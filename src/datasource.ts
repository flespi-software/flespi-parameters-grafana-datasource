import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  MutableDataFrame,
  FieldType,
  MetricFindValue,
} from '@grafana/data';

import { Observable, merge, lastValueFrom } from 'rxjs';
import { MyQuery, MyDataSourceOptions } from './types';
import { FetchResponse, getBackendSrv, getTemplateSrv } from '@grafana/runtime';
import { map } from 'rxjs/operators';

// interfaces are used in metricFindQuery function
// for 'devices.*' query - that is resolved into request /gw/devices/all
interface FlespiDevicesResponse {
  result: FlespiDevice[],
}
interface FlespiDevice {
  id: number,
  name: string,
}
// for 'devices.$device.params.*' query - that is resolved into request'gw/devices/<device_id>/telemetry/all
interface FlespiDeviceTelemetryResponse {
  result: FlespiDeviceTelemetry[],
}
interface FlespiDeviceTelemetry {
  id: number,
  telemetry: any,
}

export class DataSource extends DataSourceApi<MyQuery, MyDataSourceOptions> {
  url?: string;

  constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
    super(instanceSettings);

    this.url = instanceSettings.url;
  }

  // This function is called when you hit 'Run query' button for dashboard variable with type query
  // And to resolve possible values of Device and Parameter of variables selects
  async metricFindQuery(query: string, options?: any): Promise<MetricFindValue[]> {
    const interpolated = getTemplateSrv().replace(query, options.scopedVars);
    const variable_regex = /^(devices\.\*)|(devices\.#(\d+) - [^\.]+\.params\.\*)/;
    const variable_query_parsed = interpolated.match(variable_regex);
    if (variable_query_parsed === null) {
      // wrong variable query
      // expected queries 'devices.*' or 'devices.$device.params.*'
      return Promise.resolve([]);
    }
    if (variable_query_parsed[0] === 'devices.*') {
      // this is variable query 'devices.*' - return all flespi devices available for the token
      const flespi_devices = await this.fetchAllFlespiDevices();
      // transform returned devices to the requird format [{'text':'flespi device 1'}, {'text':'flespi device 2'}]
      const flespi_devices_formatted = flespi_devices.map((flespi_device) => {
        return { text: flespi_device };
      });
      return flespi_devices_formatted;

    } else {
      // this is variable query 'devices.#device_id - device_name.params.*'
      // device id is in the 3 array element of the parsed query
      const device_id = variable_query_parsed[3];
      const device_telemetry_params = await this.fetchDevicesTelemetryParameters(device_id);
      // transform returned arameters to the required format [{'text': 'param.1'}, {'text':'param.2'}]
      const device_telemetry_params_formatted = device_telemetry_params.map((param) => { 
        return { text: param };
      });
      return device_telemetry_params_formatted;
    }
  }

  // This function is called when you edit query or choose device in variable's selector
  query(options: DataQueryRequest<MyQuery>): Observable<DataQueryResponse> {

    const observableResponses: Array<Observable<DataQueryResponse>> = options.targets.map((query) => {

      const routePath = '/flespi';

      // resolve device from variable (that is chosen in the select in the top left corner)
      const device = getTemplateSrv().replace(query.entity, options.scopedVars);
      const param = getTemplateSrv().replace(query.param, options.scopedVars);

      if (device.startsWith('{')) {
        throw new Error(`Multiple device charts are not supported: ${device}`);
      }
      if (param.startsWith('{')) {
        throw new Error(`Multiple parameters charts are not supported: ${param}`);
      }
      // parse device id of the device selected in variable
      const device_parsed = device.match(/#(\d+)/);
      if (device_parsed == null) {
        throw new Error(`Unexpected device ${device}`);
      }
      const device_id = device_parsed ? device_parsed[1] : "not found";

      // calculate time interval to query messages
      const { range } = options;
      const from = Math.floor(range!.from.valueOf() / 1000);
      const to = Math.ceil(range!.to.valueOf() / 1000);

      let gen_query_params = ''; 
      // checkif generalization function is selected
      if (query.func !== undefined && (query.func === 'average' || query.func === 'minimum' || query.func === 'maximum')) {
        const interval_sec = (options.scopedVars.__interval_ms) ? options.scopedVars.__interval_ms.value / 1000 : 0;
        const maxDataPoints = options.maxDataPoints ? options.maxDataPoints : 0;
        if (interval_sec > 60 || (interval_sec !== 0 && maxDataPoints > 0 && ((to - from)/interval_sec > maxDataPoints))) {
          // apply generalization function
          const gen_interval = Math.floor((to - from)/ maxDataPoints);
          gen_query_params = `%2C%22generalize%22%3A${gen_interval}%2C%22method%22%3A%22${query.func}%22`;  // ,"generalize":GEN_INTERVAL,"method":"GEN_FUNC"
        }
      }
      
      // now fetch messages for the selected device
      const observable = getBackendSrv().fetch<DataQueryResponse> ({        
        url: this.url + routePath + `/gw/devices/${device_id}/messages?data=%7B%22from%22%3A${from}%2C%22to%22%3A${to}${gen_query_params}%7D`,
        method: 'GET',
      }).pipe(
        map((response) => this.handleDeviceMessagesResponse(response, query.refId, param))
      )

      return observable;
    });

    return merge(...observableResponses);
  }

  // process devices messages response and pack data points into data frame
  handleDeviceMessagesResponse(response: FetchResponse, refId: string, param: string): DataQueryResponse {
    if (response.status !== 200) {
      throw new Error(`Unexpected HTTP Response: ${response.status} - ${response.statusText}`);
    }

    const frame = new MutableDataFrame({
      refId: refId,
      fields: [
        { name: 'time', type: FieldType.time },
        { name: param, type: FieldType.number },
      ],
    })

    const messages = response.data.result;
    const messageCount = messages.length;
    for (let i = 0; i < messageCount; i++) {
      const message = messages[i];
      if (message[param] !== undefined) {
        frame.add({ time: message["timestamp"] * 1000, [param]: message[param] });
      }
    }
    return { data: [frame] };
  }

  // fetch all flespi devices available for the configured token
  async fetchAllFlespiDevices(): Promise<string[]> {
    const routePath = '/flespi';
    const observableResponse = getBackendSrv().fetch<FlespiDevicesResponse>({
      url: this.url + routePath + '/gw/devices/all',
      method: 'GET',
    });
  
    const response = await lastValueFrom(observableResponse);
    const flespi_devices = response.data.result.map(device => (`#${device.id} - ${device.name.replace(/\./g,'_')}`));
  
    return flespi_devices;
  }
  // fetch telemetry parameters for the given device, excluding certain parameters
  async fetchDevicesTelemetryParameters(device_id: string): Promise<string[]> {
    const routePath = '/flespi';
    const observableResponse = getBackendSrv().fetch<FlespiDeviceTelemetryResponse>({
      url: this.url + routePath + `/gw/devices/${device_id}/telemetry/all`,
      method: 'GET',
    })
    const response = await lastValueFrom(observableResponse);
    const telemetry = response.data.result[0].telemetry;
    if ( telemetry === null ) {
      return Promise.resolve([]);
    }
    const devices_telemetry_params = [];
    for ( const param in telemetry ) {
      if ( param.endsWith('.id') || 
           param.endsWith('.enum') || 
           param.endsWith('timestamp') ) {
        // exclude *.id, *.enum  and *.timestamp parameters
        continue;
      }
      if ( typeof telemetry[param].value !== "number" ) {
        // include only those parameters that have number value
        continue;
      }
      devices_telemetry_params.push(param);
    }
    return devices_telemetry_params;
  }

  // datasource's health check
  async testDatasource() {
    // select all flespi devices available for the configured token
    const flespi_devices = await this.fetchAllFlespiDevices();
    return {
      status: 'success',
      message: `Success! Found ${flespi_devices.length} devices for the configured Flespi Token`,
    };
  }
}
