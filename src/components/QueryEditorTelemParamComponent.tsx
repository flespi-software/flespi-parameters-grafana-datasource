import { QueryEditorProps, SelectableValue } from "@grafana/data";
import { AsyncMultiSelect, InlineField, InlineLabel, Input, Switch } from "@grafana/ui";
import { QUERY_TYPE_DEVICES } from "../constants";
import { DataSource, defaultQuery } from "datasource";
import { FlespiSDK } from "flespi-sdk";
import { defaults } from "lodash";
import React, { ReactElement, useState } from "react";
import { MyDataSourceOptions, MyQuery } from "types";
import { getTemplateSrv } from "@grafana/runtime";


export function TelemetryParameter(props: QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>): ReactElement {
    const { onChange, onRunQuery, datasource } = props;
    const query = defaults(props.query, defaultQuery);

    const [ useTelemParamVariable, setUseTelemParamVariable ] = useState<boolean>(query.useTelemParamVariable);
    const [ telemParamVariable, setTelemParamVariable ] = useState<string>(query.telemParamVariable);
    const [ telemParamsSelected, setTelemParamsSelected ] = useState<Array<SelectableValue<string>>>(() => {
        if (query.telemParamsSelected) {
            return query.telemParamsSelected.map((parameter) => {
                return {
                    label: parameter,
                    value: parameter,
                };
            });
        }
        return [];
    });
    const [ error, setError ] = useState<string>("");
    const devicesSelected = query.devicesSelected;
    const devices = devicesSelected.map((device: SelectableValue<number>) => device.value).join();

    // load telemetry parameters for the devices selected in Devices drop down
    const loadFlespiDevicesParameters = async (inputValue: string) => {
        if (devicesSelected.toString() === '') {
            // device is not yet selected, return empty array of parameters
            return Promise.resolve([]);
        }
        // fetch telemetry parameters for all selected devices
        const telemetries = await Promise.all(devicesSelected.map(device => {
            return FlespiSDK.fetchDeviceTelemetryParameters(device.value ? device.value : 0, datasource.url).then((result: string[]) => {
                return result
                // filter parameters based on user input in Parameter select field
                .filter((parameter: string) => parameter.toLowerCase().includes(inputValue));
            });
        }));
        const telemetryParameters = (await Promise.all(telemetries)).flat();
        const telemetryParametersUnique = new Set(telemetryParameters);

        return Array.from(telemetryParametersUnique.values())
            .sort()
            .map((parameter: string) => ({ value: parameter, label: parameter }));
    };

    // handle changes in selected parameter 
    const onChangeParametersSelect = (option: any) => {
        // update form state
        setTelemParamsSelected(option);
        // save new parameter to query
        onChange({ ...query, telemParamsSelected: option.map((param: SelectableValue<string>) => { return param.value!; }) });
        // execute the query
        onRunQuery();
    };

    const onParameterInputChange = (event: any) => {
        // save updated container variable to query
        setTelemParamVariable(event.target.value);
        onChange({ ...query, telemParamVariable: event.target.value });
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
        // check user input, if this is a valid dashboard varible
        const interpolations: any[] = [];
        getTemplateSrv().replace(inputValue, undefined, undefined, interpolations);
        if (interpolations[0] && interpolations[0].found === true) {
            // matching dashboard variable is found
            setTelemParamVariable(inputValue);
            setError("");
            // set new variable to the query and run query() to render the graph
            onChange({ ...query, telemParamVariable: inputValue });
            onRunQuery();
        } else {
            // no matching dashboard variable has been found, display error message
            setError(`Invalid variable: no variable ${inputValue} is defined for the dashboard`);
        }
    }

    /////////////////////////////////////////////////////////////////////////////////
    // render these controls only for query type QUERY_TYPE_DEVICES
    /////////////////////////////////////////////////////////////////////////////////
    if (query.queryType !== QUERY_TYPE_DEVICES) {
        return <div/>;
    }

    /////////////////////////////////////////////////////////////////////////////////
    // render controls to specify telemetry parameters of flespi device for query
    /////////////////////////////////////////////////////////////////////////////////
    return (
        <div  className="gf-form">
            <InlineLabel width={16} tooltip="Choose telemetry parameters for query">
                Parameters
            </InlineLabel>
            <InlineField label="Use dashboard variable">
                <div className='gf-form-switch'>
                <Switch
                    value={!!useTelemParamVariable}
                    onChange={() => {
                        setUseTelemParamVariable(!useTelemParamVariable);
                        onChange({ ...query, useTelemParamVariable: !query.useTelemParamVariable });
                    }}
                />
                </div>     
            </InlineField>
        {!useTelemParamVariable ? (
            <InlineField labelWidth={16}>
                <AsyncMultiSelect
                    key={devices}
                    value={telemParamsSelected}
                    loadOptions={loadFlespiDevicesParameters}
                    defaultOptions
                    cacheOptions
                    onChange={onChangeParametersSelect}
                    width={40}
                    noOptionsMessage="Telemetry not found"
                    allowCustomValue={true}
                />
            </InlineField>
            ) : (
            <InlineField invalid={error ? true : false} error={error}>
                <Input
                    name="parameter"
                    value={telemParamVariable}
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
