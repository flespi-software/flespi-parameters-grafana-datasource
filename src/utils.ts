import { getTemplateSrv } from "@grafana/runtime";
import { MyQuery } from "types";

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
