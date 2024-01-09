import { DataQuery, DataSourceJsonData } from '@grafana/data';

export interface MyQuery extends DataQuery {
  entity: number | string;    // if number - id of the entity to draw the graph for, if string - name of the variable to resolve the entity id from
  entityLabel: string;        // label of the entity in drop down, used to create labels of the legend if there are more that one entity on one grrph
  param: string;              // param to be drawn on the graph
  func: string;               // generalization function
}

/**
 * These are options configured for each DataSource instance
 */
export interface MyDataSourceOptions extends DataSourceJsonData {
  path?: string;
}

/**
 * Value that is used in the backend, but never sent over HTTP to the frontend
 */
export interface MySecureJsonData {
  apiKey?: string;
}
