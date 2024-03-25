import { QueryEditorProps, SelectableValue } from "@grafana/data";
import { InlineField, InlineLabel, Input, MultiSelect, Switch } from "@grafana/ui";
import { LOGS_SOURCE_DEVICE, LOGS_SOURCE_STREAM, QUERY_TYPE_LOGS } from "../constants";
import { DataSource } from "datasource";
import React, { ReactElement, useEffect, useState } from "react";
import { MyDataSourceOptions, MyQuery } from "types";
import { getTemplateSrv } from "@grafana/runtime";
import { FlespiSDK } from "flespi-sdk";

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
        // load logs sources and store them into state for the later use in drop-downs
        const fetchLogsSources = async () => {
            let values
            if (query.logsSourceType === LOGS_SOURCE_DEVICE) {
                values = (await FlespiSDK.fetchAllFlespiDevices(datasource.url)).map(device => {
                    return {
                        label: device.name,
                        value: device.id,
                    }
                });
            } else {
                // query.logsSourceType === LOGS_SOURCE_STREAM
                values = (await FlespiSDK.fetchAllFlespiStreams(datasource.url)).map(stream => {
                    return {
                        label: stream.name,
                        value: stream.id,
                    }
                });
            }
            setLogsSources(values);
        }
        fetchLogsSources().catch(console.error);
    }, [datasource, query]);

    /////////////////////////////////////////////////////////////////////////////////
    // log source input event handler: text typed
    /////////////////////////////////////////////////////////////////////////////////
    const onLogsSourcesInputChange = (event: any) => {
        // just update the value displayed in the input field
        setLogsSourceVariable(event.target.value);
    }
    /////////////////////////////////////////////////////////////////////////////////
    // logs source input event hander: key down
    /////////////////////////////////////////////////////////////////////////////////
    const onLogsSourcesInputKeyDown = (event: any) => {
        // process 'Enter' key down event only
        if (event.key !== 'Enter') {
          return;
        }
        processLogsSourcesVariableInput(event.target.value);
    }
    /////////////////////////////////////////////////////////////////////////////////
    // logs source input hander: focus lost
    /////////////////////////////////////////////////////////////////////////////////
    const onLogsSourcesInputBlur = (event: any) => {
        processLogsSourcesVariableInput(event.target.value);
    }

    /////////////////////////////////////////////////////////////////////////////////
    // logs sources input hander: user types variable name into input
    /////////////////////////////////////////////////////////////////////////////////
    const processLogsSourcesVariableInput = (inputValue: string) => {
        // logs source variable input field is empty
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
          setLogsSourceVariable(inputValue);
          setError("");
          // set new logs source variable to the query and run query() to render the graph
          onChange({ ...query, logsSourceVariable: inputValue });
          onRunQuery();
        } else {
          // no matching dashboard variable has been found, display error message
          setError(`Invalid logs source variable: no variable ${inputValue} is defined for the dashboard`);
        }
      }

    // handle changes in selected logs sources 
    const onChangeLogsSourcesSelect = (option: Array<SelectableValue<number>>) => {
        // update selected logs sources in the form state
        setLogsSourcesSelected(option);
        // save new logs souces to query
        onChange({ ...query, logsSourcesSelected: option });
        // execute the query
        onRunQuery();
  };

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
                onChange={onChangeLogsSourcesSelect}
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
                onChange={onLogsSourcesInputChange}
                onKeyDown={onLogsSourcesInputKeyDown}
                onBlur={onLogsSourcesInputBlur}
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
