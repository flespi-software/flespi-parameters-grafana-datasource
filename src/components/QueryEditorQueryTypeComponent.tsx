import { QueryEditorProps } from "@grafana/data";
import { InlineField, RadioButtonGroup } from "@grafana/ui";
import { QUERY_TYPE_OPTIONS } from "../constants";
import { DataSource, defaultQuery } from "datasource";
import { defaults } from "lodash";
import React, { ReactElement, useState } from "react";
import { MyDataSourceOptions, MyQuery } from "types";


export function QueryType(props: QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>): ReactElement {
    const { onChange, query } = props;  
    const defaultedQuery = defaults(query, defaultQuery);
    const [ queryType, setQueryType ] = useState<string>(defaultedQuery.queryType);

    /////////////////////////////////////////////////////////////////////////////////
    // render Query Type element: radio buttons group 
    /////////////////////////////////////////////////////////////////////////////////
    return (
        <div className="gf-form">
          <InlineField label="Query Type" labelWidth={26}>
            <RadioButtonGroup 
                options={QUERY_TYPE_OPTIONS}
                value={queryType} 
                onChange={(event: any) => {
                setQueryType(event);
                onChange({ ...query, queryType: event });
                }} />
          </InlineField>
        </div>
      );
}
