import { SelectableValue } from "@grafana/data";

export const REGEX_DEVICES = /^(devices\.\*)|(devices\.(\d+)\.parameters\.\*)/;
export const REGEX_ACCOUNTS = /^(accounts\.\*)|(accounts\.(\d+)\.statistics\.\*)/;

export const QUERY_TYPE_DEVICES = 'devices';
export const QUERY_TYPE_STATISTICS = 'statistics';

export const QUERY_TYPE_OPTIONS: Array<SelectableValue<string>> = [
    { label: 'Devices', value: QUERY_TYPE_DEVICES },
    { label: 'Statistics', value: QUERY_TYPE_STATISTICS },
    { label: 'Logs', value: 'logs' },
    { label: 'Intervals', value: 'intervals' },
    { label: 'Containers', value: 'containers' },
];

export const GEN_FUNC_OPTIONS: Array<SelectableValue<string>> = [
    { label: 'none', value: 'none' },
    { label: 'average', value: 'average' },
    { label: 'maximum', value: 'maximum' },
    { label: 'minimum', value: 'minimum' },
];
