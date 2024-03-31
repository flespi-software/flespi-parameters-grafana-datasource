import { QueryEditorProps, SelectableValue } from "@grafana/data";
import { getTemplateSrv } from "@grafana/runtime";
import { InlineField, InlineLabel, Input, Switch, MultiSelect } from "@grafana/ui";
import React, { ReactElement, useState, useEffect } from "react";
import { QUERY_TYPE_CONTAINERS } from "../constants";
import { DataSource } from "datasource";
import { FlespiSDK } from "flespi-sdk";
import { MyDataSourceOptions, MyQuery } from "types";

export function Container(props: QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>): ReactElement {
    const { onChange, onRunQuery, datasource, query } = props;
    const [ containers, setContainers ] = useState<Array<SelectableValue<number>>>([]);
    const [ useContainerVariable, setUseContainerVariable ] = useState<boolean>(query.useContainerVariable);
    const [ containerVariable, setContainerVariable ] = useState<string>(query.containerVariable);
    const [ containersSelected, setContainersSelected ] = useState<Array<SelectableValue<number>>>(query.containersSelected);
    const [ error, setError ] = useState<string>("");

    /////////////////////////////////////////////////////////////////////////////////
    // load all available containers for future use as select options
    /////////////////////////////////////////////////////////////////////////////////
    useEffect(() => {
        // load containers and store them into state for the later use in drop-down
        const fetchContainers = async () => {
          const values = (await FlespiSDK.fetchAllFlespiContainers(datasource.url)).map(container => {
            return {
                label: container.name,
                value: container.id,
            }
          });
          setContainers(values);
        }
        fetchContainers().catch(console.error);
      }, [datasource, query]);

    /////////////////////////////////////////////////////////////////////////////////
    // handle changes in selected containers 
    /////////////////////////////////////////////////////////////////////////////////
    const onChangeContainersSelect = (option: Array<SelectableValue<number>>) => {
        // update selected containers in the form state
        setContainersSelected(option);
        // save new parameter to query
        onChange({ ...query, containersSelected: option });
        // execute the query
        onRunQuery();
    };

    /////////////////////////////////////////////////////////////////////////////////
    // container input event handler: text typed
    /////////////////////////////////////////////////////////////////////////////////
    const onContainerInputChange = (event: any) => {
        // just update the value displayed in the input field
        setContainerVariable(event.target.value);
    }
    /////////////////////////////////////////////////////////////////////////////////
    // container input event hander: key down
    /////////////////////////////////////////////////////////////////////////////////
    const onContainerInputKeyDown = (event: any) => {
        // process 'Enter' key down event only
        if (event.key !== 'Enter') {
          return;
        }
        processContainerVariableInput(event.target.value);
    }
    /////////////////////////////////////////////////////////////////////////////////
    // container input hander: focus lost
    /////////////////////////////////////////////////////////////////////////////////
    const onContainerInputBlur = (event: any) => {
        processContainerVariableInput(event.target.value);
    }

    /////////////////////////////////////////////////////////////////////////////////
    // container input hander: user types variable name into input
    /////////////////////////////////////////////////////////////////////////////////
    const processContainerVariableInput = (inputValue: string) => {
        // container variable input field is empty
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
          setContainerVariable(inputValue);
          setError("");
          // set new container variable to the query and run query() to render the graph
          onChange({ ...query, containerVariable: inputValue });
          onRunQuery();
        } else {
          // no matching dashboard variable has been found, display error message
          setError(`Invalid container variable: no variable ${inputValue} is defined for the dashboard`);
        }
      }

    /////////////////////////////////////////////////////////////////////////////////
    // render these controls only for query type QUERY_TYPE_CONTAINERS
    /////////////////////////////////////////////////////////////////////////////////
    if (query.queryType !== QUERY_TYPE_CONTAINERS) {
        return <div/>;
    }

    /////////////////////////////////////////////////////////////////////////////////
    // render controls to specify flespi container for query
    /////////////////////////////////////////////////////////////////////////////////
    return (
        <div className="gf-form">
            <InlineLabel width={16} tooltip="Choose containers for query">
            Containers
            </InlineLabel>
            <InlineField label="Use dashboard variable">
                <div className='gf-form-switch'>
                    <Switch
                        value={!!useContainerVariable}
                        onChange={() => {
                            setUseContainerVariable(!useContainerVariable);
                            onChange({ ...query, useContainerVariable: !query.useContainerVariable });
                        }}
                    />
                </div>
            </InlineField>
            {!useContainerVariable ? (
                // if useContainerVariable==false - render Select with containers for the user to select a container for the query
                <InlineField>
                    <MultiSelect 
                        value={containersSelected}
                        options={containers}
                        onChange={onChangeContainersSelect}
                        width={40}
                        placeholder="Select container"
                    />
                </InlineField>
            ) : (
                // if useContainerVariable==true - render Input where user will type name of the variable to take container from
                <InlineField invalid={error ? true : false} error={error}>
                <Input
                    name="container"
                    value={containerVariable}
                    onChange={onContainerInputChange}
                    onKeyDown={onContainerInputKeyDown}
                    onBlur={onContainerInputBlur}
                    required
                    type="text"
                    width={40}
                    placeholder="$container"
                />
                </InlineField>
            )}
        </div>
    );
}
