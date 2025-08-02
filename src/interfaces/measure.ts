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

/**
 * Measure update result
 */
export interface MeasureUpdateResult {
  /** Whether the update was successful */
  success: boolean;
  /** Measure ID that was updated */
  measureId: string;
  /** Previous version */
  previousVersion?: string;
  /** New version */
  newVersion?: string;
  /** Update message */
  message: string;
  /** Error details if update failed */
  error?: string;
  /** Files that were updated */
  updatedFiles?: string[];
}

/**
 * Measure update options
 */
export interface MeasureUpdateOptions {
  /** Whether to force update even if no changes detected */
  force?: boolean;
  /** Whether to update README.md.erb files */
  updateReadme?: boolean;
  /** Whether to update measure.xml files */
  updateXml?: boolean;
  /** Custom measures directory */
  measuresDir?: string;
}

/**
 * Measure argument computation result
 */
export interface MeasureArgumentComputationResult {
  /** Whether the computation was successful */
  success: boolean;
  /** Measure ID */
  measureId: string;
  /** Computed arguments with model-specific values */
  arguments: MeasureArgument[];
  /** Error message if computation failed */
  error?: string;
  /** Model context used for computation */
  modelPath?: string;
}

/**
 * Measure argument computation options
 */
export interface MeasureArgumentComputationOptions {
  /** Path to model file for context-aware argument computation */
  modelPath?: string;
  /** Custom measures directory */
  measuresDir?: string;
  /** Whether to include EnergyPlus measure arguments */
  includeEnergyPlusMeasures?: boolean;
}

/**
 * Measure test result
 */
export interface MeasureTestResult {
  /** Whether all tests passed */
  success: boolean;
  /** Measure ID that was tested */
  measureId: string;
  /** Number of tests executed */
  testsExecuted: number;
  /** Number of tests passed */
  testsPassed: number;
  /** Number of tests failed */
  testsFailed: number;
  /** Test execution time in seconds */
  executionTime: number;
  /** Error message if testing failed */
  error?: string;
  /** Detailed test results */
  testDetails?: MeasureIndividualTestResult[];
}

/**
 * Individual test result
 */
export interface MeasureIndividualTestResult {
  /** Test name */
  name: string;
  /** Whether the test passed */
  passed: boolean;
  /** Test execution time in seconds */
  executionTime: number;
  /** Error message if test failed */
  error?: string;
  /** Test output */
  output?: string;
}

/**
 * Measure test options
 */
export interface MeasureTestOptions {
  /** Custom measures directory */
  measuresDir?: string;
  /** Whether to generate test dashboard */
  generateDashboard?: boolean;
  /** Whether to run only specific test files */
  testFiles?: string[];
  /** Timeout for test execution in seconds */
  timeout?: number;
}

/**
 * Measure management request interfaces for MCP
 */

export interface MeasureUpdateRequest {
  /** Measure ID to update (optional for update_all) */
  measureId?: string;
  /** Whether to update all measures */
  updateAll?: boolean;
  /** Update options */
  options?: MeasureUpdateOptions;
}

export interface MeasureArgumentComputationRequest {
  /** Measure ID to compute arguments for */
  measureId: string;
  /** Computation options */
  options?: MeasureArgumentComputationOptions;
}

export interface MeasureTestRequest {
  /** Measure ID to test */
  measureId: string;
  /** Test options */
  options?: MeasureTestOptions;
}
