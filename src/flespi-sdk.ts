import { DataQueryResponse } from "@grafana/data";
import { FetchResponse, getBackendSrv } from "@grafana/runtime";
import { Observable, lastValueFrom } from "rxjs";

// interfaces that describe data structure of flespi entities
export interface FlespiDeviceTelemetryResponse {
    result: FlespiDeviceTelemetry[],
}

export interface FlespiDeviceTelemetry {
    id: number,
    telemetry: {
        [key: string]: {
            ts: number,
            value: any,
        }
    },
}

export interface FlespiCustomerStatisticsResponse {
    result: FlespiCustomerStatistics[],
}

export interface FlespiCustomerStatistics {
    cid: number,
    [key: string]: any,
}

export interface FlespiAnalyticsIntervalsResponse {
    result: FlespiAnalyticsInterval[],
}

export interface FlespiAnalyticsInterval {
    begin: number,
    end: number,
    id: number,
    [key: string]: any,
}

export interface FlespiEntytiesResponse {
    result: FlespiEntity[],
}

export interface FlespiEntity {
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
        if (genFunction !== undefined && (genFunction === 'average' || genFunction === 'minimum' || genFunction === 'maximum') 
            && genInterval !== undefined && genInterval >= 10) {
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

    // fetch logs of given device by Id
    // GET gw/devices/logs
    // returns observable fetch response with data
    static fetchFlespiDevicesLogs(deviceId: string, parameters: string[], url: string, from: number, to: number): Observable<FetchResponse<DataQueryResponse>> {    
        // prepare request parameters
        let requestParameters = `{"from":${from},"to":${to}`;   // {"from":FROM,"to":TO
        requestParameters += `,"fields":"`;                     // {"from":FROM,"to":TO,"fields":"
        requestParameters += parameters.join(',');              // {"from":FROM,"to":TO,"fields":"param1,param2
        requestParameters += `,timestamp"}`;                    // {"from":FROM,"to":TO,"fields":"param1,param2,timestamp"}

        // execute request and return observable fetch responses
        return getBackendSrv().fetch<DataQueryResponse> ({        
            url: url + this.routePath + `/gw/devices/${deviceId}/logs?data=${requestParameters}`,
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
    static async fetchFlespiStatisticsParametersForAccount(accountId: string, url: string): Promise<string[]> {
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
        if (genFunction !== undefined && (genFunction === 'average' || genFunction === 'minimum' || genFunction === 'maximum') 
            && genInterval !== undefined && genInterval >= 10) {
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

    // fetch all flespi streams available for the configured token
    // GET gw/streams/all
    // returns array of devices:     
    // [{"id": 395457, "name": "my stream1"}, {"id": 1543533, "name": "my stream2"}]
    static async fetchAllFlespiStreams(url: string): Promise<FlespiEntity[]> {
        const observableResponse = getBackendSrv().fetch<FlespiEntytiesResponse>({
            url: url + this.routePath + '/gw/streams/all?fields=id%2Cname',
            method: 'GET',
        });

        const response = await lastValueFrom(observableResponse);
        return response.data.result;
    }  
    
    // fetch logs of given stream by Id
    // GET gw/streams/logs
    // returns observable fetch response with data
    static fetchFlespiStreamsLogs(streamId: string, parameters: string[], url: string, from: number, to: number): Observable<FetchResponse<DataQueryResponse>> {    
        // prepare request parameters
        let requestParameters = `{"from":${from},"to":${to}`;   // {"from":FROM,"to":TO
        requestParameters += `,"fields":"`;                     // {"from":FROM,"to":TO,"fields":"
        requestParameters += parameters.join(',');              // {"from":FROM,"to":TO,"fields":"param1,param2
        requestParameters += `,timestamp"}`;                    // {"from":FROM,"to":TO,"fields":"param1,param2,timestamp"}

        // execute request and return observable fetch responses
        return getBackendSrv().fetch<DataQueryResponse> ({        
            url: url + this.routePath + `/gw/streams/${streamId}/logs?data=${requestParameters}`,
            method: 'GET',
        })
    }

    // fetch all flespi containers available for the configured token
    // GET storage/containers/all
    // returns array of containers:     
    // [{"id": 395457, "name": "my container1"}, {"id": 1543533, "name": "my container2"}]
    static async fetchAllFlespiContainers(url: string): Promise<FlespiEntity[]> {
        const observableResponse = getBackendSrv().fetch<FlespiEntytiesResponse>({
            url: url + this.routePath + '/storage/containers/all?fields=id%2Cname',
            method: 'GET',
        });

        const response = await lastValueFrom(observableResponse);
        return response.data.result;
    } 

    // fetch possible parameters of container given by Id
    // GET storage/containers/messages
    // returns JS array of parameters' names
    static async fetchFlespiContainerParameters(containerId: number, url: string, parameterMask: string): Promise<string[]> {
        const observableResponse = getBackendSrv().fetch<FlespiCustomerStatisticsResponse>({
            url: url + this.routePath + `/storage/containers/${containerId}/messages?data={"max_count":1,"reverse":true,"fields":"${parameterMask}"}`,
            method: 'GET',
        });
        const response = await lastValueFrom(observableResponse);
        const params = response.data.result[0].params;
        if (params === null) {
            return Promise.resolve([]);
        }
        const containerParameters: string[] = [];
        Object.keys(params).map(param => {
            containerParameters.push(param);
        });
        
        return containerParameters;
    } 

    // fetch messages of given container by Id
    // GET storage/containers/messages
    // returns observable fetch response with data
    static fetchFlespiContainersMessages(containerId: string, parameters: string[], url: string, from: number, to: number, genFunction?: string, genInterval?: number): Observable<FetchResponse<DataQueryResponse>> {    
        // prepare request parameters
        let requestParameters = `{"left_key":${from},"right_key":${to}`;    // {"left_key":FROM,"right_key":TO
        if (genFunction !== undefined && (genFunction === 'average' || genFunction === 'minimum' || genFunction === 'maximum') 
            && genInterval !== undefined && genInterval >= 10) {
            requestParameters += `,"generalize":${genInterval},"method":"${genFunction}"`;      // {"left_key":FROM,"right_key":TO,"generalize":GEN_INTERVAL,"method":"GEN_FUNC"
        }
        requestParameters += `,"fields":"`;         // {"left_key":FROM,"right_key":TO,"generalize":GEN_INTERVAL,"method":"GEN_FUNC","fields":"
        requestParameters += parameters.join(',');  // {"left_key":FROM,"right_key":TO,"generalize":GEN_INTERVAL,"method":"GEN_FUNC","fields":"param1,param2
        requestParameters += `,timestamp"}`;        // {"left_key":FROM,"right_key":TO,"generalize":GEN_INTERVAL,"method":"GEN_FUNC","fields":"param1,param2,timestamp"}

        // execute request and return observable fetch responses
        return getBackendSrv().fetch<DataQueryResponse> ({        
            url: url + this.routePath + `/storage/containers/${containerId}/messages?data=${requestParameters}`,
            method: 'GET',
        })
    }

    // fetch all flespi calculators available for the configured token
    // GET gw/calcs/all
    // returns array of calculators:     
    // [{"id": 395457, "name": "my calc1"}, {"id": 1543533, "name": "my calc2"}]
    static async fetchAllFlespiCalculators(url: string): Promise<FlespiEntity[]> {
        const observableResponse = getBackendSrv().fetch<FlespiEntytiesResponse>({
            url: url + this.routePath + '/gw/calcs/all?fields=id%2Cname',
            method: 'GET',
        });

        const response = await lastValueFrom(observableResponse);
        return response.data.result;
    }

    // fetch flespi devices assigned to calculator by Id
    // GET gw/devices/calcs.id=<CALC_ID>
    // returns arrau of devices assigned to the given calculator:
    // [{"id": 395457, "name": "my calcdevice1"}, {"id": 1543533, "name": "my calcdevice2"}]
    static async fetchFlespiDevicesAssignedToCalculator(calcId: number, url: string): Promise<FlespiEntity[]> {
        const observableResponse = getBackendSrv().fetch<FlespiEntytiesResponse>({
            url: url + this.routePath + `/gw/devices/calcs.id=${calcId}?fields=id%2Cname`,
            method: 'GET',
        });

        const response = await lastValueFrom(observableResponse);
        return response.data.result;
    }

    // fetch possible interval parameters (aka counters) of given calculator by Id
    // GET gw/calcs/devices/intervals/last
    // returns JS array of parameters' names
    static async fetchFlespiIntervalParameters(calcId: string, url: string): Promise<string[]> {
        const observableResponse =  getBackendSrv().fetch<FlespiAnalyticsIntervalsResponse>({
            url: url + this.routePath + `/gw/calcs/${calcId}/devices/all/intervals/last`,
            method: 'GET',
        });
        const response = await lastValueFrom(observableResponse);
        const params = response.data.result[0];
        if (params === null) {
            return Promise.resolve([]);
        }
        const containerParameters: string[] = [];
        Object.keys(params).map(param => {
            containerParameters.push(param);
        });
        
        return containerParameters;    
    }

    // fetch intervals of given calculator and device by Ids
    // GET gw/calcs/devices/intervals
    // returns observable fetch response with data
    static fetchFlespiIntervals(calcId: string, deviceId: string, parameters: string[], url: string, from: number, to: number): Observable<FetchResponse<FlespiAnalyticsIntervalsResponse>> {
        let requestParameters = `{"begin":${from},"end":${to}`;
        requestParameters += `,"fields":"`;
        requestParameters += parameters.join(',');
        requestParameters += `,begin,end"}`;

        return getBackendSrv().fetch<FlespiAnalyticsIntervalsResponse>({
            url: url + this.routePath + `/gw/calcs/${calcId}/devices/${deviceId}/intervals/all?data=${requestParameters}`,
            method: 'GET',
        });
    } 
}
