import { QueryEditorProps, SelectableValue } from "@grafana/data";
import { AsyncMultiSelect, InlineField, InlineLabel, Input, Switch } from "@grafana/ui";
import { DataSource, defaultQuery } from "datasource";
import { FlespiSDK } from "flespi-sdk";
import { defaults } from "lodash";
import React, { ReactElement, useState } from "react";
import { MyDataSourceOptions, MyQuery } from "types";


export function DeviceParameter(props: QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>): ReactElement {
    const { onChange, onRunQuery, datasource } = props;
    const query = defaults(props.query, defaultQuery);

    const [ useParameterVariable, setUseParameterVariable ] = useState<boolean>(query.useParameterVariable);
    const [ parameterVariable, setParameterVariable ] = useState<string>(query.parameterVariable);
    const [ parametersSelected, setParametersSelected ] = useState<Array<SelectableValue<string>>>(() => {
        if (query.parametersSelected) {
            return query.parametersSelected.map((parameter) => {
                return {
                    label: parameter,
                    value: parameter,
                };
            });
        }
        return [];
    });
    const devicesSelected = query.devicesSelected;
    const devices = devicesSelected.map((device: SelectableValue<number>) => device.value).join();

    // load telemetry parameters for the device that is selected in Device drop down
    // this.state.deviceSelected.value contains device Id  of the selected device
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
        setParametersSelected(option);
        // save new parameter to query
        onChange({ ...query, parametersSelected: option.map((param: SelectableValue<string>) => { return param.value!; }) });
        // execute the query
        onRunQuery();
    };

    const onParameterInputChange = (event: any) => {
        // save updated container variable to query
        setParameterVariable(event.target.value);
        onChange({ ...query, parameterVariable: event.target.value });
      }
    
      const onParameterInputKeyDown = (event: any) => {
        if (event.key === 'Enter') {
          // rerender graph on the panel
          onRunQuery();
        }    
      }

    /////////////////////////////////////////////////////////////////////////////////
    // render these controls only for query type 'devices'
    /////////////////////////////////////////////////////////////////////////////////
    if (query.queryType !== 'devices') {
        return <div/>;
    }

    /////////////////////////////////////////////////////////////////////////////////
    // render controls to specify parameters of flespi device for query
    /////////////////////////////////////////////////////////////////////////////////
    return (
        <div  className="gf-form">
            <InlineLabel width={16} tooltip="Choose telemetry parameters for query">
                Parameter
            </InlineLabel>
            <InlineField label="Use dashboard variable">
                <div className='gf-form-switch'>
                <Switch
                    value={!!useParameterVariable}
                    onChange={() => {
                        setUseParameterVariable(!useParameterVariable);
                        onChange({ ...query, useParameterVariable: !query.useParameterVariable });
                    }}
                />
                </div>     
            </InlineField>
        {!useParameterVariable ? (
            <InlineField labelWidth={16}>
                <AsyncMultiSelect
                    key={devices}
                    value={parametersSelected}
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
            <Input
                name="parameter"
                value={parameterVariable}
                onChange={onParameterInputChange}
                onKeyDown={onParameterInputKeyDown}
                required
                type="text"
                width={40}
                placeholder="$parameter"
            />
        )}
        </div>
    );
}
