/**
 * Model templates module
 * 
 * This module provides functionality for creating OpenStudio models from templates.
 * It includes predefined templates for common building types and configurations.
 */
import path from 'path';
import fs from 'fs';
import { logger, fileOperations } from './index';
import { executeOpenStudioCommand } from './commandExecutor';
import { isPathSafe } from './validation';
import { OpenStudioCommandResult } from './openStudioCommands';
import config from '../config';

/**
 * Template type definition
 */
export type TemplateType = 'empty' | 'office' | 'residential' | 'retail' | 'warehouse' | 'school' | 'hospital';

/**
 * Model template options
 */
export interface ModelTemplateOptions {
  /** Building type */
  buildingType?: string;
  /** Building vintage */
  buildingVintage?: string;
  /** Climate zone */
  climateZone?: string;
  /** Weather file path */
  weatherFilePath?: string;
  /** Floor area in square meters */
  floorArea?: number;
  /** Number of stories */
  numStories?: number;
  /** Aspect ratio (length/width) */
  aspectRatio?: number;
  /** Floor to floor height in meters */
  floorToFloorHeight?: number;
  /** Perimeter zone depth in meters */
  perimeterZoneDepth?: number;
  /** Whether to include HVAC systems */
  includeHVAC?: boolean;
  /** Whether to include service water heating */
  includeSWH?: boolean;
  /** Whether to include exterior lighting */
  includeExteriorLighting?: boolean;
  /** Whether to include interior lighting */
  includeInteriorLighting?: boolean;
}

/**
 * Default template options
 */
const defaultTemplateOptions: ModelTemplateOptions = {
  buildingType: 'MidriseApartment',
  buildingVintage: '90.1-2013',
  climateZone: 'ASHRAE 169-2013-5A',
  floorArea: 1000,
  numStories: 3,
  aspectRatio: 1.5,
  floorToFloorHeight: 3.0,
  perimeterZoneDepth: 4.57,
  includeHVAC: true,
  includeSWH: true,
  includeExteriorLighting: true,
  includeInteriorLighting: true,
};

/**
 * Create a new OpenStudio model from a template
 * @param templateType Type of template to use
 * @param outputPath Path to save the model
 * @param options Template options
 * @returns Promise that resolves with the command result
 */
export async function createModelFromTemplate(
  templateType: TemplateType,
  outputPath: string,
  options: ModelTemplateOptions = {}
): Promise<OpenStudioCommandResult> {
  // Validate parameters
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
    await fileOperations.ensureDirectory(directory);
    
    // Create the model based on the template type
    if (templateType === 'empty') {
      return createEmptyModel(outputPath);
    } else {
      return createStandardModel(templateType, outputPath, options);
    }
  } catch (error) {
    logger.error({ templateType, outputPath, options, error }, 'Failed to create model from template');
    
    return {
      success: false,
      output: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Create an empty OpenStudio model
 * @param outputPath Path to save the model
 * @returns Promise that resolves with the command result
 */
async function createEmptyModel(outputPath: string): Promise<OpenStudioCommandResult> {
  try {
    // Create an empty model using the OpenStudio CLI
    const result = await executeOpenStudioCommand('create', ['--empty', outputPath]);
    
    return {
      success: result.success,
      output: result.stdout,
      error: result.error,
      data: {
        modelPath: outputPath,
        templateType: 'empty',
      },
    };
  } catch (error) {
    logger.error({ outputPath, error }, 'Failed to create empty model');
    
    return {
      success: false,
      output: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Create a standard OpenStudio model based on a template
 * @param templateType Type of template to use
 * @param outputPath Path to save the model
 * @param options Template options
 * @returns Promise that resolves with the command result
 */
async function createStandardModel(
  templateType: TemplateType,
  outputPath: string,
  options: ModelTemplateOptions = {}
): Promise<OpenStudioCommandResult> {
  try {
    // Merge options with defaults
    const opts = { ...defaultTemplateOptions, ...options };
    
    // Map template type to building type if not specified
    if (!options.buildingType) {
      switch (templateType) {
        case 'office':
          opts.buildingType = 'MediumOffice';
          break;
        case 'residential':
          opts.buildingType = 'MidriseApartment';
          break;
        case 'retail':
          opts.buildingType = 'RetailStandalone';
          break;
        case 'warehouse':
          opts.buildingType = 'Warehouse';
          break;
        case 'school':
          opts.buildingType = 'SecondarySchool';
          break;
        case 'hospital':
          opts.buildingType = 'Hospital';
          break;
        default:
          opts.buildingType = 'MediumOffice';
      }
    }
    
    // Create a temporary Ruby script to generate the model
    const scriptContent = generateModelCreationScript(opts, outputPath);
    const scriptPath = await fileOperations.createTempFile(scriptContent, { 
      prefix: 'create_model_',
      suffix: '.rb',
      tempDir: config.tempDir
    });
    
    // Execute the Ruby script using OpenStudio CLI
    const result = await executeOpenStudioCommand('ruby', [scriptPath]);
    
    // Clean up the temporary script
    await fileOperations.deleteFile(scriptPath);
    
    return {
      success: result.success,
      output: result.stdout,
      error: result.error,
      data: {
        modelPath: outputPath,
        templateType,
        options: opts,
      },
    };
  } catch (error) {
    logger.error({ templateType, outputPath, options, error }, 'Failed to create standard model');
    
    return {
      success: false,
      output: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Generate a Ruby script to create a model with the specified options
 * @param options Template options
 * @param outputPath Path to save the model
 * @returns Ruby script content
 */
function generateModelCreationScript(options: ModelTemplateOptions, outputPath: string): string {
  return `
require 'openstudio'
require 'openstudio/model/version'
require 'openstudio/ruleset/ShowRunnerOutput'
require 'openstudio/energyplus/find_energyplus'
require 'openstudio/model_articulation/facility'
require 'openstudio/model_articulation/configurable_facility'

# Create a new model
model = OpenStudio::Model::Model.new

# Create a facility
facility = OpenStudio::ModelArticulation::ConfigurableFacility.new(model)

# Set building type
facility.add_building_type('${options.buildingType}', 1.0)

# Set building vintage
facility.add_building_vintage('${options.buildingVintage}')

# Set climate zone
facility.add_climate_zone('${options.climateZone}')

# Set building parameters
facility.set_value('total_floor_area', ${options.floorArea})
facility.set_value('num_stories', ${options.numStories})
facility.set_value('aspect_ratio', ${options.aspectRatio})
facility.set_value('floor_height', ${options.floorToFloorHeight})
facility.set_value('perimeter_zone_depth', ${options.perimeterZoneDepth})

# Configure systems
facility.set_value('add_hvac', ${options.includeHVAC})
facility.set_value('add_swh', ${options.includeSWH})
facility.set_value('add_exterior_lights', ${options.includeExteriorLighting})
facility.set_value('add_interior_lights', ${options.includeInteriorLighting})

# Apply the facility to create the model
facility.apply

# Set weather file if provided
${options.weatherFilePath ? `
epw_file = OpenStudio::EpwFile.new('${options.weatherFilePath.replace(/\\/g, '\\\\')}')
OpenStudio::Model::WeatherFile.setWeatherFile(model, epw_file)
` : ''}

# Save the model
model.save('${outputPath.replace(/\\/g, '\\\\')}', true)

puts "Model created successfully and saved to #{File.absolute_path('${outputPath.replace(/\\/g, '\\\\')}')}."
`;
}

/**
 * Get available template types
 * @returns Array of available template types
 */
export function getAvailableTemplateTypes(): TemplateType[] {
  return ['empty', 'office', 'residential', 'retail', 'warehouse', 'school', 'hospital'];
}

/**
 * Get available building types for a template
 * @param templateType Template type
 * @returns Array of available building types
 */
export function getAvailableBuildingTypes(templateType: TemplateType): string[] {
  switch (templateType) {
    case 'office':
      return ['SmallOffice', 'MediumOffice', 'LargeOffice'];
    case 'residential':
      return ['MidriseApartment', 'HighriseApartment', 'SingleFamily'];
    case 'retail':
      return ['RetailStandalone', 'RetailStripmall'];
    case 'warehouse':
      return ['Warehouse'];
    case 'school':
      return ['PrimarySchool', 'SecondarySchool'];
    case 'hospital':
      return ['Hospital', 'Outpatient'];
    default:
      return [];
  }
}

/**
 * Get available building vintages
 * @returns Array of available building vintages
 */
export function getAvailableBuildingVintages(): string[] {
  return [
    'DOE Ref Pre-1980',
    'DOE Ref 1980-2004',
    '90.1-2004',
    '90.1-2007',
    '90.1-2010',
    '90.1-2013',
    '90.1-2016',
    '90.1-2019'
  ];
}

/**
 * Get available climate zones
 * @returns Array of available climate zones
 */
export function getAvailableClimateZones(): string[] {
  return [
    'ASHRAE 169-2013-1A',
    'ASHRAE 169-2013-2A',
    'ASHRAE 169-2013-2B',
    'ASHRAE 169-2013-3A',
    'ASHRAE 169-2013-3B',
    'ASHRAE 169-2013-3C',
    'ASHRAE 169-2013-4A',
    'ASHRAE 169-2013-4B',
    'ASHRAE 169-2013-4C',
    'ASHRAE 169-2013-5A',
    'ASHRAE 169-2013-5B',
    'ASHRAE 169-2013-5C',
    'ASHRAE 169-2013-6A',
    'ASHRAE 169-2013-6B',
    'ASHRAE 169-2013-7A',
    'ASHRAE 169-2013-8A'
  ];
}

// Export the module
export default {
  createModelFromTemplate,
  getAvailableTemplateTypes,
  getAvailableBuildingTypes,
  getAvailableBuildingVintages,
  getAvailableClimateZones
};