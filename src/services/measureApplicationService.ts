/**
 * Measure Application Service
 *
 * This module provides functionality for applying OpenStudio measures to models
 * with parameter mapping and validation.
 *
 * Features:
 * - Measure application workflow
 * - Parameter mapping for measures
 * - Validation for measure application
 * - Error handling and logging
 */
import path from 'path';
import { logger } from '../utils';
import openStudioCommands from '../utils/openStudioCommands';
import measureManager from '../utils/measureManager';
import fileOperations from '../utils/fileOperations';
import { BCLApiClient } from './bclApiClient';

/**
 * Measure application options
 */
export interface MeasureApplicationOptions {
  /** Whether to create a backup of the original model */
  createBackup?: boolean;
  /** Whether to validate the model before applying the measure */
  validateModel?: boolean;
  /** Whether to validate the measure before applying */
  validateMeasure?: boolean;
  /** Whether to apply the measure in-place (modify the original model) */
  inPlace?: boolean;
  /** Custom output path for the modified model */
  outputPath?: string;
  /** Custom measures directory */
  measuresDir?: string;
  /** Whether to throw an error if the measure application fails */
  throwOnError?: boolean;
}

/**
 * Default measure application options
 */
const defaultOptions: MeasureApplicationOptions = {
  createBackup: true,
  validateModel: true,
  validateMeasure: true,
  inPlace: false,
  throwOnError: false,
};

/**
 * Measure application result
 */
export interface MeasureApplicationResult {
  /** Whether the measure application was successful */
  success: boolean;
  /** Path to the modified model */
  outputModelPath: string;
  /** Original model path */
  originalModelPath: string;
  /** Measure ID */
  measureId: string;
  /** Measure arguments used */
  arguments: Record<string, any>;
  /** Error message if the application failed */
  error?: string;
  /** Command output */
  output?: string;
  /** Warnings from the measure application */
  warnings?: string[];
}

/**
 * Validate a measure for application
 * @param measureId Measure ID
 * @param modelPath Path to the model file
 * @param args Measure arguments
 * @param options Validation options
 * @returns Promise that resolves with validation result
 */
export async function validateMeasureForApplication(
  measureId: string,
  modelPath: string,
  args: Record<string, any>,
  options: MeasureApplicationOptions = {},
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  // Check if the model file exists
  if (!(await fileOperations.fileExists(modelPath))) {
    errors.push(`Model file not found: ${modelPath}`);
    return { valid: errors.length === 0, errors };
  }

  // Check if the model file is a valid OSM file
  if (!modelPath.toLowerCase().endsWith('.osm')) {
    errors.push(`Invalid model file format: ${modelPath}. Must be an OSM file.`);
  }

  // Check if the model file is a valid OSM file
  if (!modelPath.toLowerCase().endsWith('.osm')) {
    errors.push(`Invalid model file format: ${modelPath}. Must be an OSM file.`);
    return { valid: errors.length === 0, errors };
  }

  // Check if the measure is installed
  const measuresDir = options.measuresDir || measureManager.getMeasuresDir();
  const measurePath = path.join(measuresDir, measureId);

  if (!(await fileOperations.directoryExists(measurePath))) {
    errors.push(`Measure not installed: ${measureId}`);
    return { valid: errors.length === 0, errors };
  }

  // Check if the measure has the required files
  const measureXmlPath = path.join(measurePath, 'measure.xml');
  const measureRbPath = path.join(measurePath, 'measure.rb');

  if (!(await fileOperations.fileExists(measureXmlPath))) {
    errors.push(`Measure XML file not found: ${measureXmlPath}`);
  }

  if (!(await fileOperations.fileExists(measureRbPath))) {
    errors.push(`Measure Ruby file not found: ${measureRbPath}`);
  }

  // Get measure information to validate arguments
  try {
    // List available measures to get information about the measure
    const result = await openStudioCommands.listMeasures(measuresDir);

    if (!result.success || !result.data) {
      errors.push('Failed to list measures');
      return { valid: errors.length === 0, errors };
    }

    // Find the measure in the list
    const measures = result.data as any[];
    const measure = measures.find((m) => m.uuid === measureId || m.name === measureId);

    if (!measure) {
      errors.push(`Measure not found in available measures: ${measureId}`);
      return { valid: errors.length === 0, errors };
    }

    // Validate required arguments
    for (const arg of measure.arguments) {
      if (arg.required && (args[arg.name] === undefined || args[arg.name] === null)) {
        errors.push(`Missing required argument: ${arg.name}`);
      }
    }

    // Validate argument types
    for (const [name, value] of Object.entries(args)) {
      const argDef = measure.arguments.find((a) => a.name === name);

      if (!argDef) {
        errors.push(`Unknown argument: ${name}`);
        continue;
      }

      // Type validation
      switch (argDef.type) {
        case 'Double':
        case 'Integer':
          if (typeof value !== 'number') {
            errors.push(`Invalid type for argument ${name}: expected number, got ${typeof value}`);
          }
          break;
        case 'Boolean':
          if (typeof value !== 'boolean') {
            errors.push(`Invalid type for argument ${name}: expected boolean, got ${typeof value}`);
          }
          break;
        case 'String':
          if (typeof value !== 'string') {
            errors.push(`Invalid type for argument ${name}: expected string, got ${typeof value}`);
          }
          break;
        case 'Choice':
          // For choice arguments, we would need to check if the value is one of the allowed choices
          // This would require parsing the measure.xml file to get the allowed choices
          // For now, we'll just check if it's a string
          if (typeof value !== 'string') {
            errors.push(`Invalid type for argument ${name}: expected string, got ${typeof value}`);
          }
          break;
      }
    }
  } catch (error) {
    errors.push(
      `Error validating measure arguments: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Apply a measure to a model
 * @param modelPath Path to the model file
 * @param measureId Measure ID
 * @param args Measure arguments
 * @param options Measure application options
 * @returns Promise that resolves with the measure application result
 */
export async function applyMeasure(
  modelPath: string,
  measureId: string,
  args: Record<string, any>,
  options: MeasureApplicationOptions = {},
): Promise<MeasureApplicationResult> {
  const opts = { ...defaultOptions, ...options };

  try {
    logger.info({ modelPath, measureId, args }, 'Applying measure to model');

    // Validate the measure for application
    if (opts.validateMeasure) {
      const validation = await validateMeasureForApplication(measureId, modelPath, args, opts);

      if (!validation.valid) {
        logger.error(
          { modelPath, measureId, errors: validation.errors },
          'Measure validation failed',
        );

        if (opts.throwOnError) {
          throw new Error(`Measure validation failed: ${validation.errors.join(', ')}`);
        }

        return {
          success: false,
          outputModelPath: modelPath,
          originalModelPath: modelPath,
          measureId,
          arguments: args,
          error: `Measure validation failed: ${validation.errors.join(', ')}`,
        };
      }
    }

    // Get the measure path
    const measuresDir = opts.measuresDir || measureManager.getMeasuresDir();
    const measurePath = path.join(measuresDir, measureId);

    // Create a backup of the original model if requested
    let backupPath: string | undefined;
    if (opts.createBackup) {
      backupPath = `${modelPath}.backup`;
      await fileOperations.copyFile(modelPath, backupPath);
      logger.info({ modelPath, backupPath }, 'Created backup of original model');
    }

    // Determine the output path
    let outputPath = modelPath;
    if (!opts.inPlace) {
      if (opts.outputPath) {
        outputPath = opts.outputPath;
      } else {
        // Generate a default output path
        const modelDir = path.dirname(modelPath);
        const modelName = path.basename(modelPath, '.osm');
        outputPath = path.join(modelDir, `${modelName}_with_${measureId}.osm`);
      }
    }

    // Apply the measure
    const result = await openStudioCommands.applyMeasure(modelPath, measurePath, args, outputPath);

    if (!result.success) {
      logger.error({ modelPath, measureId, error: result.error }, 'Failed to apply measure');

      // Restore from backup if we were modifying in-place
      if (opts.inPlace && backupPath) {
        await fileOperations.copyFile(backupPath, modelPath);
        logger.info(
          { modelPath, backupPath },
          'Restored model from backup after failed measure application',
        );
      }

      // Clean up backup if not needed
      if (backupPath && !opts.inPlace) {
        await fileOperations.deleteFile(backupPath);
      }

      if (opts.throwOnError) {
        throw new Error(`Failed to apply measure: ${result.error}`);
      }

      return {
        success: false,
        outputModelPath: modelPath,
        originalModelPath: modelPath,
        measureId,
        arguments: args,
        error: result.error,
        output: result.output,
      };
    }

    // Extract warnings from the output
    const warnings: string[] = [];
    if (result.output) {
      const warningMatches = result.output.match(/Warning: ([^\n]+)/g);
      if (warningMatches) {
        warnings.push(...warningMatches.map((match) => match.replace('Warning: ', '').trim()));
      }
    }

    // Clean up backup if not needed
    if (backupPath && !opts.inPlace) {
      await fileOperations.deleteFile(backupPath);
    }

    logger.info({ modelPath, measureId, outputPath }, 'Successfully applied measure to model');

    return {
      success: true,
      outputModelPath: outputPath,
      originalModelPath: modelPath,
      measureId,
      arguments: args,
      warnings,
      output: result.output,
    };
  } catch (error) {
    logger.error(
      { modelPath, measureId, error: error instanceof Error ? error.message : String(error) },
      'Error applying measure',
    );

    if (opts.throwOnError) {
      throw error;
    }

    return {
      success: false,
      outputModelPath: modelPath,
      originalModelPath: modelPath,
      measureId,
      arguments: args,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Apply multiple measures to a model in sequence
 * @param modelPath Path to the model file
 * @param measures Array of measures to apply with their arguments
 * @param options Measure application options
 * @returns Promise that resolves with the measure application results
 */
export async function applyMeasuresInSequence(
  modelPath: string,
  measures: Array<{ measureId: string; arguments: Record<string, any> }>,
  options: MeasureApplicationOptions = {},
): Promise<MeasureApplicationResult[]> {
  const results: MeasureApplicationResult[] = [];
  let currentModelPath = modelPath;

  try {
    logger.info(
      { modelPath, measureCount: measures.length },
      'Applying multiple measures to model in sequence',
    );

    for (const [index, measure] of measures.entries()) {
      logger.info(
        { modelPath: currentModelPath, measureId: measure.measureId, index },
        `Applying measure ${index + 1} of ${measures.length}`,
      );

      // For intermediate steps, we want to keep the output separate
      const stepOptions: MeasureApplicationOptions = {
        ...options,
        inPlace: false,
        outputPath:
          options.outputPath && index === measures.length - 1 ? options.outputPath : undefined,
      };

      // Apply the measure
      const result = await applyMeasure(
        currentModelPath,
        measure.measureId,
        measure.arguments,
        stepOptions,
      );
      results.push(result);

      // If the measure failed, stop the sequence
      if (!result.success) {
        logger.error(
          { modelPath, measureId: measure.measureId, index },
          `Measure ${index + 1} failed, stopping sequence`,
        );
        break;
      }

      // Update the model path for the next measure
      currentModelPath = result.outputModelPath;
    }

    // If we're applying in-place and we have a final output path, copy the result back to the original
    if (options.inPlace && results.length > 0 && results[results.length - 1].success) {
      await fileOperations.copyFile(results[results.length - 1].outputModelPath, modelPath);

      // Clean up intermediate files
      for (let i = 0; i < results.length - 1; i++) {
        if (results[i].success && results[i].outputModelPath !== modelPath) {
          await fileOperations.deleteFile(results[i].outputModelPath);
        }
      }
    }

    return results;
  } catch (error) {
    logger.error(
      { modelPath, error: error instanceof Error ? error.message : String(error) },
      'Error applying measures in sequence',
    );

    if (options.throwOnError) {
      throw error;
    }

    return results;
  }
}

/**
 * Map measure parameters from user input to OpenStudio measure arguments
 * @param measureId Measure ID
 * @param userParams User-provided parameters
 * @param options Mapping options
 * @returns Promise that resolves with mapped arguments
 */
export async function mapMeasureParameters(
  measureId: string,
  userParams: Record<string, any>,
  options: { measuresDir?: string } = {},
): Promise<Record<string, any>> {
  try {
    logger.info({ measureId, userParams }, 'Mapping measure parameters');

    // Get the measure path
    const measuresDir = options.measuresDir || measureManager.getMeasuresDir();
    const measurePath = path.join(measuresDir, measureId);

    // Check if the measure is installed
    if (!(await fileOperations.directoryExists(measurePath))) {
      throw new Error(`Measure not installed: ${measureId}`);
    }

    // Get measure information
    const result = await openStudioCommands.listMeasures(measuresDir);

    if (!result.success || !result.data) {
      throw new Error('Failed to list measures');
    }

    // Find the measure in the list
    const measures = result.data as any[];
    const measure = measures.find((m) => m.uuid === measureId || m.name === measureId);

    if (!measure) {
      throw new Error(`Measure not found in available measures: ${measureId}`);
    }

    // Map user parameters to measure arguments
    const mappedArgs: Record<string, any> = {};

    // First, set default values for all arguments
    for (const arg of measure.arguments) {
      if (arg.defaultValue !== undefined) {
        mappedArgs[arg.name] = arg.defaultValue;
      }
    }

    // Then, override with user-provided values
    for (const [key, value] of Object.entries(userParams)) {
      // Try to find the argument by name or display name
      const arg = measure.arguments.find(
        (a) =>
          a.name === key ||
          a.displayName === key ||
          a.name.toLowerCase() === key.toLowerCase() ||
          a.displayName.toLowerCase() === key.toLowerCase(),
      );

      if (arg) {
        // Convert the value to the appropriate type
        switch (arg.type) {
          case 'Double':
            mappedArgs[arg.name] = typeof value === 'number' ? value : parseFloat(String(value));
            break;
          case 'Integer':
            mappedArgs[arg.name] =
              typeof value === 'number' ? Math.round(value) : parseInt(String(value), 10);
            break;
          case 'Boolean':
            mappedArgs[arg.name] =
              typeof value === 'boolean' ? value : String(value).toLowerCase() === 'true';
            break;
          case 'String':
          case 'Choice':
          default:
            mappedArgs[arg.name] = String(value);
            break;
        }
      } else {
        // If we can't find a matching argument, just pass it through
        mappedArgs[key] = value;
      }
    }

    logger.info({ measureId, mappedArgs }, 'Successfully mapped measure parameters');
    return mappedArgs;
  } catch (error) {
    logger.error(
      { measureId, userParams, error: error instanceof Error ? error.message : String(error) },
      'Error mapping measure parameters',
    );
    throw error;
  }
}

/**
 * Download and apply a measure from the BCL
 * @param modelPath Path to the model file
 * @param measureId BCL measure ID
 * @param args Measure arguments
 * @param options Measure application options
 * @returns Promise that resolves with the measure application result
 */
export async function downloadAndApplyMeasure(
  modelPath: string,
  measureId: string,
  args: Record<string, any>,
  options: MeasureApplicationOptions = {},
): Promise<MeasureApplicationResult> {
  try {
    logger.info({ modelPath, measureId }, 'Downloading and applying measure');

    // Check if the measure is already installed
    const isInstalled = await measureManager.isMeasureInstalled(measureId, options.measuresDir);

    if (!isInstalled) {
      logger.info({ measureId }, 'Measure not installed, downloading from BCL');

      // Create a BCL API client
      const bclClient = new BCLApiClient();

      // Download and install the measure
      const downloadSuccess = await bclClient.downloadMeasure(measureId);

      if (!downloadSuccess) {
        logger.error({ measureId }, 'Failed to download measure from BCL');

        return {
          success: false,
          outputModelPath: modelPath,
          originalModelPath: modelPath,
          measureId,
          arguments: args,
          error: `Failed to download measure ${measureId} from BCL`,
        };
      }

      const installSuccess = await bclClient.installMeasure(measureId);

      if (!installSuccess) {
        logger.error({ measureId }, 'Failed to install downloaded measure');

        return {
          success: false,
          outputModelPath: modelPath,
          originalModelPath: modelPath,
          measureId,
          arguments: args,
          error: `Failed to install downloaded measure ${measureId}`,
        };
      }

      logger.info({ measureId }, 'Successfully downloaded and installed measure');
    }

    // Apply the measure
    return applyMeasure(modelPath, measureId, args, options);
  } catch (error) {
    logger.error(
      { modelPath, measureId, error: error instanceof Error ? error.message : String(error) },
      'Error downloading and applying measure',
    );

    if (options.throwOnError) {
      throw error;
    }

    return {
      success: false,
      outputModelPath: modelPath,
      originalModelPath: modelPath,
      measureId,
      arguments: args,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Measure application workflow
 *
 * This interface defines the structure of a measure application workflow,
 * which is a sequence of steps to apply measures to a model.
 */
export interface MeasureApplicationWorkflow {
  /** Workflow name */
  name: string;
  /** Workflow description */
  description: string;
  /** Model path */
  modelPath: string;
  /** Measures to apply in sequence */
  measures: Array<{
    /** Measure ID */
    measureId: string;
    /** Measure arguments */
    arguments: Record<string, any>;
    /** Optional description of this step */
    description?: string;
  }>;
  /** Workflow options */
  options?: MeasureApplicationOptions;
}

/**
 * Measure application workflow result
 */
export interface MeasureApplicationWorkflowResult {
  /** Whether the workflow completed successfully */
  success: boolean;
  /** Original model path */
  originalModelPath: string;
  /** Final model path after all measures are applied */
  finalModelPath: string;
  /** Individual measure application results */
  measureResults: MeasureApplicationResult[];
  /** Error message if the workflow failed */
  error?: string;
}

/**
 * Execute a measure application workflow
 * @param workflow Measure application workflow
 * @returns Promise that resolves with the workflow result
 */
export async function executeMeasureWorkflow(
  workflow: MeasureApplicationWorkflow,
): Promise<MeasureApplicationWorkflowResult> {
  try {
    logger.info({ workflow: workflow.name }, 'Executing measure application workflow');

    // Validate the workflow
    if (!workflow.modelPath) {
      throw new Error('Model path is required for measure application workflow');
    }

    if (!workflow.measures || workflow.measures.length === 0) {
      throw new Error('At least one measure is required for measure application workflow');
    }

    // Check if the model file exists
    if (!(await fileOperations.fileExists(workflow.modelPath))) {
      throw new Error(`Model file not found: ${workflow.modelPath}`);
    }

    // Apply measures in sequence
    const results = await applyMeasuresInSequence(
      workflow.modelPath,
      workflow.measures,
      workflow.options,
    );

    // Determine if the workflow was successful
    const success = results.every((result) => result.success);

    // Get the final model path
    const finalModelPath =
      results.length > 0 && results[results.length - 1].success
        ? results[results.length - 1].outputModelPath
        : workflow.modelPath;

    // Create the workflow result
    const workflowResult: MeasureApplicationWorkflowResult = {
      success,
      originalModelPath: workflow.modelPath,
      finalModelPath,
      measureResults: results,
    };

    // Add error message if the workflow failed
    if (!success) {
      const failedResult = results.find((result) => !result.success);
      if (failedResult) {
        workflowResult.error = failedResult.error;
      } else {
        workflowResult.error = 'Unknown error during measure application workflow';
      }
    }

    logger.info(
      {
        workflow: workflow.name,
        success,
        originalModelPath: workflow.modelPath,
        finalModelPath,
      },
      'Measure application workflow completed',
    );

    return workflowResult;
  } catch (error) {
    logger.error(
      {
        workflow: workflow.name,
        error: error instanceof Error ? error.message : String(error),
      },
      'Error executing measure application workflow',
    );

    return {
      success: false,
      originalModelPath: workflow.modelPath,
      finalModelPath: workflow.modelPath,
      measureResults: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Export all functions as a default object

/**
 * Create a measure application workflow from a template
 * @param templateName Template name ('energy_efficiency', 'hvac_upgrade', 'lighting_upgrade', 'envelope_upgrade')
 * @param modelPath Path to the model file
 * @param options Workflow options
 * @returns Promise that resolves with the created workflow
 */
export async function createWorkflowFromTemplate(
  templateName: string,
  modelPath: string,
  options?: MeasureApplicationOptions,
): Promise<MeasureApplicationWorkflow> {
  try {
    logger.info({ templateName, modelPath }, 'Creating measure application workflow from template');

    // Define workflow templates
    const templates: Record<string, Omit<MeasureApplicationWorkflow, 'modelPath'>> = {
      energy_efficiency: {
        name: 'Energy Efficiency Workflow',
        description: 'Apply common energy efficiency measures to a model',
        measures: [
          {
            measureId: 'ReduceLightingLoadsByPercentage',
            arguments: { lighting_power_reduction_percent: 20 },
            description: 'Reduce lighting loads by 20%',
          },
          {
            measureId: 'ReduceElectricEquipmentLoadsByPercentage',
            arguments: { electric_equipment_power_reduction_percent: 15 },
            description: 'Reduce electric equipment loads by 15%',
          },
          {
            measureId: 'ImproveFanBeltEfficiency',
            arguments: { fan_efficiency_improvement_percent: 10 },
            description: 'Improve fan belt efficiency by 10%',
          },
        ],
      },
      hvac_upgrade: {
        name: 'HVAC Upgrade Workflow',
        description: 'Apply HVAC upgrade measures to a model',
        measures: [
          {
            measureId: 'SetCOPforSingleSpeedDXCoolingUnits',
            arguments: { cop: 4.0 },
            description: 'Set COP for DX cooling units to 4.0',
          },
          {
            measureId: 'SetBoilerEfficiency',
            arguments: { boiler_thermal_efficiency: 0.95 },
            description: 'Set boiler efficiency to 95%',
          },
          {
            measureId: 'EnableDemandControlledVentilation',
            arguments: { dcv_type: 'Occupancy' },
            description: 'Enable demand-controlled ventilation',
          },
        ],
      },
      lighting_upgrade: {
        name: 'Lighting Upgrade Workflow',
        description: 'Apply lighting upgrade measures to a model',
        measures: [
          {
            measureId: 'ReplaceLightingWithLED',
            arguments: { led_efficacy: 100 },
            description: 'Replace lighting with LED',
          },
          {
            measureId: 'AddDaylightSensors',
            arguments: { minimum_light_level: 100 },
            description: 'Add daylight sensors',
          },
          {
            measureId: 'AddOccupancySensors',
            arguments: { space_type_apply_to: 'All' },
            description: 'Add occupancy sensors',
          },
        ],
      },
      envelope_upgrade: {
        name: 'Envelope Upgrade Workflow',
        description: 'Apply envelope upgrade measures to a model',
        measures: [
          {
            measureId: 'SetWindowToWallRatioByFacade',
            arguments: { wwr: 0.4 },
            description: 'Set window-to-wall ratio to 40%',
          },
          {
            measureId: 'AddOverhangsByProjectionFactor',
            arguments: { projection_factor: 0.5 },
            description: 'Add overhangs with projection factor of 0.5',
          },
          {
            measureId: 'ImproveExteriorWallRValue',
            arguments: { r_value_increase_percent: 25 },
            description: 'Improve exterior wall R-value by 25%',
          },
        ],
      },
    };

    // Check if the template exists
    if (!templates[templateName]) {
      throw new Error(`Template not found: ${templateName}`);
    }

    // Create the workflow
    const template = templates[templateName];
    const workflow: MeasureApplicationWorkflow = {
      ...template,
      modelPath,
      options,
    };

    logger.info({ templateName, modelPath }, 'Successfully created workflow from template');
    return workflow;
  } catch (error) {
    logger.error(
      {
        templateName,
        modelPath,
        error: error instanceof Error ? error.message : String(error),
      },
      'Error creating workflow from template',
    );
    throw error;
  }
}

/**
 * Validate a measure application workflow
 * @param workflow Measure application workflow
 * @returns Promise that resolves with validation result
 */
export async function validateWorkflow(
  workflow: MeasureApplicationWorkflow,
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  try {
    logger.info({ workflow: workflow.name }, 'Validating measure application workflow');

    // Check if the model file exists
    if (!(await fileOperations.fileExists(workflow.modelPath))) {
      errors.push(`Model file not found: ${workflow.modelPath}`);
    }

    // Check if the model file is a valid OSM file
    if (!workflow.modelPath.toLowerCase().endsWith('.osm')) {
      errors.push(`Invalid model file format: ${workflow.modelPath}. Must be an OSM file.`);
    }

    // Check if there are measures in the workflow
    if (!workflow.measures || workflow.measures.length === 0) {
      errors.push('At least one measure is required for measure application workflow');
    }

    // Validate each measure
    for (const [index, measure] of workflow.measures.entries()) {
      if (!measure.measureId) {
        errors.push(`Measure ID is required for measure at index ${index}`);
        continue;
      }

      // Check if the measure is installed
      const measuresDir = workflow.options?.measuresDir || measureManager.getMeasuresDir();
      const measurePath = path.join(measuresDir, measure.measureId);

      if (!(await fileOperations.directoryExists(measurePath))) {
        errors.push(`Measure not installed: ${measure.measureId}`);
        continue;
      }

      // Validate measure arguments
      const validation = await validateMeasureForApplication(
        measure.measureId,
        workflow.modelPath,
        measure.arguments || {},
        workflow.options,
      );

      if (!validation.valid) {
        errors.push(
          `Validation failed for measure ${measure.measureId}: ${validation.errors.join(', ')}`,
        );
      }
    }

    logger.info(
      {
        workflow: workflow.name,
        valid: errors.length === 0,
        errorCount: errors.length,
      },
      'Workflow validation completed',
    );

    return { valid: errors.length === 0, errors };
  } catch (error) {
    logger.error(
      {
        workflow: workflow.name,
        error: error instanceof Error ? error.message : String(error),
      },
      'Error validating workflow',
    );

    errors.push(
      `Error validating workflow: ${error instanceof Error ? error.message : String(error)}`,
    );
    return { valid: false, errors };
  }
}

// Export all functions as a default object
const measureApplicationService = {
  validateMeasureForApplication,
  applyMeasure,
  applyMeasuresInSequence,
  mapMeasureParameters,
  downloadAndApplyMeasure,
  executeMeasureWorkflow,
  createWorkflowFromTemplate,
  validateWorkflow,
};

export default measureApplicationService;
