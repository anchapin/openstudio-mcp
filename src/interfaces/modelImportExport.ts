/**
 * Interfaces for Model Import/Export functionality
 * Supports multiple file formats for comprehensive model conversion
 */

// Supported import/export formats
export type ModelFormat =
  | 'osm' // OpenStudio Model
  | 'idf' // EnergyPlus Input Data Format
  | 'gbxml' // Green Building XML
  | 'ifc' // Industry Foundation Classes
  | 'sdd' // Simulation Domain Data (ASHRAE 90.1)
  | 'json' // JSON representation
  | 'xml' // Generic XML format
  | 'csv' // CSV data export
  | 'xlsx' // Excel format for data export
  | 'pdf' // PDF report generation
  | 'html'; // HTML report generation

// Import/export operation types
export type OperationType = 'import' | 'export';

// Validation levels for import operations
export type ValidationLevel = 'none' | 'basic' | 'strict' | 'comprehensive';

// Export detail levels
export type ExportDetailLevel = 'minimal' | 'standard' | 'detailed' | 'complete';

/**
 * Base interface for import/export requests
 */
export interface BaseImportExportRequest {
  filePath: string;
  format: ModelFormat;
  options?: Record<string, unknown>;
  validateOutput?: boolean;
  backupOriginal?: boolean;
}

/**
 * Model import request interface
 */
export interface ModelImportRequest extends BaseImportExportRequest {
  targetModelPath?: string;
  validationLevel?: ValidationLevel;
  preserveGuids?: boolean;
  importOptions?: {
    mergeWithExisting?: boolean;
    overwriteExisting?: boolean;
    createBackup?: boolean;
    ignoreErrors?: boolean;
    convertUnits?: boolean;
    targetUnits?: 'SI' | 'IP';
    importGeometry?: boolean;
    importLoads?: boolean;
    importSchedules?: boolean;
    importMaterials?: boolean;
    importConstructions?: boolean;
    importThermalZones?: boolean;
    importHVACSystems?: boolean;
    importPlantLoops?: boolean;
    customImportSettings?: Record<string, unknown>;
  };
}

/**
 * Model export request interface
 */
export interface ModelExportRequest extends BaseImportExportRequest {
  sourceModelPath: string;
  detailLevel?: ExportDetailLevel;
  exportOptions?: {
    includeGeometry?: boolean;
    includeLoads?: boolean;
    includeSchedules?: boolean;
    includeMaterials?: boolean;
    includeConstructions?: boolean;
    includeThermalZones?: boolean;
    includeHVACSystems?: boolean;
    includePlantLoops?: boolean;
    includeOutputVariables?: boolean;
    includeResults?: boolean;
    includeMetadata?: boolean;
    compressionLevel?: number;
    prettyFormat?: boolean;
    includeComments?: boolean;
    customExportSettings?: Record<string, unknown>;
    reportOptions?: {
      includeImages?: boolean;
      includeTables?: boolean;
      includeCharts?: boolean;
      templatePath?: string;
      outputFormat?: 'pdf' | 'html' | 'docx';
    };
  };
}

/**
 * Batch operation request for multiple files
 */
export interface BatchImportExportRequest {
  operations: Array<{
    operation: OperationType;
    request: ModelImportRequest | ModelExportRequest;
    priority?: number;
  }>;
  parallelProcessing?: boolean;
  maxConcurrentOperations?: number;
  continueOnError?: boolean;
  generateReport?: boolean;
}

/**
 * Format conversion request
 */
export interface FormatConversionRequest {
  sourceFilePath: string;
  sourceFormat: ModelFormat;
  targetFilePath: string;
  targetFormat: ModelFormat;
  conversionOptions?: {
    validationLevel?: ValidationLevel;
    preserveMetadata?: boolean;
    optimizeOutput?: boolean;
    includeValidationReport?: boolean;
    customMappings?: Record<string, unknown>;
  };
}

/**
 * Validation result for imported/exported models
 */
export interface ValidationResult {
  isValid: boolean;
  warnings: ValidationIssue[];
  errors: ValidationIssue[];
  summary: {
    totalIssues: number;
    criticalErrors: number;
    warnings: number;
    elementsChecked: number;
    validationTime: number;
  };
}

/**
 * Individual validation issue
 */
export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  category: string;
  message: string;
  elementId?: string;
  elementType?: string;
  location?: string;
  suggestions?: string[];
}

/**
 * Import operation result
 */
export interface ImportResult {
  success: boolean;
  importedModelPath?: string;
  format: ModelFormat;
  validation?: ValidationResult;
  metadata: {
    originalFileSize: number;
    importedElements: number;
    processingTime: number;
    memoryUsage: number;
    openStudioVersion: string;
  };
  statistics?: {
    geometryElements: number;
    thermalZones: number;
    spaces: number;
    surfaces: number;
    subsurfaces: number;
    materials: number;
    constructions: number;
    loads: number;
    schedules: number;
    hvacSystems: number;
    plantLoops: number;
  };
  warnings?: string[];
  errors?: string[];
  conversionLog?: string[];
}

/**
 * Export operation result
 */
export interface ExportResult {
  success: boolean;
  exportedFilePath?: string;
  format: ModelFormat;
  validation?: ValidationResult;
  metadata: {
    exportedFileSize: number;
    exportedElements: number;
    processingTime: number;
    memoryUsage: number;
    openStudioVersion: string;
  };
  statistics?: {
    geometryElements: number;
    thermalZones: number;
    spaces: number;
    surfaces: number;
    subsurfaces: number;
    materials: number;
    constructions: number;
    loads: number;
    schedules: number;
    hvacSystems: number;
    plantLoops: number;
  };
  warnings?: string[];
  errors?: string[];
  conversionLog?: string[];
  reportPath?: string;
}

/**
 * Batch operation result
 */
export interface BatchOperationResult {
  success: boolean;
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  results: Array<{
    operation: OperationType;
    format: ModelFormat;
    filePath: string;
    success: boolean;
    result?: ImportResult | ExportResult;
    error?: string;
  }>;
  summary: {
    totalProcessingTime: number;
    totalFilesProcessed: number;
    totalFileSize: number;
    averageProcessingTime: number;
  };
  reportPath?: string;
}

/**
 * Format conversion result
 */
export interface ConversionResult {
  success: boolean;
  sourceFormat: ModelFormat;
  targetFormat: ModelFormat;
  sourceFilePath: string;
  targetFilePath: string;
  validation?: ValidationResult;
  metadata: {
    sourceFileSize: number;
    targetFileSize: number;
    processingTime: number;
    memoryUsage: number;
    compressionRatio?: number;
  };
  mappingReport?: {
    mappedElements: number;
    unmappedElements: number;
    modifiedElements: number;
    elementMappings: Array<{
      sourceElement: string;
      targetElement: string;
      mappingType: 'direct' | 'converted' | 'approximated' | 'skipped';
      notes?: string;
    }>;
  };
  warnings?: string[];
  errors?: string[];
}

/**
 * Format capabilities and support information
 */
export interface FormatCapabilities {
  format: ModelFormat;
  name: string;
  description: string;
  fileExtensions: string[];
  supportsImport: boolean;
  supportsExport: boolean;
  supportedFeatures: {
    geometry: boolean;
    materials: boolean;
    constructions: boolean;
    loads: boolean;
    schedules: boolean;
    thermalZones: boolean;
    hvacSystems: boolean;
    plantLoops: boolean;
    results: boolean;
    metadata: boolean;
  };
  limitations?: string[];
  recommendedUse?: string[];
}

/**
 * Quality assurance settings for import/export operations
 */
export interface QualityAssuranceSettings {
  enableValidation: boolean;
  validationLevel: ValidationLevel;
  autoFix: boolean;
  generateReport: boolean;
  customValidationRules?: Array<{
    ruleName: string;
    ruleType: 'geometry' | 'energy' | 'hvac' | 'envelope' | 'custom';
    severity: 'error' | 'warning' | 'info';
    enabled: boolean;
    parameters?: Record<string, unknown>;
  }>;
}

/**
 * Performance monitoring for import/export operations
 */
export interface PerformanceMetrics {
  operationType: OperationType;
  format: ModelFormat;
  fileSize: number;
  processingTime: number;
  memoryUsage: {
    peak: number;
    average: number;
    final: number;
  };
  cpuUsage: {
    peak: number;
    average: number;
  };
  ioOperations: {
    reads: number;
    writes: number;
    totalBytes: number;
  };
  cacheHits?: number;
  cacheMisses?: number;
}

/**
 * Import/Export service configuration
 */
export interface ImportExportConfig {
  defaultValidationLevel: ValidationLevel;
  defaultExportDetailLevel: ExportDetailLevel;
  enableBackups: boolean;
  backupDirectory: string;
  maxFileSize: number;
  maxConcurrentOperations: number;
  timeoutDuration: number;
  enableCaching: boolean;
  cacheDirectory: string;
  enablePerformanceMonitoring: boolean;
  supportedFormats: ModelFormat[];
  qualityAssurance: QualityAssuranceSettings;
}

/**
 * MCP request interfaces for import/export operations
 */
export interface ModelImportMCPRequest {
  importRequest: ModelImportRequest;
}

export interface ModelExportMCPRequest {
  exportRequest: ModelExportRequest;
}

export interface BatchImportExportMCPRequest {
  batchRequest: BatchImportExportRequest;
}

export interface FormatConversionMCPRequest {
  conversionRequest: FormatConversionRequest;
}

export interface GetFormatCapabilitiesMCPRequest {
  format?: ModelFormat;
  includeAll?: boolean;
}
