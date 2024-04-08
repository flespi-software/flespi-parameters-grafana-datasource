import { QueryEditorProps, SelectableValue } from "@grafana/data";
import { InlineField, InlineLabel, Input, MultiSelect, Switch } from "@grafana/ui";
import { LOGS_SOURCE_DEVICE, LOGS_SOURCE_STREAM, QUERY_TYPE_LOGS } from "../constants";
import { DataSource } from "datasource";
import React, { ReactElement, useEffect, useState } from "react";
import { MyDataSourceOptions, MyQuery } from "types";
import { FlespiSDK } from "flespi-sdk";
import { processVariableInput } from "utils";

export function LogsSource(props: QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>): ReactElement {
    const { onChange, onRunQuery, datasource, query } = props;
    const [ logsSources, setLogsSources ] = useState<Array<SelectableValue<number>>>([]);
    const [ useLogsSourceVariable, setUseLogsSourceVariable ] = useState<boolean>(query.useLogsSourceVariable);
    const [ logsSourceVariable, setLogsSourceVariable ] = useState<string>(query.logsSourceVariable);
    const [ logsSourcesSelected, setLogsSourcesSelected ] = useState<Array<SelectableValue<number>>>(query.logsSourcesSelected);
    const [ error, setError ] = useState<string>("");

    /////////////////////////////////////////////////////////////////////////////////
    // load all available logs sources for future use as select options
    /////////////////////////////////////////////////////////////////////////////////
    useEffect(() => {
        const fetchLogsSources = async () => {
            let values
            if (query.logsSourceType === LOGS_SOURCE_DEVICE) {
                values = (await FlespiSDK.fetchAllFlespiDevices(datasource.url)).map(device => ({label: device.name, value: device.id}));
            } else {
                // query.logsSourceType === LOGS_SOURCE_STREAM
                values = (await FlespiSDK.fetchAllFlespiStreams(datasource.url)).map(stream => ({label: stream.name, value: stream.id}));
            }
            setLogsSources(values);
        }
        fetchLogsSources().catch(console.error);
    }, [datasource, query]);

    /////////////////////////////////////////////////////////////////////////////////
    // render these controls only for query type QUERY_TYPE_LOGS
    /////////////////////////////////////////////////////////////////////////////////
    if (query.queryType !== QUERY_TYPE_LOGS) {
        return <div/>;
    }

    /////////////////////////////////////////////////////////////////////////////////
    // render controls to specify flespi items for query
    /////////////////////////////////////////////////////////////////////////////////
    let tooltip, label, placeholderSelect, placeholderInput
    switch(query.logsSourceType) {
        case LOGS_SOURCE_DEVICE:
            label = 'Devices';
            tooltip = 'Choose devices for query';
            placeholderSelect = 'Select device';
            placeholderInput = '$device';
            break;
        case LOGS_SOURCE_STREAM:
            label = 'Streams';
            tooltip = 'Choose streams for query';
            placeholderSelect = 'Select stream';
            placeholderInput = '$stream';
            break;
    }
    return (
        <div className="gf-form">
            <InlineLabel width={16} tooltip={tooltip}>
                {label}
            </InlineLabel>
          <InlineField label="Use dashboard variable">
            <div className='gf-form-switch'>
              <Switch
                value={!!useLogsSourceVariable}
                onChange={() => {
                    setUseLogsSourceVariable(!useLogsSourceVariable);
                    onChange({ ...query, useLogsSourceVariable: !query.useLogsSourceVariable });
                }}
              />
            </div>
          </InlineField>
          {!useLogsSourceVariable ? (
            // if useLogsSourceVariable==false - render Select with logs sources for the user to select a one for the query
            <InlineField>
              <MultiSelect 
                value={logsSourcesSelected}
                options={logsSources}
                onChange={(option: Array<SelectableValue<number>>) => {
                    setLogsSourcesSelected(option);
                    onChange({ ...query, logsSourcesSelected: option });
                    onRunQuery();
                }}
                width={40}
                placeholder={placeholderSelect}
              />
            </InlineField>
          ) : (
            // if useLogsSourceVariable==true - render Input where user will type name of the variable to take logs source from
            <InlineField invalid={error ? true : false} error={error}>
              <Input
                name="logsSource"
                value={logsSourceVariable}
                onChange={(event: any) => {
                    setLogsSourceVariable(event.target.value);
                }}
                onKeyDown={(event: any) => {
                    // process 'Enter' key down event only
                    if (event.key !== 'Enter') {
                        return;
                    }
                    processVariableInput(event.target.value, query, 'logsSourceVariable', setLogsSourceVariable, setError, onChange, onRunQuery);
                }}
                onBlur={(event: any) => {
                    processVariableInput(event.target.value, query, 'logsSourceVariable', setLogsSourceVariable, setError, onChange, onRunQuery);
                }}
                required
                type="text"
                width={40}
                placeholder={placeholderInput}
              />
            </InlineField>
          )}
        </div>
    );
}
