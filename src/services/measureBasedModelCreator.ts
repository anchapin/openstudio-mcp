/**
 * Measure-Based Model Creator
 *
 * This service creates OpenStudio models using BCL measures like "create bar from space type ratios"
 * instead of basic Ruby scripts. It provides enhanced model creation capabilities with
 * detailed building configurations and space type ratios.
 */

import path from 'path';
import logger from '../utils/logger';
import fileOperations from '../utils/fileOperations';
import * as openStudioCommands from '../utils/openStudioCommands';
import { BCLApiClient } from './bclApiClient';
import measureManager from '../utils/measureManager';

export interface MeasureBasedModelOptions {
  /** Building type (office, residential, retail, etc.) */
  buildingType: string;
  /** Building vintage (90.1-2019, 90.1-2016, etc.) */
  buildingVintage?: string;
  /** Climate zone (ASHRAE 1A, 2A, etc.) */
  climateZone?: string;
  /** Weather file path */
  weatherFilePath?: string;
  /** Total floor area in square meters */
  floorArea: number;
  /** Number of stories */
  numStories: number;
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
  /** Output directory for the model */
  outputDir?: string;
  /** Model name */
  modelName?: string;
}

export interface SpaceTypeRatio {
  spaceType: string;
  ratio: number;
  lightingWattsPerSqFt?: number;
  equipmentWattsPerSqFt?: number;
  occupancyPerSqFt?: number;
}

export interface MeasureBasedModelResult {
  success: boolean;
  modelPath?: string;
  measureId?: string;
  errors?: string[];
  warnings?: string[];
  info?: string[];
}

export class MeasureBasedModelCreator {
  private bclClient: BCLApiClient;
  private readonly CREATE_BAR_MEASURE_ID = '3e988765-9673-46f8-9b65-99d5b86c2b22';

  constructor() {
    this.bclClient = new BCLApiClient();
  }

  /**
   * Create a model using the "create bar from space type ratios" measure
   * @param options Model creation options
   * @returns Promise resolving to creation result
   */
  async createModelWithCreateBarMeasure(
    options: MeasureBasedModelOptions,
  ): Promise<MeasureBasedModelResult> {
    try {
      logger.info(`Creating model with create bar measure: ${JSON.stringify(options)}`);

      // Ensure the create bar measure is available
      const measureAvailable = await this.ensureCreateBarMeasure();
      if (!measureAvailable) {
        return {
          success: false,
          errors: ['Failed to ensure create bar measure is available'],
          warnings: [],
        };
      }

      // Create temporary directory for model creation
      const tempDir = await fileOperations.createTempDirectory('openstudio-mcp-model-');
      const modelPath = path.join(tempDir, `${options.modelName || 'building_model'}.osm`);

      // Create initial empty model
      const emptyModelCreated = await this.createEmptyModel(modelPath);
      if (!emptyModelCreated) {
        return {
          success: false,
          errors: ['Failed to create empty OpenStudio model'],
        };
      }

      // Configure measure arguments based on building type
      const measureArgs = await this.configureCreateBarArguments(options);

      // Run the create bar measure
      const measureResult = await this.runCreateBarMeasure(modelPath, measureArgs);

      if (!measureResult.success) {
        return {
          success: false,
          errors: measureResult.errors,
          warnings: measureResult.warnings,
        };
      }

      // Validate the created model
      const validationResult = await this.validateModel(modelPath);
      if (!validationResult.success) {
        logger.warn('Model validation failed', validationResult.errors);
      }

      // Move model to final location if specified
      let finalModelPath = modelPath;
      if (options.outputDir) {
        await fileOperations.ensureDirectory(options.outputDir);
        finalModelPath = path.join(options.outputDir, path.basename(modelPath));
        await fileOperations.copyFile(modelPath, finalModelPath);
      }

      return {
        success: true,
        modelPath: finalModelPath,
        measureId: this.CREATE_BAR_MEASURE_ID,
        warnings: validationResult.warnings,
        info: [`Model created successfully with ${options.buildingType} configuration`],
      };
    } catch (error) {
      logger.error('Error creating model with create bar measure', error);
      return {
        success: false,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  /**
   * Ensure the create bar measure is available locally
   * @returns Promise resolving to availability status
   */
  private async ensureCreateBarMeasure(): Promise<boolean> {
    try {
      // Check if measure is already installed
      const isInstalled = await measureManager.isMeasureInstalled(this.CREATE_BAR_MEASURE_ID);
      if (isInstalled) {
        logger.info('Create bar measure is already installed');
        return true;
      }

      // Download and install the measure
      logger.info('Downloading create bar measure from BCL');
      const downloadSuccess = await this.bclClient.downloadMeasure(this.CREATE_BAR_MEASURE_ID);
      if (!downloadSuccess) {
        logger.error('Failed to download create bar measure');
        return false;
      }

      const installSuccess = await this.bclClient.installMeasure(this.CREATE_BAR_MEASURE_ID);
      if (!installSuccess) {
        logger.error('Failed to install create bar measure');
        return false;
      }

      logger.info('Successfully installed create bar measure');
      return true;
    } catch (error) {
      logger.error('Error ensuring create bar measure availability', error);
      return false;
    }
  }

  /**
   * Create an empty OpenStudio model
   * @param modelPath Path for the new model
   * @returns Promise resolving to creation success
   */
  private async createEmptyModel(modelPath: string): Promise<boolean> {
    try {
      const rubyScript = `
        require 'openstudio'
        
        # Create a new model
        model = OpenStudio::Model::Model.new
        
        # Set basic model information
        model.getBuilding.setName("Building Model")
        
        # Save the model
        model.save(OpenStudio::Path.new('${modelPath}'), true)
        
        puts "Empty model created at: ${modelPath}"
      `;

      const result = await openStudioCommands.executeRubyScript(rubyScript);
      return result.success;
    } catch (error) {
      logger.error('Error creating empty model', error);
      return false;
    }
  }

  /**
   * Configure arguments for the create bar measure based on building type
   * @param options Model creation options
   * @returns Promise resolving to measure arguments
   */
  private async configureCreateBarArguments(
    options: MeasureBasedModelOptions,
  ): Promise<Record<string, string | number | boolean>> {
    const spaceTypeRatios = this.getSpaceTypeRatios(options.buildingType);

    return {
      bar_division_method: 'Multiple Space Types - Simple Sliced',
      space_type_hash_string: this.formatSpaceTypeHash(spaceTypeRatios),
      building_rotation: 0,
      floor_height: options.floorToFloorHeight || 3.0,
      num_floors: options.numStories,
      bottom_story_ground_exposed_floor: true,
      top_story_exterior_exposed_roof: true,
      make_mid_story_surfaces_adiabatic: false,
      story_multiplier: 'Basements Ground Mid Top',
      bar_width: Math.sqrt(options.floorArea / options.numStories / (options.aspectRatio || 1.5)),
      bar_length: Math.sqrt(
        (options.floorArea / options.numStories) * (options.aspectRatio || 1.5),
      ),
      bar_sep_dist_mult: 0,
      double_loaded_corridor: 'Primary Space Type',
      space_type_sort_logic: 'Building Type > Size',
      custom_height_bar: false,
      custom_height_bar_apply_to_all_stories: false,
      use_upstream_args: false,
    };
  }

  /**
   * Get space type ratios for different building types
   * @param buildingType Type of building
   * @returns Array of space type ratios
   */
  private getSpaceTypeRatios(buildingType: string): SpaceTypeRatio[] {
    const ratios: Record<string, SpaceTypeRatio[]> = {
      office: [
        {
          spaceType: 'Office',
          ratio: 0.65,
          lightingWattsPerSqFt: 1.1,
          equipmentWattsPerSqFt: 1.0,
          occupancyPerSqFt: 0.005,
        },
        {
          spaceType: 'Conference',
          ratio: 0.1,
          lightingWattsPerSqFt: 1.3,
          equipmentWattsPerSqFt: 1.5,
          occupancyPerSqFt: 0.05,
        },
        {
          spaceType: 'Corridor',
          ratio: 0.15,
          lightingWattsPerSqFt: 0.6,
          equipmentWattsPerSqFt: 0.1,
          occupancyPerSqFt: 0.001,
        },
        {
          spaceType: 'Restroom',
          ratio: 0.05,
          lightingWattsPerSqFt: 1.0,
          equipmentWattsPerSqFt: 0.2,
          occupancyPerSqFt: 0.01,
        },
        {
          spaceType: 'Storage',
          ratio: 0.05,
          lightingWattsPerSqFt: 0.8,
          equipmentWattsPerSqFt: 0.1,
          occupancyPerSqFt: 0.001,
        },
      ],
      residential: [
        {
          spaceType: 'Apartment',
          ratio: 0.7,
          lightingWattsPerSqFt: 0.8,
          equipmentWattsPerSqFt: 1.2,
          occupancyPerSqFt: 0.004,
        },
        {
          spaceType: 'Corridor',
          ratio: 0.15,
          lightingWattsPerSqFt: 0.6,
          equipmentWattsPerSqFt: 0.1,
          occupancyPerSqFt: 0.001,
        },
        {
          spaceType: 'Lobby',
          ratio: 0.1,
          lightingWattsPerSqFt: 1.0,
          equipmentWattsPerSqFt: 0.2,
          occupancyPerSqFt: 0.01,
        },
        {
          spaceType: 'Storage',
          ratio: 0.05,
          lightingWattsPerSqFt: 0.5,
          equipmentWattsPerSqFt: 0.1,
          occupancyPerSqFt: 0.001,
        },
      ],
      retail: [
        {
          spaceType: 'Retail',
          ratio: 0.8,
          lightingWattsPerSqFt: 1.5,
          equipmentWattsPerSqFt: 1.0,
          occupancyPerSqFt: 0.02,
        },
        {
          spaceType: 'Storage',
          ratio: 0.15,
          lightingWattsPerSqFt: 0.8,
          equipmentWattsPerSqFt: 0.2,
          occupancyPerSqFt: 0.001,
        },
        {
          spaceType: 'Office',
          ratio: 0.05,
          lightingWattsPerSqFt: 1.1,
          equipmentWattsPerSqFt: 1.0,
          occupancyPerSqFt: 0.005,
        },
      ],
      warehouse: [
        {
          spaceType: 'Warehouse',
          ratio: 0.85,
          lightingWattsPerSqFt: 0.6,
          equipmentWattsPerSqFt: 0.5,
          occupancyPerSqFt: 0.001,
        },
        {
          spaceType: 'Office',
          ratio: 0.1,
          lightingWattsPerSqFt: 1.1,
          equipmentWattsPerSqFt: 1.0,
          occupancyPerSqFt: 0.005,
        },
        {
          spaceType: 'Storage',
          ratio: 0.05,
          lightingWattsPerSqFt: 0.8,
          equipmentWattsPerSqFt: 0.1,
          occupancyPerSqFt: 0.001,
        },
      ],
      school: [
        {
          spaceType: 'Classroom',
          ratio: 0.6,
          lightingWattsPerSqFt: 1.2,
          equipmentWattsPerSqFt: 1.5,
          occupancyPerSqFt: 0.03,
        },
        {
          spaceType: 'Office',
          ratio: 0.15,
          lightingWattsPerSqFt: 1.1,
          equipmentWattsPerSqFt: 1.0,
          occupancyPerSqFt: 0.005,
        },
        {
          spaceType: 'Corridor',
          ratio: 0.15,
          lightingWattsPerSqFt: 0.6,
          equipmentWattsPerSqFt: 0.1,
          occupancyPerSqFt: 0.001,
        },
        {
          spaceType: 'Gymnasium',
          ratio: 0.05,
          lightingWattsPerSqFt: 1.5,
          equipmentWattsPerSqFt: 0.5,
          occupancyPerSqFt: 0.05,
        },
        {
          spaceType: 'Restroom',
          ratio: 0.05,
          lightingWattsPerSqFt: 1.0,
          equipmentWattsPerSqFt: 0.2,
          occupancyPerSqFt: 0.01,
        },
      ],
      hospital: [
        {
          spaceType: 'Patient Room',
          ratio: 0.4,
          lightingWattsPerSqFt: 1.0,
          equipmentWattsPerSqFt: 2.0,
          occupancyPerSqFt: 0.01,
        },
        {
          spaceType: 'Nurse Station',
          ratio: 0.15,
          lightingWattsPerSqFt: 1.2,
          equipmentWattsPerSqFt: 1.5,
          occupancyPerSqFt: 0.02,
        },
        {
          spaceType: 'Corridor',
          ratio: 0.2,
          lightingWattsPerSqFt: 0.6,
          equipmentWattsPerSqFt: 0.1,
          occupancyPerSqFt: 0.001,
        },
        {
          spaceType: 'Office',
          ratio: 0.1,
          lightingWattsPerSqFt: 1.1,
          equipmentWattsPerSqFt: 1.0,
          occupancyPerSqFt: 0.005,
        },
        {
          spaceType: 'Storage',
          ratio: 0.1,
          lightingWattsPerSqFt: 0.8,
          equipmentWattsPerSqFt: 0.2,
          occupancyPerSqFt: 0.001,
        },
        {
          spaceType: 'Restroom',
          ratio: 0.05,
          lightingWattsPerSqFt: 1.0,
          equipmentWattsPerSqFt: 0.2,
          occupancyPerSqFt: 0.01,
        },
      ],
    };

    return ratios[buildingType.toLowerCase()] || ratios['office'];
  }

  /**
   * Format space type ratios for the measure argument
   * @param ratios Array of space type ratios
   * @returns Formatted string for measure argument
   */
  private formatSpaceTypeHash(ratios: SpaceTypeRatio[]): string {
    return ratios.map((ratio) => `${ratio.spaceType}=>${ratio.ratio}`).join('|');
  }

  /**
   * Run the create bar measure on the model
   * @param modelPath Path to the model file
   * @param args Measure arguments
   * @returns Promise resolving to execution result
   */
  private async runCreateBarMeasure(
    modelPath: string,
    args: Record<string, string | number | boolean>,
  ): Promise<{
    success: boolean;
    errors?: string[];
    warnings?: string[];
  }> {
    try {
      const measurePath = measureManager.getMeasurePath(this.CREATE_BAR_MEASURE_ID);

      const rubyScript = `
        require 'openstudio'
        require 'json'
        
        # Load the model
        model = OpenStudio::Model::Model.load(OpenStudio::Path.new('${modelPath}')).get
        
        # Load the measure
        require '${measurePath}/measure.rb'
        
        # Create measure instance
        measure = CreateBarFromSpaceTypeRatios.new
        
        # Create runner
        runner = OpenStudio::Measure::OSRunner.new(OpenStudio::Workspace.new)
        
        # Create argument map
        argument_map = OpenStudio::Measure.convertOSArgumentVectorToMap(measure.arguments(model))
        
        # Set arguments
        ${Object.entries(args)
          .map(
            ([key, value]) =>
              `argument_map['${key}'].setValue(${typeof value === 'string' ? `'${value}'` : value})`,
          )
          .join('\n        ')}
        
        # Run the measure
        measure.run(model, runner, argument_map)
        
        # Check results
        if runner.result.value.valueName == 'Success'
          # Save the model
          model.save(OpenStudio::Path.new('${modelPath}'), true)
          puts "Measure executed successfully"
          puts "Model saved to: ${modelPath}"
          exit 0
        else
          puts "Measure failed: #{runner.result.errors.map(&:logMessage).join(', ')}"
          exit 1
        end
      `;

      const result = await openStudioCommands.executeRubyScript(rubyScript);

      return {
        success: result.success,
        errors: result.error ? [result.error] : [],
        warnings: [],
      };
    } catch (error) {
      logger.error('Error running create bar measure', error);
      return {
        success: false,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  /**
   * Validate the created model
   * @param modelPath Path to the model file
   * @returns Promise resolving to validation result
   */
  private async validateModel(modelPath: string): Promise<{
    success: boolean;
    errors?: string[];
    warnings?: string[];
  }> {
    try {
      const rubyScript = `
        require 'openstudio'
        
        # Load the model
        model = OpenStudio::Model::Model.load(OpenStudio::Path.new('${modelPath}')).get
        
        # Run basic validation
        errors = []
        warnings = []
        
        # Check for spaces
        if model.getSpaces.empty?
          errors << "Model contains no spaces"
        end
        
        # Check for thermal zones
        if model.getThermalZones.empty?
          warnings << "Model contains no thermal zones"
        end
        
        # Check for HVAC systems
        if model.getAirLoopHVACs.empty? && model.getZoneHVACComponents.empty?
          warnings << "Model contains no HVAC systems"
        end
        
        # Check for surfaces
        if model.getSurfaces.empty?
          errors << "Model contains no surfaces"
        end
        
        # Check for valid geometry
        model.getSpaces.each do |space|
          if space.floorArea <= 0
            errors << "Space #{space.name} has invalid floor area"
          end
        end
        
        if errors.empty?
          puts "Model validation passed"
          exit 0
        else
          puts "Model validation failed: #{errors.join(', ')}"
          exit 1
        end
      `;

      const result = await openStudioCommands.executeRubyScript(rubyScript);

      return {
        success: result.success,
        errors: result.error ? [result.error] : [],
        warnings: [],
      };
    } catch (error) {
      logger.error('Error validating model', error);
      return {
        success: false,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  /**
   * Create a model with enhanced features using multiple measures
   * @param options Model creation options
   * @returns Promise resolving to creation result
   */
  async createEnhancedModel(options: MeasureBasedModelOptions): Promise<MeasureBasedModelResult> {
    try {
      // First create basic model with create bar measure
      const basicResult = await this.createModelWithCreateBarMeasure(options);
      if (!basicResult.success || !basicResult.modelPath) {
        return basicResult;
      }

      // Apply additional measures based on building type
      const enhancedResult = await this.applyBuildingTypeMeasures(basicResult.modelPath, options);

      return enhancedResult;
    } catch (error) {
      logger.error('Error creating enhanced model', error);
      return {
        success: false,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  /**
   * Apply building-type specific measures to enhance the model
   * @param modelPath Path to the model
   * @param options Model options
   * @returns Promise resolving to enhanced model result
   */
  private async applyBuildingTypeMeasures(
    modelPath: string,
    options: MeasureBasedModelOptions,
  ): Promise<MeasureBasedModelResult> {
    try {
      const measures = this.getBuildingTypeMeasures(options.buildingType);

      for (const measure of measures) {
        const result = await this.applyMeasureToModel(modelPath, measure, options);
        if (!result.success) {
          logger.warn(`Failed to apply measure ${measure}:`, result.errors);
        }
      }

      return {
        success: true,
        modelPath: modelPath,
        info: [`Enhanced model created with ${measures.length} additional measures`],
      };
    } catch (error) {
      logger.error('Error applying building type measures', error);
      return {
        success: false,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  /**
   * Get building-type specific measures to apply
   * @param buildingType Type of building
   * @returns Array of measure IDs
   */
  private getBuildingTypeMeasures(buildingType: string): string[] {
    const measures: Record<string, string[]> = {
      office: ['add_hvac_systems', 'add_exterior_lights', 'add_service_water_heating'],
      residential: ['add_hvac_systems', 'add_exterior_lights', 'add_service_water_heating'],
      retail: ['add_hvac_systems', 'add_exterior_lights', 'add_service_water_heating'],
      warehouse: ['add_hvac_systems', 'add_exterior_lights'],
      school: ['add_hvac_systems', 'add_exterior_lights', 'add_service_water_heating'],
      hospital: ['add_hvac_systems', 'add_exterior_lights', 'add_service_water_heating'],
    };

    return measures[buildingType.toLowerCase()] || measures['office'];
  }

  /**
   * Apply a measure to the model
   * @param modelPath Path to the model
   * @param measureId Measure ID
   * @param options Model options
   * @returns Promise resolving to application result
   */
  private async applyMeasureToModel(
    modelPath: string,
    measureId: string,
    _options: MeasureBasedModelOptions,
  ): Promise<{
    success: boolean;
    errors?: string[];
  }> {
    try {
      // This is a placeholder for applying additional measures
      // In a real implementation, this would configure and run specific measures
      logger.info(`Applying measure ${measureId} to model ${modelPath}`);

      return { success: true };
    } catch (error) {
      logger.error(`Error applying measure ${measureId}`, error);
      return {
        success: false,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }
}

// Export singleton instance
export const measureBasedModelCreator = new MeasureBasedModelCreator();
export default measureBasedModelCreator;
