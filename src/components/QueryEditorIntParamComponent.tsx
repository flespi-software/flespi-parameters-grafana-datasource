import { QueryEditorProps, SelectableValue } from "@grafana/data";
import { QUERY_TYPE_INTERVALS } from "../constants";
import { DataSource } from "datasource";
import React, { useState, ReactElement } from "react";
import { MyDataSourceOptions, MyQuery } from "types";
import { AsyncMultiSelect, InlineField, InlineLabel, Input, Switch } from "@grafana/ui";
import { FlespiSDK } from "flespi-sdk";
import { prepareItemsAndLabelsFromSelectedOptions, prepareItemsAndLabelsFromVariable, processVariableInput } from "utils";


export function IntervalParameter(props: QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>): ReactElement {
    const { onChange, onRunQuery, datasource, query } = props;
    const [ useIntParamVariable, setUseIntParamVariable ] = useState<boolean>(query.useIntParamVariable);
    const [ intParamVariable, setIntParamVariable ] = useState<string>(query.intParamVariable);
    const [ intParamsSelected, setIntParamsSelected ] = useState<Array<SelectableValue<string>>>(() => {
        if (query.intParamsSelected) {
            return query.intParamsSelected.map((parameter: string) => ({label: parameter, value: parameter}));
        }
        return [];
    });
    const [ error, setError ] = useState<string>("");

    // prepare list of selected calculators
    const calcIds: string[] = (query.useCalculatorVariable === true) ? prepareItemsAndLabelsFromVariable(query.calculatorVariable, {}) : prepareItemsAndLabelsFromSelectedOptions(query.calculatorsSelected);
    const calculators = calcIds.join();

    // load intervals parameters for the selected calculators
    const loadFlespiIntervalParameters = async (inputValue: string) => {
        if (calculators === '') {
            // calculator is not yet selected, return empty array of parameters
            return Promise.resolve([]);
        }
        const intParameters = (await Promise.all(calcIds.map(calculator => {
            return FlespiSDK.fetchLastFlespiInterval(calculator, datasource.url)
                            .then((result: string[]) => (result.filter((parameter: string) => parameter.toLowerCase().includes(inputValue))));
            }))).flat();
        return Array.from(new Set(intParameters).values())
            .sort()
            .map((parameter: string) => ({value: parameter, label: parameter})); 
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
            <InlineField label="Use dashboard variable">
                <div className='gf-form-switch'>
                <Switch
                    value={!!useIntParamVariable}
                    onChange={() => {
                        setUseIntParamVariable(!useIntParamVariable);
                        onChange({ ...query, useIntParamVariable: !query.useIntParamVariable });
                    }}
                />
                </div>     
            </InlineField>
            {!useIntParamVariable ? (
                <InlineField labelWidth={16}>
                    <AsyncMultiSelect
                        key={calculators}
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
                        placeholder=''
                    />
                </InlineField>
            ) : (
                <InlineField invalid={error ? true : false} error={error}>
                <Input
                    name="parameter"
                    value={intParamVariable}
                    onChange={(event: any) => {
                        setIntParamVariable(event.target.value);
                        onChange({ ...query, intParamVariable: event.target.value });
                    }}
                    onKeyDown={(event: any) => {
                        if (event.key !== 'Enter') {
                            return;
                        }   
                        onRunQuery();
                        processVariableInput(event.target.value, query, 'intParamVariable', setIntParamVariable, setError, onChange, onRunQuery);
                    }}
                    onBlur={(event: any) => {
                        processVariableInput(event.target.value, query, 'intParamVariable', setIntParamVariable, setError, onChange, onRunQuery);
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
