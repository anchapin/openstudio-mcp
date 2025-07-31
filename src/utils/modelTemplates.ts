/**
 * Model templates module
 *
 * This module provides functionality for creating OpenStudio models from templates.
 * It includes predefined templates for common building types and configurations.
 */
import path from 'path';
import { logger, fileOperations } from './index';
import { isPathSafe } from './validation';
import { OpenStudioCommandResult } from './openStudioCommands';
import config from '../config';

/**
 * Template type definition
 */
export type TemplateType =
  | 'empty'
  | 'office'
  | 'residential'
  | 'retail'
  | 'warehouse'
  | 'school'
  | 'hospital';

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
  options: ModelTemplateOptions = {},
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
    logger.error(
      { templateType, outputPath, options, error },
      'Failed to create model from template',
    );

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
    // Create a simple Ruby script to generate an empty model using OpenStudio SDK
    const scriptContent = `
require 'openstudio'

# Create a new empty model
model = OpenStudio::Model::Model.new

# Set up basic building
building = model.getBuilding
building.setName('Empty Building')

# Save the model
begin
  model.save('${outputPath.replace(/\\/g, '\\\\')}', true)
  puts "Empty model created successfully and saved to #{File.absolute_path('${outputPath.replace(/\\/g, '\\\\')}')}."
rescue => e
  puts "Error saving model: #{e.message}"
  exit 1
end
`;

    const scriptPath = await fileOperations.createTempFile(scriptContent, {
      tempDir: config.tempDir,
    });

    // Execute the Ruby script using OpenStudio CLI with direct spawn
    const openStudioPath = '/Applications/OpenStudio-3.10.0/bin/openstudio';
    const { spawn } = await import('child_process');
    const result = await new Promise<{
      success: boolean;
      stdout: string;
      stderr: string;
      error?: string;
    }>((resolve) => {
      const child = spawn(openStudioPath, ['execute_ruby_script', scriptPath]);

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({
          success: code === 0,
          stdout,
          stderr,
          error: code !== 0 ? `Command exited with code ${code}` : undefined,
        });
      });

      child.on('error', (error) => {
        resolve({
          success: false,
          stdout,
          stderr,
          error: error.message,
        });
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        child.kill();
        resolve({
          success: false,
          stdout,
          stderr,
          error: 'Command timed out',
        });
      }, 30000);
    });

    // Clean up the temporary script
    await fileOperations.deleteFile(scriptPath);

    return {
      success: result.success,
      output: result.stdout,
      error: result.success ? undefined : result.error,
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
  options: ModelTemplateOptions = {},
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
    logger.debug({ scriptContent }, 'Generated Ruby script content');

    const scriptPath = await fileOperations.createTempFile(scriptContent, {
      tempDir: config.tempDir,
    });
    logger.debug({ scriptPath }, 'Created temporary script file');

    // Execute the Ruby script using OpenStudio CLI with direct spawn
    const openStudioPath = '/Applications/OpenStudio-3.10.0/bin/openstudio';
    logger.debug(
      { command: openStudioPath, args: ['execute_ruby_script', scriptPath] },
      'Executing OpenStudio command',
    );

    // Use direct spawn to avoid complex validation issues
    const { spawn } = await import('child_process');
    const result = await new Promise<{
      success: boolean;
      stdout: string;
      stderr: string;
      error?: string;
    }>((resolve) => {
      const child = spawn(openStudioPath, ['execute_ruby_script', scriptPath]);

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        logger.debug({ code, stdout, stderr }, 'OpenStudio command completed');
        resolve({
          success: code === 0,
          stdout,
          stderr,
          error: code !== 0 ? `Command exited with code ${code}. stderr: ${stderr}` : undefined,
        });
      });

      child.on('error', (error) => {
        logger.error({ error: error.message }, 'OpenStudio command spawn error');
        resolve({
          success: false,
          stdout,
          stderr,
          error: error.message,
        });
      });

      // Timeout after 60 seconds
      setTimeout(() => {
        child.kill();
        resolve({
          success: false,
          stdout,
          stderr,
          error: 'Command timed out',
        });
      }, 60000);
    });

    logger.debug({ result }, 'OpenStudio command result');

    // Clean up the temporary script
    await fileOperations.deleteFile(scriptPath);

    return {
      success: result.success,
      output: result.stdout,
      error: result.success ? undefined : result.error,
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
require 'openstudio-standards'

# Create a new model
model = OpenStudio::Model::Model.new

# Set up building
building = model.getBuilding
building.setName('${options.buildingType || 'Building'}')

# Calculate dimensions based on floor area and aspect ratio
total_floor_area = ${options.floorArea || 1000}
num_stories = ${options.numStories || 1}
aspect_ratio = ${options.aspectRatio || 1.5}
floor_height = ${options.floorToFloorHeight || 3.0}

# Calculate floor area per story
floor_area_per_story = total_floor_area / num_stories

# Calculate building dimensions
# area = length * width, aspect_ratio = length / width
# So: area = aspect_ratio * width^2, therefore width = sqrt(area / aspect_ratio)
width = Math.sqrt(floor_area_per_story / aspect_ratio)
length = width * aspect_ratio

puts "Creating building: #{length.round(2)}m x #{width.round(2)}m x #{num_stories} stories"

# Create spaces for each story
(0...num_stories).each do |story|
  story_name = "Story_#{story + 1}"
  
  # Create thermal zone for this story
  zone = OpenStudio::Model::ThermalZone.new(model)
  zone.setName("#{story_name}_Zone")
  
  # Create space
  space = OpenStudio::Model::Space.new(model)
  space.setName("#{story_name}_Space")
  space.setThermalZone(zone)
  
  # Set space origin (z-coordinate for the story)
  origin = OpenStudio::Point3d.new(0, 0, story * floor_height)
  space.setXOrigin(origin.x)
  space.setYOrigin(origin.y)
  space.setZOrigin(origin.z)
  
  # Create floor vertices
  floor_vertices = []
  floor_vertices << OpenStudio::Point3d.new(0, 0, story * floor_height)
  floor_vertices << OpenStudio::Point3d.new(length, 0, story * floor_height)
  floor_vertices << OpenStudio::Point3d.new(length, width, story * floor_height)
  floor_vertices << OpenStudio::Point3d.new(0, width, story * floor_height)
  
  # Create floor surface
  floor = OpenStudio::Model::Surface.new(floor_vertices, model)
  floor.setName("#{story_name}_Floor")
  floor.setSurfaceType("Floor")
  floor.setSpace(space)
  
  # Create ceiling vertices
  ceiling_z = (story + 1) * floor_height
  ceiling_vertices = []
  ceiling_vertices << OpenStudio::Point3d.new(0, 0, ceiling_z)
  ceiling_vertices << OpenStudio::Point3d.new(0, width, ceiling_z)
  ceiling_vertices << OpenStudio::Point3d.new(length, width, ceiling_z)
  ceiling_vertices << OpenStudio::Point3d.new(length, 0, ceiling_z)
  
  # Create ceiling surface
  ceiling = OpenStudio::Model::Surface.new(ceiling_vertices, model)
  ceiling.setName("#{story_name}_Ceiling")
  ceiling.setSurfaceType("RoofCeiling")
  ceiling.setSpace(space)
  
  # Create walls
  wall_height = floor_height
  
  # South wall (y=0)
  south_vertices = []
  south_vertices << OpenStudio::Point3d.new(0, 0, story * floor_height)
  south_vertices << OpenStudio::Point3d.new(0, 0, ceiling_z)
  south_vertices << OpenStudio::Point3d.new(length, 0, ceiling_z)
  south_vertices << OpenStudio::Point3d.new(length, 0, story * floor_height)
  
  south_wall = OpenStudio::Model::Surface.new(south_vertices, model)
  south_wall.setName("#{story_name}_South_Wall")
  south_wall.setSurfaceType("Wall")
  south_wall.setSpace(space)
  
  # East wall (x=length)
  east_vertices = []
  east_vertices << OpenStudio::Point3d.new(length, 0, story * floor_height)
  east_vertices << OpenStudio::Point3d.new(length, 0, ceiling_z)
  east_vertices << OpenStudio::Point3d.new(length, width, ceiling_z)
  east_vertices << OpenStudio::Point3d.new(length, width, story * floor_height)
  
  east_wall = OpenStudio::Model::Surface.new(east_vertices, model)
  east_wall.setName("#{story_name}_East_Wall")
  east_wall.setSurfaceType("Wall")
  east_wall.setSpace(space)
  
  # North wall (y=width)
  north_vertices = []
  north_vertices << OpenStudio::Point3d.new(length, width, story * floor_height)
  north_vertices << OpenStudio::Point3d.new(length, width, ceiling_z)
  north_vertices << OpenStudio::Point3d.new(0, width, ceiling_z)
  north_vertices << OpenStudio::Point3d.new(0, width, story * floor_height)
  
  north_wall = OpenStudio::Model::Surface.new(north_vertices, model)
  north_wall.setName("#{story_name}_North_Wall")
  north_wall.setSurfaceType("Wall")
  north_wall.setSpace(space)
  
  # West wall (x=0)
  west_vertices = []
  west_vertices << OpenStudio::Point3d.new(0, width, story * floor_height)
  west_vertices << OpenStudio::Point3d.new(0, width, ceiling_z)
  west_vertices << OpenStudio::Point3d.new(0, 0, ceiling_z)
  west_vertices << OpenStudio::Point3d.new(0, 0, story * floor_height)
  
  west_wall = OpenStudio::Model::Surface.new(west_vertices, model)
  west_wall.setName("#{story_name}_West_Wall")
  west_wall.setSurfaceType("Wall")
  west_wall.setSpace(space)
end

puts "Created #{num_stories} stories with total floor area of #{total_floor_area} m²"

# Set weather file if provided
${
  options.weatherFilePath
    ? `
begin
  epw_file = OpenStudio::EpwFile.new('${options.weatherFilePath.replace(/\\/g, '\\\\')}')
  OpenStudio::Model::WeatherFile.setWeatherFile(model, epw_file)
  puts "Weather file set: ${options.weatherFilePath.replace(/\\/g, '\\\\')}"
rescue => e
  puts "Warning: Could not set weather file: #{e.message}"
end
`
    : ''
}

# Save the model
begin
  model.save('${outputPath.replace(/\\/g, '\\\\')}', true)
  puts "Model created successfully and saved to #{File.absolute_path('${outputPath.replace(/\\/g, '\\\\')}')}."
  puts "Model contains #{model.getSpaces.size} spaces and #{model.getSurfaces.size} surfaces."
rescue => e
  puts "Error saving model: #{e.message}"
  exit 1
end
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
    '90.1-2019',
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
    'ASHRAE 169-2013-8A',
  ];
}

// Export the module
export default {
  createModelFromTemplate,
  getAvailableTemplateTypes,
  getAvailableBuildingTypes,
  getAvailableBuildingVintages,
  getAvailableClimateZones,
};
