import { QueryEditorProps, SelectableValue } from "@grafana/data";
import { AsyncMultiSelect, InlineField, InlineLabel, Input, Switch } from "@grafana/ui";
import { QUERY_TYPE_DEVICES } from "../constants";
import { DataSource, defaultQuery } from "datasource";
import { FlespiSDK } from "flespi-sdk";
import { defaults } from "lodash";
import React, { ReactElement, useState } from "react";
import { MyDataSourceOptions, MyQuery } from "types";
import { prepareItemsAndLabelsFromSelectedOptions, prepareItemsAndLabelsFromVariable, processVariableInput } from "utils";


export function TelemetryParameter(props: QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>): ReactElement {
    const { onChange, onRunQuery, datasource } = props;
    const query = defaults(props.query, defaultQuery);

    const [ useTelemParamVariable, setUseTelemParamVariable ] = useState<boolean>(query.useTelemParamVariable);
    const [ telemParamVariable, setTelemParamVariable ] = useState<string>(query.telemParamVariable);
    const [ telemParamsSelected, setTelemParamsSelected ] = useState<Array<SelectableValue<string>>>(() => {
        if (query.telemParamsSelected) {
            return query.telemParamsSelected.map((parameter: string) => ({label: parameter, value: parameter}));
        }
        return [];
    });
    const [ error, setError ] = useState<string>("");

    // prepare list of devices
    const devicesIds: string[] = (query.useDeviceVariable === true) ? prepareItemsAndLabelsFromVariable(query.deviceVariable, {}) : prepareItemsAndLabelsFromSelectedOptions(query.devicesSelected);
    const devices = devicesIds.join();

    /////////////////////////////////////////////////////////////////////////////////
    // load telemetry parameters for the devices selected in Devices drop down
    /////////////////////////////////////////////////////////////////////////////////
    const loadFlespiDevicesParameters = async (inputValue: string) => {
        if (devices === '') {
            // device is not yet selected, return empty array of parameters
            return Promise.resolve([]);
        }
        // fetch telemetry parameters for all selected devices
        const telemetries = await Promise.all(devicesIds.map(device => {
            return FlespiSDK.fetchDeviceTelemetryParameters(device, datasource.url).then((result: string[]) => {
                return result
                // filter parameters based on user input in Parameter select field
                .filter((parameter: string) => parameter.toLowerCase().includes(inputValue));
            });
        }));
        const telemetryParameters = (await Promise.all(telemetries)).flat();
        const telemetryParametersUnique = new Set(telemetryParameters);

        return Array.from(telemetryParametersUnique.values())
            .sort()
            .map((parameter: string) => ({value: parameter, label: parameter}));
    };

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
                    onChange={(option: any) => {
                        setTelemParamsSelected(option);
                        onChange({ ...query, telemParamsSelected: option.map((param: SelectableValue<string>) => (param.value)) });
                        onRunQuery();
                    }}
                    width={40}
                    noOptionsMessage={`Telemetry not found for devices' IDs: ${devices}`}
                    allowCustomValue={true}
                />
            </InlineField>
            ) : (
            <InlineField invalid={error ? true : false} error={error}>
                <Input
                    name="parameter"
                    value={telemParamVariable}
                    onChange={(event: any) => {
                        setTelemParamVariable(event.target.value);
                        onChange({ ...query, telemParamVariable: event.target.value });
                    }}
                    onKeyDown={(event: any) => {
                        if (event.key !== 'Enter') {
                            return;
                        }
                        onRunQuery();
                        processVariableInput(event.target.value, query, 'telemParamVariable', setTelemParamVariable, setError, onChange, onRunQuery);
                    }}
                    onBlur={(event: any) => {
                        processVariableInput(event.target.value, query, 'telemParamVariable', setTelemParamVariable, setError, onChange, onRunQuery);
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
