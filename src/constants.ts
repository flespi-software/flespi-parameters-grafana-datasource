import { SelectableValue } from "@grafana/data";
import { MyQuery } from "types";

export const REGEX_DEVICES = /^(devices\.\*)|(devices\.(\d+)\.parameters\.\*)/;
export const REGEX_ACCOUNTS = /^(accounts\.\*)|(accounts\.([\d,]+)\.statistics\.\*)/;

export const QUERY_TYPE_DEVICES = 'devices';
export const QUERY_TYPE_STATISTICS = 'statistics';

export const QUERY_TYPE_OPTIONS: Array<SelectableValue<string>> = [
    { label: 'Devices', value: QUERY_TYPE_DEVICES },
    { label: 'Statistics', value: QUERY_TYPE_STATISTICS },
    { label: 'Logs', value: 'logs' },
    { label: 'Intervals', value: 'intervals' },
    { label: 'Containers', value: 'containers' },
];

export const GEN_FUNC_AVERAGE = 'average';

export const GEN_FUNC_OPTIONS: Array<SelectableValue<string>> = [
    { label: 'none', value: 'none' },
    { label: 'average', value: GEN_FUNC_AVERAGE },
    { label: 'maximum', value: 'maximum' },
    { label: 'minimum', value: 'minimum' },
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
