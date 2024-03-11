import { QueryEditorProps, SelectableValue } from "@grafana/data";
import { getTemplateSrv } from "@grafana/runtime";
import { InlineField, InlineLabel, Input, MultiSelect, Switch } from "@grafana/ui";
import { DataSource } from "datasource";
import React, { ReactElement, useEffect, useState } from "react";
import { MyDataSourceOptions, MyQuery } from "types";


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
          const values = (await datasource.fetchAllFlespiDevices()).map(device => {
            return {
              label: device.name,
              value: device.id,
            }
          });
          setDevices(values);
        }
        fetchDevices().catch(console.error);
      }, [datasource, query]);

    /////////////////////////////////////////////////////////////////////////////////
    // device input event handler: text typed
    /////////////////////////////////////////////////////////////////////////////////
    const onDeviceInputChange = (event: any) => {
        // just update the value displayed in the input field
        setDeviceVariable(event.target.value);
    }
    /////////////////////////////////////////////////////////////////////////////////
    // device input event hander: key down
    /////////////////////////////////////////////////////////////////////////////////
    const onDeviceInputKeyDown = (event: any) => {
        // process 'Enter' key down event only
        if (event.key !== 'Enter') {
          return;
        }
        processDeviceVariableInput(event.target.value);
    }
    /////////////////////////////////////////////////////////////////////////////////
    // device input hander: focus lost
    /////////////////////////////////////////////////////////////////////////////////
    const onDeviceInputBlur = (event: any) => {
        processDeviceVariableInput(event.target.value);
    }

    /////////////////////////////////////////////////////////////////////////////////
    // device input hander: user types variable name into input
    /////////////////////////////////////////////////////////////////////////////////
    const processDeviceVariableInput = (inputValue: string) => {
        // device variable input field is empty
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
          setDeviceVariable(inputValue);
          setError("");
          // set new device variable to the query and run query() to render the graph
          onChange({ ...query, deviceVariable: inputValue });
          onRunQuery();
        } else {
          // no matching dashboard variable has been found, display error message
          setError(`Invalid device variable: no variable ${inputValue} is defined for the dashboard`);
        }
      }

    // handle changes in selected devices 
    const onChangeDevicesSelect = (option: Array<SelectableValue<number>>) => {
        // update selected devices in the form state
        setDevicesSelected(option);
        // save new parameter to query
        onChange({ ...query, devicesSelected: option });
        // execute the query
        onRunQuery();
  };

    /////////////////////////////////////////////////////////////////////////////////
    // render these controls only for query type 'devices'
    /////////////////////////////////////////////////////////////////////////////////
    if (query.queryType !== 'devices') {
        return <div/>;
    }

    /////////////////////////////////////////////////////////////////////////////////
    // render controls to specify flespi device for query
    /////////////////////////////////////////////////////////////////////////////////
    return (
        <div className="gf-form">
          <InlineLabel width={16} tooltip="Choose device for query">
            Device
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
                onChange={onChangeDevicesSelect}
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
                onChange={onDeviceInputChange}
                onKeyDown={onDeviceInputKeyDown}
                onBlur={onDeviceInputBlur}
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
