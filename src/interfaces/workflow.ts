/**
 * OpenStudio Workflow (OSW) related interfaces
 */

/**
 * OpenStudio Workflow request parameters
 */
export interface WorkflowRequest {
  /** Path to OSW file or workflow object */
  workflow: string | object;

  /** Execution options */
  options?: {
    debug?: boolean;
    measuresOnly?: boolean;
    postProcessOnly?: boolean;
    preserveRunDir?: boolean;
    outputDirectory?: string;
  };
}

/**
 * Workflow creation request parameters
 */
export interface WorkflowCreateRequest {
  /** Template name for workflow creation */
  templateName?: string;

  /** Workflow name */
  name?: string;

  /** Workflow description */
  description?: string;

  /** Seed model file path */
  seedFile: string;

  /** Weather file path (optional) */
  weatherFile?: string;

  /** Custom workflow steps */
  steps?: {
    measureDirName: string;
    arguments?: Record<string, unknown>;
    name?: string;
    description?: string;
  }[];

  /** Output path for the workflow file */
  outputPath?: string;
}

/**
 * Workflow validation request parameters
 */
export interface WorkflowValidateRequest {
  /** Path to OSW file or workflow object */
  workflow: string | object;

  /** Base directory for resolving relative paths */
  baseDirectory?: string;
}

/**
 * Workflow execution response
 */
export interface WorkflowExecutionResponse {
  /** Whether execution was successful */
  success: boolean;

  /** Execution output */
  output: string;

  /** Error message if execution failed */
  error?: string;

  /** Execution duration in milliseconds */
  duration?: number;

  /** Output directory */
  outputDirectory?: string;

  /** Step-by-step results */
  stepResults?: {
    stepIndex: number;
    measureName: string;
    success: boolean;
    output?: string;
    error?: string;
    duration?: number;
  }[];

  /** Final model path */
  finalModelPath?: string;

  /** Simulation results (if simulation was run) */
  simulationResults?: {
    success: boolean;
    eui?: number;
    totalSiteEnergy?: number;
    errors?: string[];
    warnings?: string[];
  };
}

/**
 * Workflow validation response
 */
export interface WorkflowValidationResponse {
  /** Whether workflow is valid */
  valid: boolean;

  /** Validation errors */
  errors: string[];

  /** Validation warnings */
  warnings: string[];

  /** Missing files */
  missingFiles?: string[];

  /** Invalid measures */
  invalidMeasures?: string[];
}
