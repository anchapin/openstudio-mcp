/**
 * OpenStudio CLI command mapping
 * 
 * This module provides a mapping of common OpenStudio CLI commands to functions
 * with proper parameter validation and error handling.
 * 
 * Features:
 * - Typed interfaces for command parameters and results
 * - Parameter validation for each command
 * - Error handling and logging
 * - Helper functions for common operations
 * - Support for all major OpenStudio CLI commands
 */
import { executeOpenStudioCommand } from './commandExecutor';
import { logger } from './index';
import { isPathSafe } from './validation';
import path from 'path';
import fs from 'fs';

/**
 * OpenStudio command result
 */
export interface OpenStudioCommandResult {
  /** Whether the command executed successfully */
  success: boolean;
  /** Command output */
  output: string;
  /** Error message if the command failed */
  error?: string;
  /** Additional data returned by the command */
  data?: any;
}

/**
 * OpenStudio model information
 */
export interface OpenStudioModelInfo {
  /** Model version */
  version: string;
  /** Number of spaces in the model */
  spaces: number;
  /** Number of thermal zones in the model */
  thermalZones: number;
  /** Number of constructions in the model */
  constructions: number;
  /** Number of materials in the model */
  materials: number;
  /** Weather file path */
  weatherFile?: string;
  /** Building type */
  buildingType?: string;
  /** Floor area in square meters */
  floorArea?: number;
  /** Number of stories */
  stories?: number;
}

/**
 * OpenStudio measure information
 */
export interface OpenStudioMeasure {
  /** Measure name */
  name: string;
  /** Measure description */
  description: string;
  /** Measure version */
  version: string;
  /** Measure UUID */
  uuid: string;
  /** Measure arguments */
  arguments: {
    /** Argument name */
    name: string;
    /** Argument display name */
    displayName: string;
    /** Argument description */
    description: string;
    /** Argument type */
    type: string;
    /** Whether the argument is required */
    required: boolean;
    /** Argument default value */
    defaultValue?: any;
  }[];
}

/**
 * OpenStudio simulation results
 */
export interface OpenStudioSimulationResults {
  /** Whether the simulation completed successfully */
  success: boolean;
  /** Simulation output directory */
  outputDirectory: string;
  /** Simulation errors */
  errors: string[];
  /** Simulation warnings */
  warnings: string[];
  /** Energy use intensity (EUI) in kWh/m²/year */
  eui?: number;
  /** Total site energy in GJ */
  totalSiteEnergy?: number;
  /** Total source energy in GJ */
  totalSourceEnergy?: number;
  /** Annual electricity consumption in kWh */
  electricityConsumption?: number;
  /** Annual natural gas consumption in GJ */
  naturalGasConsumption?: number;
  /** Annual district heating consumption in GJ */
  districtHeatingConsumption?: number;
  /** Annual district cooling consumption in GJ */
  districtCoolingConsumption?: number;
}

/**
 * OpenStudio weather file information
 */
export interface OpenStudioWeatherFileInfo {
  /** Weather file path */
  path: string;
  /** Weather file location */
  location: string;
  /** Weather file latitude */
  latitude: number;
  /** Weather file longitude */
  longitude: number;
  /** Weather file elevation */
  elevation: number;
  /** Weather file time zone */
  timeZone: number;
  /** Weather file data period */
  dataPeriod: string;
}

/**
 * OpenStudio component information
 */
export interface OpenStudioComponent {
  /** Component type */
  type: string;
  /** Component name */
  name: string;
  /** Component UUID */
  uuid: string;
  /** Component version */
  version: string;
  /** Component description */
  description?: string;
}

/**
 * OpenStudio workflow options
 */
export interface OpenStudioWorkflowOptions {
  /** Whether to run in parallel */
  parallel?: boolean;
  /** Number of parallel jobs */
  jobs?: number;
  /** Whether to include radiative calculations */
  includeRadiance?: boolean;
  /** Whether to run design days only */
  designDaysOnly?: boolean;
  /** Whether to run annual simulation */
  annualSimulation?: boolean;
  /** Whether to fast run the simulation (less accurate) */
  fastRun?: boolean;
}

/**
 * Get OpenStudio version
 * @returns Promise that resolves with the OpenStudio version
 */
export async function getOpenStudioVersion(): Promise<OpenStudioCommandResult> {
  try {
    const result = await executeOpenStudioCommand('--version');
    
    return {
      success: result.success,
      output: result.stdout.trim(),
      error: result.error,
    };
  } catch (error) {
    logger.error({ error }, 'Failed to get OpenStudio version');
    
    return {
      success: false,
      output: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Create a new OpenStudio model
 * @param templateType Type of template to use ('empty', 'office', 'residential')
 * @param outputPath Path to save the model
 * @returns Promise that resolves with the command result
 */
export async function createModel(
  templateType: 'empty' | 'office' | 'residential',
  outputPath: string
): Promise<OpenStudioCommandResult> {
  // Validate parameters
  if (!['empty', 'office', 'residential'].includes(templateType)) {
    return {
      success: false,
      output: '',
      error: `Invalid template type: ${templateType}. Must be one of: empty, office, residential`,
    };
  }
  
  if (!outputPath || !isPathSafe(outputPath)) {
    return {
      success: false,
      output: '',
      error: `Invalid output path: ${outputPath}`,
    };
  }
  
  try {
    // Ensure the directory exists
    const directory = path.dirname(outputPath);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }
    
    // Create the model based on the template type
    let result;
    
    if (templateType === 'empty') {
      // Create an empty model
      result = await executeOpenStudioCommand('create', ['--empty', outputPath]);
    } else if (templateType === 'office') {
      // Create an office building model
      result = await executeOpenStudioCommand('create', ['--template', 'office', outputPath]);
    } else if (templateType === 'residential') {
      // Create a residential building model
      result = await executeOpenStudioCommand('create', ['--template', 'residential', outputPath]);
    }
    
    return {
      success: result?.success || false,
      output: result?.stdout || '',
      error: result?.error,
      data: {
        modelPath: outputPath,
        templateType,
      },
    };
  } catch (error) {
    logger.error({ templateType, outputPath, error }, 'Failed to create OpenStudio model');
    
    return {
      success: false,
      output: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get information about an OpenStudio model
 * @param modelPath Path to the model file
 * @param detailLevel Level of detail to include ('basic', 'detailed', 'complete')
 * @returns Promise that resolves with the model information
 */
export async function getModelInfo(
  modelPath: string,
  detailLevel: 'basic' | 'detailed' | 'complete' = 'basic'
): Promise<OpenStudioCommandResult> {
  // Validate parameters
  if (!modelPath || !isPathSafe(modelPath)) {
    return {
      success: false,
      output: '',
      error: `Invalid model path: ${modelPath}`,
    };
  }
  
  if (!fs.existsSync(modelPath)) {
    return {
      success: false,
      output: '',
      error: `Model file not found: ${modelPath}`,
    };
  }
  
  try {
    // Get model information
    const args = ['--info'];
    
    if (detailLevel === 'detailed' || detailLevel === 'complete') {
      args.push('--detailed');
    }
    
    if (detailLevel === 'complete') {
      args.push('--complete');
    }
    
    args.push(modelPath);
    
    const result = await executeOpenStudioCommand('model', args);
    
    // Parse the model information
    const modelInfo: OpenStudioModelInfo = {
      version: '',
      spaces: 0,
      thermalZones: 0,
      constructions: 0,
      materials: 0,
    };
    
    if (result.success && result.stdout) {
      // Extract version
      const versionMatch = result.stdout.match(/OpenStudio Version: ([^\n]+)/);
      if (versionMatch) {
        modelInfo.version = versionMatch[1].trim();
      }
      
      // Extract spaces
      const spacesMatch = result.stdout.match(/Spaces: (\d+)/);
      if (spacesMatch) {
        modelInfo.spaces = parseInt(spacesMatch[1], 10);
      }
      
      // Extract thermal zones
      const thermalZonesMatch = result.stdout.match(/Thermal Zones: (\d+)/);
      if (thermalZonesMatch) {
        modelInfo.thermalZones = parseInt(thermalZonesMatch[1], 10);
      }
      
      // Extract constructions
      const constructionsMatch = result.stdout.match(/Constructions: (\d+)/);
      if (constructionsMatch) {
        modelInfo.constructions = parseInt(constructionsMatch[1], 10);
      }
      
      // Extract materials
      const materialsMatch = result.stdout.match(/Materials: (\d+)/);
      if (materialsMatch) {
        modelInfo.materials = parseInt(materialsMatch[1], 10);
      }
      
      // Extract weather file
      const weatherFileMatch = result.stdout.match(/Weather File: ([^\n]+)/);
      if (weatherFileMatch) {
        modelInfo.weatherFile = weatherFileMatch[1].trim();
      }
      
      // Extract building type
      const buildingTypeMatch = result.stdout.match(/Building Type: ([^\n]+)/);
      if (buildingTypeMatch) {
        modelInfo.buildingType = buildingTypeMatch[1].trim();
      }
      
      // Extract floor area
      const floorAreaMatch = result.stdout.match(/Floor Area: ([\d.]+) m²/);
      if (floorAreaMatch) {
        modelInfo.floorArea = parseFloat(floorAreaMatch[1]);
      }
      
      // Extract stories
      const storiesMatch = result.stdout.match(/Stories: (\d+)/);
      if (storiesMatch) {
        modelInfo.stories = parseInt(storiesMatch[1], 10);
      }
    }
    
    return {
      success: result.success,
      output: result.stdout,
      error: result.error,
      data: modelInfo,
    };
  } catch (error) {
    logger.error({ modelPath, detailLevel, error }, 'Failed to get OpenStudio model information');
    
    return {
      success: false,
      output: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Run an OpenStudio simulation
 * @param modelPath Path to the model file
 * @param weatherFile Path to the weather file (optional)
 * @param outputDirectory Directory to save simulation results (optional)
 * @returns Promise that resolves with the simulation results
 */
export async function runSimulation(
  modelPath: string,
  weatherFile?: string,
  outputDirectory?: string
): Promise<OpenStudioCommandResult> {
  // Validate parameters
  if (!modelPath || !isPathSafe(modelPath)) {
    return {
      success: false,
      output: '',
      error: `Invalid model path: ${modelPath}`,
    };
  }
  
  if (!fs.existsSync(modelPath)) {
    return {
      success: false,
      output: '',
      error: `Model file not found: ${modelPath}`,
    };
  }
  
  if (weatherFile && (!isPathSafe(weatherFile) || !fs.existsSync(weatherFile))) {
    return {
      success: false,
      output: '',
      error: `Invalid weather file: ${weatherFile}`,
    };
  }
  
  if (outputDirectory && !isPathSafe(outputDirectory)) {
    return {
      success: false,
      output: '',
      error: `Invalid output directory: ${outputDirectory}`,
    };
  }
  
  try {
    // Ensure the output directory exists
    if (outputDirectory && !fs.existsSync(outputDirectory)) {
      fs.mkdirSync(outputDirectory, { recursive: true });
    }
    
    // Prepare simulation arguments
    const args = ['--run'];
    
    if (weatherFile) {
      args.push('--weather', weatherFile);
    }
    
    if (outputDirectory) {
      args.push('--output', outputDirectory);
    }
    
    args.push(modelPath);
    
    // Run the simulation
    const result = await executeOpenStudioCommand('energyplus', args, {
      timeout: 600000, // 10 minutes
      memoryLimit: 4096, // 4GB
    });
    
    // Parse the simulation results
    const simulationResults: OpenStudioSimulationResults = {
      success: result.success,
      outputDirectory: outputDirectory || path.dirname(modelPath),
      errors: [],
      warnings: [],
    };
    
    if (result.stdout) {
      // Extract errors
      const errorMatches = result.stdout.match(/Error: ([^\n]+)/g);
      if (errorMatches) {
        simulationResults.errors = errorMatches.map(match => match.replace('Error: ', '').trim());
      }
      
      // Extract warnings
      const warningMatches = result.stdout.match(/Warning: ([^\n]+)/g);
      if (warningMatches) {
        simulationResults.warnings = warningMatches.map(match => match.replace('Warning: ', '').trim());
      }
      
      // Extract EUI
      const euiMatch = result.stdout.match(/EUI: ([\d.]+) kWh\/m²\/year/);
      if (euiMatch) {
        simulationResults.eui = parseFloat(euiMatch[1]);
      }
      
      // Extract total site energy
      const totalSiteEnergyMatch = result.stdout.match(/Total Site Energy: ([\d.]+) GJ/);
      if (totalSiteEnergyMatch) {
        simulationResults.totalSiteEnergy = parseFloat(totalSiteEnergyMatch[1]);
      }
      
      // Extract total source energy
      const totalSourceEnergyMatch = result.stdout.match(/Total Source Energy: ([\d.]+) GJ/);
      if (totalSourceEnergyMatch) {
        simulationResults.totalSourceEnergy = parseFloat(totalSourceEnergyMatch[1]);
      }
      
      // Extract electricity consumption
      const electricityConsumptionMatch = result.stdout.match(/Electricity Consumption: ([\d.]+) kWh/);
      if (electricityConsumptionMatch) {
        simulationResults.electricityConsumption = parseFloat(electricityConsumptionMatch[1]);
      }
      
      // Extract natural gas consumption
      const naturalGasConsumptionMatch = result.stdout.match(/Natural Gas Consumption: ([\d.]+) GJ/);
      if (naturalGasConsumptionMatch) {
        simulationResults.naturalGasConsumption = parseFloat(naturalGasConsumptionMatch[1]);
      }
    }
    
    return {
      success: result.success,
      output: result.stdout,
      error: result.error,
      data: simulationResults,
    };
  } catch (error) {
    logger.error({ modelPath, weatherFile, outputDirectory, error }, 'Failed to run OpenStudio simulation');
    
    return {
      success: false,
      output: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * List available measures
 * @param measureDir Directory containing measures (optional)
 * @returns Promise that resolves with the list of measures
 */
export async function listMeasures(measureDir?: string): Promise<OpenStudioCommandResult> {
  try {
    // Prepare arguments
    const args = ['--list'];
    
    if (measureDir) {
      if (!isPathSafe(measureDir)) {
        return {
          success: false,
          output: '',
          error: `Invalid measure directory: ${measureDir}`,
        };
      }
      
      if (!fs.existsSync(measureDir)) {
        return {
          success: false,
          output: '',
          error: `Measure directory not found: ${measureDir}`,
        };
      }
      
      args.push('--dir', measureDir);
    }
    
    // List measures
    const result = await executeOpenStudioCommand('measure', args);
    
    // Parse the measure list
    const measures: OpenStudioMeasure[] = [];
    
    if (result.success && result.stdout) {
      // Split by measure sections
      const measureSections = result.stdout.split(/Measure: /g).slice(1);
      
      for (const section of measureSections) {
        const measure: OpenStudioMeasure = {
          name: '',
          description: '',
          version: '',
          uuid: '',
          arguments: [],
        };
        
        // Extract name
        const nameMatch = section.match(/Name: ([^\n]+)/);
        if (nameMatch) {
          measure.name = nameMatch[1].trim();
        }
        
        // Extract description
        const descriptionMatch = section.match(/Description: ([^\n]+)/);
        if (descriptionMatch) {
          measure.description = descriptionMatch[1].trim();
        }
        
        // Extract version
        const versionMatch = section.match(/Version: ([^\n]+)/);
        if (versionMatch) {
          measure.version = versionMatch[1].trim();
        }
        
        // Extract UUID
        const uuidMatch = section.match(/UUID: ([^\n]+)/);
        if (uuidMatch) {
          measure.uuid = uuidMatch[1].trim();
        }
        
        // Extract arguments
        const argumentSections = section.split(/Argument: /g).slice(1);
        
        for (const argSection of argumentSections) {
          const argument = {
            name: '',
            displayName: '',
            description: '',
            type: '',
            required: false,
          };
          
          // Extract name
          const argNameMatch = argSection.match(/Name: ([^\n]+)/);
          if (argNameMatch) {
            argument.name = argNameMatch[1].trim();
          }
          
          // Extract display name
          const argDisplayNameMatch = argSection.match(/Display Name: ([^\n]+)/);
          if (argDisplayNameMatch) {
            argument.displayName = argDisplayNameMatch[1].trim();
          }
          
          // Extract description
          const argDescriptionMatch = argSection.match(/Description: ([^\n]+)/);
          if (argDescriptionMatch) {
            argument.description = argDescriptionMatch[1].trim();
          }
          
          // Extract type
          const argTypeMatch = argSection.match(/Type: ([^\n]+)/);
          if (argTypeMatch) {
            argument.type = argTypeMatch[1].trim();
          }
          
          // Extract required
          const argRequiredMatch = argSection.match(/Required: ([^\n]+)/);
          if (argRequiredMatch) {
            argument.required = argRequiredMatch[1].trim().toLowerCase() === 'true';
          }
          
          // Extract default value
          const argDefaultMatch = argSection.match(/Default: ([^\n]+)/);
          if (argDefaultMatch) {
            const defaultValue = argDefaultMatch[1].trim();
            
            // Convert to appropriate type
            if (argument.type === 'Double' || argument.type === 'Integer') {
              argument.defaultValue = parseFloat(defaultValue);
            } else if (argument.type === 'Boolean') {
              argument.defaultValue = defaultValue.toLowerCase() === 'true';
            } else {
              argument.defaultValue = defaultValue;
            }
          }
          
          measure.arguments.push(argument);
        }
        
        measures.push(measure);
      }
    }
    
    return {
      success: result.success,
      output: result.stdout,
      error: result.error,
      data: measures,
    };
  } catch (error) {
    logger.error({ measureDir, error }, 'Failed to list OpenStudio measures');
    
    return {
      success: false,
      output: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Apply a measure to a model
 * @param modelPath Path to the model file
 * @param measurePath Path to the measure directory
 * @param arguments Measure arguments
 * @param outputPath Path to save the modified model (optional)
 * @returns Promise that resolves with the command result
 */
export async function applyMeasure(
  modelPath: string,
  measurePath: string,
  args: Record<string, any>,
  outputPath?: string
): Promise<OpenStudioCommandResult> {
  // Validate parameters
  if (!modelPath || !isPathSafe(modelPath)) {
    return {
      success: false,
      output: '',
      error: `Invalid model path: ${modelPath}`,
    };
  }
  
  if (!fs.existsSync(modelPath)) {
    return {
      success: false,
      output: '',
      error: `Model file not found: ${modelPath}`,
    };
  }
  
  if (!measurePath || !isPathSafe(measurePath)) {
    return {
      success: false,
      output: '',
      error: `Invalid measure path: ${measurePath}`,
    };
  }
  
  if (!fs.existsSync(measurePath)) {
    return {
      success: false,
      output: '',
      error: `Measure directory not found: ${measurePath}`,
    };
  }
  
  if (outputPath && !isPathSafe(outputPath)) {
    return {
      success: false,
      output: '',
      error: `Invalid output path: ${outputPath}`,
    };
  }
  
  try {
    // Ensure the output directory exists if specified
    if (outputPath) {
      const directory = path.dirname(outputPath);
      if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
      }
    }
    
    // Prepare measure arguments
    const measureArgs = ['--apply', measurePath, modelPath];
    
    // Add measure arguments
    for (const [key, value] of Object.entries(args)) {
      measureArgs.push('--argument', `${key}=${value}`);
    }
    
    // Add output path if specified
    if (outputPath) {
      measureArgs.push('--output', outputPath);
    }
    
    // Apply the measure
    const result = await executeOpenStudioCommand('measure', measureArgs);
    
    return {
      success: result.success,
      output: result.stdout,
      error: result.error,
      data: {
        modelPath: outputPath || modelPath,
        measurePath,
        arguments: args,
      },
    };
  } catch (error) {
    logger.error({ modelPath, measurePath, args, outputPath, error }, 'Failed to apply OpenStudio measure');
    
    return {
      success: false,
      output: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Convert a model to a different format
 * @param inputPath Path to the input file
 * @param outputPath Path to save the converted file
 * @returns Promise that resolves with the command result
 */
export async function convertModel(
  inputPath: string,
  outputPath: string
): Promise<OpenStudioCommandResult> {
  // Validate parameters
  if (!inputPath || !isPathSafe(inputPath)) {
    return {
      success: false,
      output: '',
      error: `Invalid input path: ${inputPath}`,
    };
  }
  
  if (!fs.existsSync(inputPath)) {
    return {
      success: false,
      output: '',
      error: `Input file not found: ${inputPath}`,
    };
  }
  
  if (!outputPath || !isPathSafe(outputPath)) {
    return {
      success: false,
      output: '',
      error: `Invalid output path: ${outputPath}`,
    };
  }
  
  try {
    // Ensure the output directory exists
    const directory = path.dirname(outputPath);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }
    
    // Determine the conversion type based on file extensions
    const inputExt = path.extname(inputPath).toLowerCase();
    const outputExt = path.extname(outputPath).toLowerCase();
    
    // Prepare conversion arguments
    const args = ['--convert', inputPath, outputPath];
    
    // Convert the model
    const result = await executeOpenStudioCommand('model', args);
    
    return {
      success: result.success,
      output: result.stdout,
      error: result.error,
      data: {
        inputPath,
        outputPath,
        inputFormat: inputExt,
        outputFormat: outputExt,
      },
    };
  } catch (error) {
    logger.error({ inputPath, outputPath, error }, 'Failed to convert OpenStudio model');
    
    return {
      success: false,
      output: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get information about a weather file
 * @param weatherFilePath Path to the weather file
 * @returns Promise that resolves with the weather file information
 */
export async function getWeatherFileInfo(
  weatherFilePath: string
): Promise<OpenStudioCommandResult> {
  // Validate parameters
  if (!weatherFilePath || !isPathSafe(weatherFilePath)) {
    return {
      success: false,
      output: '',
      error: `Invalid weather file path: ${weatherFilePath}`,
    };
  }
  
  if (!fs.existsSync(weatherFilePath)) {
    return {
      success: false,
      output: '',
      error: `Weather file not found: ${weatherFilePath}`,
    };
  }
  
  try {
    // Get weather file information
    const result = await executeOpenStudioCommand('weather', ['--info', weatherFilePath]);
    
    // Parse the weather file information
    const weatherInfo: OpenStudioWeatherFileInfo = {
      path: weatherFilePath,
      location: '',
      latitude: 0,
      longitude: 0,
      elevation: 0,
      timeZone: 0,
      dataPeriod: '',
    };
    
    if (result.success && result.stdout) {
      // Extract location
      const locationMatch = result.stdout.match(/Location: ([^\n]+)/);
      if (locationMatch) {
        weatherInfo.location = locationMatch[1].trim();
      }
      
      // Extract latitude
      const latitudeMatch = result.stdout.match(/Latitude: ([\d.-]+)/);
      if (latitudeMatch) {
        weatherInfo.latitude = parseFloat(latitudeMatch[1]);
      }
      
      // Extract longitude
      const longitudeMatch = result.stdout.match(/Longitude: ([\d.-]+)/);
      if (longitudeMatch) {
        weatherInfo.longitude = parseFloat(longitudeMatch[1]);
      }
      
      // Extract elevation
      const elevationMatch = result.stdout.match(/Elevation: ([\d.-]+)/);
      if (elevationMatch) {
        weatherInfo.elevation = parseFloat(elevationMatch[1]);
      }
      
      // Extract time zone
      const timeZoneMatch = result.stdout.match(/Time Zone: ([\d.-]+)/);
      if (timeZoneMatch) {
        weatherInfo.timeZone = parseFloat(timeZoneMatch[1]);
      }
      
      // Extract data period
      const dataPeriodMatch = result.stdout.match(/Data Period: ([^\n]+)/);
      if (dataPeriodMatch) {
        weatherInfo.dataPeriod = dataPeriodMatch[1].trim();
      }
    }
    
    return {
      success: result.success,
      output: result.stdout,
      error: result.error,
      data: weatherInfo,
    };
  } catch (error) {
    logger.error({ weatherFilePath, error }, 'Failed to get weather file information');
    
    return {
      success: false,
      output: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Run a parametric analysis on a model
 * @param modelPath Path to the model file
 * @param parametersPath Path to the parameters JSON file
 * @param outputDirectory Directory to save results (optional)
 * @returns Promise that resolves with the command result
 */
export async function runParametricAnalysis(
  modelPath: string,
  parametersPath: string,
  outputDirectory?: string
): Promise<OpenStudioCommandResult> {
  // Validate parameters
  if (!modelPath || !isPathSafe(modelPath)) {
    return {
      success: false,
      output: '',
      error: `Invalid model path: ${modelPath}`,
    };
  }
  
  if (!fs.existsSync(modelPath)) {
    return {
      success: false,
      output: '',
      error: `Model file not found: ${modelPath}`,
    };
  }
  
  if (!parametersPath || !isPathSafe(parametersPath)) {
    return {
      success: false,
      output: '',
      error: `Invalid parameters path: ${parametersPath}`,
    };
  }
  
  if (!fs.existsSync(parametersPath)) {
    return {
      success: false,
      output: '',
      error: `Parameters file not found: ${parametersPath}`,
    };
  }
  
  if (outputDirectory && !isPathSafe(outputDirectory)) {
    return {
      success: false,
      output: '',
      error: `Invalid output directory: ${outputDirectory}`,
    };
  }
  
  try {
    // Ensure the output directory exists
    if (outputDirectory && !fs.existsSync(outputDirectory)) {
      fs.mkdirSync(outputDirectory, { recursive: true });
    }
    
    // Prepare arguments
    const args = ['--parametric', modelPath, parametersPath];
    
    if (outputDirectory) {
      args.push('--output', outputDirectory);
    }
    
    // Run the parametric analysis
    const result = await executeOpenStudioCommand('analysis', args, {
      timeout: 1800000, // 30 minutes
      memoryLimit: 8192, // 8GB
    });
    
    return {
      success: result.success,
      output: result.stdout,
      error: result.error,
      data: {
        modelPath,
        parametersPath,
        outputDirectory: outputDirectory || path.dirname(modelPath),
      },
    };
  } catch (error) {
    logger.error({ modelPath, parametersPath, outputDirectory, error }, 'Failed to run parametric analysis');
    
    return {
      success: false,
      output: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Run a workflow on a model
 * @param workflowPath Path to the workflow JSON file
 * @param options Workflow options
 * @returns Promise that resolves with the command result
 */
export async function runWorkflow(
  workflowPath: string,
  options?: OpenStudioWorkflowOptions
): Promise<OpenStudioCommandResult> {
  // Validate parameters
  if (!workflowPath || !isPathSafe(workflowPath)) {
    return {
      success: false,
      output: '',
      error: `Invalid workflow path: ${workflowPath}`,
    };
  }
  
  if (!fs.existsSync(workflowPath)) {
    return {
      success: false,
      output: '',
      error: `Workflow file not found: ${workflowPath}`,
    };
  }
  
  try {
    // Prepare arguments
    const args = ['--workflow', workflowPath];
    
    // Add options
    if (options) {
      if (options.parallel) {
        args.push('--parallel');
        
        if (options.jobs && options.jobs > 0) {
          args.push('--jobs', options.jobs.toString());
        }
      }
      
      if (options.includeRadiance) {
        args.push('--include-radiance');
      }
      
      if (options.designDaysOnly) {
        args.push('--design-days-only');
      }
      
      if (options.annualSimulation) {
        args.push('--annual-simulation');
      }
      
      if (options.fastRun) {
        args.push('--fast');
      }
    }
    
    // Run the workflow
    const result = await executeOpenStudioCommand('workflow', args, {
      timeout: 1800000, // 30 minutes
      memoryLimit: 8192, // 8GB
    });
    
    return {
      success: result.success,
      output: result.stdout,
      error: result.error,
      data: {
        workflowPath,
        options,
      },
    };
  } catch (error) {
    logger.error({ workflowPath, options, error }, 'Failed to run workflow');
    
    return {
      success: false,
      output: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get information about a component
 * @param componentPath Path to the component file
 * @returns Promise that resolves with the component information
 */
export async function getComponentInfo(
  componentPath: string
): Promise<OpenStudioCommandResult> {
  // Validate parameters
  if (!componentPath || !isPathSafe(componentPath)) {
    return {
      success: false,
      output: '',
      error: `Invalid component path: ${componentPath}`,
    };
  }
  
  if (!fs.existsSync(componentPath)) {
    return {
      success: false,
      output: '',
      error: `Component file not found: ${componentPath}`,
    };
  }
  
  try {
    // Get component information
    const result = await executeOpenStudioCommand('component', ['--info', componentPath]);
    
    // Parse the component information
    const componentInfo: OpenStudioComponent = {
      type: '',
      name: '',
      uuid: '',
      version: '',
    };
    
    if (result.success && result.stdout) {
      // Extract type
      const typeMatch = result.stdout.match(/Type: ([^\n]+)/);
      if (typeMatch) {
        componentInfo.type = typeMatch[1].trim();
      }
      
      // Extract name
      const nameMatch = result.stdout.match(/Name: ([^\n]+)/);
      if (nameMatch) {
        componentInfo.name = nameMatch[1].trim();
      }
      
      // Extract UUID
      const uuidMatch = result.stdout.match(/UUID: ([^\n]+)/);
      if (uuidMatch) {
        componentInfo.uuid = uuidMatch[1].trim();
      }
      
      // Extract version
      const versionMatch = result.stdout.match(/Version: ([^\n]+)/);
      if (versionMatch) {
        componentInfo.version = versionMatch[1].trim();
      }
      
      // Extract description
      const descriptionMatch = result.stdout.match(/Description: ([^\n]+)/);
      if (descriptionMatch) {
        componentInfo.description = descriptionMatch[1].trim();
      }
    }
    
    return {
      success: result.success,
      output: result.stdout,
      error: result.error,
      data: componentInfo,
    };
  } catch (error) {
    logger.error({ componentPath, error }, 'Failed to get component information');
    
    return {
      success: false,
      output: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Extract objects from a model
 * @param modelPath Path to the model file
 * @param objectType Type of objects to extract
 * @param outputPath Path to save the extracted objects
 * @returns Promise that resolves with the command result
 */
export async function extractModelObjects(
  modelPath: string,
  objectType: string,
  outputPath: string
): Promise<OpenStudioCommandResult> {
  // Validate parameters
  if (!modelPath || !isPathSafe(modelPath)) {
    return {
      success: false,
      output: '',
      error: `Invalid model path: ${modelPath}`,
    };
  }
  
  if (!fs.existsSync(modelPath)) {
    return {
      success: false,
      output: '',
      error: `Model file not found: ${modelPath}`,
    };
  }
  
  if (!objectType) {
    return {
      success: false,
      output: '',
      error: 'Object type is required',
    };
  }
  
  if (!outputPath || !isPathSafe(outputPath)) {
    return {
      success: false,
      output: '',
      error: `Invalid output path: ${outputPath}`,
    };
  }
  
  try {
    // Ensure the output directory exists
    const directory = path.dirname(outputPath);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }
    
    // Extract objects
    const result = await executeOpenStudioCommand('model', ['--extract', objectType, modelPath, outputPath]);
    
    return {
      success: result.success,
      output: result.stdout,
      error: result.error,
      data: {
        modelPath,
        objectType,
        outputPath,
      },
    };
  } catch (error) {
    logger.error({ modelPath, objectType, outputPath, error }, 'Failed to extract model objects');
    
    return {
      success: false,
      output: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Compare two models
 * @param modelPath1 Path to the first model file
 * @param modelPath2 Path to the second model file
 * @param outputPath Path to save the comparison results (optional)
 * @returns Promise that resolves with the command result
 */
export async function compareModels(
  modelPath1: string,
  modelPath2: string,
  outputPath?: string
): Promise<OpenStudioCommandResult> {
  // Validate parameters
  if (!modelPath1 || !isPathSafe(modelPath1)) {
    return {
      success: false,
      output: '',
      error: `Invalid model path: ${modelPath1}`,
    };
  }
  
  if (!fs.existsSync(modelPath1)) {
    return {
      success: false,
      output: '',
      error: `Model file not found: ${modelPath1}`,
    };
  }
  
  if (!modelPath2 || !isPathSafe(modelPath2)) {
    return {
      success: false,
      output: '',
      error: `Invalid model path: ${modelPath2}`,
    };
  }
  
  if (!fs.existsSync(modelPath2)) {
    return {
      success: false,
      output: '',
      error: `Model file not found: ${modelPath2}`,
    };
  }
  
  if (outputPath && !isPathSafe(outputPath)) {
    return {
      success: false,
      output: '',
      error: `Invalid output path: ${outputPath}`,
    };
  }
  
  try {
    // Ensure the output directory exists if specified
    if (outputPath) {
      const directory = path.dirname(outputPath);
      if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
      }
    }
    
    // Prepare arguments
    const args = ['--compare', modelPath1, modelPath2];
    
    if (outputPath) {
      args.push('--output', outputPath);
    }
    
    // Compare models
    const result = await executeOpenStudioCommand('model', args);
    
    return {
      success: result.success,
      output: result.stdout,
      error: result.error,
      data: {
        modelPath1,
        modelPath2,
        outputPath,
      },
    };
  } catch (error) {
    logger.error({ modelPath1, modelPath2, outputPath, error }, 'Failed to compare models');
    
    return {
      success: false,
      output: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Validate a model
 * @param modelPath Path to the model file
 * @returns Promise that resolves with the validation result
 */
export async function validateModel(
  modelPath: string
): Promise<OpenStudioCommandResult> {
  // Validate parameters
  if (!modelPath || !isPathSafe(modelPath)) {
    return {
      success: false,
      output: '',
      error: `Invalid model path: ${modelPath}`,
    };
  }
  
  if (!fs.existsSync(modelPath)) {
    return {
      success: false,
      output: '',
      error: `Model file not found: ${modelPath}`,
    };
  }
  
  try {
    // Validate model
    const result = await executeOpenStudioCommand('model', ['--validate', modelPath]);
    
    // Parse validation results
    const validationErrors: string[] = [];
    const validationWarnings: string[] = [];
    
    if (result.stdout) {
      // Extract errors
      const errorMatches = result.stdout.match(/Error: ([^\n]+)/g);
      if (errorMatches) {
        validationErrors.push(...errorMatches.map(match => match.replace('Error: ', '').trim()));
      }
      
      // Extract warnings
      const warningMatches = result.stdout.match(/Warning: ([^\n]+)/g);
      if (warningMatches) {
        validationWarnings.push(...warningMatches.map(match => match.replace('Warning: ', '').trim()));
      }
    }
    
    return {
      success: validationErrors.length === 0,
      output: result.stdout,
      error: result.error,
      data: {
        modelPath,
        valid: validationErrors.length === 0,
        errors: validationErrors,
        warnings: validationWarnings,
      },
    };
  } catch (error) {
    logger.error({ modelPath, error }, 'Failed to validate model');
    
    return {
      success: false,
      output: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Export all commands as a single default object
export default {
  getOpenStudioVersion,
  createModel,
  getModelInfo,
  runSimulation,
  listMeasures,
  applyMeasure,
  convertModel,
  getWeatherFileInfo,
  runParametricAnalysis,
  runWorkflow,
  getComponentInfo,
  extractModelObjects,
  compareModels,
  validateModel,
};