import { QueryEditorProps, SelectableValue } from "@grafana/data";
import { InlineField, InlineLabel, Input, MultiSelect, Switch } from "@grafana/ui";
import { LOGS_PARAMS_DEVICE_OPTIONS, LOGS_PARAMS_STREAM_OPTIONS, LOGS_SOURCE_DEVICE, LOGS_SOURCE_STREAM, QUERY_TYPE_LOGS } from "../constants";
import { DataSource, defaultQuery } from "datasource";
import { defaults } from "lodash";
import React, { ReactElement, useState } from "react";
import { MyDataSourceOptions, MyQuery } from "types";
import { processVariableInput } from "utils";

export function LogParameter(props: QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>): ReactElement {
    const { onChange, onRunQuery } = props;
    const query = defaults(props.query, defaultQuery);

    const [ useLogsParamVariable, setUseLogsParamVariable ] = useState<boolean>(query.useLogsParamVariable);
    const [ logsParamVariable, setLogsParamVariable ] = useState<string>(query.logsParamVariable);
    const [ logsParamsSelected, setLogsParamsSelected ] = useState<Array<SelectableValue<string>>>(() => {
        if (query.logsParamsSelected) {
            return query.logsParamsSelected.map(parameter => ({label: parameter, value: parameter}));
        }
        return [];
    });
    const [ error, setError ] = useState<string>("");

    /////////////////////////////////////////////////////////////////////////////////
    // render these controls only for query type QUERY_TYPE_LOGS
    /////////////////////////////////////////////////////////////////////////////////
    if (query.queryType !== QUERY_TYPE_LOGS) {
        return <div/>;
    }

    /////////////////////////////////////////////////////////////////////////////////
    // render controls to specify logs parameters of flespi items for query
    /////////////////////////////////////////////////////////////////////////////////
    let options;
    switch(query.logsSourceType) {
        case LOGS_SOURCE_DEVICE:
            options = LOGS_PARAMS_DEVICE_OPTIONS;
            break;
        case LOGS_SOURCE_STREAM:
            options = LOGS_PARAMS_STREAM_OPTIONS;
            break;
    }
    return (
        <div  className="gf-form">
            <InlineLabel width={16} tooltip="Choose logs parameters for query">
                Parameters
            </InlineLabel>
            <InlineField label="Use dashboard variable">
                <div className='gf-form-switch'>
                <Switch
                    value={!!useLogsParamVariable}
                    onChange={() => {
                        setUseLogsParamVariable(!useLogsParamVariable);
                        onChange({ ...query, useLogsParamVariable: !query.useLogsParamVariable });
                    }}
                />
                </div>     
            </InlineField>
        {!useLogsParamVariable ? (
            <InlineField labelWidth={16}>
                <MultiSelect
                    value={logsParamsSelected}
                    options={options}
                    onChange={(option: any) => {
                        setLogsParamsSelected(option);
                        onChange({ ...query, logsParamsSelected: option.map((param: SelectableValue<string>) => (param.value!)) });
                        onRunQuery();
                    }}
                    width={40}
                    allowCustomValue={true}
                />
            </InlineField>
            ) : (
            <InlineField invalid={error ? true : false} error={error}>
                <Input
                    name="parameter"
                    value={logsParamVariable}
                    onChange={(event: any) => {
                        setLogsParamVariable(event.target.value);
                        onChange({ ...query, logsParamVariable: event.target.value });
                    }}
                    onKeyDown={(event: any) => {
                        if (event.key !== 'Enter') {
                            return;
                        }
                        onRunQuery();
                        processVariableInput(event.target.value, query, 'logsParamVariable', setLogsParamVariable, setError, onChange, onRunQuery);
                    }}
                    onBlur={(event: any) => {
                        processVariableInput(event.target.value, query, 'logsParamVariable', setLogsParamVariable, setError, onChange, onRunQuery);
                    }}
                    required
                    type="text"
                    width={40}
                    placeholder="$parameter"
                />
            </InlineField>
        )}
        </div>
    );
}
