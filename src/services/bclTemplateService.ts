/**
 * BCL Template Service
 *
 * This service provides functionality for creating OpenStudio models using templates
 * from the Building Component Library (BCL). It enhances the existing model creation
 * capabilities by integrating with BCL templates and components.
 */

// import axios from 'axios';
import path from 'path';
import { logger, fileOperations } from '../utils';
import { TemplateType, ModelTemplateOptions } from '../utils/modelTemplates';
// import config from '../config';
import { BCLApiClient } from './bclApiClient';
import modelTemplates from '../utils/modelTemplates';
import { OpenStudioCommandResult } from '../utils/openStudioCommands';

/**
 * BCL template information
 */
export interface BCLTemplateInfo {
  /** Template ID */
  id: string;
  /** Template name */
  name: string;
  /** Template description */
  description: string;
  /** Template version */
  version: string;
  /** Template tags */
  tags: string[];
  /** Template building types */
  buildingTypes: string[];
  /** Template climate zones */
  climateZones: string[];
  /** Template vintages */
  vintages: string[];
}

/**
 * BCL template search options
 */
export interface BCLTemplateSearchOptions {
  /** Building type to search for */
  buildingType?: string;
  /** Climate zone to search for */
  climateZone?: string;
  /** Building vintage to search for */
  vintage?: string;
  /** Search query */
  query?: string;
  /** Number of results to return */
  limit?: number;
}

/**
 * BCL model creation options
 */
export interface BCLModelCreationOptions {
  /** Template ID from BCL */
  templateId: string;
  /** Output path for the model */
  outputPath: string;
  /** Template options */
  templateOptions?: ModelTemplateOptions;
  /** Whether to apply default measures */
  applyDefaultMeasures?: boolean;
}

/**
 * BCL Template Service
 */
export class BCLTemplateService {
  private bclClient: BCLApiClient;

  constructor() {
    this.bclClient = new BCLApiClient();
  }

  /**
   * Search for templates in the BCL
   * @param options Search options
   * @returns Promise that resolves with array of template information
   */
  public async searchTemplates(options: BCLTemplateSearchOptions = {}): Promise<BCLTemplateInfo[]> {
    try {
      logger.info({ options }, 'Searching for BCL templates');

      // Build search query
      const queryParts: string[] = [];

      if (options.buildingType) {
        queryParts.push(`building_type:${options.buildingType}`);
      }

      if (options.climateZone) {
        queryParts.push(`climate_zone:${options.climateZone}`);
      }

      if (options.vintage) {
        queryParts.push(`vintage:${options.vintage}`);
      }

      if (options.query) {
        queryParts.push(options.query);
      }

      const searchQuery = queryParts.join(' ');

      // Search for measures (templates are a type of measure in BCL)
      const measures = await this.bclClient.searchMeasures(searchQuery);

      // Filter for templates and transform to BCLTemplateInfo
      const templates: BCLTemplateInfo[] = measures
        .filter(
          (measure) =>
            measure.tags.some((tag) => tag.includes('template')) ||
            measure.name.toLowerCase().includes('template') ||
            measure.description.toLowerCase().includes('template'),
        )
        .map((measure) => ({
          id: measure.id,
          name: measure.name,
          description: measure.description,
          version: measure.version,
          tags: measure.tags,
          buildingTypes: this.extractBuildingTypes(measure.tags),
          climateZones: this.extractClimateZones(measure.tags),
          vintages: this.extractVintages(measure.tags),
        }))
        // Limit results
        .slice(0, options.limit || 20);

      logger.info({ templateCount: templates.length }, 'Found BCL templates');
      return templates;
    } catch (error) {
      logger.error(
        { options, error: error instanceof Error ? error.message : String(error) },
        'Error searching for BCL templates',
      );
      return [];
    }
  }

  /**
   * Get detailed information about a BCL template
   * @param templateId Template ID
   * @returns Promise that resolves with template information
   */
  public async getTemplateInfo(templateId: string): Promise<BCLTemplateInfo | null> {
    try {
      logger.info({ templateId }, 'Getting BCL template information');

      // First check if template is already installed
      // In a real implementation, we would fetch detailed template info from BCL
      // For now, we'll create a basic template info object

      const templateInfo: BCLTemplateInfo = {
        id: templateId,
        name: `Template ${templateId}`,
        description: 'BCL template',
        version: '1.0.0',
        tags: [`template:${templateId}`],
        buildingTypes: ['Unknown'],
        climateZones: ['Unknown'],
        vintages: ['Unknown'],
      };

      return templateInfo;
    } catch (error) {
      logger.error(
        { templateId, error: error instanceof Error ? error.message : String(error) },
        'Error getting BCL template information',
      );
      return null;
    }
  }

  /**
   * Create a model from a BCL template
   * @param options Model creation options
   * @returns Promise that resolves with the command result
   */
  public async createModelFromBCLTemplate(
    options: BCLModelCreationOptions,
  ): Promise<OpenStudioCommandResult> {
    try {
      logger.info({ options }, 'Creating model from BCL template');

      // Validate parameters
      if (!options.templateId) {
        return {
          success: false,
          output: '',
          error: 'Template ID is required',
        };
      }

      if (!options.outputPath) {
        return {
          success: false,
          output: '',
          error: 'Output path is required',
        };
      }

      // Ensure output directory exists
      const outputDir = path.dirname(options.outputPath);
      await fileOperations.ensureDirectory(outputDir);

      // Download and install the template if not already installed
      const downloadSuccess = await this.bclClient.downloadMeasure(options.templateId);

      if (!downloadSuccess) {
        return {
          success: false,
          output: '',
          error: `Failed to download template ${options.templateId} from BCL`,
        };
      }

      const installSuccess = await this.bclClient.installMeasure(options.templateId);

      if (!installSuccess) {
        return {
          success: false,
          output: '',
          error: `Failed to install template ${options.templateId}`,
        };
      }

      // For now, we'll fall back to using the standard model creation
      // In a real implementation, we would use the BCL template directly
      const templateType: TemplateType = this.mapBCLTemplateToStandardType(options.templateId);

      const result = await modelTemplates.createModelFromTemplate(
        templateType,
        options.outputPath,
        options.templateOptions,
      );

      // Apply default measures if requested
      if (options.applyDefaultMeasures) {
        await this.applyDefaultMeasures(options.outputPath, templateType);
      }

      return result;
    } catch (error) {
      logger.error(
        { options, error: error instanceof Error ? error.message : String(error) },
        'Error creating model from BCL template',
      );

      return {
        success: false,
        output: '',
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
    try {
      logger.info({ modelPath, templateType }, 'Applying default measures to model');

      // Get recommended measures for this template type
      const context = `default measures for ${templateType} building`;
      const recommendedMeasures = await this.bclClient.recommendMeasures(context, modelPath);

      // Apply the top 3 recommended measures
      // In a real implementation, this would use the measure application service
      logger.info(
        {
          modelPath,
          templateType,
          measureCount: Math.min(3, recommendedMeasures.length),
        },
        'Would apply default measures (implementation pending)',
      );

      // Note: Actual measure application would be implemented here
      // This requires integration with the measure application service
    } catch (error) {
      logger.warn(
        { modelPath, templateType, error: error instanceof Error ? error.message : String(error) },
        'Warning: Failed to apply default measures',
      );
    }
  }

  /**
   * Extract building types from tags
   * @param tags Array of tags
   * @returns Array of building types
   */
  private extractBuildingTypes(tags: string[]): string[] {
    const buildingTypes: string[] = [];

    for (const tag of tags) {
      if (tag.startsWith('building_type:')) {
        buildingTypes.push(tag.replace('building_type:', ''));
      }
    }

    return buildingTypes.length > 0 ? buildingTypes : ['Unknown'];
  }

  /**
   * Extract climate zones from tags
   * @param tags Array of tags
   * @returns Array of climate zones
   */
  private extractClimateZones(tags: string[]): string[] {
    const climateZones: string[] = [];

    for (const tag of tags) {
      if (tag.startsWith('climate_zone:')) {
        climateZones.push(tag.replace('climate_zone:', ''));
      }
    }

    return climateZones.length > 0 ? climateZones : ['Unknown'];
  }

  /**
   * Extract vintages from tags
   * @param tags Array of tags
   * @returns Array of vintages
   */
  private extractVintages(tags: string[]): string[] {
    const vintages: string[] = [];

    for (const tag of tags) {
      if (tag.startsWith('vintage:')) {
        vintages.push(tag.replace('vintage:', ''));
      }
    }

    return vintages.length > 0 ? vintages : ['Unknown'];
  }

  /**
   * Map BCL template ID to standard template type
   * @param templateId BCL template ID
   * @returns Standard template type
   */
  private mapBCLTemplateToStandardType(templateId: string): TemplateType {
    const templateIdLower = templateId.toLowerCase();

    if (templateIdLower.includes('office')) {
      return 'office';
    } else if (templateIdLower.includes('residential') || templateIdLower.includes('apartment')) {
      return 'residential';
    } else if (templateIdLower.includes('retail') || templateIdLower.includes('store')) {
      return 'retail';
    } else if (templateIdLower.includes('warehouse') || templateIdLower.includes('storage')) {
      return 'warehouse';
    } else if (templateIdLower.includes('school') || templateIdLower.includes('education')) {
      return 'school';
    } else if (templateIdLower.includes('hospital') || templateIdLower.includes('healthcare')) {
      return 'hospital';
    } else {
      return 'empty'; // Default to empty template
    }
  }

  /**
   * Get available BCL templates for a specific building type
   * @param buildingType Building type
   * @returns Promise that resolves with array of template information
   */
  public async getTemplatesForBuildingType(buildingType: string): Promise<BCLTemplateInfo[]> {
    return this.searchTemplates({ buildingType, limit: 10 });
  }

  /**
   * Get available BCL templates for a specific climate zone
   * @param climateZone Climate zone
   * @returns Promise that resolves with array of template information
   */
  public async getTemplatesForClimateZone(climateZone: string): Promise<BCLTemplateInfo[]> {
    return this.searchTemplates({ climateZone, limit: 10 });
  }

  /**
   * Get available BCL templates for a specific vintage
   * @param vintage Building vintage
   * @returns Promise that resolves with array of template information
   */
  public async getTemplatesForVintage(vintage: string): Promise<BCLTemplateInfo[]> {
    return this.searchTemplates({ vintage, limit: 10 });
  }
}

// Export a singleton instance
export default new BCLTemplateService();
