import { QueryEditorProps, SelectableValue } from "@grafana/data";
import { getTemplateSrv } from "@grafana/runtime";
import { InlineField, InlineLabel, Input, MultiSelect, Switch } from "@grafana/ui";
import { DataSource } from "datasource";
import { FlespiSDK } from "flespi-sdk";
import React, { ReactElement, useEffect, useState } from "react";
import { MyDataSourceOptions, MyQuery } from "types";


export function Account(props: QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>): ReactElement {
    const { onChange, onRunQuery, datasource, query } = props;  
    const [ accounts, setAccounts ] = useState<Array<SelectableValue<number>>>([]);
    const [ useAccountVariable, setUseAccoutVariable ] = useState<boolean>(query.useAccountVariable);
    const [ accountVariable, setAccountVariable ] = useState<string>(query.accountVariable);
    const [ accountsSelected, setAccountSelected ] = useState<Array<SelectableValue<number>>>(query.accountsSelected);
    const [ error, setError ] = useState<string>("");

    useEffect(() => {
        // load devices and store them into state for the later use in devices drop-down
        const fetchAccounts = async () => {
            const accounts = await Promise.all([
                FlespiSDK.fetchFlespiAccount(datasource.url),
                FlespiSDK.fetchAllFlespiSubaccounts(datasource.url)
            ]);
            const values = (await Promise.all(accounts))
                .flat()
                .map(account => {
                    return {
                        label: '#' + account.id + ' ' + account.name,
                        value: account.id,
                    }
                });
            setAccounts(values);
        }
        fetchAccounts().catch(console.error);
    }, [datasource, query]);

    /////////////////////////////////////////////////////////////////////////////////
    // account input event handler: text typed
    /////////////////////////////////////////////////////////////////////////////////
    const onAccountInputChange = (event: any) => {
        // just update the value displayed in the input field
        setAccountVariable(event.target.value);
    }
    /////////////////////////////////////////////////////////////////////////////////
    // account input event hander: key down
    /////////////////////////////////////////////////////////////////////////////////
    const onAccountInputKeyDown = (event: any) => {
        // process 'Enter' key down event only
        if (event.key !== 'Enter') {
          return;
        }
        processAccountVariableInput(event.target.value);
    }
    /////////////////////////////////////////////////////////////////////////////////
    // device input hander: focus lost
    /////////////////////////////////////////////////////////////////////////////////
    const onAccountInputBlur = (event: any) => {
        processAccountVariableInput(event.target.value);
    }

    /////////////////////////////////////////////////////////////////////////////////
    // account input hander: user types variable name into input
    /////////////////////////////////////////////////////////////////////////////////
    const processAccountVariableInput = (inputValue: string) => {
        // device variable input field is empty
        if (inputValue === '') {
            // nothing to do, just remove error message, if any
            setError("");
            return;
        }
        // check user input, if this is a valid dashboard varible
        const interpolations: any[] = [];
        getTemplateSrv().replace(inputValue, undefined, undefined, interpolations);
        if (interpolations[0] && interpolations[0].found === true) {
            // matching dashboard variable is found
            setAccountVariable(inputValue);
            setError("");
            // set new device variable to the query and run query() to render the graph
            onChange({ ...query, deviceVariable: inputValue });
            onRunQuery();
        } else {
            // no matching dashboard variable has been found, display error message
            setError(`Invalid account variable: no variable ${inputValue} is defined for the dashboard`);
        }
    }

    /////////////////////////////////////////////////////////////////////////////////
    // account select hander: changes selected accounts
    /////////////////////////////////////////////////////////////////////////////////
    const onChangeAccountsSelect = (option: Array<SelectableValue<number>>) => {
        // update selected devices in the form state
        setAccountSelected(option);
        // save new parameter to query
        onChange({ ...query, accountsSelected: option });
        // execute the query
        onRunQuery();
  };

    /////////////////////////////////////////////////////////////////////////////////
    // render these controls only for query type 'statistics'
    /////////////////////////////////////////////////////////////////////////////////
    if (query.queryType !== 'statistics') {
        return <div/>;
    }

    /////////////////////////////////////////////////////////////////////////////////
    // render controls to specify flespi device for query
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
                        onChange={onChangeAccountsSelect}
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
                        onChange={onAccountInputChange}
                        onKeyDown={onAccountInputKeyDown}
                        onBlur={onAccountInputBlur}
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
