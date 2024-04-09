import { QueryEditorProps, SelectableValue } from "@grafana/data";
import { QUERY_TYPE_INTERVALS } from "../constants";
import { DataSource } from "datasource";
import React, { useState, ReactElement } from "react";
import { MyDataSourceOptions, MyQuery } from "types";
import { AsyncMultiSelect, InlineField, InlineLabel } from "@grafana/ui";
import { FlespiSDK } from "flespi-sdk";


export function IntervalParameter(props: QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>): ReactElement {
    const { onChange, onRunQuery, datasource, query } = props;
    const [ intParamsSelected, setIntParamsSelected ] = useState<Array<SelectableValue<string>>>(() => {
        if (query.intParamsSelected) {
            return query.intParamsSelected.map((parameter: string) => ({label: parameter, value: parameter}));
        }
        return [];
    });

    const devicesSelected = query.calcDevicesSelected;
    const calcSelected = query.calculatorSelected.value ? query.calculatorSelected.value : 0;
    const deviceSelected = devicesSelected[0].value ? devicesSelected[0].value : 0;
    const devices = devicesSelected.map((device: SelectableValue<number>) => device.value).join();

    // load statistics parameters for the accounts selected in Accounts drop down
    const loadFlespiIntervalParameters = async (inputValue: string) => {
        if (devicesSelected.toString() === '') {
            // device is not yet selected, return empty array of parameters
            return Promise.resolve([]);
        }
        // fetch interval parameters
        const intParameters = await FlespiSDK.fetchLastFlespiInterval(calcSelected, deviceSelected, datasource.url).then((result: string[]) => {
            return result
            // filter parameters based on user input in Parameter select field
            .filter((parameter: string) => parameter.toLowerCase().includes(inputValue));
        });

        return intParameters.map((parameter: string) => ({value: parameter, label: parameter}));
    };

    /////////////////////////////////////////////////////////////////////////////////
    // render these controls only for query type QUERY_TYPE_INTERVALS
    /////////////////////////////////////////////////////////////////////////////////
    if (query.queryType !== QUERY_TYPE_INTERVALS) {
        return <div/>;
    }

    /////////////////////////////////////////////////////////////////////////////////
    // render controls to specify intervals parameters for query
    /////////////////////////////////////////////////////////////////////////////////
    return (
        <div className="gf-form">
            <InlineLabel width={16} tooltip="Choose interval parameters for query">
                Parameters
            </InlineLabel>
            <InlineField labelWidth={16}>
                <AsyncMultiSelect
                    key={devices}
                    value={intParamsSelected}
                    loadOptions={loadFlespiIntervalParameters}
                    defaultOptions
                    cacheOptions
                    onChange={(option: any) => {
                        setIntParamsSelected(option);
                        onChange({ ...query, intParamsSelected: option.map((param: SelectableValue<string>) => (param.value!)) });
                        onRunQuery();
                    }}
                    width={40}
                    noOptionsMessage="Telemetry not found"
                    allowCustomValue={true}
                />
            </InlineField>
        </div>
    );
}
