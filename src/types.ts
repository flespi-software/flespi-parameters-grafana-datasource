import { DataSourceJsonData, SelectableValue } from '@grafana/data';
import { DataQuery } from '@grafana/schema';

export interface MyQuery extends DataQuery {
    // old query model
    entity?: number | string;    // if number - id of the entity to draw the graph for, if string - name of the variable to resolve the entity id from
    entityLabel?: string;        // label of the entity in drop down, used to create labels of the legend if there are more that one entity on one grrph
    param?: string;              // param to be drawn on the graph
    func?: string;               // generalization function

    // new query model
    queryType: string;                                  // type of the query: devices, containers, logs, statistics, intervals    
    // - // the following fields are used if queryType === QUERY_TYPE_DEVICES
    useDeviceVariable: boolean;
    devicesSelected: Array<SelectableValue<number>>;    // used if useDeviceVariable === false
    deviceVariable: string;                             // used if useDeviceVariable === true
    useTelemParamVariable: boolean;
    telemParamsSelected: string[];
    telemParamVariable: string;
    // - // the following fields are used if queryType === QUERY_TYPE_STATISTICS
    useAccountVariable: boolean;
    accountsSelected: Array<SelectableValue<number>>;   // used if useAccountVariable === false
    accountVariable: string;                            // used if useAccountVariable === true
    useStatParamVariable: boolean;
    statParamsSelected: string[]; 
    statParamVariable: string;    
    // - // used if queryType === QUERY_TYPE_DEVICES || queryType === QUERY_TYPE_STATISTICS || queryType === QUERY_TYPE_CONTAINERS
    generalizationFunction?: string;   
    // - // the following fields are used if queryType === QUERY_TYPE_LOGS
    logsSourceType: string;                             // source of the logs: device, stream etc
    useLogsSourceVariable: boolean;
    logsSourcesSelected: Array<SelectableValue<number>>;
    logsSourceVariable: string;
    useLogsParamVariable: boolean;
    logsParamsSelected: string[];
    logsParamVariable: string;   
    // - // the following fields are used if queryType === QUERY_TYPE_CONTAINERS             
    useContainerVariable: boolean;
    containersSelected: Array<SelectableValue<number>>;
    containerVariable: string;
    useContParamVariable: boolean;
    contParamsSelected: string[];
    contParamVariable: string;
    // - // the following fields are used if queryTypr === QUERY_TYPE_INTERVALS
    calculatorSelected: SelectableValue<number>;
}

/**
 * These are options configured for each DataSource instance
 */
export interface MyDataSourceOptions extends DataSourceJsonData {
    path?: string;
}

/**
 * Value that is used in the backend, but never sent over HTTP to the frontend
 */
export interface MySecureJsonData {
    apiKey?: string;
}
