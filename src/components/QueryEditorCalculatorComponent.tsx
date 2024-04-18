import { QueryEditorProps, SelectableValue } from "@grafana/data";
import { DataSource } from "datasource";
import React, { ReactElement, useState, useEffect } from "react";
import { MyDataSourceOptions, MyQuery } from "types";
import { InlineLabel, InlineField, Switch, Input, MultiSelect } from "@grafana/ui";
import { QUERY_TYPE_INTERVALS } from "../constants";
import { FlespiSDK } from "flespi-sdk";
import { prepareSelectOption, processVariableInput } from "utils";

export function Calculator(props: QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>): ReactElement {
    const { onChange, onRunQuery, datasource, query } = props;
    const [ calculatorsSelected, setCalculatorsSelected ] = useState<Array<SelectableValue<number>>>(query.calculatorsSelected);
    const [ calculators, setCalculators ] = useState<Array<SelectableValue<number>>>([]);
    const [ useCalculatorVariable, setUseCalculatorVariable ] = useState<boolean>(query.useCalculatorVariable);
    const [ calculatorVariable, setCalculatorVariable ] = useState<string>(query.calculatorVariable);
    const [ error, setError ] = useState<string>("");

    /////////////////////////////////////////////////////////////////////////////////
    // load all available calculators for future use as select options
    /////////////////////////////////////////////////////////////////////////////////
    useEffect(() => {
        const fetchCalculators = async () => {
          const values = (await FlespiSDK.fetchAllFlespiCalculators(datasource.url)).map(calculator => (prepareSelectOption(calculator.name, calculator.id)));
          setCalculators(values);
        }
        fetchCalculators().catch(console.error);
    }, [datasource, query]);

    /////////////////////////////////////////////////////////////////////////////////
    // render these controls only for query type QUERY_TYPE_INTERVALS
    /////////////////////////////////////////////////////////////////////////////////
    if (query.queryType !== QUERY_TYPE_INTERVALS) {
        return <div/>;
    }

    /////////////////////////////////////////////////////////////////////////////////
    // render controls to specify flespi calcualtor for query
    /////////////////////////////////////////////////////////////////////////////////   
    return (
        <div className="gf-form">
            <InlineLabel width={16} tooltip="Choose calculator for query">
            Calculator
            </InlineLabel>
            <InlineField label="Use dashboard variable">
                <div className='gf-form-switch'>
                    <Switch
                        value={!!useCalculatorVariable}
                        onChange={() => {
                            setUseCalculatorVariable(!useCalculatorVariable);
                            onChange({ ...query, useCalculatorVariable: !query.useCalculatorVariable });
                        }}
                    />
                </div>
            </InlineField>
            {!useCalculatorVariable ? (
                <InlineField>
                    <MultiSelect
                        placeholder="Select calculator"
                        value={calculatorsSelected}
                        options={calculators}
                        width={40}
                        onChange={(option: Array<SelectableValue<number>>) => {
                            setCalculatorsSelected(option);
                            onChange({ ...query, calculatorsSelected: option });
                            onRunQuery();
                        }}
                    />
                </InlineField>
            ) : (
                <InlineField invalid={error ? true : false} error={error}>
                <Input
                    name="calculator"
                    value={calculatorVariable}
                    onChange={(event: any) => {
                        setCalculatorVariable(event.target.value);
                    }}
                    onKeyDown={(event: any) => {
                        // process 'Enter' key down event only
                        if (event.key !== 'Enter') {
                            return;
                        }
                        processVariableInput(event.target.value, query, 'calculatorVariable', setCalculatorVariable, setError, onChange, onRunQuery);
                    }}
                    onBlur={(event: any) => {
                        processVariableInput(event.target.value, query, 'calculatorVariable', setCalculatorVariable, setError, onChange, onRunQuery);
                    }}
                    required
                    type="text"
                    width={40}
                    placeholder="$calculator"
                />
                </InlineField>
            )}
        </div>
    );
}
