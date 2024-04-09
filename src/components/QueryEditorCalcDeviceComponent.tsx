import { QueryEditorProps, SelectableValue } from "@grafana/data";
import { MyDataSourceOptions, MyQuery } from "types";
import { DataSource } from "datasource";
import { QUERY_TYPE_INTERVALS } from "../constants";
import React, { ReactElement, useState } from "react";
import { InlineLabel, InlineField, AsyncMultiSelect, Switch, Input } from "@grafana/ui";
import { FlespiSDK, FlespiEntity } from "flespi-sdk";
import { processVariableInput } from "utils";

export function CalcDevice(props: QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>): ReactElement {
    const { onChange, onRunQuery, datasource, query } = props;
    const [ calcDevicesSelected, setCalcDevicesSelected ] = useState<Array<SelectableValue<number>>>(query.calcDevicesSelected);
    const [ useCalcDeviceVariable, setUseCalcDeviceVariable ] = useState<boolean>(query.useCalcDeviceVariable);
    const [ calcDeviceVariable, setCalcDeviceVariable ] = useState<string>(query.calcDeviceVariable);
    const [ error, setError ] = useState<string>("");

    const calculatorSelected = (query.calculatorsSelected[0] && query.calculatorsSelected[0].value) ? query.calculatorsSelected[0].value?.toString() : '';

    const loadCalcDevices = async (inputValue: string) => {
        if (query.calculatorsSelected.length === 0) {
            // calculator is not yet selected, return empty array of devices
            return Promise.resolve([]);
        }
        const calcDevicesPromises = await Promise.all(query.calculatorsSelected.map(calculator => {
            return FlespiSDK.fetchFlespiDevicesAssignedToCalculator(calculator.value ? calculator.value : 0, datasource.url)
                            .then((result: FlespiEntity[]) => (result.filter(device => (device.name.toLowerCase().includes(inputValue)))));
        }));
        const calcDevices = (await Promise.all(calcDevicesPromises)).flat();
        const calcDevicesUnique = new Set(calcDevices);

        return Array.from(calcDevicesUnique.values())
            .sort()
            .map(device => ({value: device.id, label: device.name})); 
    };

    /////////////////////////////////////////////////////////////////////////////////
    // render these controls only for query type QUERY_TYPE_INTERVALS
    /////////////////////////////////////////////////////////////////////////////////
    if (query.queryType !== QUERY_TYPE_INTERVALS) {
        return <div/>;
    }

    ///////////////////////////////////////////////////////////////////////////////
    // render controls to specify flespi calcualtor's device for query
    ///////////////////////////////////////////////////////////////////////////////// 
    return (
        <div className="gf-form">
            <InlineLabel width={16} tooltip="Choose calc's device for query">
            Device
            </InlineLabel>
            <InlineField label="Use dashboard variable">
                <div className='gf-form-switch'>
                    <Switch
                        value={!!useCalcDeviceVariable}
                        onChange={() => {
                            setUseCalcDeviceVariable(!useCalcDeviceVariable);
                            onChange({ ...query, useCalcDeviceVariable: !query.useCalcDeviceVariable });
                        }}
                    />
                </div>
            </InlineField>
            {!useCalcDeviceVariable ? (
                <InlineField disabled={calculatorSelected ? false : true}>
                    <AsyncMultiSelect
                        key={calculatorSelected}
                        value={calcDevicesSelected}
                        loadOptions={loadCalcDevices}
                        onChange={(option: Array<SelectableValue<number>>) => {
                            setCalcDevicesSelected(option);
                            onChange({ ...query, calcDevicesSelected: option });
                            onRunQuery();
                        }}
                        defaultOptions
                        cacheOptions
                        width={40}
                        placeholder=''
                    />
                </InlineField>
            ) : (
                <InlineField invalid={error ? true : false} error={error}>
                <Input
                    name="calcdevice"
                    value={calcDeviceVariable}
                    onChange={(event: any) => {
                        setCalcDeviceVariable(event.target.value);
                    }}
                    onKeyDown={(event: any) => {
                        // process 'Enter' key down event only
                        if (event.key !== 'Enter') {
                            return;
                        }
                        processVariableInput(event.target.value, query, 'calcDeviceVariable', setCalcDeviceVariable, setError, onChange, onRunQuery);
                    }}
                    onBlur={(event: any) => {
                        processVariableInput(event.target.value, query, 'calcDeviceVariable', setCalcDeviceVariable, setError, onChange, onRunQuery);
                    }}
                    required
                    type="text"
                    width={40}
                    placeholder="$calcdevice"
                />
                </InlineField>
            )}
        </div>
    );

}
