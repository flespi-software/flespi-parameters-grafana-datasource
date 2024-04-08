import { QueryEditorProps, SelectableValue } from "@grafana/data";
import { DataSource } from "datasource";
import React, { ReactElement, useState, useEffect } from "react";
import { MyDataSourceOptions, MyQuery } from "types";
import { InlineLabel, InlineField, Select, Switch, Input } from "@grafana/ui";
import { QUERY_TYPE_INTERVALS } from "../constants";
import { FlespiSDK } from "flespi-sdk";
import { getTemplateSrv } from "@grafana/runtime";

export function Calculator(props: QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>): ReactElement {
    const { onChange, onRunQuery, datasource, query } = props;
    const [ calculatorSelected, setCalculatorSelected ] = useState<SelectableValue<number>>(query.calculatorSelected);
    const [ calculators, setCalculators ] = useState<Array<SelectableValue<number>>>([]);
    const [ useCalculatorVariable, setUseCalculatorVariable ] = useState<boolean>(query.useCalculatorVariable);
    const [ calculatorVariable, setCalculatorVariable ] = useState<string>(query.calculatorVariable);
    const [ error, setError ] = useState<string>("");

    /////////////////////////////////////////////////////////////////////////////////
    // load all available calculators for future use as select options
    /////////////////////////////////////////////////////////////////////////////////
    useEffect(() => {
        // load calculators and store them into state for the later use in drop-down
        const fetchCalculators = async () => {
          const values = (await FlespiSDK.fetchAllFlespiCalculators(datasource.url)).map(calculator => {
            return {
                label: calculator.name,
                value: calculator.id,
            }
          });
          setCalculators(values);
        }
        fetchCalculators().catch(console.error);
    }, [datasource, query]);

    // handle changes in selected calculator 
    const onChangeCalculatorSelect = (option: SelectableValue<number>) => {
        // update selected calcualtor in the form state
        setCalculatorSelected(option);
        // save new parameter to query
        onChange({ ...query, calculatorSelected: option });
        // execute the query
        onRunQuery();
    };

    const onCalculatorInputChange = (event: any) => {
        // just update the value displayed in the input field
        setCalculatorVariable(event.target.value);
    }

    const onCalculatorInputKeyDown = (event: any) => {
        // process 'Enter' key down event only
        if (event.key !== 'Enter') {
          return;
        }
        processCalculatorVariableInput(event.target.value);
    }

    const onCalculatorInputBlur = (event: any) => {
        processCalculatorVariableInput(event.target.value);
    }

    const processCalculatorVariableInput = (inputValue: string) => {
        if (inputValue === '') {
          // nothing to do, just remove error message, if any
          setError("");
          return;
        }
        // check user input, if this is a valid dashboard variable
        const interpolations: any[] = [];
        getTemplateSrv().replace(inputValue, undefined, undefined, interpolations);
        if (interpolations[0] && interpolations[0].found === true) {
          // matching dashboard variable is found
          setCalculatorVariable(inputValue);
          setError("");
          onChange({ ...query, calculatorVariable: inputValue });
          onRunQuery();
        } else {
          // no matching dashboard variable has been found, display error message
          setError(`Invalid calculator variable: no variable ${inputValue} is defined for the dashboard`);
        }
      }


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
                    <Select
                        placeholder="Select calculator"
                        value={calculatorSelected}
                        options={calculators}
                        width={40}
                        onChange={onChangeCalculatorSelect}
                    />
                </InlineField>
            ) : (
                <InlineField invalid={error ? true : false} error={error}>
                <Input
                    name="calculator"
                    value={calculatorVariable}
                    onChange={onCalculatorInputChange}
                    onKeyDown={onCalculatorInputKeyDown}
                    onBlur={onCalculatorInputBlur}
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
