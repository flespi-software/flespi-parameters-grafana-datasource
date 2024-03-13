import { SelectableValue } from "@grafana/data";

export const QUERY_TYPE_OPTIONS: Array<SelectableValue<string>> = [
    { label: 'Devices', value: 'devices' },
    { label: 'Statistics', value: 'statistics' },
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
