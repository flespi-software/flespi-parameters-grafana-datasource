import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  MutableDataFrame,
  FieldType,
  MetricFindValue,
  ScopedVar,
  SelectableValue,
} from '@grafana/data';

import { Observable, merge } from 'rxjs';
import { MyQuery, MyDataSourceOptions } from './types';
import { FetchResponse, getTemplateSrv } from '@grafana/runtime';
import { map } from 'rxjs/operators';
import { FlespiSDK } from 'flespi-sdk';
import { REGEX_DEVICES, REGEX_ACCOUNTS, REGEX_CONTAINERS, QUERY_TYPE_DEVICES, QUERY_TYPE_STATISTICS, QUERY_TYPE_CONTAINERS, QUERY_TYPE_INTERVALS, tempBackwardCompatibilityConversion, LOGS_SOURCE_DEVICE, VARIABLES_QUERY_STREAMS, QUERY_TYPE_LOGS, LOGS_SOURCE_STREAM, REGEX_CALCULATORS } from './constants';
import { decode } from "@googlemaps/polyline-codec";

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
    // the following fields are used if queryType === QUERY_TYPE_LOGS
    logsSourceType: LOGS_SOURCE_DEVICE,                              
    useLogsSourceVariable: false,
    logsSourcesSelected: [],
    logsSourceVariable: '',
    useLogsParamVariable: false,
    logsParamsSelected: [],
    logsParamVariable: '',
    // - // the following fields are used if queryType === QUERY_TYPE_CONTAINERS             
    useContainerVariable: false,
    containersSelected: [],
    containerVariable: '',
    useContParamVariable: false,
    contParamsSelected: [],
    contParamVariable: '',
    // - // the following fields are used if queryTypr === QUERY_TYPE_INTERVALS
    useCalculatorVariable: false,
    calculatorSelected: {},
    calculatorVariable: '',
    useCalcDeviceVariable: false,
    calcDevicesSelected: [],
    calcDeviceVariable: '',
    intParamsSelected: [],
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
        if (query.trim() === VARIABLES_QUERY_STREAMS) {
            // this is streams variable
            return (await FlespiSDK .fetchAllFlespiStreams(this.url)).map(stream => {
                console.log(stream);
                const steamName = stream.name !== '' ? stream.name.replace(/\./g,'_') : '<noname>';
                return {
                    text: `#${stream.id} - ${steamName}`,
                    value: stream.id,
                }
            });
        }
        const interpolated = getTemplateSrv().replace(query.trim(), options.scopedVars, 'csv');
        let variableQueryParsed = interpolated.match(REGEX_DEVICES);
        if (variableQueryParsed !== null) {
            // this is devices variable
            if (variableQueryParsed[0] === 'devices.*') {
                // this is variable query 'devices.*' - return all flespi devices available for the token
                return (await FlespiSDK.fetchAllFlespiDevices(this.url)).map(device => {
                    const deviceName = device.name !== '' ? device.name.replace(/\./g,'_') : '<noname>';
                    return {
                        text: `#${device.id} - ${deviceName}`,
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
            // this is accounts variable
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

        variableQueryParsed = interpolated.match(REGEX_CONTAINERS);
        if (variableQueryParsed !== null) {
            // this is container variable
            if (variableQueryParsed[0] === 'containers.*') {
                // this is variable query 'containers.*' - return all flespi containers available for the token
                return (await FlespiSDK.fetchAllFlespiContainers(this.url)).map(container => {
                    const containerName = container.name !== '' ? container.name.replace(/\./g,'_') : '<noname>';
                    return {
                        text: `#${container.id} - ${containerName}`,
                        value: container.id,
                    }
                });
            } else {
                // this is variable query 'containers.<container_id>.parameters.*'
                // container id is in the 3 array element of the parsed query
                const containerId = parseInt(variableQueryParsed[3], 10);
                const containerParameters = await FlespiSDK.fetchFlespiContainerParameters(containerId, this.url, '');
                // transform returned parameters to the required format [{'text': 'param.1'}, {'text':'param.2'}]
                return containerParameters.map((param) => { 
                    return { text: param };
                });
            }
        }

        variableQueryParsed = interpolated.match(REGEX_CALCULATORS);
        if (variableQueryParsed != null) {
            if (variableQueryParsed[0] === 'calculators.*') {
                // this is variable query 'calculators.*' - return all flespi calculators available for the token
                return (await FlespiSDK.fetchAllFlespiCalculators(this.url)).map(calculator => {
                    const calculatorName = calculator.name !== '' ? calculator.name.replace(/\./g,'_') : '<noname>';
                    return {
                        text: `#${calculator.id} - ${calculatorName}`,
                        value: calculator.id,
                    }
                });
            } else if (variableQueryParsed[0].endsWith('.devices.*')) {
                // this is variable query 'calculators.1685993.devices.*' - return devices assigned to calculator
                const calculatorId = parseInt(variableQueryParsed[3], 10);
                return (await FlespiSDK.fetchFlespiDevicesAssignedToCalculator(calculatorId, this.url)).map(device => {
                    const deviceName = device.name !== '' ? device.name.replace(/\./g,'_') : '<noname>';
                    return {
                        text: `#${device.id} - ${deviceName}`,
                        value: device.id,
                    }
                });               
            } else {
                // this is variable query 'calculators.1685993.devices.5486936.parameters.*' - return intervals' parameters
                const calculatorId = parseInt(variableQueryParsed[5], 10);
                const deviceId = parseInt(variableQueryParsed[6], 10);
                const intervalParams = await FlespiSDK.fetchLastFlespiInterval(calculatorId, deviceId, this.url);
                // transform returned parameters to the required format [{'text': 'param.1'}, {'text':'param.2'}]
                return intervalParams.map((param) => { 
                    return { text: param };
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
        const flespiStreams = await FlespiSDK.fetchAllFlespiStreams(this.url);        
        return {
            status: 'success',
            message: `Success! The configured token has access to ${flespiDevices.length} flespi devices, ${flespiStreams.length} streams, account ID ${flespiAccount[0].id} and ${flespiSubaccounts.length} subaccounts.`,
        };
    }

    // This function is called when you edit query or choose device in variable's selector
    query(options: DataQueryRequest<MyQuery>): Observable<DataQueryResponse> {

        console.log(options);

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
                    let devices: string[], telemParameters: string[], devicesLabels: {[key: string]: string,} = {};
                    if (query.useDeviceVariable === true) {
                        // resolve devices' ids from variable, that is stored in query.deviceVariable field
                        devices = getTemplateSrv().replace(query.deviceVariable, options.scopedVars, 'csv').split(',');
                        // save device's label to be displayed on the graph
                        this.prepareItemsLabelsFromVariableOptions(query.deviceVariable, devices, devicesLabels);
                    } else {
                        // use ids of selected devices, that are stored in query.devicesSelected field
                        devices = this.prepareItemsAndLabelsFromSelectedOptions(query.devicesSelected, devicesLabels);
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
                    });
                    return merge(...deviceObservableResponses); 

                case QUERY_TYPE_STATISTICS:
                    // query accounts statistics: expecting query parameters for accounts and statistics parameters
                    let accounts: string[], statParameters: string[], accountsLabels: {[key: string]: string,} = {}
                    // prepare accounts ids
                    if (query.useAccountVariable === true) {
                        // resolve accounts ids from variable, that is stored in query.accountVariable field
                        accounts = getTemplateSrv().replace(query.accountVariable, options.scopedVars, 'csv').split(',');
                        // save account's label to be diplayed on the graph
                        this.prepareItemsLabelsFromVariableOptions(query.accountVariable, accounts, accountsLabels);
                    } else {
                        // use ids of selected accounts, that are stored in query.accountsSelected field as values
                        accounts = this.prepareItemsAndLabelsFromSelectedOptions(query.accountsSelected, accountsLabels);
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

                case QUERY_TYPE_LOGS:
                    // prepare logs parameters
                    let logParameters: string[];
                    if (query.useLogsParamVariable === true) {
                        // resolve parameters from variable, that is stored in query.logsParamVariable field
                        logParameters = getTemplateSrv().replace(query.logsParamVariable, options.scopedVars, 'csv').split(',');
                    } else {
                        logParameters = query.logsParamsSelected;
                    }
                    switch (query.logsSourceType) {
                        case LOGS_SOURCE_DEVICE:
                            let devices: string[], devicesLabels: {[key: string]: string,} = {};
                            if (query.useLogsSourceVariable === true) {
                                // resolve devices from variable that is stored in variable query.logsSourceVariable
                                devices = getTemplateSrv().replace(query.logsSourceVariable, options.scopedVars, 'csv').split(',');
                                // prepare devices labels to be displayed later on the graph 
                                this.prepareItemsLabelsFromVariableOptions(query.logsSourceVariable, devices, devicesLabels);                   
                            } else {
                                // use ids of selected streams, that are stored in query.logsSourcesSelected field
                                devices = this.prepareItemsAndLabelsFromSelectedOptions(query.logsSourcesSelected, devicesLabels);
                            }
                            console.log("query::logs::devices::" + devices + "::parameters::" + logParameters + "::");
                            // fetch device's logs and transform it to data frame
                            const deviceObservableResponses = devices.map(device => {
                                const observableResponse = FlespiSDK.fetchFlespiDevicesLogs(device, logParameters, this.url, from, to)
                                .pipe(
                                    map((response) => this.handleFetchDataQueryResponse(response, query.refId + ':' + device, (devices.length > 1 || options.targets.length > 1) ? devicesLabels[device.toString()] : undefined))
                                )
                                return observableResponse;
                            });
                            return merge(...deviceObservableResponses); 

                        case LOGS_SOURCE_STREAM:
                            let streams: string[], streamsLabels: {[key: string]: string,} = {};
                            if (query.useLogsSourceVariable === true) {
                                // resolve streams from variable that is stored in variable query.logsSourceVariable
                                streams = getTemplateSrv().replace(query.logsSourceVariable, options.scopedVars, 'csv').split(',');
                                // prepare streams labels to be displayed later on the graph 
                                this.prepareItemsLabelsFromVariableOptions(query.logsSourceVariable, streams, streamsLabels);                
                            } else {
                                // use ids of selected streams, that are stored in query.logsSourcesSelected field
                                streams = this.prepareItemsAndLabelsFromSelectedOptions(query.logsSourcesSelected, streamsLabels);
                            }
                            console.log("query::logs::streams::" + streams + "::parameters::" + logParameters + "::");
                            // fetch stream's logs and transform it to data frame
                            const streamObservableResponses = streams.map(stream => {
                                const observableResponse = FlespiSDK.fetchFlespiStreamsLogs(stream, logParameters, this.url, from, to)
                                .pipe(
                                    map((response) => this.handleFetchDataQueryResponse(response, query.refId + ':' + stream, (streams.length > 1 || options.targets.length > 1) ? streamsLabels[stream.toString()] : undefined))
                                )
                                return observableResponse;
                            });
                            return merge(...streamObservableResponses); 
                            
                        default:
                            return new Observable<DataQueryResponse>();
                    }

                case QUERY_TYPE_CONTAINERS:
                    let containers: string[], contParameters: string[], containersLabels: {[key: string]: string,} = {};
                    if (query.useContainerVariable === true) {
                        // resolve container's ids from variable, that is stored in query.containerVariable field
                        containers = getTemplateSrv().replace(query.containerVariable, options.scopedVars, 'csv').split(',');
                        // save containers' labels to be displayed on the graph's legend
                        this.prepareItemsLabelsFromVariableOptions(query.containerVariable, containers, containersLabels);
                    } else {
                        containers = this.prepareItemsAndLabelsFromSelectedOptions(query.containersSelected, containersLabels);
                    }
                    // prepare container parameters
                    if (query.useContParamVariable === true) {
                        // resolve parameters from variable, that is stored in query.contParamVariable field
                        contParameters = getTemplateSrv().replace(query.contParamVariable, options.scopedVars, 'csv').split(',');
                    } else {
                        contParameters = query.contParamsSelected;
                    }
                    console.log("query::containers::" + containers + "::parameters::" + contParameters + "::");
                    // fetch container messages and transform it to data frame
                    const containerObservableResponses = containers.map(container => {
                        const observableResponse = FlespiSDK.fetchFlespiContainersMessages(container, contParameters, this.url, from, to, genFunction, genInterval)
                        .pipe(
                            map((response) => this.handleFetchDataQueryResponse(response, query.refId + ':' + container, (containers.length > 1 || options.targets.length > 1) ? containersLabels[container.toString()] : undefined))
                        )
                        return observableResponse;
                    });
                    return merge(...containerObservableResponses); 

                case QUERY_TYPE_INTERVALS:
                    const calcId = query.calculatorSelected.value ? query.calculatorSelected.value : 0;
                    const deviceId = query.calcDevicesSelected[0].value ? query.calcDevicesSelected[0].value : 0;
                    console.log("query::intervals::calcId::" + calcId + "::deviceId::" + deviceId + "::");
                    const observableResponse = FlespiSDK.fetchFlespiIntervals(calcId, deviceId, this.url, from, to)
                    .pipe(
                        map((response) => this.handleFetchIntervals(response, query.refId))
                    )
                    return observableResponse;

                default:
                    return new Observable<DataQueryResponse>();
            }
        });

        return merge(...observableResponses);
    }

    private prepareItemsAndLabelsFromSelectedOptions(itemsSelected: Array<SelectableValue<number>>, itemsLabels: {[key: string]: string}) {
        return itemsSelected.map(item => {
            if (item.value === undefined) {
                throw new Error("Wrong item value. Item ID is expected.");
            }
            itemsLabels[item.value.toString()] = item.label ? item.label : '';
            return item.value?.toString();
        });   
    }

    private prepareItemsLabelsFromVariableOptions(variableName: string, items: string[], itemsLabels: {[key: string]: string}) {
        // find dashoard variable with given name
        const currentVariable = getTemplateSrv().getVariables().find(variable => {
            return (`$${variable.name}` === variableName);
        });
        if (currentVariable !== undefined) {
            // get variable options
            const options: Array<ScopedVar<string>> = JSON.parse(JSON.stringify(currentVariable)).options;
            // iterate flespi items ids and find corresponding variable's option
            items.map(itemId => {
                options.find(option  => {
                    const optionItemId = option.value.split(':')[0];
                    if (optionItemId === itemId) {
                        // corresponding option is found - store its text for future use in graphs legend as a label
                        itemsLabels[itemId.toString()] = option.text;
                    }
                });
            });
        }
    }

    private handleFetchIntervals(response: FetchResponse, refId: string, labels?: string): DataQueryResponse {
        console.log("==============handleFetchIntervals()");

        // array to collect timestamps values for data frame, format:
        // [ 1705074821000, 1705074831000, 1705074841000 ]
        // const timeValues = [];
        // const paramValues = [];
        const latValues = [];
        const lonValues = [];
        // const param = 'namo_mileage';
        const intervals = response.data.result;
        const intervalsCount = intervals.length;
        if (intervalsCount === 0) {
            return { data: [] };
        }
        for (let i = 0; i < intervalsCount; i++) {
            let interval: any = intervals[i];
            // timeValues.push(interval.begin * 1000);
            // paramValues.push(interval[param]);
            // timeValues.push(interval.end * 1000);
            // paramValues.push(null);



            const encoded = interval.namo_route;
            const decodedRoute = decode(encoded, 5);

            for (let ii = 0; ii < decodedRoute.length; ii++) {
                const point = decodedRoute[ii];
                latValues.push(point[0]);
                lonValues.push(point[1]);
            }
            // [
            //   [38.5, -120.2],
            //   [40.7, -120.95],
            //   [43.252, -126.453],
            // ]

            console.log(interval);
            break;
        }

        // Now create a data frame from collected values
        // const frame = new MutableDataFrame({
        //     refId: refId,
        //     fields: [
        //         { name: 'Time', type: FieldType.time, values: timeValues },
        //     ],
        // });
        const frame = new MutableDataFrame({
            refId: refId,
            fields: [
                { name: 'lat', type: FieldType.number, values: latValues },
            ],
        });
        // frame.addField({
        //     name: 'lat',
        //     type: FieldType.number,
        //     values: latValues,
        //     labels: (labels !== undefined) ? {item: `[${labels}]`} : undefined,
        // });
        frame.addField({
            name: 'lon',
            type: FieldType.number,
            values: lonValues,
            labels: (labels !== undefined) ? {item: `[${labels}]`} : undefined,
        });

        return { data: [frame] };
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
        if (messagesCount === 0) {
            return { data: [] };
        }
        for (let i = 0; i < messagesCount; i++) {
            let message: any = messages[i];
            if (message.key !== undefined && message.params !== undefined) {
                message = message.params;
            }
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
