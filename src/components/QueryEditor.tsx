import { QueryEditorProps, SelectableValue } from "@grafana/data";
import { getTemplateSrv } from "@grafana/runtime";
import { AsyncSelect, InlineField, Select } from "@grafana/ui";
import { DataSource } from "datasource";
import React, { PureComponent } from "react";
import { MyDataSourceOptions, MyQuery } from "types";

type Props = QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>;

export interface State {
  deviceOptions: Array<SelectableValue<string>>;
  deviceSelected: SelectableValue<string | number>;
  paramSelected: SelectableValue<string>;
  funcSelected?: SelectableValue<string>; 
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
        deviceOptions: [],
        deviceSelected: { label: 'Select device', value: '' },  
        paramSelected: { label: 'Select parameter', value: '' },
        funcSelected: { value: 'none', label: 'none' },
      };
    } else {
      // device is already configured for this dashboard, use device from query to init dropdown
      this.state = {
        deviceOptions: [],
        deviceSelected: { value: props.query.entity }, // label for the selected device will be created later in componentDidMount()
        paramSelected: { value: props.query.param, label: props.query.param },
        funcSelected: { value: props.query.func, label: props.query.func },
      };
    }
  }

  // load options for devices drop down
  async componentDidMount() {
    let deviceSelected;
    if (typeof this.state.deviceSelected.value === 'string') {
      // selected device is dashboard variable
      deviceSelected = { 
        label: this.state.deviceSelected.value, 
        value: this.state.deviceSelected.value,
      };
    }
    const devicesOptions = (await this.props.datasource.fetchAllFlespiDevices()).map(device => {
      if (this.state.deviceSelected.value === device.id) {
        // find selected device by id, if device is selected from the loaded list
        deviceSelected = { 
          label: `#${device.id} - ${device.name.replace(/\./g,'_')}`, 
          value: device.id.toString(),
        };
      }
      return {
        label: `#${device.id} - ${device.name.replace(/\./g,'_')}`,
        value: device.id.toString(),
      };
    });
    if (deviceSelected === undefined) {
      // failed wo determine selected device, invalidate it
      deviceSelected = { 
        label: 'Select device', 
        value: '' 
      };
    }
    this.setState({ ...this.state, deviceSelected: deviceSelected, deviceOptions: devicesOptions })
  }

  // handle changes in selected device
  onDeviceChange = (option: any) => {
    const { onChange, onRunQuery, query } = this.props;
    // save Id of the selected entity (device) into query, and invalidate the choise of selected param
    onChange({ ...query, entity: option.value, param: '' });
    // save selected device in the compoment state
    this.setState({ ...this.state, deviceSelected: option });
    // execute the query to cleanup the graph drawn for previously selected device&param
    onRunQuery();
  };

    // load telemetry parameters for the device that is selected in Device drop down
    // this.state.deviceSelected.value contains device Id  of the selected device
    loadlFlespiDeviceParameters = async (inputValue: string) => {
      // getTemplateSrv().replace(this.state.deviceSelected.value, options.scopedVars);
      if (this.state.deviceSelected.value == null || this.state.deviceSelected.value === '') {
        // device is not yet selected, return empty array of parameters
        return Promise.resolve([]);
      }
      let deviceId = this.state.deviceSelected.value;
      if (deviceId === undefined) {
        // device not yet selected, return empty rapameters array
        return Promise.resolve([]);
      }
      if (typeof deviceId === 'string') {
        if (deviceId === '') {
          // device not yet selected, return empty rapameters array
          return Promise.resolve([]);
        }
        // device is selected from dashboard variable
        deviceId = getTemplateSrv().replace(deviceId);
      }

      return await this.props.datasource.fetchDevicesTelemetryParameters(deviceId).then((result: string[]) => {
        return result
          // filter parameters based on user input in Parameter select field
          .filter((parameter: string) => parameter.toLowerCase().includes(inputValue))
          // transform returned parameters to select options format [{'value':'1','label':'One'}, {'value':'2','label':'Two'}]
          .map((parameter: string) => ({ value: parameter, label: parameter }));
      });
    };

    // handle changes in selected parameter 
    onParamChange = (option: any) => {
        const { onChange, onRunQuery, query } = this.props;
        this.setState({ ...this.state, paramSelected: option });
        // save new parameter value to query
        onChange({ ...query, param: option.value });
        // execute the query
        onRunQuery();
    };

  // handle generalization function change in drop down
  onGenFuncChange = (option: any) => {
    const { onChange, onRunQuery, query } = this.props;
    this.setState({ ...this.state, funcSelected: option });
    // save new function value to query
    onChange({ ...query, func: option.value });
    // execute the query
    onRunQuery();
  };

    render() {
        const { deviceOptions, deviceSelected, paramSelected, funcSelected } = this.state;
        if ( deviceSelected.value === undefined || deviceSelected.value === '' ) {
            // if device is not yet selected - render only Device drop down
            return (
                <div className="gf-form">
                    <InlineField label="Device" labelWidth={16}>
                      <Select
                        value={deviceSelected}
                        options={deviceOptions}
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
                        <Select
                        value={deviceSelected}
                        options={deviceOptions}
                        onChange={this.onDeviceChange}
                        width={40}
                        noOptionsMessage="No flespi devices found"
                        allowCustomValue={true}
                        />
                    </InlineField>
                    <InlineField label="Parameter" labelWidth={16}>
                        <AsyncSelect
                        key={this.state.deviceSelected.value}
                        value={paramSelected}
                        loadOptions={this.loadlFlespiDeviceParameters}
                        defaultOptions
                        cacheOptions
                        onChange={this.onParamChange}
                        width={40}
                        noOptionsMessage="Telemetry not found"
                        allowCustomValue={true}
                        />
                    </InlineField>
                    <InlineField label="Generalization func" labelWidth={26}>
                        <Select
                        options={GEN_FUNC_OPTIONS}
                        value={funcSelected}
                        onChange={this.onGenFuncChange}
                        />
                    </InlineField>
                </div>
            );
        }
    }
}
