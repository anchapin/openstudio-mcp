/**
 * Measure interfaces
 */

/**
 * Measure interface
 */
export interface Measure {
  id: string;
  name: string;
  description: string;
  version: string;
  modelerDescription: string;
  tags: string[];
  arguments: MeasureArgument[];
}

/**
 * Measure argument interface
 */
export interface MeasureArgument {
  name: string;
  displayName: string;
  description: string;
  type: string;
  required: boolean;
  defaultValue?: string | number | boolean;
}

/**
 * BCL integration interface
 */
export interface BCLIntegration {
  searchMeasures(query: string): Promise<Measure[]>;
  downloadMeasure(measureId: string): Promise<boolean>;
  installMeasure(measureId: string): Promise<boolean>;
  recommendMeasures(context: string): Promise<Measure[]>;
  updateMeasure(measureId: string): Promise<boolean>;
}
