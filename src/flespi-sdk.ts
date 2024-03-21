import { DataQueryResponse } from "@grafana/data";
import { FetchResponse, getBackendSrv } from "@grafana/runtime";
import { Observable, lastValueFrom } from "rxjs";
// import { map } from 'rxjs/operators';

export interface FlespiDeviceTelemetryResponse {
    result: FlespiDeviceTelemetry[],
}

export interface FlespiDeviceTelemetry {
    id: number,
    telemetry: any,
}

export interface FlespiCustomerStatisticsResponse {
    result: FlespiCustomerStatistics[],
}

export interface FlespiCustomerStatistics {
    cid: number,
    [key: string]: any,
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
    // returns JS array of telemetry parameters' names
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

    // fetch message of given device by Id
    // GET gw/devices/messages
    // returns observable fetch response with data
    static fetchFlespiDevicesMessages(deviceId: string, parameters: string[], url: string, from: number, to: number, genFunction?: string, genInterval?: number): Observable<FetchResponse<DataQueryResponse>> {    
        // prepare request parameters
        let requestParameters = `{"from":${from},"to":${to}`;                                   // {"from":FROM,"to":TO
        if (genFunction !== undefined && (genFunction === 'average' || genFunction === 'minimum' || genFunction === 'maximum') && genInterval !== undefined) {
            requestParameters += `,"generalize":${genInterval},"method":"${genFunction}"`;      // {"from":FROM,"to":TO,"generalize":GEN_INTERVAL,"method":"GEN_FUNC"
        }
        requestParameters += `,"fields":"`;         // {"from":FROM,"to":TO,"generalize":GEN_INTERVAL,"method":"GEN_FUNC","fields":"
        requestParameters += parameters.join(',');  // {"from":FROM,"to":TO,"generalize":GEN_INTERVAL,"method":"GEN_FUNC","fields":"param1,param2
        requestParameters += `,timestamp"}`;        // {"from":FROM,"to":TO,"generalize":GEN_INTERVAL,"method":"GEN_FUNC","fields":"param1,param2,timestamp"}

        // execute request and return observable fetch responses
        return getBackendSrv().fetch<DataQueryResponse> ({        
            url: url + this.routePath + `/gw/devices/${deviceId}/messages?data=${requestParameters}`,
            method: 'GET',
        })
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

    // fetch possible statistics parameters for given account by Id
    // GET platform/customer/statistics with header 'x-flespi-cid: <account_id>'
    // returns JS array of statistics parameters' names
    static async fetchFlespiStatisticsParametersForAccount(accountId: number, url: string): Promise<string[]> {
        const observableResponse = getBackendSrv().fetch<FlespiCustomerStatisticsResponse>({
            url: url + this.routePath + '/platform/customer/statistics?data=%7B%22reverse%22%3Atrue%2C%22count%22%3A1%7D',
            method: 'GET',
            headers: {
                'x-flespi-cid': accountId,
            },
        });
        const response = await lastValueFrom(observableResponse);
        const statistics = response.data.result[0];
        if ( statistics === null ) {
            return Promise.resolve([]);
        }
        const statisticsParameters = [];
        for ( const parameter in statistics ) {
            statisticsParameters.push(parameter);
        }

        return statisticsParameters;
    }

    // fetch statistics for given account by Id
    // GET platform/customer/statistics
    // returns observable fetch response with data
    static fetchFlespiAccountsStatistics(accountId: string, parameters: string[], url: string, from: number, to: number, genFunction?: string, genInterval?: number): Observable<FetchResponse<DataQueryResponse>> {    
        // prepare request parameters
        let requestParameters = `{"from":${from},"to":${to}`;                                   // {"from":FROM,"to":TO
        if (genFunction !== undefined && (genFunction === 'average' || genFunction === 'minimum' || genFunction === 'maximum') && genInterval !== undefined) {
            requestParameters += `,"generalize":${genInterval},"method":"${genFunction}"`;      // {"from":FROM,"to":TO,"generalize":GEN_INTERVAL,"method":"GEN_FUNC"
        }
        requestParameters += `,"fields":"`;         // {"from":FROM,"to":TO,"generalize":GEN_INTERVAL,"method":"GEN_FUNC","fields":"
        requestParameters += parameters.join(',');  // {"from":FROM,"to":TO,"generalize":GEN_INTERVAL,"method":"GEN_FUNC","fields":"param1,param2
        requestParameters += `,timestamp"}`;        // {"from":FROM,"to":TO,"generalize":GEN_INTERVAL,"method":"GEN_FUNC","fields":"param1,param2,timestamp"}

        // execute request and return observable fetch responses
        return getBackendSrv().fetch<DataQueryResponse> ({        
            url: url + this.routePath + `/platform/customer/statistics?data=${requestParameters}`,
            method: 'GET',
            headers: {
                'x-flespi-cid': accountId,
            },
        })
    }
}
