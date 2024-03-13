import { QueryEditorProps, SelectableValue } from "@grafana/data";
import { AsyncMultiSelect, InlineField, InlineLabel, Input, Switch } from "@grafana/ui";
import { DataSource, defaultQuery } from "datasource";
import { FlespiSDK } from "flespi-sdk";
import { defaults } from "lodash";
import React, { ReactElement, useState } from "react";
import { MyDataSourceOptions, MyQuery } from "types";

export function StatisticsParameter(props: QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>): ReactElement {
    const { onChange, onRunQuery, datasource } = props;
    const query = defaults(props.query, defaultQuery);

    const [ useStatParamVariable, setUseStatParamVariable ] = useState<boolean>(query.useStatParamVariable);
    const [ statParamVariable, setStatParamVariable ] = useState<string>(query.statParamVariable);
    const [ statParamsSelected, setStatParamsSelected ] = useState<Array<SelectableValue<string>>>(() => {
        if (query.statParamsSelected) {
            return query.statParamsSelected.map((parameter) => {
                return {
                    label: parameter,
                    value: parameter,
                };
            });
        }
        return [];
    });
    const accountsSelected = query.accountsSelected;
    const accounts = accountsSelected.map((device: SelectableValue<number>) => device.value).join();

    // load statistics parameters for the accounts selected in Accounts drop down
    const loadFlespiStatsParameters = async (inputValue: string) => {
        if (accountsSelected.toString() === '') {
            // account is not yet selected, return empty array of parameters
            return Promise.resolve([]);
        }
        // fetch telemetry parameters for all selected devices
        const statistics = await Promise.all(accountsSelected.map(account => {
            return FlespiSDK.fetchFlespiStatisticsParametersForAccount(account.value ? account.value : 0, datasource.url).then((result: string[]) => {
                return result
                // filter parameters based on user input in Parameter select field
                .filter((parameter: string) => parameter.toLowerCase().includes(inputValue));
            });
        }));
        const statisticsParameters = (await Promise.all(statistics)).flat();
        const statisticsParametersUnique = new Set(statisticsParameters);

        return Array.from(statisticsParametersUnique.values())
            .sort()
            .map((parameter: string) => ({ value: parameter, label: parameter }));
    };

    // handle changes in selected parameter 
    const onChangeParametersSelect = (option: any) => {
        // update form state
        setStatParamsSelected(option);
        // save new parameter to query
        onChange({ ...query, statParamsSelected: option.map((param: SelectableValue<string>) => { return param.value!; }) });
        // execute the query
        onRunQuery();
    };

    const onParameterInputChange = (event: any) => {
        // save updated container variable to query
        setStatParamVariable(event.target.value);
        onChange({ ...query, statParamVariable: event.target.value });
      }
    
      const onParameterInputKeyDown = (event: any) => {
        if (event.key === 'Enter') {
          // rerender graph on the panel
          onRunQuery();
        }    
      }

    /////////////////////////////////////////////////////////////////////////////////
    // render these controls only for query type 'statistics'
    /////////////////////////////////////////////////////////////////////////////////
    if (query.queryType !== 'statistics') {
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
                    onChange={onChangeParametersSelect}
                    width={40}
                    noOptionsMessage="Telemetry not found"
                    allowCustomValue={true}
                />
            </InlineField>
            ) : (
            <Input
                name="parameter"
                value={statParamVariable}
                onChange={onParameterInputChange}
                onKeyDown={onParameterInputKeyDown}
                required
                type="text"
                width={40}
                placeholder="$parameter"
            />
            )}

        </div>
    );
}
