import { QueryEditorProps, SelectableValue } from "@grafana/data";
import { AsyncMultiSelect, InlineField, InlineLabel, Input, Switch } from "@grafana/ui";
import { QUERY_TYPE_STATISTICS } from "../constants";
import { DataSource, defaultQuery } from "datasource";
import { FlespiSDK } from "flespi-sdk";
import { defaults } from "lodash";
import React, { ReactElement, useState } from "react";
import { MyDataSourceOptions, MyQuery } from "types";
import { prepareItemsAndLabelsFromSelectedOptions, prepareItemsAndLabelsFromVariable, processVariableInput } from "utils";

export function StatisticsParameter(props: QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>): ReactElement {
    const { onChange, onRunQuery, datasource } = props;
    const query = defaults(props.query, defaultQuery);

    const [ useStatParamVariable, setUseStatParamVariable ] = useState<boolean>(query.useStatParamVariable);
    const [ statParamVariable, setStatParamVariable ] = useState<string>(query.statParamVariable);
    const [ statParamsSelected, setStatParamsSelected ] = useState<Array<SelectableValue<string>>>(() => {
        if (query.statParamsSelected) {
            return query.statParamsSelected.map((parameter: string) => ({label: parameter, value: parameter}));
        }
        return [];
    });
    const [ error, setError ] = useState<string>("");

    // prepare list of accounts
    const accountsIDds: string[] = (query.useAccountVariable === true) ? prepareItemsAndLabelsFromVariable(query.accountVariable, {}) : prepareItemsAndLabelsFromSelectedOptions(query.accountsSelected);
    const accounts = accountsIDds.join();

    /////////////////////////////////////////////////////////////////////////////////
    // load statistics parameters for the accounts selected in Accounts drop down
    /////////////////////////////////////////////////////////////////////////////////
    const loadFlespiStatsParameters = async (inputValue: string) => {
        if (accounts === '') {
            // account is not yet selected, return empty array of parameters
            return Promise.resolve([]);
        }
        // fetch statistics parameters
        const statistics = await Promise.all(accountsIDds.map(account => {
            return FlespiSDK.fetchFlespiStatisticsParametersForAccount(account, datasource.url).then((result: string[]) => {
                return result
                // filter parameters based on user input in Parameter select field
                .filter((parameter: string) => parameter.toLowerCase().includes(inputValue));
            });
        }));
        const statisticsParameters = (await Promise.all(statistics)).flat();
        const statisticsParametersUnique = new Set(statisticsParameters);

        return Array.from(statisticsParametersUnique.values())
            .sort()
            .map((parameter: string) => ({value: parameter, label: parameter}));
    };


    /////////////////////////////////////////////////////////////////////////////////
    // render these controls only for query type QUERY_TYPE_STATISTICS
    /////////////////////////////////////////////////////////////////////////////////
    if (query.queryType !== QUERY_TYPE_STATISTICS) {
        return <div/>;
    }

    /////////////////////////////////////////////////////////////////////////////////
    // render controls to specify statistics parameters of flespi account for query
    /////////////////////////////////////////////////////////////////////////////////
    return (
        <div  className="gf-form">
            <InlineLabel width={16} tooltip="Choose statistics parameters for query">
                Parameters
            </InlineLabel>
            <InlineField label="Use dashboard variable">
                <div className='gf-form-switch'>
                <Switch
                    value={!!useStatParamVariable}
                    onChange={() => {
                        setUseStatParamVariable(!useStatParamVariable);
                        onChange({ ...query, useStatParamVariable: !query.useStatParamVariable });
                    }}
                />
                </div>     
            </InlineField>
            {!useStatParamVariable ? (
                <InlineField labelWidth={16}>
                <AsyncMultiSelect
                    key={accounts}
                    value={statParamsSelected}
                    loadOptions={loadFlespiStatsParameters}
                    defaultOptions
                    cacheOptions
                    onChange={(option: any) => {
                        setStatParamsSelected(option);
                        onChange({ ...query, statParamsSelected: option.map((param: SelectableValue<string>) => { return param.value!; }) });
                        onRunQuery();
                    }}
                    width={40}
                    noOptionsMessage={`Satistics not found for accounts' IDs: ${accounts}`}
                    allowCustomValue={true}
                />
            </InlineField>
            ) : (
            <InlineField invalid={error ? true : false} error={error}>
                <Input
                    name="parameter"
                    value={statParamVariable}
                    onChange={(event: any) => {
                        setStatParamVariable(event.target.value);
                        onChange({ ...query, statParamVariable: event.target.value });
                    }}
                    onKeyDown={(event: any) => {
                        if (event.key !== 'Enter') {
                            return;
                        }   
                        onRunQuery();
                        processVariableInput(event.target.value, query, 'statParamVariable', setStatParamVariable, setError, onChange, onRunQuery);
                    }}
                    onBlur={(event: any) => {
                        processVariableInput(event.target.value, query, 'statParamVariable', setStatParamVariable, setError, onChange, onRunQuery);
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
