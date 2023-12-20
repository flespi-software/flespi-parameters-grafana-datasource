import { QueryEditorProps, SelectableValue } from "@grafana/data";
import { AsyncSelect, InlineField, Select } from "@grafana/ui";
import { DataSource } from "datasource";
import React, { PureComponent } from "react";
import { MyDataSourceOptions, MyQuery } from "types";

type Props = QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>;

export interface State {
    selectedDevice: SelectableValue<string>;
    selectedParam: SelectableValue<string>;
    selectedFunc?: SelectableValue<string>;
}

const GEN_FUNC_OPTIONS: Array<SelectableValue<string>> = [
    { label: 'none', value: 'none' },
    { label: 'average', value: 'average' },
    { label: 'maximum', value: 'maximum' },
    { label: 'minimum', value: 'minimum' },
];

export class QueryEditor extends PureComponent<Props, State> {
    
    constructor(props: Props) {
        super(props);

        // Set default value for the dropdown
        if (props.query.entity === undefined || props.query.param === undefined) {
            // device is not yet configured for this dashboard, use default values
            this.state = {
                selectedDevice: { label: 'Select device' },
                selectedParam: { label: 'Select parameter' },
                selectedFunc: { value: 'none', label: 'none' },
            };
        } else {
            // device is already configured for this dashboard, use device from query to init dropdown
            this.state = {
                selectedDevice: { value: props.query.entity, label: props.query.entity },
                selectedParam: { value: props.query.param, label: props.query.param },
                selectedFunc: { value: props.query.func, label: props.query.func },
            };
        }
    }

    // load options for the Device dropdown asynchronously
    loadFlespiDevices = async () => {
        // fetch flespi devices avaiable for the configured token
        const flespi_devices = await this.props.datasource.fetchAllFlespiDevices();
        // transform returned devices to select options format [{'value':'1','label':'One'}, {'value':'2','label':'Two'}]
        const select_options = flespi_devices.map((flespi_device) => {
            return { value: flespi_device, label: flespi_device };
        });
        return select_options;
    };

    // handle changes in selected device
    onDeviceChange = (option: any) => {
        const { onChange, onRunQuery, query } = this.props;
        // invalidate the choise of param when slected device has changed
        onChange({ ...query, entity: option.value, param: '' });
        this.setState({ selectedDevice: option, selectedParam: { label: 'Select parameter' } });
        // execute the query to cleanup the chart drawn for previously selected device&param
        onRunQuery();
    };

    // load options for the Parameter dropdown asynchronously, based on the value selected in device drop down
    loadlFlespiDeviceParameters = async () => {
        // determine device id to fetch telemetry parameters for
        const device_id_name = this.state.selectedDevice.value;
        if ( device_id_name === undefined || device_id_name === null ) {
            throw new Error("Device not found");
        }
        const device_id_regex = /^#(\d+) - .*/;
        const device_id_parsed = device_id_name.match(device_id_regex);
        if ( device_id_parsed === null || device_id_parsed[1] === undefined ) {
            throw new Error(`Invalid device in drop down '${device_id_name}'`);
        }
        // fetch available telemetry parameters for the selected device
        const device_telemetry_parameters = await this.props.datasource.fetchDevicesTelemetryParameters(device_id_parsed[1]);
        // transform returned parameters to select options format [{'value':'1','label':'One'}, {'value':'2','label':'Two'}]
        const select_options = device_telemetry_parameters.map((telemetry_param) => {
            return { value: telemetry_param, label: telemetry_param };
        });
        return select_options;
    };

    // handle changes in selected parameter 
    onParamChange = (option: any) => {
        const { onChange, onRunQuery, query } = this.props;
        this.setState({ ...this.state, selectedParam: option });
        onChange({ ...query, param: option.value });
        // execute the query
        onRunQuery();
    };

    // handle generalization function change in drop down
    onGenFuncChange = (option: any) => {
        const { onChange, onRunQuery, query } = this.props;
        this.setState({ ...this.state, selectedFunc: option });
        onChange({ ...query, func: option.value });
        // execute the query
        onRunQuery();
    };

    render() {
        const { selectedDevice, selectedParam, selectedFunc } = this.state;
        if ( selectedDevice.value === undefined ) {
            // if device is not yet selected - return only Device srop down
            return (
                <div className="gf-form">
                    <InlineField label="Device" labelWidth={16}>
                        <AsyncSelect
                        value={selectedDevice}
                        loadOptions={this.loadFlespiDevices}
                        defaultOptions
                        onChange={this.onDeviceChange}
                        width={40}
                        noOptionsMessage="No flespi devices found"
                        allowCustomValue={true}
                        />
                    </InlineField>
                </div>
            );
        } else {
            // if device is already selected - return both Device and Parameter drop downs
            return (
                <div className="gf-form">
                    <InlineField label="Device" labelWidth={16}>
                        <AsyncSelect
                        value={selectedDevice}
                        loadOptions={this.loadFlespiDevices}
                        defaultOptions
                        onChange={this.onDeviceChange}
                        width={40}
                        noOptionsMessage="No flespi devices found"
                        allowCustomValue={true}
                        />
                    </InlineField>
                    <InlineField label="Parameter" labelWidth={16}>
                        <AsyncSelect
                        key={this.state.selectedDevice.value}
                        value={selectedParam}
                        loadOptions={this.loadlFlespiDeviceParameters}
                        defaultOptions
                        onChange={this.onParamChange}
                        width={40}
                        noOptionsMessage="Telemetry not found"
                        allowCustomValue={true}
                        />
                    </InlineField>
                    <InlineField label="Generalization func" labelWidth={26}>
                        <Select
                        options={GEN_FUNC_OPTIONS}
                        value={selectedFunc}
                        onChange={this.onGenFuncChange}
                        />
                    </InlineField>
                </div>
            );
        }
    }
}
