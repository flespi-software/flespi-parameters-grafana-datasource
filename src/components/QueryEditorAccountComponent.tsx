import { QueryEditorProps, SelectableValue } from "@grafana/data";
import { InlineField, InlineLabel, Select } from "@grafana/ui";
import { DataSource } from "datasource";
import React, { ReactElement, useEffect, useState } from "react";
import { MyDataSourceOptions, MyQuery } from "types";


export function Account(props: QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>): ReactElement {
    const { onChange, datasource, query } = props;  
    const [ accounts, setAccounts ] = useState<Array<SelectableValue<string>>>([]);

    useEffect(() => {
        // load devices and store them into state for the later use in devices drop-down
        const fetchAccounts = async () => {
          const accounts = await Promise.all([
              datasource.fetchFlespiAccount(),
              datasource.fetchAllFlespiSubaccounts()
          ]);
          const values = (await Promise.all(accounts))
            .flat()
            .map(account => {
            return {
              label: '#' + account.id + ' ' + account.name,
              value: account.id.toString(10),
            }
          });
          setAccounts(values);
        }
        fetchAccounts().catch(console.error);
      }, [datasource, query]);

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
          <InlineLabel width={16} tooltip="Choose account to display statistics">
            Account
          </InlineLabel>
          <InlineField>
              <Select 
                value={query.entity ? query.entity : accounts[0]}
                options={accounts}
                onChange={option => {
                  onChange({ ...query, accountSelector: option.value ? option.value.toString() : "" });
                }}
                width={40}
                placeholder="Select subaccount"
              />
            </InlineField>
        </div>
      );
}
