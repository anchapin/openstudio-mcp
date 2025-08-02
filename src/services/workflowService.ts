/**
 * OpenStudio Workflow (OSW) Service
 *
 * This service provides comprehensive support for OpenStudio Workflow (OSW) files,
 * including parsing, validation, and execution of workflows.
 *
 * Features:
 * - Complete OSW JSON schema validation
 * - Workflow execution with all CLI options
 * - Support for seed files, weather files, and measure steps
 * - File discovery logic compatible with OpenStudio CLI
 * - Error handling and progress tracking
 */

import { logger } from '../utils';
import { isPathSafe } from '../utils/validation';
import { executeOpenStudioCommand } from '../utils/commandExecutor';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';

/**
 * OpenStudio Workflow JSON structure
 */
export interface OpenStudioWorkflow {
  /** Workflow version */
  version?: string;

  /** Workflow name */
  name?: string;

  /** Workflow description */
  description?: string;

  /** Seed OpenStudio model file */
  seed_file?: string;

  /** Weather file for simulation */
  weather_file?: string;

  /** Workflow steps (measures to apply) */
  steps: WorkflowStep[];

  /** Workflow metadata */
  created_at?: string;
  updated_at?: string;

  /** Run options */
  run_options?: {
    debug?: boolean;
    fast?: boolean;
    preserve_run_dir?: boolean;
    cleanup?: boolean;
  };

  /** File paths */
  file_paths?: string[];

  /** Measure paths */
  measure_paths?: string[];

  /** Output variables */
  output_variables?: string[];
}

/**
 * Workflow step (measure application)
 */
export interface WorkflowStep {
  /** Measure directory name or path */
  measure_dir_name: string;

  /** Measure arguments */
  arguments?: Record<string, unknown>;

  /** Step name (optional) */
  name?: string;

  /** Step description (optional) */
  description?: string;

  /** Whether this step is enabled */
  enabled?: boolean;
}

/**
 * Workflow execution options
 */
export interface WorkflowExecutionOptions {
  /** Enable debug mode */
  debug?: boolean;

  /** Run measures only (skip simulation) */
  measuresOnly?: boolean;

  /** Run reporting measures only (post-process) */
  postProcessOnly?: boolean;

  /** Preserve run directory */
  preserveRunDir?: boolean;

  /** Output directory for results */
  outputDirectory?: string;

  /** Additional CLI arguments */
  additionalArgs?: string[];
}

/**
 * Workflow execution result
 */
export interface WorkflowExecutionResult {
  /** Whether execution was successful */
  success: boolean;

  /** Output from workflow execution */
  output: string;

  /** Error message if execution failed */
  error?: string;

  /** Workflow output directory */
  outputDirectory?: string;

  /** Execution duration in milliseconds */
  duration?: number;

  /** Step-by-step results */
  stepResults?: WorkflowStepResult[];

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
 * Individual step execution result
 */
export interface WorkflowStepResult {
  /** Step index */
  stepIndex: number;

  /** Measure name */
  measureName: string;

  /** Step success status */
  success: boolean;

  /** Step output */
  output?: string;

  /** Step error */
  error?: string;

  /** Step duration */
  duration?: number;

  /** Measure arguments used */
  arguments?: Record<string, unknown>;
}

/**
 * Workflow validation result
 */
export interface WorkflowValidationResult {
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

/**
 * OpenStudio Workflow Service
 */
export class WorkflowService {
  /**
   * Parse an OSW file from disk
   * @param oswPath Path to the OSW file
   * @returns Parsed workflow object
   */
  async parseWorkflowFile(oswPath: string): Promise<OpenStudioWorkflow> {
    if (!oswPath || !isPathSafe(oswPath)) {
      throw new Error(`Invalid OSW file path: ${oswPath}`);
    }

    if (!existsSync(oswPath)) {
      throw new Error(`OSW file not found: ${oswPath}`);
    }

    try {
      const oswContent = await fs.readFile(oswPath, 'utf-8');
      const workflow = JSON.parse(oswContent) as OpenStudioWorkflow;

      logger.info({ oswPath, stepCount: workflow.steps.length }, 'Parsed OSW file');

      return workflow;
    } catch (error) {
      logger.error({ oswPath, error }, 'Failed to parse OSW file');
      throw new Error(
        `Failed to parse OSW file: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Validate a workflow object
   * @param workflow Workflow to validate
   * @param workflowDir Base directory for resolving relative paths
   * @returns Validation result
   */
  async validateWorkflow(
    workflow: OpenStudioWorkflow,
    workflowDir?: string,
  ): Promise<WorkflowValidationResult> {
    const result: WorkflowValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      missingFiles: [],
      invalidMeasures: [],
    };

    try {
      // Validate basic structure
      if (!workflow.steps || !Array.isArray(workflow.steps)) {
        result.errors.push('Workflow must have a steps array');
        result.valid = false;
      }

      if (workflow.steps.length === 0) {
        result.warnings.push('Workflow has no steps defined');
      }

      // Validate seed file if specified
      if (workflow.seed_file) {
        const seedPath = this.resolvePath(workflow.seed_file, workflowDir);
        if (!existsSync(seedPath)) {
          result.errors.push(`Seed file not found: ${workflow.seed_file}`);
          result.missingFiles?.push(workflow.seed_file);
          result.valid = false;
        }
      }

      // Validate weather file if specified
      if (workflow.weather_file) {
        const weatherPath = this.resolvePath(workflow.weather_file, workflowDir);
        if (!existsSync(weatherPath)) {
          result.errors.push(`Weather file not found: ${workflow.weather_file}`);
          result.missingFiles?.push(workflow.weather_file);
          result.valid = false;
        }
      }

      // Validate each step
      for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];

        if (!step.measure_dir_name) {
          result.errors.push(`Step ${i + 1}: measure_dir_name is required`);
          result.valid = false;
        }

        // Check if measure directory exists (if it's a path)
        if (step.measure_dir_name && step.measure_dir_name.includes('/')) {
          const measurePath = this.resolvePath(step.measure_dir_name, workflowDir);
          if (!existsSync(measurePath)) {
            result.warnings.push(
              `Step ${i + 1}: Measure directory not found: ${step.measure_dir_name}`,
            );
            result.invalidMeasures?.push(step.measure_dir_name);
          }
        }
      }

      logger.info(
        {
          valid: result.valid,
          errorCount: result.errors.length,
          warningCount: result.warnings.length,
        },
        'Workflow validation completed',
      );

      return result;
    } catch (error) {
      logger.error({ error }, 'Error during workflow validation');
      result.errors.push(
        `Validation error: ${error instanceof Error ? error.message : String(error)}`,
      );
      result.valid = false;
      return result;
    }
  }

  /**
   * Execute a workflow
   * @param workflow Workflow to execute
   * @param options Execution options
   * @param workflowDir Base directory for the workflow
   * @returns Execution result
   */
  async executeWorkflow(
    workflow: OpenStudioWorkflow,
    options: WorkflowExecutionOptions = {},
    workflowDir?: string,
  ): Promise<WorkflowExecutionResult> {
    const startTime = Date.now();

    try {
      logger.info({ stepCount: workflow.steps.length, options }, 'Starting workflow execution');

      // Validate workflow first
      const validation = await this.validateWorkflow(workflow, workflowDir);
      if (!validation.valid) {
        return {
          success: false,
          output: '',
          error: `Workflow validation failed: ${validation.errors.join(', ')}`,
          duration: Date.now() - startTime,
        };
      }

      // Create temporary OSW file for execution
      const tempOswPath = await this.createTempWorkflowFile(workflow, workflowDir);

      try {
        // Execute workflow using OpenStudio CLI
        const executionResult = await this.executeWorkflowFile(tempOswPath, options);

        // Clean up temporary file
        await fs.unlink(tempOswPath);

        return {
          ...executionResult,
          duration: Date.now() - startTime,
        };
      } catch (error) {
        // Clean up temporary file on error
        try {
          await fs.unlink(tempOswPath);
        } catch (cleanupError) {
          logger.warn({ cleanupError }, 'Failed to clean up temporary OSW file');
        }
        throw error;
      }
    } catch (error) {
      logger.error({ error }, 'Workflow execution failed');
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute a workflow file using OpenStudio CLI
   * @param oswPath Path to OSW file
   * @param options Execution options
   * @returns Execution result
   */
  async executeWorkflowFile(
    oswPath: string,
    options: WorkflowExecutionOptions = {},
  ): Promise<WorkflowExecutionResult> {
    if (!oswPath || !isPathSafe(oswPath)) {
      throw new Error(`Invalid OSW file path: ${oswPath}`);
    }

    if (!existsSync(oswPath)) {
      throw new Error(`OSW file not found: ${oswPath}`);
    }

    try {
      // Prepare CLI arguments
      const args = ['run', '--workflow', oswPath];

      if (options.debug) {
        args.push('--debug');
      }

      if (options.measuresOnly) {
        args.push('--measures_only');
      }

      if (options.postProcessOnly) {
        args.push('--postprocess_only');
      }

      if (options.additionalArgs) {
        args.push(...options.additionalArgs);
      }

      logger.info({ oswPath, args }, 'Executing workflow with OpenStudio CLI');

      // Execute the workflow
      const result = await executeOpenStudioCommand('', args, {
        timeout: 1800000, // 30 minutes
        memoryLimit: 8192, // 8GB
      });

      // Parse execution results
      const executionResult: WorkflowExecutionResult = {
        success: result.success,
        output: result.stdout,
        error: result.error,
        outputDirectory: options.outputDirectory || path.dirname(oswPath),
      };

      // Parse workflow output if available
      if (result.stdout) {
        executionResult.stepResults = this.parseWorkflowOutput(result.stdout);
      }

      logger.info(
        {
          success: executionResult.success,
          stepCount: executionResult.stepResults?.length || 0,
        },
        'Workflow execution completed',
      );

      return executionResult;
    } catch (error) {
      logger.error({ oswPath, error }, 'Failed to execute workflow');
      throw new Error(
        `Workflow execution failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Create a workflow object from a template
   * @param templateName Template name (e.g., 'calibration', 'basic_analysis')
   * @param seedFile Path to seed model file
   * @param weatherFile Path to weather file (optional)
   * @returns Workflow object
   */
  createWorkflowFromTemplate(
    templateName: string,
    seedFile: string,
    weatherFile?: string,
  ): OpenStudioWorkflow {
    const workflow: OpenStudioWorkflow = {
      version: '3.8.0',
      seed_file: seedFile,
      weather_file: weatherFile,
      steps: [],
      created_at: new Date().toISOString(),
      run_options: {
        debug: false,
        cleanup: true,
      },
    };

    // Add template-specific steps
    switch (templateName.toLowerCase()) {
      case 'basic_analysis':
        workflow.steps = [
          {
            measure_dir_name: 'SetWindowToWallRatioByFacade',
            arguments: {
              wwr_north: 0.4,
              wwr_south: 0.4,
              wwr_east: 0.3,
              wwr_west: 0.3,
            },
          },
        ];
        break;

      case 'calibration':
        workflow.steps = [
          {
            measure_dir_name: 'CalibrationReports',
            arguments: {
              reporting_frequency: 'Monthly',
            },
          },
        ];
        break;

      case 'hvac_analysis':
        workflow.steps = [
          {
            measure_dir_name: 'replace_hvac_with_gshp_and_doas',
            arguments: {},
          },
        ];
        break;

      default:
        logger.warn({ templateName }, 'Unknown template name, creating empty workflow');
        break;
    }

    logger.info(
      { templateName, stepCount: workflow.steps.length },
      'Created workflow from template',
    );

    return workflow;
  }

  /**
   * Save a workflow to a file
   * @param workflow Workflow object
   * @param outputPath Path to save the OSW file
   */
  async saveWorkflow(workflow: OpenStudioWorkflow, outputPath: string): Promise<void> {
    if (!outputPath || !isPathSafe(outputPath)) {
      throw new Error(`Invalid output path: ${outputPath}`);
    }

    try {
      // Ensure directory exists
      const dir = path.dirname(outputPath);
      await fs.mkdir(dir, { recursive: true });

      // Update timestamp
      workflow.updated_at = new Date().toISOString();

      // Write workflow file
      const oswContent = JSON.stringify(workflow, null, 2);
      await fs.writeFile(outputPath, oswContent, 'utf-8');

      logger.info({ outputPath, stepCount: workflow.steps.length }, 'Saved workflow to file');
    } catch (error) {
      logger.error({ outputPath, error }, 'Failed to save workflow');
      throw new Error(
        `Failed to save workflow: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Resolve a file path relative to a base directory
   * @param filePath File path to resolve
   * @param baseDir Base directory (optional)
   * @returns Resolved absolute path
   */
  private resolvePath(filePath: string, baseDir?: string): string {
    if (path.isAbsolute(filePath)) {
      return filePath;
    }

    if (baseDir) {
      return path.resolve(baseDir, filePath);
    }

    return path.resolve(filePath);
  }

  /**
   * Create a temporary OSW file for execution
   * @param workflow Workflow object
   * @param workflowDir Base directory for the workflow
   * @returns Path to temporary OSW file
   */
  private async createTempWorkflowFile(
    workflow: OpenStudioWorkflow,
    workflowDir?: string,
  ): Promise<string> {
    const os = await import('os');
    const tempDir = os.tmpdir();
    const tempFileName = `workflow_${Date.now()}.osw`;
    const tempPath = path.join(tempDir, tempFileName);

    // Resolve relative paths in workflow
    const resolvedWorkflow = { ...workflow };

    if (workflow.seed_file && !path.isAbsolute(workflow.seed_file)) {
      resolvedWorkflow.seed_file = this.resolvePath(workflow.seed_file, workflowDir);
    }

    if (workflow.weather_file && !path.isAbsolute(workflow.weather_file)) {
      resolvedWorkflow.weather_file = this.resolvePath(workflow.weather_file, workflowDir);
    }

    await this.saveWorkflow(resolvedWorkflow, tempPath);
    return tempPath;
  }

  /**
   * Parse workflow execution output to extract step results
   * @param output OpenStudio CLI output
   * @returns Array of step results
   */
  private parseWorkflowOutput(output: string): WorkflowStepResult[] {
    const stepResults: WorkflowStepResult[] = [];

    try {
      // Split output by lines and look for measure execution patterns
      const lines = output.split('\n');
      let currentStep: Partial<WorkflowStepResult> | null = null;
      let stepIndex = 0;

      for (const line of lines) {
        // Look for measure execution start
        const measureStartMatch = line.match(/Applying (.+?) measure/);
        if (measureStartMatch) {
          if (currentStep) {
            stepResults.push(currentStep as WorkflowStepResult);
          }

          currentStep = {
            stepIndex: stepIndex++,
            measureName: measureStartMatch[1],
            success: false,
            output: '',
          };
        }

        // Look for measure completion
        const measureCompleteMatch = line.match(/Measure (.+?) completed/);
        if (measureCompleteMatch && currentStep) {
          currentStep.success = true;
        }

        // Look for measure errors
        const measureErrorMatch = line.match(/Error in measure (.+?):/);
        if (measureErrorMatch && currentStep) {
          currentStep.success = false;
          currentStep.error = line;
        }

        // Accumulate output for current step
        if (currentStep) {
          currentStep.output = (currentStep.output || '') + line + '\n';
        }
      }

      // Add final step if exists
      if (currentStep) {
        stepResults.push(currentStep as WorkflowStepResult);
      }
    } catch (error) {
      logger.warn({ error }, 'Failed to parse workflow output');
    }

    return stepResults;
  }
}

// Create and export default instance
const workflowService = new WorkflowService();
export default workflowService;
