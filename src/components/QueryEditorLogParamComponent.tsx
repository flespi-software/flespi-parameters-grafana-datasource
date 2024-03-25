import { QueryEditorProps, SelectableValue } from "@grafana/data";
import { InlineField, InlineLabel, Input, MultiSelect, Switch } from "@grafana/ui";
import { LOGS_PARAMS_DEVICE_OPTIONS, LOGS_PARAMS_STREAM_OPTIONS, LOGS_SOURCE_DEVICE, LOGS_SOURCE_STREAM, QUERY_TYPE_LOGS } from "../constants";
import { DataSource, defaultQuery } from "datasource";
import { defaults } from "lodash";
import React, { ReactElement, useState } from "react";
import { MyDataSourceOptions, MyQuery } from "types";
import { getTemplateSrv } from "@grafana/runtime";


export function LogParameter(props: QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>): ReactElement {
    const { onChange, onRunQuery } = props;
    const query = defaults(props.query, defaultQuery);

    const [ useLogsParamVariable, setUseLogsParamVariable ] = useState<boolean>(query.useLogsParamVariable);
    const [ logsParamVariable, setLogsParamVariable ] = useState<string>(query.logsParamVariable);
    const [ logsParamsSelected, setLogsParamsSelected ] = useState<Array<SelectableValue<string>>>(() => {
        if (query.logsParamsSelected) {
            return query.logsParamsSelected.map((parameter) => {
                return {
                    label: parameter,
                    value: parameter,
                };
            });
        }
        return [];
    });
    const [ error, setError ] = useState<string>("");

    // handle changes in selected parameter 
    const onChangeParametersSelect = (option: any) => {
        // update form state
        setLogsParamsSelected(option);
        // save new parameter to query
        onChange({ ...query, logsParamsSelected: option.map((param: SelectableValue<string>) => { return param.value!; }) });
        // execute the query
        onRunQuery();
    };

    const onParameterInputChange = (event: any) => {
        // save updated container variable to query
        setLogsParamVariable(event.target.value);
        onChange({ ...query, logsParamVariable: event.target.value });
      }
    
    const onParameterInputKeyDown = (event: any) => {
        if (event.key !== 'Enter') {
            return;
        }
        onRunQuery();
        processVariableInput(event.target.value);
    }
    
    const onParameterInputBlur = (event: any) => {
        processVariableInput(event.target.value);
    }

    const processVariableInput = (inputValue: string) => {
        // variable input field is empty
        if (inputValue === '') {
            // nothing to do, just remove error message, if any
            setError("");
            return;
        }
        // check user input, if this is a valid dashboard variable
        const interpolations: any[] = [];
        getTemplateSrv().replace(inputValue, undefined, undefined, interpolations);
        if (interpolations[0] && interpolations[0].found === true) {
            // matching dashboard variable is found
            setLogsParamVariable(inputValue);
            setError("");
            // set new variable to the query and run query() to render the graph
            onChange({ ...query, logsParamVariable: inputValue });
            onRunQuery();
        } else {
            // no matching dashboard variable has been found, display error message
            setError(`Invalid variable: no variable ${inputValue} is defined for the dashboard`);
        }
    }

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
                    onChange={onChangeParametersSelect}
                    width={40}
                    allowCustomValue={true}
                />
            </InlineField>
            ) : (
            <InlineField invalid={error ? true : false} error={error}>
                <Input
                    name="parameter"
                    value={logsParamVariable}
                    onChange={onParameterInputChange}
                    onKeyDown={onParameterInputKeyDown}
                    onBlur={onParameterInputBlur}
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
