import { QueryEditorProps, SelectableValue } from "@grafana/data";
import { InlineField, InlineLabel, Input, MultiSelect, Switch } from "@grafana/ui";
import { QUERY_TYPE_STATISTICS } from "../constants";
import { DataSource } from "datasource";
import { FlespiSDK } from "flespi-sdk";
import React, { ReactElement, useEffect, useState } from "react";
import { MyDataSourceOptions, MyQuery } from "types";
import { processVariableInput } from "utils";

export function Account(props: QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>): ReactElement {
    const { onChange, onRunQuery, datasource, query } = props;  
    const [ accounts, setAccounts ] = useState<Array<SelectableValue<number>>>([]);
    const [ useAccountVariable, setUseAccoutVariable ] = useState<boolean>(query.useAccountVariable);
    const [ accountVariable, setAccountVariable ] = useState<string>(query.accountVariable);
    const [ accountsSelected, setAccountSelected ] = useState<Array<SelectableValue<number>>>(query.accountsSelected);
    const [ error, setError ] = useState<string>("");

    /////////////////////////////////////////////////////////////////////////////////
    // load account and all available subaccounts for future use as select options
    /////////////////////////////////////////////////////////////////////////////////
    useEffect(() => {
        const fetchAccounts = async () => {
            const accounts = await Promise.all([
                FlespiSDK.fetchFlespiAccount(datasource.url),
                FlespiSDK.fetchAllFlespiSubaccounts(datasource.url)
            ]);
            const values = (await Promise.all(accounts))
                .flat()
                .map(account => ({label: '#' + account.id + ' ' + account.name, value: account.id,}));
            setAccounts(values);
        }
        fetchAccounts().catch(console.error);
    }, [datasource, query]);

    /////////////////////////////////////////////////////////////////////////////////
    // render these controls only for query type QUERY_TYPE_STATISTICS
    /////////////////////////////////////////////////////////////////////////////////
    if (query.queryType !== QUERY_TYPE_STATISTICS) {
        return <div/>;
    }

    /////////////////////////////////////////////////////////////////////////////////
    // render controls to specify flespi accounts for query
    /////////////////////////////////////////////////////////////////////////////////
    return (
        <div className="gf-form">
            <InlineLabel width={16} tooltip="Choose accounts for query">
                Accounts
            </InlineLabel>
            <InlineField label="Use dashboard variable">
            <div className='gf-form-switch'>
                <Switch
                value={!!useAccountVariable}
                onChange={() => {
                    setUseAccoutVariable(!useAccountVariable);
                    onChange({ ...query, useAccountVariable: !query.useAccountVariable });
                }}
                />
            </div>
            </InlineField>
            {!useAccountVariable ? (
                <InlineField>
                    <MultiSelect 
                        value={accountsSelected}
                        options={accounts}
                        onChange={(option: Array<SelectableValue<number>>) => {
                            setAccountSelected(option);
                            onChange({ ...query, accountsSelected: option });
                            onRunQuery();
                        }}
                        width={40}
                        placeholder="Select subaccount"                        
                    />
                </InlineField>
            ) : (
                // if useAccountVariable==true - render Input where user will type name of the variable to take account from
                <InlineField invalid={error ? true : false} error={error}>
                    <Input
                        name="account"
                        value={accountVariable}
                        onChange={(event: any) => {
                            setAccountVariable(event.target.value);
                        }}
                        onKeyDown={(event: any) => {
                            // process 'Enter' key down event only
                            if (event.key !== 'Enter') {
                                return;
                            }
                            processVariableInput(event.target.value, query, 'accountVariable', setAccountVariable, setError, onChange, onRunQuery);
                        }}
                        onBlur={(event: any) => {
                            processVariableInput(event.target.value, query, 'accountVariable', setAccountVariable, setError, onChange, onRunQuery);
                        }}
                        required
                        type="text"
                        width={40}
                        placeholder="$account"
                    />
                </InlineField>
            )}
        </div>
    );
}
