import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  MutableDataFrame,
  FieldType,
  MetricFindValue,
} from '@grafana/data';

import { Observable, merge } from 'rxjs';
import { MyQuery, MyDataSourceOptions } from './types';
import { FetchResponse, getTemplateSrv } from '@grafana/runtime';
import { map } from 'rxjs/operators';
import { FlespiSDK } from 'flespi-sdk';
import { REGEX_DEVICES, REGEX_ACCOUNTS, REGEX_CONTAINERS, QUERY_TYPE_DEVICES, QUERY_TYPE_STATISTICS, QUERY_TYPE_CONTAINERS, QUERY_TYPE_INTERVALS, tempBackwardCompatibilityConversion, LOGS_SOURCE_DEVICE, VARIABLES_QUERY_STREAMS, QUERY_TYPE_LOGS, LOGS_SOURCE_STREAM, REGEX_CALCULATORS } from './constants';
import { decode } from "@googlemaps/polyline-codec";
import { handleFetchDataQueryResponse, prepareItemsAndLabelsFromSelectedOptions, prepareItemsAndLabelsFromVariable, prepareVariableOption } from 'utils';

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
    // used for both queryType === QUERY_TYPE_DEVICES, queryType === QUERY_TYPE_STATISTICS and queryType === QUERY_TYPE_CONTAINERS
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
            return (await FlespiSDK .fetchAllFlespiStreams(this.url)).map(stream => (prepareVariableOption(stream.name, stream.id)));
        }
        const interpolated = getTemplateSrv().replace(query.trim(), options.scopedVars, 'csv');
        let variableQueryParsed = interpolated.match(REGEX_DEVICES);
        if (variableQueryParsed !== null) {
            // this is devices variable
            if (variableQueryParsed[0] === 'devices.*') {
                // this is variable query 'devices.*' - return all flespi devices available for the token
                return (await FlespiSDK.fetchAllFlespiDevices(this.url)).map(device => (prepareVariableOption(device.name, device.id)));
            } else {
                // this is variable query 'devices.#device_id - device_name.parameters.*'
                // device id is in the 3 array element of the parsed query
                const deviceId = parseInt(variableQueryParsed[3], 10);
                // fetch and transform returned parameters to the required format [{'text': 'param.1'}, {'text':'param.2'}]
                return (await FlespiSDK.fetchDeviceTelemetryParameters(deviceId, this.url)).map((parameter: string) => ({ text: parameter }));
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
                    .map(account => (prepareVariableOption(account.name, account.id)));
            } else {
                // this is variable query 'accounts.#account_id - account_name.statistics.*'
                // account id is in the 3 array element of the parsed query
                const accountId = parseInt(variableQueryParsed[3], 10);
                // all statistics parameters are the same for all accounts that's why it's enough to make just one request
                // for the first account to get the list of statistics parameters
                // and transform returned parameters to the required format [{'text': 'param.1'}, {'text':'param.2'}]
                return (await FlespiSDK.fetchFlespiStatisticsParametersForAccount(accountId, this.url)).map((parameter: string) => ({ text: parameter }));
            }
        }  

        variableQueryParsed = interpolated.match(REGEX_CONTAINERS);
        if (variableQueryParsed !== null) {
            // this is container variable
            if (variableQueryParsed[0] === 'containers.*') {
                // this is variable query 'containers.*' - return all flespi containers available for the token
                return (await FlespiSDK.fetchAllFlespiContainers(this.url)).map(container => (prepareVariableOption(container.name, container.id)));
            } else {
                // this is variable query 'containers.<container_id>.parameters.*'
                // container id is in the 3 array element of the parsed query
                const containerId = parseInt(variableQueryParsed[3], 10);
                // fetch and transform returned parameters to the required format [{'text': 'param.1'}, {'text':'param.2'}]
                return (await FlespiSDK.fetchFlespiContainerParameters(containerId, this.url, '')).map((parameter: string) => ({ text: parameter }));
            }
        }

        variableQueryParsed = interpolated.match(REGEX_CALCULATORS);
        if (variableQueryParsed != null) {
            if (variableQueryParsed[0] === 'calculators.*') {
                // this is variable query 'calculators.*' - return all flespi calculators available for the token
                return (await FlespiSDK.fetchAllFlespiCalculators(this.url)).map(calculator => (prepareVariableOption(calculator.name, calculator.id)));
            } else if (variableQueryParsed[0].endsWith('.devices.*')) {
                // this is variable query 'calculators.1685993.devices.*' - return devices assigned to calculator
                const calculatorId = parseInt(variableQueryParsed[3], 10);
                return (await FlespiSDK.fetchFlespiDevicesAssignedToCalculator(calculatorId, this.url)).map(device => (prepareVariableOption(device.name, device.id)));               
            } else {
                // this is variable query 'calculators.1685993.devices.5486936.parameters.*' - return intervals' parameters
                const calculatorId = parseInt(variableQueryParsed[5], 10);
                const deviceId = parseInt(variableQueryParsed[6], 10);
                // fetch and transform returned parameters to the required format [{'text': 'param.1'}, {'text':'param.2'}]
                return (await FlespiSDK.fetchLastFlespiInterval(calculatorId, deviceId, this.url)).map((parameter: string) => ({ text: parameter }));
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
                        // resolve devices' ids from variable, that is stored in query.deviceVariable field and save device's label to be displayed on the graph
                        devices = prepareItemsAndLabelsFromVariable(query.deviceVariable, options.scopedVars, devicesLabels);
                    } else {
                        // use ids of selected devices, that are stored in query.devicesSelected field
                        devices = prepareItemsAndLabelsFromSelectedOptions(query.devicesSelected, devicesLabels);
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
                            map((response) => handleFetchDataQueryResponse(response, query.refId + ':' + device, (devices.length > 1 || options.targets.length > 1) ? devicesLabels[device.toString()] : undefined))
                        )
                        return observableResponse;
                    });
                    return merge(...deviceObservableResponses); 

                case QUERY_TYPE_STATISTICS:
                    // query accounts statistics: expecting query parameters for accounts and statistics parameters
                    let accounts: string[], statParameters: string[], accountsLabels: {[key: string]: string,} = {}
                    // prepare accounts ids
                    if (query.useAccountVariable === true) {
                        // resolve accounts ids from variable, that is stored in query.accountVariable field and save account's label to be diplayed on the graph
                        accounts = prepareItemsAndLabelsFromVariable(query.accountVariable, options.scopedVars, accountsLabels);
                    } else {
                        // use ids of selected accounts, that are stored in query.accountsSelected field as values
                        accounts = prepareItemsAndLabelsFromSelectedOptions(query.accountsSelected, accountsLabels);
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
                            map((response) => handleFetchDataQueryResponse(response, query.refId + ':' + account, (accounts.length > 1 || options.targets.length > 1) ? accountsLabels[account.toString()] : undefined))
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
                                // resolve devices from variable that is stored in variable query.logsSourceVariable and prepare devices labels to be displayed later on the graph 
                                devices = prepareItemsAndLabelsFromVariable(query.logsSourceVariable, options.scopedVars, devicesLabels);     
                            } else {
                                // use ids of selected streams, that are stored in query.logsSourcesSelected field
                                devices = prepareItemsAndLabelsFromSelectedOptions(query.logsSourcesSelected, devicesLabels);
                            }
                            console.log("query::logs::devices::" + devices + "::parameters::" + logParameters + "::");
                            // fetch device's logs and transform it to data frame
                            const deviceObservableResponses = devices.map(device => {
                                const observableResponse = FlespiSDK.fetchFlespiDevicesLogs(device, logParameters, this.url, from, to)
                                .pipe(
                                    map((response) => handleFetchDataQueryResponse(response, query.refId + ':' + device, (devices.length > 1 || options.targets.length > 1) ? devicesLabels[device.toString()] : undefined))
                                )
                                return observableResponse;
                            });
                            return merge(...deviceObservableResponses); 

                        case LOGS_SOURCE_STREAM:
                            let streams: string[], streamsLabels: {[key: string]: string,} = {};
                            if (query.useLogsSourceVariable === true) {
                                // resolve streams from variable that is stored in variable query.logsSourceVariable and prepare streams labels to be displayed later on the graph 
                                streams = prepareItemsAndLabelsFromVariable(query.logsSourceVariable, options.scopedVars, streamsLabels);                
                            } else {
                                // use ids of selected streams, that are stored in query.logsSourcesSelected field
                                streams = prepareItemsAndLabelsFromSelectedOptions(query.logsSourcesSelected, streamsLabels);
                            }
                            console.log("query::logs::streams::" + streams + "::parameters::" + logParameters + "::");
                            // fetch stream's logs and transform it to data frame
                            const streamObservableResponses = streams.map(stream => {
                                const observableResponse = FlespiSDK.fetchFlespiStreamsLogs(stream, logParameters, this.url, from, to)
                                .pipe(
                                    map((response) => handleFetchDataQueryResponse(response, query.refId + ':' + stream, (streams.length > 1 || options.targets.length > 1) ? streamsLabels[stream.toString()] : undefined))
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
                        // resolve container's ids from variable, that is stored in query.containerVariable field and save containers' labels to be displayed on the graph's legend
                        containers = prepareItemsAndLabelsFromVariable(query.containerVariable, options.scopedVars, containersLabels);
                    } else {
                        containers = prepareItemsAndLabelsFromSelectedOptions(query.containersSelected, containersLabels);
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
                            map((response) => handleFetchDataQueryResponse(response, query.refId + ':' + container, (containers.length > 1 || options.targets.length > 1) ? containersLabels[container.toString()] : undefined))
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
}
