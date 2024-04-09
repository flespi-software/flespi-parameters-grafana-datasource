import { QueryEditorProps, SelectableValue } from "@grafana/data";
import { InlineField, InlineLabel, Input, MultiSelect, Switch } from "@grafana/ui";
import { QUERY_TYPE_DEVICES } from "../constants";
import { DataSource } from "datasource";
import { FlespiSDK } from "flespi-sdk";
import React, { ReactElement, useEffect, useState } from "react";
import { MyDataSourceOptions, MyQuery } from "types";
import { processVariableInput } from "utils";

export function Device(props: QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>): ReactElement {
    const { onChange, onRunQuery, datasource, query } = props;
    const [ devices, setDevices ] = useState<Array<SelectableValue<number>>>([]);
    const [ useDeviceVariable, setUseDeviceVariable ] = useState<boolean>(query.useDeviceVariable);
    const [ deviceVariable, setDeviceVariable ] = useState<string>(query.deviceVariable);
    const [ devicesSelected, setDevicesSelected ] = useState<Array<SelectableValue<number>>>(query.devicesSelected);
    const [ error, setError ] = useState<string>("");

    /////////////////////////////////////////////////////////////////////////////////
    // load all available devices for future use as select options
    /////////////////////////////////////////////////////////////////////////////////
    useEffect(() => {
        // load devices and store them into state for the later use in devices drop-down
        const fetchDevices = async () => {
            const values = (await FlespiSDK.fetchAllFlespiDevices(datasource.url)).map(device => ({label: device.name, value: device.id}));
            setDevices(values);
        }
        fetchDevices().catch(console.error);
      }, [datasource, query]);

    /////////////////////////////////////////////////////////////////////////////////
    // render these controls only for query type QUERY_TYPE_DEVICES
    /////////////////////////////////////////////////////////////////////////////////
    if (query.queryType !== QUERY_TYPE_DEVICES) {
        return <div/>;
    }

    /////////////////////////////////////////////////////////////////////////////////
    // render controls to specify flespi device for query
    /////////////////////////////////////////////////////////////////////////////////
    return (
        <div className="gf-form">
            <InlineLabel width={16} tooltip="Choose devices for query">
                Devices
            </InlineLabel>
            <InlineField label="Use dashboard variable">
                <div className='gf-form-switch'>
                    <Switch
                        value={!!useDeviceVariable}
                        onChange={() => {
                            setUseDeviceVariable(!useDeviceVariable);
                            onChange({ ...query, useDeviceVariable: !query.useDeviceVariable });
                        }}
                    />
                </div>
            </InlineField>
            {!useDeviceVariable ? (
                // if useDeviceVariable==false - render Select with devices for the user to select a device for the query
                <InlineField>
                    <MultiSelect 
                        value={devicesSelected}
                        options={devices}
                        onChange={(option: Array<SelectableValue<number>>) => {
                            setDevicesSelected(option);
                            onChange({ ...query, devicesSelected: option });
                            onRunQuery();
                        }}
                        width={40}
                        placeholder="Select device"
                    />
                </InlineField>
            ) : (
                // if useDeviceVariable==true - render Input where user will type name of the variable to take device from
                <InlineField invalid={error ? true : false} error={error}>
                <Input
                    name="device"
                    value={deviceVariable}
                    onChange={(event: any) => {
                        setDeviceVariable(event.target.value);
                    }}
                    onKeyDown={(event: any) => {
                        // process 'Enter' key down event only
                        if (event.key !== 'Enter') {
                            return;
                        }
                        processVariableInput(event.target.value, query, 'deviceVariable', setDeviceVariable, setError, onChange, onRunQuery);
                    }}
                    onBlur={(event: any) => {
                        processVariableInput(event.target.value, query, 'deviceVariable', setDeviceVariable, setError, onChange, onRunQuery);
                    }}
                    required
                    type="text"
                    width={40}
                    placeholder="$device"
                />
                </InlineField>
            )}
        </div>
    );
}
