import { QueryEditorProps, SelectableValue } from "@grafana/data";
import { MyDataSourceOptions, MyQuery } from "types";
import { DataSource } from "datasource";
import { QUERY_TYPE_INTERVALS } from "../constants";
import React, { ReactElement, useState } from "react";
import { InlineLabel, InlineField, AsyncMultiSelect, Switch, Input } from "@grafana/ui";
import { FlespiSDK, FlespiEntity } from "flespi-sdk";
import { prepareItemsAndLabelsFromSelectedOptions, prepareItemsAndLabelsFromVariable, prepareSelectOption, processVariableInput } from "utils";

export function CalcDevice(props: QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>): ReactElement {
    const { onChange, onRunQuery, datasource, query } = props;
    const [ calcDevicesSelected, setCalcDevicesSelected ] = useState<Array<SelectableValue<number>>>(query.calcDevicesSelected);
    const [ useCalcDeviceVariable, setUseCalcDeviceVariable ] = useState<boolean>(query.useCalcDeviceVariable);
    const [ calcDeviceVariable, setCalcDeviceVariable ] = useState<string>(query.calcDeviceVariable);
    const [ error, setError ] = useState<string>("");

    // prepare list of selected calculators
    const calcIds: string[] = (query.useCalculatorVariable === true) ? prepareItemsAndLabelsFromVariable(query.calculatorVariable, {}) : prepareItemsAndLabelsFromSelectedOptions(query.calculatorsSelected);
    const calculators = calcIds.join();

    const loadCalcDevices = async (inputValue: string) => {
        if (calculators === '') {
            // calculator is not yet selected, return empty array of devices
            return Promise.resolve([]);
        }
        const calcDevices = (await Promise.all(query.calculatorsSelected.map(calculator => {
            return FlespiSDK.fetchFlespiDevicesAssignedToCalculator(calculator.value ? calculator.value : 0, datasource.url)
                            .then((result: FlespiEntity[]) => (result.filter(device => (device.name.toLowerCase().includes(inputValue)))));
            }))).flat();
        return Array.from(new Set(calcDevices).values())
            .sort()
            .map(device => (prepareSelectOption(device.name, device.id))); 
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
                <InlineField>
                    <AsyncMultiSelect
                        key={calculators}
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
