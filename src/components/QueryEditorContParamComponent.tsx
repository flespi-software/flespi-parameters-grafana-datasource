import { QueryEditorProps, SelectableValue } from "@grafana/data";
import { AsyncMultiSelect, InlineField, InlineLabel, Input, Switch } from "@grafana/ui";
import { QUERY_TYPE_CONTAINERS } from "../constants";
import { DataSource, defaultQuery } from "datasource";
import { FlespiSDK } from "flespi-sdk";
import { defaults } from "lodash";
import React, { ReactElement, useState } from "react";
import { MyDataSourceOptions, MyQuery } from "types";
import { getTemplateSrv } from "@grafana/runtime";


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

    // handle changes in selected parameter 
    const onChangeParametersSelect = (option: any) => {
        // update form state
        setContParamsSelected(option);
        // save new parameter to query
        onChange({ ...query, contParamsSelected: option.map((param: SelectableValue<string>) => { return param.value!; }) });
        // execute the query
        onRunQuery();
    };

    const onParameterInputChange = (event: any) => {
        // save updated variable to query
        setContParamVariable(event.target.value);
        onChange({ ...query, contParamVariable: event.target.value });
      }
    
    const onParameterInputKeyDown = (event: any) => {
        if (event.key !== 'Enter') {
            return;
        }
        onRunQuery();
        processVariableInput(event.target.value);
    }
    
    const onParameterInputBlur = (event: any) => {
        processVariableInput(event.target.value);
    }

    const processVariableInput = (inputValue: string) => {
        // variable input field is empty
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
            setContParamVariable(inputValue);
            setError("");
            // set new variable to the query and run query() to render the graph
            onChange({ ...query, contParamVariable: inputValue });
            onRunQuery();
        } else {
            // no matching dashboard variable has been found, display error message
            setError(`Invalid variable: no variable ${inputValue} is defined for the dashboard`);
        }
    }

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
                    onChange={onChangeParametersSelect}
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
                    onChange={onParameterInputChange}
                    onKeyDown={onParameterInputKeyDown}
                    onBlur={onParameterInputBlur}
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
