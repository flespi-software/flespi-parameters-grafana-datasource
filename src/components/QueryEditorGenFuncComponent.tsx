import React, { ReactElement, useState } from "react";
import { QueryEditorProps, SelectableValue } from "@grafana/data";
import { DataSource, defaultQuery } from "datasource";
import { MyDataSourceOptions, MyQuery } from "types";
import { InlineField, Select } from "@grafana/ui";
import { defaults } from "lodash";
import { GEN_FUNC_OPTIONS, QUERY_TYPE_DEVICES, QUERY_TYPE_STATISTICS, QUERY_TYPE_CONTAINERS } from "../constants";


export function GneralizationFunction(props: QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>): ReactElement {
    const { onChange, onRunQuery } = props;
    const query = defaults(props.query, defaultQuery);

    const [ genFunc, setGenFunc ] = useState<SelectableValue<string>>({ 
        label: query.generalizationFunction, 
        value: query.generalizationFunction 
    });

    /////////////////////////////////////////////////////////////////////////////////
    // render these controls only for query types devices, statistics and containers
    /////////////////////////////////////////////////////////////////////////////////
    if (query.queryType !== QUERY_TYPE_DEVICES && query.queryType !== QUERY_TYPE_STATISTICS && query.queryType !== QUERY_TYPE_CONTAINERS) {
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
