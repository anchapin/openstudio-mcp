/**
 * BCL Template interfaces
 */

/**
 * BCL template interface
 */
export interface BCLTemplate {
  id: string;
  name: string;
  description: string;
  version: string;
  buildingType: string;
  climateZone: string;
  floorArea: number;
  stories: number;
  thumbnailUrl?: string;
  downloadUrl: string;
  tags: string[];
  attributes: BCLTemplateAttribute[];
}

/**
 * BCL template attribute interface
 */
export interface BCLTemplateAttribute {
  name: string;
  value: string;
  units?: string;
}

/**
 * BCL template search result
 */
export interface BCLTemplateSearchResult {
  templates: BCLTemplate[];
  totalResults: number;
  currentPage: number;
  totalPages: number;
}

/**
 * BCL template search options
 */
export interface BCLTemplateSearchOptions {
  query?: string;
  buildingType?: string;
  climateZone?: string;
  minFloorArea?: number;
  maxFloorArea?: number;
  stories?: number;
  vintage?: string;
  tags?: string[];
  sortBy?: 'name' | 'date' | 'popularity';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

/**
 * BCL template download result
 */
export interface BCLTemplateDownloadResult {
  success: boolean;
  templateId: string;
  localPath?: string;
  error?: string;
}

/**
 * BCL template application options
 */
export interface BCLTemplateApplicationOptions {
  templatePath: string;
  outputPath: string;
  modelOptions?: Partial<BCLTemplateApplicationModelOptions>;
}

/**
 * BCL template model application options
 */
export interface BCLTemplateApplicationModelOptions {
  modelName: string;
  weatherFilePath?: string;
  measuresToApply?: string[];
  additionalLoads?: BCLTemplateAdditionalLoad[];
}

/**
 * BCL template additional load
 */
export interface BCLTemplateAdditionalLoad {
  type: 'lighting' | 'equipment' | 'occupancy' | 'infiltration' | 'hvac';
  name: string;
  powerPerArea?: number;
  scheduleName?: string;
  fractionLatent?: number;
  fractionRadiant?: number;
  fractionLost?: number;
}
