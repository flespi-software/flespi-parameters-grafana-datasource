import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  MutableDataFrame,
  FieldType,
  MetricFindValue,
  ScopedVar,
} from '@grafana/data';

import { Observable, merge } from 'rxjs';
import { MyQuery, MyDataSourceOptions } from './types';
import { FetchResponse, getTemplateSrv } from '@grafana/runtime';
import { map } from 'rxjs/operators';
import { FlespiSDK } from 'flespi-sdk';
import { REGEX_DEVICES, REGEX_ACCOUNTS, QUERY_TYPE_DEVICES, QUERY_TYPE_STATISTICS, tempBackwardCompatibilityConversion } from './constants';

// default query values
export const defaultQuery: Partial<MyQuery> = {
  queryType: QUERY_TYPE_DEVICES,
  // queryType === QUERY_TYPE_DEVICES: query devices' messages' parameters (telemetry)
  useDeviceVariable: false,
  devicesSelected: [],
  deviceVariable: '',
  useTelemParamVariable: false,
  telemParamsSelected: ['position.speed'],
  telemParamVariable: '',
  // queryType = statistics: query account's statistics parameters
  useAccountVariable: false,
  accountsSelected: [],
  accountVariable: '',
  useStatParamVariable: false,
  statParamsSelected: ['*_storage'],
  statParamVariable: '',
  // used for both queryType === QUERY_TYPE_DEVICES and queryType === QUERY_TYPE_STATISTICS
  generalizationFunction: "average",
};

export class DataSource extends DataSourceApi<MyQuery, MyDataSourceOptions> {
    url: string;

    constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
        super(instanceSettings);

        this.url = instanceSettings.url ? instanceSettings.url : '';
    }

    // This function is called when you hit 'Run query' button for dashboard variable with type query
    // And to resolve possible values of Device and Parameter of variables selects
    async metricFindQuery(query: string, options?: any): Promise<MetricFindValue[]> {
        const interpolated = getTemplateSrv().replace(query.trim(), options.scopedVars, 'csv');
        let variableQueryParsed = interpolated.match(REGEX_DEVICES);
        if (variableQueryParsed !== null) {
            // this is devices variable
            if (variableQueryParsed[0] === 'devices.*') {
                // this is variable query 'devices.*' - return all flespi devices available for the token
                return (await FlespiSDK.fetchAllFlespiDevices(this.url)).map(device => {
                    return {
                        text: `#${device.id} - ${device.name.replace(/\./g,'_')}`,
                        value: device.id,
                    }
                });
            } else {
                // this is variable query 'devices.#device_id - device_name.parameters.*'
                // device id is in the 3 array element of the parsed query
                const deviceId = variableQueryParsed[3];
                const deviceTelemetryParams = await FlespiSDK.fetchDeviceTelemetryParameters(parseInt(deviceId, 10), this.url);
                // transform returned parameters to the required format [{'text': 'param.1'}, {'text':'param.2'}]
                return deviceTelemetryParams.map((param) => { 
                    return { text: param };
                });
            }
        }
        variableQueryParsed = interpolated.match(REGEX_ACCOUNTS);
        if (variableQueryParsed !== null) {
            // this is devices variable
            if (variableQueryParsed[0] === 'accounts.*') {
                // this is variable query 'accounts.*' - return all flespi accounts and subaccounts available for the token
                const accounts = await Promise.all([
                    FlespiSDK.fetchFlespiAccount(this.url),
                    FlespiSDK.fetchAllFlespiSubaccounts(this.url)
                ]);
                return (await Promise.all(accounts))
                    .flat()
                    .map(account => {
                        return {
                            text: `#${account.id} - ${account.name.replace(/\./g,'_')}`,
                            value: account.id,
                        }
                    });
            } else {
                // this is variable query 'accounts.#account_id - account_name.statistics.*'
                // account id is in the 3 array element of the parsed query
                const accountId = variableQueryParsed[3];
                // all statistics parameters are the same for all accounts that's why it's enough to make just one request
                // for the first account to get the list of statistics parameters
                const accountStatisticsParams = await FlespiSDK.fetchFlespiStatisticsParametersForAccount(parseInt(accountId, 10), this.url);
                // transform returned parameters to the required format [{'text': 'param.1'}, {'text':'param.2'}]
                return accountStatisticsParams.map((parameter) => { 
                    return { text: parameter };
                });
            }
        }  

        // wrong variable query
        return Promise.resolve([]);
    }

    // datasource's health check
    async testDatasource() {
        // select all flespi devices available for the configured token
        const flespiDevices = await FlespiSDK.fetchAllFlespiDevices(this.url);
        const flespiAccount = await FlespiSDK.fetchFlespiAccount(this.url);
        const flespiSubaccounts = await FlespiSDK.fetchAllFlespiSubaccounts(this.url);        
        return {
            status: 'success',
            message: `Success! The configured token has access to ${flespiDevices.length} flespi devices, account ID ${flespiAccount[0].id} and ${flespiSubaccounts.length} subaccounts.`,
        };
    }

    // This function is called when you edit query or choose device in variable's selector
    query(options: DataQueryRequest<MyQuery>): Observable<DataQueryResponse> {

        const observableResponses: Array<Observable<DataQueryResponse>> = options.targets.map((query) => {

            console.log("========== query()");
            console.log(JSON.stringify(query));

            // apply backward compatibility conversion, if needed
            tempBackwardCompatibilityConversion(query);

            // prepare time range parameters for query
            const { range } = options;
            const from = Math.floor(range!.from.valueOf() / 1000);
            const to = Math.ceil(range!.to.valueOf() / 1000);
        
            // prepare ganaralization function params 'generalize' and 'method', if needed
            const genFunction = query.generalizationFunction;
            let genInterval: number | undefined;
            if (genFunction !== undefined && (genFunction === 'average' || genFunction === 'minimum' || genFunction === 'maximum')) {
                const intervalSec = (options.scopedVars.__interval_ms) ? options.scopedVars.__interval_ms.value / 1000 : 0;
                const maxDataPoints = options.maxDataPoints ? options.maxDataPoints : 0;
                if (intervalSec > 60 || (intervalSec !== 0 && maxDataPoints > 0 && ((to - from)/intervalSec > maxDataPoints))) {
                    // apply generalization function
                    genInterval = Math.floor((to - from)/ maxDataPoints);
                }
            }

            // determine the type of query to perform
            switch(query.queryType) {
                case QUERY_TYPE_DEVICES:
                    let devices: string[], telemParameters: string[], devicesLabels: {[key: string]: string,} = {}
                    if (query.useDeviceVariable === true) {
                        // resolve accounts ids from variable, that is stored in query.accountVariable field
                        devices = getTemplateSrv().replace(query.deviceVariable, options.scopedVars, 'csv').split(',');
                        // save device's label to be diplayed on the graph
                        const currentVariable = getTemplateSrv().getVariables().find(variable => {
                            return (`$${variable.name}` === query.deviceVariable);
                        });
                        if (currentVariable !== undefined) {
                            // get variable options and find corresponding option by account id
                            const options: Array<ScopedVar<string>> = JSON.parse(JSON.stringify(currentVariable)).options;
                            devices.map(deviceId => {
                                options.find(option  => {
                                    const optionDeviceId = option.value.split(':')[0];
                                    if (optionDeviceId === deviceId) {
                                        devicesLabels[deviceId.toString()] = option.text;
                                    }
                                });
                            });
                        }
                    } else {
                        // use ids of selected devices, that are stored in query.devicesSelected field
                        devices = query.devicesSelected.map(device => {
                            if (device.value === undefined) {
                                throw new Error("Wrong device value. Device ID is expected.");
                            }
                            devicesLabels[device.value.toString()] = device.label ? device.label : '';
                            return device.value?.toString();
                        });
                    }
                    // prepare telemetry parameters
                    if (query.useTelemParamVariable === true) {
                        // resolve parameters from variable, that is stored in query.telemParamVariable field
                        telemParameters = getTemplateSrv().replace(query.telemParamVariable, options.scopedVars, 'csv').split(',');
                    } else {
                        telemParameters = query.telemParamsSelected;
                    }
                    console.log("query::devices::" + devices + "::parameters::" + telemParameters + "::");
                    // fetch device messages and transform it to data frame
                    const deviceObservableResponses = devices.map(device => {
                        const observableResponse = FlespiSDK.fetchFlespiDevicesMessages(device, telemParameters, this.url, from, to, genFunction, genInterval)
                        .pipe(
                            map((response) => this.handleFetchDataQueryResponse(response, query.refId + ':' + device, (devices.length > 1 || options.targets.length > 1) ? devicesLabels[device.toString()] : undefined))
                        )
                        return observableResponse;
                    })
                    return merge(...deviceObservableResponses); 

                case QUERY_TYPE_STATISTICS:
                    // query accounts statistics: expecting query parameters for accounts and statistics parameters
                    let accounts: string[], statParameters: string[], accountsLabels: {[key: string]: string,} = {}
                    // prepare accounts ids
                    if (query.useAccountVariable === true) {
                        // resolve accounts ids from variable, that is stored in query.accountVariable field
                        accounts = getTemplateSrv().replace(query.accountVariable, options.scopedVars, 'csv').split(',');
                        // save account's label to be diplayed on the graph
                        const currentVariable = getTemplateSrv().getVariables().find(variable => {
                            return (`$${variable.name}` === query.accountVariable);
                        });
                        if (currentVariable !== undefined) {
                            // get variable options and find corresponding option by account id
                            const options: Array<ScopedVar<string>> = JSON.parse(JSON.stringify(currentVariable)).options;
                            accounts.map(accountId => {
                                options.find(option  => {
                                    const optionAccountId = option.value.split(':')[0];
                                    if (optionAccountId === accountId) {
                                        accountsLabels[accountId.toString()] = option.text;
                                    }
                                });
                            });
                        }
                    } else {
                        // use ids of selected accounts, that are stored in query.accountsSelected field as values
                        accounts = query.accountsSelected.map(account => {
                            if (account.value === undefined) {
                                throw new Error("Wrong account value. Account ID is expected.");
                            }
                            accountsLabels[account.value.toString()] = account.label ? account.label : '';
                            return account.value?.toString();
                        });
                    }
                    // prepare statistics parameters
                    if (query.useStatParamVariable === true) {
                        // resolve parameters from variable, that is stored in query.statParamVariable field
                        statParameters = getTemplateSrv().replace(query.statParamVariable, options.scopedVars, 'csv').split(',');
                    } else {
                        statParameters = query.statParamsSelected;
                    }

                    console.log("query::statistics::accounts::" + accounts + "::parameters::" + statParameters + "::");
                    
                    if (Array.isArray(accounts) && accounts.length === 0 || Array.isArray(statParameters) && statParameters.length === 0) {
                        // either account or parameter is not selected, return empty response
                        return new Observable<DataQueryResponse>();
                    }
                    // fetch statistics and transform it to data frame
                    const accountObservableResponses = accounts.map(account => {
                        const observableResponse = FlespiSDK.fetchFlespiAccountsStatistics(account, statParameters, this.url, from, to, genFunction, genInterval)
                        .pipe(
                            map((response) => this.handleFetchDataQueryResponse(response, query.refId + ':' + account, (accounts.length > 1 || options.targets.length > 1) ? accountsLabels[account.toString()] : undefined))
                        )
                        return observableResponse;
                    })
                    return merge(...accountObservableResponses); 

                default:
                    return new Observable<DataQueryResponse>();
            }
        });

        return merge(...observableResponses);
    }

    private handleFetchDataQueryResponse(response: FetchResponse, refId: string, labels?: string): DataQueryResponse {
        // array to collect timestamps values for data frame, format:
        // [ 1705074821000, 1705074831000, 1705074841000 ]
        const timeValues = [];
        // object with arrays of parameters' values for data frame, format:
        // {
        //   param_one: [ 11, 13, 18 ],
        //   param_two: [ 25, 28, null ],
        //   param_three: [ null, 40, 44 ]
        // }
        const parametersValues: any = {};
        // helper array to keep a set of parameters' names discovered in the returned messages
        const knownParameters: string[] = [];
        // helper variable to keep track of the number of values added into arrays
        let valuesArrayLength = 0;

        // iterate over returned container messages
        const messages = response.data.result;
        const messagesCount = messages.length;
        for (let i = 0; i < messagesCount; i++) {
            const message: any = messages[i];
            // collect time value for data frame
            let { timestamp, ...messageRest } = message;
            const time = timestamp ? timestamp * 1000 : message.key * 1000;
            timeValues.push(time);

            // iterate over known parameters names and push all known parameter's values to corresponding array
            for (let ii = 0; ii < knownParameters.length; ii++) {
                const parameterName = knownParameters[ii];
                parametersValues[parameterName].push(messageRest[parameterName] !== undefined ? messageRest[parameterName] : null);
                // delete processed parameter from message
                delete messageRest[parameterName];
            }
            // process the rest message parameters, that are known so far
            Object.keys(messageRest).map(parameterName => {
                // create corresponding array and push parameter's value into it, padding with required number of nulls
                const parameterValue = messageRest[parameterName];
                parametersValues[parameterName] = [];
                for (let iii = 0; iii < valuesArrayLength; iii++){
                    parametersValues[parameterName].push(null);
                }
                parametersValues[parameterName].push(parameterValue);
                // save parameter name in the set
                knownParameters.push(parameterName);
            });
            // we've processed one message - increament the number of stored values
            valuesArrayLength++;
        }

        // Now create a data frame from collected values
        const frame = new MutableDataFrame({
            refId: refId,
            fields: [
                { name: 'Time', type: FieldType.time, values: timeValues },
            ],
        })
        Object.keys(parametersValues).map(fieldName => {
            let fieldType: FieldType;
            switch (typeof parametersValues[fieldName][0]) {
                case "number":
                    fieldType = FieldType.number;
                    break;
                case "string":
                    fieldType = FieldType.string;
                    break;
                case "boolean":
                    fieldType = FieldType.boolean;
                    break;
                default:
                    fieldType = FieldType.other;
                    break;
            }
            frame.addField({
                name: fieldName,
                type: fieldType,
                values: parametersValues[fieldName],
                labels: (labels !== undefined) ? {item: `[${labels}]`} : undefined,
            });
        });

        return { data: [frame] };
    }
}
