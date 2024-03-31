import { QueryEditorProps, SelectableValue } from "@grafana/data";
import { DataSource } from "datasource";
import React, { ReactElement, useState, useEffect } from "react";
import { MyDataSourceOptions, MyQuery } from "types";
import { InlineLabel, InlineField, Select } from "@grafana/ui";
import { QUERY_TYPE_INTERVALS } from "../constants";
import { FlespiSDK } from "flespi-sdk";

export function Calculator(props: QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>): ReactElement {
    const { onChange, onRunQuery, datasource, query } = props;
    const [ calculatorSelected, setCalculatorSelected ] = useState<SelectableValue<number>>(query.calculatorSelected);
    const [ calculators, setCalculators ] = useState<Array<SelectableValue<number>>>([]);

    /////////////////////////////////////////////////////////////////////////////////
    // load all available calculators for future use as select options
    /////////////////////////////////////////////////////////////////////////////////
    useEffect(() => {
        // load containers and store them into state for the later use in drop-down
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
            <InlineField>
                <Select
                    value={calculatorSelected}
                    options={calculators}
                    width={40}
                    onChange={onChangeCalculatorSelect}
                />
            </InlineField>
        </div>
    );
}
