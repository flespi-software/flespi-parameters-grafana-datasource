import { DataQueryResponse, FieldType, MetricFindValue, MutableDataFrame, ScopedVar, ScopedVars, SelectableValue } from "@grafana/data";
import { FetchResponse, getTemplateSrv } from "@grafana/runtime";
import { MyQuery } from "types";

// function is used in query editor components to validate string that user enters into variable Input
export const processVariableInput = (inputValue: string,
                                    query: MyQuery,
                                    queryFieldName: string,
                                    setVariable: React.Dispatch<React.SetStateAction<string>>,
                                    setError: React.Dispatch<React.SetStateAction<string>>,
                                    onChange: (value: MyQuery) => void,
                                    onRunQuery: () => void) => {
    if (inputValue === '') {
        // nothing to do, just remove error message, if any
        setError("");
        return;
    }
    // check user input, if this is a valid dashboard variable
    const interpolations: any[] = [];
    getTemplateSrv().replace(inputValue, undefined, undefined, interpolations);
    if (interpolations[0] && interpolations[0].found === true) {
        // matching dashboard variable is found
        setVariable(inputValue);
        setError("");
        onChange({ ...query, [queryFieldName]: inputValue });
        onRunQuery();
    } else {
        // no matching dashboard variable has been found, display error message
        setError(`Invalid variable: no variable ${inputValue} is defined for the dashboard`);
    }
}

// function is used in metricFindQuery() method to generate common variable option json
export const prepareVariableOption = (itemName: string, itemId: number): MetricFindValue => {
    const name = itemName !== '' ? itemName.replace(/\./g,'_') : '<noname>';
    return {text: `#${itemId} - ${name}`, value: itemId};
}

// function is used in query() method to resolve the list of selected options into the list of items' ids and fill the dictionary with items' labels
export const prepareItemsAndLabelsFromSelectedOptions = (itemsSelected: Array<SelectableValue<number>>, itemsLabels?: {[key: string]: string}): string[] => {
    return itemsSelected.map(item => {
        if (item.value === undefined) {
            throw new Error("Wrong item value. Item ID is expected.");
        }
        if (itemsLabels !== undefined) {
            itemsLabels[item.value.toString()] = item.label ? item.label : '';
        }
        return item.value?.toString();
    });   
}

// function is used in query() method to resolve the variable into the list of items' ids and fill the dictionary with items' labels
export const prepareItemsAndLabelsFromVariable = (variableName: string, scopedVars: ScopedVars, itemsLabels?: {[key: string]: string}): string[] => {
    // resolve items' ids from variable
    const items = getTemplateSrv().replace(variableName, scopedVars, 'csv').split(',');
    if (itemsLabels !== undefined) {
        // find dashoard variable with given name
        const currentVariable = getTemplateSrv().getVariables().find(variable => (`$${variable.name}` === variableName));
        if (currentVariable !== undefined) {
            // get variable options
            const options: Array<ScopedVar<string>> = JSON.parse(JSON.stringify(currentVariable)).options;
            // iterate flespi items ids and find corresponding variable's option
            items.map(itemId => {
                options.find(option  => {
                    const optionItemId = option.value.split(':')[0];
                    if (optionItemId === itemId) {
                        // corresponding option is found - store its text for future use in graphs legend as a label
                        itemsLabels[itemId.toString()] = option.text;
                    }
                });
            });
        }
    }
    return items;
}

// function is used in query() method to process response with data from flespi and transform it into  grafana data frames
export const handleFetchDataQueryResponse = (response: FetchResponse, refId: string, labels?: string): DataQueryResponse => {
    // array to collect timestamps values for data frame, format:
    // [ 1705074821000, 1705074831000, 1705074841000 ]
    const timeValues = [];
    // object with arrays of parameters' values for data frame, format:
    // {
    //   param_one: [ 11, 13, 18 ],
    //   param_two: [ 25, 28, null ],
    //   param_three: [ null, 40, 44 ]
    // }
    const parametersValues: any = {};
    // helper array to keep a set of parameters' names discovered in the returned messages
    const knownParameters: string[] = [];
    // helper variable to keep track of the number of values added into arrays
    let valuesArrayLength = 0;

    // iterate over returned container messages
    const messages = response.data.result;
    const messagesCount = messages.length;
    if (messagesCount === 0) {
        return { data: [] };
    }
    for (let i = 0; i < messagesCount; i++) {
        let message: any = messages[i];
        if (message.key !== undefined && message.params !== undefined) {
            message = message.params;
        }
        // collect time value for data frame
        let { timestamp, ...messageRest } = message;
        const time = timestamp ? timestamp * 1000 : message.key * 1000;
        timeValues.push(time);

        // iterate over known parameters names and push all known parameter's values to corresponding array
        for (let ii = 0; ii < knownParameters.length; ii++) {
            const parameterName = knownParameters[ii];
            parametersValues[parameterName].push(messageRest[parameterName] !== undefined ? messageRest[parameterName] : null);
            // delete processed parameter from message
            delete messageRest[parameterName];
        }
        // process the rest message parameters, that are known so far
        Object.keys(messageRest).map(parameterName => {
            // create corresponding array and push parameter's value into it, padding with required number of nulls
            const parameterValue = messageRest[parameterName];
            parametersValues[parameterName] = [];
            for (let iii = 0; iii < valuesArrayLength; iii++){
                parametersValues[parameterName].push(null);
            }
            parametersValues[parameterName].push(parameterValue);
            // save parameter name in the set
            knownParameters.push(parameterName);
        });
        // we've processed one message - increament the number of stored values
        valuesArrayLength++;
    }

    return createDataFrame(timeValues, parametersValues, refId, labels);
}

export const handleFetchIntervalsResponse = (response: FetchResponse, parameters: string[], refId: string, labels?: string): DataQueryResponse => {
    const result = response.data.result;
    if (result.length === 0) {
        return { data: [] };
    }

    // array to collect timestamps values for data frame, format:
    // [ 1705074821000, 1705074831000, 1705074841000 ]
    const timeValues = [];
    const parametersValues: any = {};
    const intervalsCount = result.length;
    for (let i = 0; i < intervalsCount; i++) {
        let interval: any = result[i];
        // push interval begin and end values into time field
        timeValues.push(interval.begin * 1000);
        timeValues.push(interval.end * 1000);
        for (const parameter of parameters) {
            if (interval[parameter] !== undefined) {
                if (parametersValues[parameter] === undefined) {
                    parametersValues[parameter] = [];
                }
                const parameterValues = parametersValues[parameter];
                parameterValues.push(interval[parameter]);
                parameterValues.push(null);
            }
        }
    }
    return createDataFrame(timeValues, parametersValues, refId, labels);
}

const createDataFrame = (timeValues: number[], parametersValues: {[key: string]: any}, refId: string, labels?: string): DataQueryResponse => {
    // Now create a data frame from collected values
    const frame = new MutableDataFrame({
        refId: refId,
        fields: [
            { name: 'Time', type: FieldType.time, values: timeValues },
        ],
    })
    Object.keys(parametersValues).map(fieldName => {
        if (parametersValues[fieldName].length > 0) {
            let fieldType: FieldType;
            switch (typeof parametersValues[fieldName][0]) {
                case "number":
                    fieldType = FieldType.number;
                    break;
                case "string":
                    fieldType = FieldType.string;
                    break;
                case "boolean":
                    fieldType = FieldType.boolean;
                    break;
                default:
                    fieldType = FieldType.other;
                    break;
            }
            frame.addField({
                name: fieldName,
                type: fieldType,
                values: parametersValues[fieldName],
                labels: (labels !== undefined) ? {item: `[${labels}]`} : undefined,
            });
        }
    });

    return { data: [frame] };
}
