import { QueryEditorProps, SelectableValue } from "@grafana/data";
import { MyDataSourceOptions, MyQuery } from "types";
import { DataSource } from "datasource";
import { QUERY_TYPE_INTERVALS } from "../constants";
import React, { ReactElement, useState } from "react";
import { InlineLabel, InlineField, AsyncMultiSelect, Switch } from "@grafana/ui";
import { FlespiSDK } from "flespi-sdk";

export function CalcDevice(props: QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>): ReactElement {
    const { onChange, onRunQuery, datasource, query } = props;
    const [ calcDevicesSelected, setCalcDevicesSelected ] = useState<Array<SelectableValue<number>>>(query.calcDevicesSelected);
    const [ useContainerVariable, setUseContainerVariable ] = useState<boolean>(query.useContainerVariable);


    const calculatorSelected = query.calculatorSelected.value?.toString();
    // console.log("============ #1");
    // console.log(calculatorSelected);
    // console.log(query.calculatorSelected);

    const loadCalcDevices = async (inputValue: string) => {
        // console.log("=========== loadCalcDevices():: " + calculatorSelected);
        if (calculatorSelected === undefined) {
            // calculator is not yet selected, return empty array of devices
            return Promise.resolve([]);
        }
        // fetch calcdevices and create select options
        return (await FlespiSDK.fetchFlespiDevicesAssignedToCalculator(query.calculatorSelected.value ? query.calculatorSelected.value : 0, datasource.url))
            .map((device: any) => { return { value: device.id, label: device.name } });
    };

    const onChangeCalcDevicesSelect = (option: any) => {
        // update form state
        setCalcDevicesSelected(option);
        // save new parameter to query
        onChange({ ...query, calcDevicesSelected: option });
        // execute the query
        onRunQuery();
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
    console.log("====== #1");
    console.log(calculatorSelected);  
    return (
        <div className="gf-form">
            <InlineLabel width={16} tooltip="Choose calc's device for query">
            Device
            </InlineLabel>
            <InlineField label="Use dashboard variable">
                <div className='gf-form-switch'>
                    <Switch
                        value={!!useContainerVariable}
                        onChange={() => {
                            setUseContainerVariable(!useContainerVariable);
                            onChange({ ...query, useContainerVariable: !query.useContainerVariable });
                        }}
                    />
                </div>
            </InlineField>
            <InlineField disabled={calculatorSelected ? false : true}>
                <AsyncMultiSelect
                    key={calculatorSelected}
                    value={calcDevicesSelected}
                    loadOptions={loadCalcDevices}
                    onChange={onChangeCalcDevicesSelect}
                    defaultOptions
                    cacheOptions
                    width={40}
                    placeholder=''
                />
            </InlineField>
        </div>
    );

}
