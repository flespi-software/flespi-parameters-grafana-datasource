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

export function QueryEditor(props: QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>): ReactElement {
  const { onChange, onRunQuery, datasource, query } = props;
  return (
    <>
      <QueryType datasource={datasource} query={query} onRunQuery={onRunQuery} onChange={onChange} />
      <Device datasource={datasource} query={query} onRunQuery={onRunQuery} onChange={onChange} />
      <TelemetryParameter datasource={datasource} query={query} onRunQuery={onRunQuery} onChange={onChange} />
      <Account datasource={datasource} query={query} onRunQuery={onRunQuery} onChange={onChange} />
      <StatisticsParameter datasource={datasource} query={query} onRunQuery={onRunQuery} onChange={onChange} />
      <GneralizationFunction datasource={datasource} query={query} onRunQuery={onRunQuery} onChange={onChange} />
    </>
  );
}
