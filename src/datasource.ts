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
import { FetchResponse, getBackendSrv, getTemplateSrv } from '@grafana/runtime';
import { map } from 'rxjs/operators';
import { FlespiSDK } from 'flespi-sdk';
import { REGEX_DEVICES, REGEX_ACCOUNTS, QUERY_TYPE_DEVICES, QUERY_TYPE_STATISTICS } from './constants';

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
        console.log("========= metricFindQuery()::interpolated " + interpolated);
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
        console.log(variableQueryParsed);
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

  // This function is called when you edit query or choose device in variable's selector
    query(options: DataQueryRequest<MyQuery>): Observable<DataQueryResponse> {

        const observableResponses: Array<Observable<DataQueryResponse>> = options.targets.map((query) => {

            console.log("========== query()");
            console.log(JSON.stringify(query));
            const routePath = '/flespi';

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
                    // code 
                    return new Observable<DataQueryResponse>();
                    break;
                case QUERY_TYPE_STATISTICS:
                    // query accounts statistics: expecting query parameters for accounts and statistics parameters
                    let accounts: string[], parameters: string[], accounts_labels: {[key: string]: string,} = {}
                    // prepare accounts ids
                    if (query.useAccountVariable === true) {
                        // resolve accounts ids from variable, that is stored in query.accountVariable field
                        accounts = getTemplateSrv().replace(query.accountVariable, options.scopedVars, 'csv').split(',');
                        if (accounts.length > 1) {
                            // if the are more than 1 account selected - save account's label to be diplayed on the graph
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
                                            accounts_labels[accountId.toString()] = option.text;
                                        }
                                    });
                                });
                            }
                        }
                    } else {
                        // use ids of selected accounts, that are stored in query.accountsSelected field as values
                        accounts = query.accountsSelected.map(account => {
                            if (account.value === undefined) {
                                throw new Error("Wrong account value. Account ID is expected.");
                            }
                            if (accounts.length > 1) {
                                // if the are more than 1 account selected - save account's label to be diplayed on the graph
                                accounts_labels[account.value.toString()] = account.label ? account.label : '';
                            }
                            return account.value?.toString();
                        });
                    }
                    // prepare statistics parameters
                    if (query.useStatParamVariable === true) {
                        // resolve parameters from variable, that is stored in query.statParamVariable field
                        parameters = getTemplateSrv().replace(query.statParamVariable, options.scopedVars, 'csv').split(',');
                    } else {
                        parameters = query.statParamsSelected;
                    }

                    console.log("query::statistics::accounts::" + accounts + "::parameters::" + parameters + "::");
                    
                    if (Array.isArray(accounts) && accounts.length === 0 || Array.isArray(parameters) && parameters.length === 0) {
                        // either account or parameter is not selected, return empty response
                        return new Observable<DataQueryResponse>();
                    }
                    // fetch statistics and transform it to data frame
                    const accountObservableResponses = accounts.map(account => {
                        const observableResponse = FlespiSDK.fetchFlespiAccountsStatistics(account, parameters, this.url, from, to, genFunction, genInterval)
                        .pipe(
                            map((response) => this.handleFetchDataQueryResponse(response, query.refId + ':' + account, accounts_labels[account.toString()]))
                        )
                        return observableResponse;
                    })
                    return merge(...accountObservableResponses); 

                default:
                    return new Observable<DataQueryResponse>();
            }
            

            // if (query.queryType === QUERY_TYPE_DEVICES) {
                const deviceObservableResponses = query.devicesSelected.map(device => {
                    // now fetch messages for the selected device and full data frame with values of the param
                        const requestParams = this.prepareDeviceMessagesRequestParams(options, query);
                        const observable = getBackendSrv().fetch<DataQueryResponse> ({        
                            url: this.url + routePath + `/gw/devices/${device.value}/messages?data=${requestParams}`,
                            method: 'GET',
                        }).pipe(
                            map((response) => this.handleDeviceMessagesResponse(response, query.refId + ':' + device.value, 'position.speed', device.label))
                        )

                    return observable;
                });
            return merge(...deviceObservableResponses); 
            // }


            // const routePath = '/flespi';
            // // prepare id of the entity
            // let { entity, entityLabel } = query;
            // if (entity === undefined || entity === '') {
            //   // device not yet selected
            //   throw new Error("Select device to draw a graph for");
            // }
            // // if entity contains a string - this is expected to be name of dashboard variable to resolve entity id from
            // if (typeof entity === 'string' && getTemplateSrv().containsTemplate(entity) === true) {
            //   // this is dashboard variable, resolve it to entity Id
            //   entity = parseInt(getTemplateSrv().replace(entity, options.scopedVars, "csv"), 10);
            //   // if there are several devices on one graph - find current selected variable to use it label on legend
            //   if (options.targets.length > 1) {
            //     const currentVariable = getTemplateSrv().getVariables().find(variable => {
            //       return (`$${variable.name}` === query.entity);
            //     });
            //     // JSON stringify and back is needed because of type checking, that doesn't see variable.current field in TypedVariableModel type
            //     entityLabel = JSON.parse(JSON.stringify(currentVariable)).current.text;
            //   }
            // }
            // // entity should be resolved to number (id)
            // if (typeof entity !== 'number') {
            //   throw new Error(`Wrong device ${entity}`);
            // }

            // // prepare param to be drawn on the graph
            // const param = getTemplateSrv().replace(query.param, options.scopedVars);

            // // now fetch messages for the selected device and full data frame with values of the param
            // const requestParams = this.prepareDeviceMessagesRequestParams(options, query);
            // const observable = getBackendSrv().fetch<DataQueryResponse> ({        
            //   url: this.url + routePath + `/gw/devices/${entity}/messages?data=${requestParams}`,
            //   method: 'GET',
            // }).pipe(
            //   map((response) => this.handleDeviceMessagesResponse(response, query.refId, param, (options.targets.length > 1) ? entityLabel : undefined))
            // )

            // return observable;
        });

        return merge(...observableResponses);
    }

  // prepare params for GET devices/DEVICE_ID/messages request
  // returns the string applicable to use as '?data=' URL parameter
  private prepareDeviceMessagesRequestParams(options: DataQueryRequest<MyQuery>, query: MyQuery): string {
    // prepare 'from', 'to' request params
    const { range } = options;
    const from = Math.floor(range!.from.valueOf() / 1000);
    const to = Math.ceil(range!.to.valueOf() / 1000);

    // prepare ganaralization function params 'generalize' and 'method', if needed
    let generalizationQueryParams = ''; 
    if (query.func !== undefined && (query.func === 'average' || query.func === 'minimum' || query.func === 'maximum')) {
      const intervalSec = (options.scopedVars.__interval_ms) ? options.scopedVars.__interval_ms.value / 1000 : 0;
      const maxDataPoints = options.maxDataPoints ? options.maxDataPoints : 0;
      if (intervalSec > 60 || (intervalSec !== 0 && maxDataPoints > 0 && ((to - from)/intervalSec > maxDataPoints))) {
        // apply generalization function
        const genInterval = Math.floor((to - from)/ maxDataPoints);
        generalizationQueryParams = `%2C%22generalize%22%3A${genInterval}%2C%22method%22%3A%22${query.func}%22`;  // ,"generalize":GEN_INTERVAL,"method":"GEN_FUNC"
      }
    }
    return `%7B%22from%22%3A${from}%2C%22to%22%3A${to}${generalizationQueryParams}%7D`;
  }

  // datasource's health check
  async testDatasource() {
    // select all flespi devices available for the configured token
    const flespiDevices = await FlespiSDK.fetchAllFlespiDevices(this.url);
    return {
      status: 'success',
      message: `Success! Found ${flespiDevices.length} devices for the configured Flespi Token`,
    };
  }

  // processes devices messages response and packes data points into data frame
  // param: name of the parameter that is extracted from device's messages and put into data frame
  // labels: name of the device to be displayed together with param name on the graph's legend (needed when two or mode devices are dronw on one graph)
  private handleDeviceMessagesResponse(response: FetchResponse, refId: string, param: string, labels?: string): DataQueryResponse {
    if (response.status !== 200) {
      throw new Error(`Unexpected HTTP Response: ${response.status} - ${response.statusText}`);
    }

    console.log("-------------------");
    console.log(response);

    const frame = new MutableDataFrame({
      refId: refId,
      fields: [
        { name: 'time', type: FieldType.time },
        { name: param, type: FieldType.number, labels: (labels !== undefined) ? {device: `[${labels}]`} : undefined },
      ],
    })

    const messages = response.data.result;
    const messageCount = messages.length;
    for (let i = 0; i < messageCount; i++) {
      const message = messages[i];
      if (message[param] !== undefined) {
        frame.add({ time: message["timestamp"] * 1000, [param]: message[param] });
      }
    }
    return { data: [frame] };
  }

    private handleFetchDataQueryResponse(response: FetchResponse, refId: string, labels?: string): DataQueryResponse {
        console.log("============== handleFetchDataQueryResponse");
        console.log(response.data);

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
            frame.addField({
                name: fieldName,
                type: FieldType.number,
                values: parametersValues[fieldName],
                labels: (labels !== undefined) ? {item: `[${labels}]`} : undefined,
            });
        });

        return { data: [frame] };
    }
}
