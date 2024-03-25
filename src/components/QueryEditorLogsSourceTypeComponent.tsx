import { QueryEditorProps } from "@grafana/data";
import { InlineField, RadioButtonGroup } from "@grafana/ui";
import { LOGS_SOURCE_OPTIONS, QUERY_TYPE_LOGS } from "../constants";
import { DataSource, defaultQuery } from "datasource";
import { defaults } from "lodash";
import React, { ReactElement, useState } from "react";
import { MyDataSourceOptions, MyQuery } from "types";


export function LogsSourceType(props: QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>): ReactElement {
    const { onChange, query } = props;  
    const defaultedQuery = defaults(query, defaultQuery);
    const [ logsSourceType, setLogsSourceType ] = useState<string>(defaultedQuery.logsSourceType);

    /////////////////////////////////////////////////////////////////////////////////
    // user changed query type switch (radio buttons group)
    /////////////////////////////////////////////////////////////////////////////////
    const onLogsSourceTypeChange = (event: any) => {
        // update component state
        setLogsSourceType(event);
        // update query
        onChange({ ...query, logsSourceType: event });
    }
    
    /////////////////////////////////////////////////////////////////////////////////
    // render these controls only for query type QUERY_TYPE_LOGS
    /////////////////////////////////////////////////////////////////////////////////
    if (query.queryType !== QUERY_TYPE_LOGS) {
        return <div/>;
    }

    /////////////////////////////////////////////////////////////////////////////////
    // render Logs Source Type element: radio buttons group 
    /////////////////////////////////////////////////////////////////////////////////
    return (
        <div className="gf-form">
          <InlineField label="Logs Source" labelWidth={26}>
            <RadioButtonGroup 
                options={LOGS_SOURCE_OPTIONS}
                value={logsSourceType} 
                onChange={onLogsSourceTypeChange} />
          </InlineField>
        </div>
      );
}
