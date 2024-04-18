import { QueryEditorProps, SelectableValue } from "@grafana/data";
import { InlineField, InlineLabel, Input, Switch, MultiSelect } from "@grafana/ui";
import React, { ReactElement, useState, useEffect } from "react";
import { QUERY_TYPE_CONTAINERS } from "../constants";
import { DataSource } from "datasource";
import { FlespiSDK } from "flespi-sdk";
import { MyDataSourceOptions, MyQuery } from "types";
import { prepareSelectOption, processVariableInput } from "utils";

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
          const values = (await FlespiSDK.fetchAllFlespiContainers(datasource.url)).map(container => (prepareSelectOption(container.name, container.id)));
          setContainers(values);
        }
        fetchContainers().catch(console.error);
    }, [datasource, query]);

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
                        onChange={(option: Array<SelectableValue<number>>) => {
                            setContainersSelected(option);
                            onChange({ ...query, containersSelected: option });
                            onRunQuery();
                        }}
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
                    onChange={(event: any) => {
                        setContainerVariable(event.target.value);
                    }}
                    onKeyDown={(event: any) => {
                        // process 'Enter' key down event only
                        if (event.key !== 'Enter') {
                            return;
                        }
                        processVariableInput(event.target.value, query, 'containerVariable', setContainerVariable, setError, onChange, onRunQuery);
                    }}
                    onBlur={(event: any) => {
                        processVariableInput(event.target.value, query, 'containerVariable', setContainerVariable, setError, onChange, onRunQuery);
                    }}
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
