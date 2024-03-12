import { getBackendSrv } from "@grafana/runtime";
import { lastValueFrom } from "rxjs";

// for 'devices.$device.params.*' query - that is resolved into request'gw/devices/<device_id>/telemetry/all
export interface FlespiDeviceTelemetryResponse {
    result: FlespiDeviceTelemetry[],
}

export interface FlespiDeviceTelemetry {
    id: number,
    telemetry: any,
}

// interfaces are used in metricFindQuery function
// for 'devices.*' query - that is resolved into request /gw/devices/all
interface FlespiEntytiesResponse {
    result: FlespiEntity[],
}

interface FlespiEntity {
    id: number,
    name: string,
}
  

export class FlespiSDK {
    static routePath = '/flespi';

    // fetch all flespi devices available for the configured token
    // GET gw/devices/all
    // returns array of devices:     
    // [{"id": 395457, "name": "my device1"}, {"id": 1543533, "name": "my device2"}]
    static async fetchAllFlespiDevices(url: string): Promise<FlespiEntity[]> {
        const observableResponse = getBackendSrv().fetch<FlespiEntytiesResponse>({
            url: url + this.routePath + '/gw/devices/all?fields=id%2Cname',
            method: 'GET',
        });

        const response = await lastValueFrom(observableResponse);
        return response.data.result;
    }

    // fetch telemetry parameters of the given device by Id
    // GET gw/devices/<device_id>/telemetry/all
    // returns JS array of parameters' names
    static async fetchDeviceTelemetryParameters(deviceId: number, url: string): Promise<string[]> {
        const observableResponse = getBackendSrv().fetch<FlespiDeviceTelemetryResponse>({
            url: url + this.routePath + `/gw/devices/${deviceId}/telemetry/all`,
            method: 'GET',
        })
        const response = await lastValueFrom(observableResponse);
        const telemetry = response.data.result[0].telemetry;
        if ( telemetry === null ) {
            return Promise.resolve([]);
        }
        const devicesTelemetryParameters = [];
        for ( const parameter in telemetry ) {
            devicesTelemetryParameters.push(parameter);
        }

        return devicesTelemetryParameters;
    }

    // fetch subaccounts available for the configured token
    // GET platform/subaccounts/all
    // returns array of subaccounts
    // [{"id":13704,"name":"my subaccount1"},{"id":13705,"name":"my subaccount2"}]
    static async fetchAllFlespiSubaccounts(url: string): Promise<FlespiEntity[]> {
        const observableResponse = getBackendSrv().fetch<FlespiEntytiesResponse>({
            url: url + this.routePath + '/platform/subaccounts/all?fields=id%2Cname',
            method: 'GET',
        });

        const response = await lastValueFrom(observableResponse);
        return response.data.result;
    }

    // fetch current flespi account of the configured token
    // GET platform/customer
    // returns array with account
    // [{"id":51,"name":"My Flespi Account"}]
    static async fetchFlespiAccount(url: string): Promise<FlespiEntity[]> {
        const observableResponse = getBackendSrv().fetch<FlespiEntytiesResponse>({
            url: url + this.routePath + '/platform/customer?fields=id%2Cname',
            method: 'GET',
        });

        const response = await lastValueFrom(observableResponse);
        return response.data.result;
    }
}
