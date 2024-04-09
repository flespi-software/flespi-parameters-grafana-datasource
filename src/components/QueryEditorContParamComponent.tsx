import { QueryEditorProps, SelectableValue } from "@grafana/data";
import { AsyncMultiSelect, InlineField, InlineLabel, Input, Switch } from "@grafana/ui";
import { QUERY_TYPE_CONTAINERS } from "../constants";
import { DataSource, defaultQuery } from "datasource";
import { FlespiSDK } from "flespi-sdk";
import { defaults } from "lodash";
import React, { ReactElement, useState } from "react";
import { MyDataSourceOptions, MyQuery } from "types";
import { processVariableInput } from "utils";


export function ContainerParameter(props: QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>): ReactElement {
    const { onChange, onRunQuery, datasource } = props;
    const query = defaults(props.query, defaultQuery);

    const [ useContParamVariable, setUseContParamVariable ] = useState<boolean>(query.useContParamVariable);
    const [ contParamVariable, setContParamVariable ] = useState<string>(query.contParamVariable);
    const [ contParamsSelected, setContParamsSelected ] = useState<Array<SelectableValue<string>>>(() => {
        if (query.contParamsSelected) {
            return query.contParamsSelected.map((parameter) => {
                return {
                    label: parameter,
                    value: parameter,
                };
            });
        }
        return [];
    });
    const [ error, setError ] = useState<string>("");
    const containersSelected = query.containersSelected;
    const containers = containersSelected.map((container: SelectableValue<number>) => container.value).join();

    // load container parameters for the containers selected in the drop down
    const loadFlespiContainerParameters = async (inputValue: string) => {
        if (containersSelected.toString() === '') {
            // container is not yet selected, return empty array of parameters
            return Promise.resolve([]);
        }
        // fetch container parameters for all selected container
        const contParams = await Promise.all(containersSelected.map(container => {
            return FlespiSDK.fetchFlespiContainerParameters(container.value ? container.value : 0, datasource.url, inputValue).then((result: string[]) => {
                return result
                // filter parameters based on user input in Parameter select field
                .filter((parameter: string) => parameter.toLowerCase().includes(inputValue));
            });
        }));
        const containersParameters = (await Promise.all(contParams)).flat();
        const containersParametersUnique = new Set(containersParameters);

        return Array.from(containersParametersUnique.values())
            .sort()
            .map((parameter: string) => ({ value: parameter, label: parameter }));
    };

    /////////////////////////////////////////////////////////////////////////////////
    // render these controls only for query type QUERY_TYPE_CONTAINERS
    /////////////////////////////////////////////////////////////////////////////////
    if (query.queryType !== QUERY_TYPE_CONTAINERS) {
        return <div/>;
    }

    /////////////////////////////////////////////////////////////////////////////////
    // render controls to specify container parameters for query
    /////////////////////////////////////////////////////////////////////////////////
    return (
        <div  className="gf-form">
            <InlineLabel width={16} tooltip="Choose container parameters for query">
                Parameters
            </InlineLabel>
            <InlineField label="Use dashboard variable">
                <div className='gf-form-switch'>
                <Switch
                    value={!!useContParamVariable}
                    onChange={() => {
                        setUseContParamVariable(!useContParamVariable);
                        onChange({ ...query, useContParamVariable: !query.useContParamVariable });
                    }}
                />
                </div>     
            </InlineField>
        {!useContParamVariable ? (
            <InlineField labelWidth={16}>
                <AsyncMultiSelect
                    key={containers}
                    value={contParamsSelected}
                    loadOptions={loadFlespiContainerParameters}
                    defaultOptions
                    cacheOptions
                    onChange={(option: any) => {
                        setContParamsSelected(option);
                        onChange({ ...query, contParamsSelected: option.map((param: SelectableValue<string>) => { return param.value!; }) });
                        onRunQuery();
                    }}
                    width={40}
                    noOptionsMessage="Container parameters not found"
                    allowCustomValue={true}
                />
            </InlineField>
            ) : (
            <InlineField invalid={error ? true : false} error={error}>
                <Input
                    name="parameter"
                    value={contParamVariable}
                    onChange={(event: any) => {
                        setContParamVariable(event.target.value);
                        onChange({ ...query, contParamVariable: event.target.value });
                    }}
                    onKeyDown={(event: any) => {
                        if (event.key !== 'Enter') {
                            return;
                        }
                        onRunQuery();
                        processVariableInput(event.target.value, query, 'contParamVariable', setContParamVariable, setError, onChange, onRunQuery);
                    }}
                    onBlur={(event: any) => {
                        processVariableInput(event.target.value, query, 'contParamVariable', setContParamVariable, setError, onChange, onRunQuery);
                    }}
                    required
                    type="text"
                    width={40}
                    placeholder="$parameter"
                />
            </InlineField>
        )}
        </div>
    );
}
