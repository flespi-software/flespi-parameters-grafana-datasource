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

    const disabledOptions = ['intervals'];

    /////////////////////////////////////////////////////////////////////////////////
    // user changed query type switch (radio buttons group)
    /////////////////////////////////////////////////////////////////////////////////
    const onQueryTypeChange = (event: any) => {
        // update component state
        setQueryType(event);
        // update query
        onChange({ ...query, queryType: event });
    }

    /////////////////////////////////////////////////////////////////////////////////
    // render Query Type element: radio buttons group 
    /////////////////////////////////////////////////////////////////////////////////
    return (
        <div className="gf-form">
          <InlineField label="Query Type" labelWidth={26}>
            <RadioButtonGroup 
                options={QUERY_TYPE_OPTIONS}
                disabledOptions={disabledOptions}
                value={queryType} 
                onChange={onQueryTypeChange} />
          </InlineField>
        </div>
      );
}
