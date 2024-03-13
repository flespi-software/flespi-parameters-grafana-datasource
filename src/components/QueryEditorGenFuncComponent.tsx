import React, { ReactElement, useState } from "react";
import { QueryEditorProps, SelectableValue } from "@grafana/data";
import { DataSource, defaultQuery } from "datasource";
import { MyDataSourceOptions, MyQuery } from "types";
import { InlineField, Select } from "@grafana/ui";
import { defaults } from "lodash";
import { GEN_FUNC_OPTIONS } from "../constants";


export function GneralizationFunction(props: QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>): ReactElement {
    const { onChange, onRunQuery } = props;
    const query = defaults(props.query, defaultQuery);

    const [ genFunc, setGenFunc ] = useState<SelectableValue<string>>({ 
        label: query.generalizationFunction, 
        value: query.generalizationFunction 
    });

    /////////////////////////////////////////////////////////////////////////////////
    // render these controls only for query type 'devices'
    /////////////////////////////////////////////////////////////////////////////////
    if (query.queryType !== 'devices' && query.queryType !== 'statistics') {
        return <div/>;
    }

    /////////////////////////////////////////////////////////////////////////////////
    // render controls to specify generalization function for query
    /////////////////////////////////////////////////////////////////////////////////
    return (
        <div className="gf-form">
        <InlineField label="Generalization Function" labelWidth={26}>
        <Select
            value={genFunc}
            options={GEN_FUNC_OPTIONS}
            onChange={option => {
                setGenFunc(option);
                onChange({ ...query, generalizationFunction: option.value });
                onRunQuery();
            }}
        />
        </InlineField>
        </div>
    );
}
