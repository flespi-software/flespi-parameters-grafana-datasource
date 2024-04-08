import { SelectableValue } from "@grafana/data";
import { MyQuery } from "types";

export const REGEX_DEVICES = /^(devices\.\*)|^(devices\.(\d+)\.parameters\.\*)/;
export const REGEX_ACCOUNTS = /^(accounts\.\*)|(accounts\.([\d,]+)\.statistics\.\*)/;
export const VARIABLES_QUERY_STREAMS = 'streams.*';
export const REGEX_CONTAINERS = /^(containers\.\*)|(containers\.([\d,]+)\.parameters\.\*)/;
export const REGEX_CALCULATORS = /^(calculators\.\*)|(calculators\.([\d,]+)\.devices\.\*)|(calculators\.([\d,]+)\.devices\.([\d,]+).parameters\.\*)/;

export const QUERY_TYPE_DEVICES = 'devices';
export const QUERY_TYPE_STATISTICS = 'statistics';
export const QUERY_TYPE_LOGS = 'logs';
export const QUERY_TYPE_CONTAINERS = 'containers';
export const QUERY_TYPE_INTERVALS = 'intervals';

export const QUERY_TYPE_OPTIONS: Array<SelectableValue<string>> = [
    { label: 'Devices', value: QUERY_TYPE_DEVICES },
    { label: 'Statistics', value: QUERY_TYPE_STATISTICS },
    { label: 'Logs', value: QUERY_TYPE_LOGS },
    { label: 'Intervals', value: QUERY_TYPE_INTERVALS },
    { label: 'Containers', value: QUERY_TYPE_CONTAINERS },
];

export const GEN_FUNC_AVERAGE = 'average';

export const GEN_FUNC_OPTIONS: Array<SelectableValue<string>> = [
    { label: 'none', value: 'none' },
    { label: 'average', value: GEN_FUNC_AVERAGE },
    { label: 'maximum', value: 'maximum' },
    { label: 'minimum', value: 'minimum' },
];

export const LOGS_SOURCE_DEVICE = 'device';
export const LOGS_SOURCE_STREAM = 'stream';

export const LOGS_SOURCE_OPTIONS: Array<SelectableValue<string>> = [
    { label: 'Device', value: LOGS_SOURCE_DEVICE },
    { label: 'Stream', value: LOGS_SOURCE_STREAM },
];

export const LOGS_PARAMS_DEVICE_OPTIONS: Array<SelectableValue<string>> = [
    { label: 'recv', value: 'recv' },
    { label: 'send', value: 'send' },
    { label: 'msgs', value: 'msgs' },
];

export const LOGS_PARAMS_STREAM_OPTIONS: Array<SelectableValue<string>> = [
    { label: 'accepted', value: 'accepted' },
    { label: 'ack_latency', value: 'ack_latency' },
    { label: 'read', value: 'read' },
    { label: 'rejected', value: 'rejected' },
    { label: 'skipped', value: 'skipped' },
];

// temporary method for backward compatibility
export function tempBackwardCompatibilityConversion(query: MyQuery): boolean {
    // backward compatibility
    if (query.queryType === undefined && query.entity !== undefined) {
        // tranfser old query model to the new one
        query.queryType = QUERY_TYPE_DEVICES;
        if (typeof query.entity === "number")  {
            query.useDeviceVariable = false;
            query.devicesSelected = [{label: query.entityLabel, value: typeof query.entity === "number" ? query.entity : parseInt(query.entity, 10)}];
        } else {
            query.useDeviceVariable = true;
            query.deviceVariable = query.entity;
        }
        if (query.param !== undefined) {
            if (query.param.includes('$')) {
                query.useTelemParamVariable = true;
                query.telemParamVariable = query.param;
            } else {
                query.useTelemParamVariable = false;
                query.telemParamsSelected = [];
                query.telemParamsSelected.push(query.param);
            }
        }
        query.generalizationFunction = query.func !== undefined ? query.func : GEN_FUNC_AVERAGE;
        delete query.param;
        delete query.func;
        delete query.entity;
        delete query.entityLabel;

        return true;
    }
    return false;
}
