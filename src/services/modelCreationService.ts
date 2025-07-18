/**
 * Model Creation Service
 * 
 * This service provides functionality for creating OpenStudio models from templates
 * and initializing models with common settings.
 */
import path from 'path';
import { logger, modelTemplates, fileOperations } from '../utils';
import { ModelTemplateOptions, TemplateType } from '../utils/modelTemplates';
import config from '../config';

/**
 * Model initialization options
 */
export interface ModelInitOptions {
  /** Template type to use */
  templateType: TemplateType;
  /** Template options */
  templateOptions?: ModelTemplateOptions;
  /** Output directory */
  outputDirectory?: string;
  /** Model name */
  modelName?: string;
  /** Whether to include default measures */
  includeDefaultMeasures?: boolean;
}

/**
 * Model creation result
 */
export interface ModelCreationResult {
  /** Whether the operation was successful */
  success: boolean;
  /** Error message if the operation failed */
  error?: string;
  /** Path to the created model */
  modelPath?: string;
  /** Additional data */
  data?: any;
}

/**
 * Model Creation Service
 */
export class ModelCreationService {
  /**
   * Create a new model from a template
   * @param options Model initialization options
   * @returns Promise that resolves with the model creation result
   */
  public async createModel(options: ModelInitOptions): Promise<ModelCreationResult> {
    try {
      logger.info({ options }, 'Creating new model from template');
      
      // Determine output path
      const outputDirectory = options.outputDirectory || config.tempDir;
      const modelName = options.modelName || `model_${Date.now()}.osm`;
      const outputPath = path.join(outputDirectory, modelName);
      
      // Ensure output directory exists
      await fileOperations.ensureDirectory(outputDirectory);
      
      // Create model from template
      const result = await modelTemplates.createModelFromTemplate(
        options.templateType,
        outputPath,
        options.templateOptions
      );
      
      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to create model from template',
        };
      }
      
      // Apply default measures if requested
      if (options.includeDefaultMeasures) {
        await this.applyDefaultMeasures(outputPath, options.templateType);
      }
      
      return {
        success: true,
        modelPath: outputPath,
        data: result.data,
      };
    } catch (error) {
      logger.error({ options, error }, 'Error creating model from template');
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  
  /**
   * Apply default measures to a model based on template type
   * @param modelPath Path to the model
   * @param templateType Template type
   * @returns Promise that resolves when measures are applied
   */
  private async applyDefaultMeasures(modelPath: string, templateType: TemplateType): Promise<void> {
    // This is a placeholder for future implementation
    // In a real implementation, we would apply default measures based on the template type
    logger.info({ modelPath, templateType }, 'Applying default measures to model');
    
    // For now, we'll just log that this would apply measures
    // In the future, this would use the measure application functionality
    // that will be implemented in task 6.3
  }
  
  /**
   * Get available template types
   * @returns Array of available template types
   */
  public getAvailableTemplateTypes(): TemplateType[] {
    return modelTemplates.getAvailableTemplateTypes();
  }
  
  /**
   * Get available building types for a template
   * @param templateType Template type
   * @returns Array of available building types
   */
  public getAvailableBuildingTypes(templateType: TemplateType): string[] {
    return modelTemplates.getAvailableBuildingTypes(templateType);
  }
  
  /**
   * Get available building vintages
   * @returns Array of available building vintages
   */
  public getAvailableBuildingVintages(): string[] {
    return modelTemplates.getAvailableBuildingVintages();
  }
  
  /**
   * Get available climate zones
   * @returns Array of available climate zones
   */
  public getAvailableClimateZones(): string[] {
    return modelTemplates.getAvailableClimateZones();
  }
  
  /**
   * Get default template options for a template type
   * @param templateType Template type
   * @returns Default template options
   */
  public getDefaultTemplateOptions(templateType: TemplateType): ModelTemplateOptions {
    // Default options based on template type
    switch (templateType) {
      case 'office':
        return {
          buildingType: 'MediumOffice',
          buildingVintage: '90.1-2013',
          climateZone: 'ASHRAE 169-2013-5A',
          floorArea: 5000,
          numStories: 3,
          aspectRatio: 1.5,
          floorToFloorHeight: 3.96,
          perimeterZoneDepth: 4.57,
          includeHVAC: true,
          includeSWH: true,
          includeExteriorLighting: true,
          includeInteriorLighting: true,
        };
      case 'residential':
        return {
          buildingType: 'MidriseApartment',
          buildingVintage: '90.1-2013',
          climateZone: 'ASHRAE 169-2013-5A',
          floorArea: 3000,
          numStories: 4,
          aspectRatio: 2.0,
          floorToFloorHeight: 3.05,
          perimeterZoneDepth: 4.57,
          includeHVAC: true,
          includeSWH: true,
          includeExteriorLighting: true,
          includeInteriorLighting: true,
        };
      case 'retail':
        return {
          buildingType: 'RetailStandalone',
          buildingVintage: '90.1-2013',
          climateZone: 'ASHRAE 169-2013-5A',
          floorArea: 2500,
          numStories: 1,
          aspectRatio: 1.5,
          floorToFloorHeight: 4.27,
          perimeterZoneDepth: 4.57,
          includeHVAC: true,
          includeSWH: true,
          includeExteriorLighting: true,
          includeInteriorLighting: true,
        };
      case 'warehouse':
        return {
          buildingType: 'Warehouse',
          buildingVintage: '90.1-2013',
          climateZone: 'ASHRAE 169-2013-5A',
          floorArea: 5000,
          numStories: 1,
          aspectRatio: 2.0,
          floorToFloorHeight: 5.0,
          perimeterZoneDepth: 4.57,
          includeHVAC: true,
          includeSWH: false,
          includeExteriorLighting: true,
          includeInteriorLighting: true,
        };
      case 'school':
        return {
          buildingType: 'SecondarySchool',
          buildingVintage: '90.1-2013',
          climateZone: 'ASHRAE 169-2013-5A',
          floorArea: 10000,
          numStories: 2,
          aspectRatio: 3.0,
          floorToFloorHeight: 4.0,
          perimeterZoneDepth: 4.57,
          includeHVAC: true,
          includeSWH: true,
          includeExteriorLighting: true,
          includeInteriorLighting: true,
        };
      case 'hospital':
        return {
          buildingType: 'Hospital',
          buildingVintage: '90.1-2013',
          climateZone: 'ASHRAE 169-2013-5A',
          floorArea: 15000,
          numStories: 5,
          aspectRatio: 1.5,
          floorToFloorHeight: 4.0,
          perimeterZoneDepth: 4.57,
          includeHVAC: true,
          includeSWH: true,
          includeExteriorLighting: true,
          includeInteriorLighting: true,
        };
      default:
        return {};
    }
  }
}

// Export a singleton instance
export default new ModelCreationService();