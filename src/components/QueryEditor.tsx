import { QueryEditorProps } from "@grafana/data";
import { DataSource } from "datasource";
import React, { ReactElement } from "react";
import { MyDataSourceOptions, MyQuery } from "types";
import { Device } from "./QueryEditorDeviceComponent";
import { QueryType } from "./QueryEditorQueryTypeComponent";
import { Account } from "./QueryEditorAccountComponent";
import { TelemetryParameter } from "./QueryEditorTelemParamComponent";
import { StatisticsParameter } from "./QueryEditorStatParamComponent";
import { GneralizationFunction } from "./QueryEditorGenFuncComponent";
import { tempBackwardCompatibilityConversion } from "../constants";
import { LogsSource } from "./QueryEditorLogsSourceComponent";
import { LogsSourceType } from "./QueryEditorLogsSourceTypeComponent";
import { LogParameter } from "./QueryEditorLogParamComponent";

export function QueryEditor(props: QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>): ReactElement {
    const { onChange, onRunQuery, datasource, query } = props;
    console.log(JSON.stringify(props.query))
    if (tempBackwardCompatibilityConversion(query) === true) {
        // save chages to query, if backward compatibility was applied
        onChange(query);
    }

    return (
        <>
            <QueryType datasource={datasource} query={query} onRunQuery={onRunQuery} onChange={onChange} />
            <Device datasource={datasource} query={query} onRunQuery={onRunQuery} onChange={onChange} />
            <TelemetryParameter datasource={datasource} query={query} onRunQuery={onRunQuery} onChange={onChange} />
            <Account datasource={datasource} query={query} onRunQuery={onRunQuery} onChange={onChange} />
            <StatisticsParameter datasource={datasource} query={query} onRunQuery={onRunQuery} onChange={onChange} />
            <GneralizationFunction datasource={datasource} query={query} onRunQuery={onRunQuery} onChange={onChange} />
            <LogsSourceType datasource={datasource} query={query} onRunQuery={onRunQuery} onChange={onChange} />
            <LogsSource datasource={datasource} query={query} onRunQuery={onRunQuery} onChange={onChange} />
            <LogParameter datasource={datasource} query={query} onRunQuery={onRunQuery} onChange={onChange} />
        </>
    );
}
