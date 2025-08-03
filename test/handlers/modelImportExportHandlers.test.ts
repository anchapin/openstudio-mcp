/**
 * Tests for Model Import/Export Request Handlers
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RequestHandler } from '../../src/handlers/requestHandler';
import { ModelImportExportService } from '../../src/services/modelImportExportService';
import {
  ModelImportMCPRequest,
  ModelExportMCPRequest,
  BatchImportExportMCPRequest,
  FormatConversionMCPRequest,
  GetFormatCapabilitiesMCPRequest,
  ImportResult,
  ExportResult,
  BatchOperationResult,
  ConversionResult,
  FormatCapabilities,
} from '../../src/interfaces/modelImportExport';

// Mock dependencies
vi.mock('../../src/services/modelImportExportService');
vi.mock('../../src/services/commandProcessor');
vi.mock('../../src/services/bclApiClient');
vi.mock('../../src/services/advancedBclService');
vi.mock('../../src/services/workflowService');
vi.mock('../../src/services/enhancedMeasureService');
vi.mock('../../src/utils/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));
vi.mock('../../src/config', () => ({
  default: {
    bcl: { apiUrl: 'https://test-bcl-api.com' },
  },
}));

describe('Model Import/Export Request Handlers', () => {
  let requestHandler: RequestHandler;
  let mockModelImportExportService: ModelImportExportService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock service instance
    mockModelImportExportService = {
      importModel: vi.fn(),
      exportModel: vi.fn(),
      batchOperation: vi.fn(),
      convertFormat: vi.fn(),
      getFormatCapabilities: vi.fn(),
    } as unknown as ModelImportExportService;

    requestHandler = new RequestHandler();
    // Override the internal service with our mock
    (requestHandler as any).modelImportExportService = mockModelImportExportService;
  });

  describe('handleModelImport', () => {
    it('should handle model import request successfully', async () => {
      const mockResult: ImportResult = {
        success: true,
        importedModelPath: '/path/to/imported.osm',
        format: 'idf',
        metadata: {
          originalFileSize: 1024000,
          importedElements: 150,
          processingTime: 2500,
          memoryUsage: 50000000,
          openStudioVersion: '3.5.0',
        },
        statistics: {
          geometryElements: 25,
          thermalZones: 5,
          spaces: 12,
          surfaces: 45,
          subsurfaces: 8,
          materials: 15,
          constructions: 10,
          loads: 20,
          schedules: 8,
          hvacSystems: 2,
          plantLoops: 1,
        },
        warnings: ['Minor geometry issue detected'],
      };

      vi.mocked(mockModelImportExportService.importModel).mockResolvedValue(mockResult);

      const params: ModelImportMCPRequest = {
        importRequest: {
          filePath: '/path/to/source.idf',
          format: 'idf',
          targetModelPath: '/path/to/imported.osm',
          validationLevel: 'basic',
          importOptions: {
            importGeometry: true,
            importMaterials: true,
            convertUnits: true,
            targetUnits: 'SI',
          },
          validateOutput: true,
        },
      };

      const result = await (requestHandler as any).handleModelImport(params);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Successfully imported idf model');
      expect(result.output).toContain('/path/to/imported.osm');
      expect(result.output).toContain('2500ms');
      expect(result.output).toContain('1 warnings');
      expect(result.data).toEqual(mockResult);
      expect(mockModelImportExportService.importModel).toHaveBeenCalledWith(params.importRequest);
    });

    it('should handle missing importRequest parameter', async () => {
      const params = {} as ModelImportMCPRequest;

      const result = await (requestHandler as any).handleModelImport(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('importRequest is required');
      expect(mockModelImportExportService.importModel).not.toHaveBeenCalled();
    });

    it('should handle import service failure', async () => {
      const mockResult: ImportResult = {
        success: false,
        format: 'idf',
        metadata: {
          originalFileSize: 0,
          importedElements: 0,
          processingTime: 100,
          memoryUsage: 50000000,
          openStudioVersion: '3.5.0',
        },
        errors: ['Invalid IDF file format'],
      };

      vi.mocked(mockModelImportExportService.importModel).mockResolvedValue(mockResult);

      const params: ModelImportMCPRequest = {
        importRequest: {
          filePath: '/path/to/invalid.idf',
          format: 'idf',
        },
      };

      const result = await (requestHandler as any).handleModelImport(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid IDF file format');
    });

    it('should handle import service errors', async () => {
      vi.mocked(mockModelImportExportService.importModel).mockRejectedValue(
        new Error('Service unavailable'),
      );

      const params: ModelImportMCPRequest = {
        importRequest: {
          filePath: '/path/to/model.osm',
          format: 'osm',
        },
      };

      const result = await (requestHandler as any).handleModelImport(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Service unavailable');
    });

    it('should handle import with validation results', async () => {
      const mockResult: ImportResult = {
        success: true,
        importedModelPath: '/path/to/imported.osm',
        format: 'gbxml',
        validation: {
          isValid: true,
          warnings: [
            {
              severity: 'warning',
              category: 'geometry',
              message: 'Minor surface overlap detected',
            },
          ],
          errors: [
            {
              severity: 'error',
              category: 'materials',
              message: 'Missing material properties',
            },
          ],
          summary: {
            totalIssues: 2,
            criticalErrors: 1,
            warnings: 1,
            elementsChecked: 100,
            validationTime: 500,
          },
        },
        metadata: {
          originalFileSize: 2048000,
          importedElements: 200,
          processingTime: 3000,
          memoryUsage: 75000000,
          openStudioVersion: '3.5.0',
        },
      };

      vi.mocked(mockModelImportExportService.importModel).mockResolvedValue(mockResult);

      const params: ModelImportMCPRequest = {
        importRequest: {
          filePath: '/path/to/model.gbxml',
          format: 'gbxml',
          validateOutput: true,
        },
      };

      const result = await (requestHandler as any).handleModelImport(params);

      expect(result.success).toBe(true);
      expect(result.output).toContain('(validation: 1 errors, 1 warnings)');
    });
  });

  describe('handleModelExport', () => {
    it('should handle model export request successfully', async () => {
      const mockResult: ExportResult = {
        success: true,
        exportedFilePath: '/path/to/exported.idf',
        format: 'idf',
        metadata: {
          exportedFileSize: 1536000,
          exportedElements: 175,
          processingTime: 1800,
          memoryUsage: 60000000,
          openStudioVersion: '3.5.0',
        },
        statistics: {
          geometryElements: 30,
          thermalZones: 6,
          spaces: 15,
          surfaces: 50,
          subsurfaces: 10,
          materials: 18,
          constructions: 12,
          loads: 25,
          schedules: 10,
          hvacSystems: 3,
          plantLoops: 2,
        },
      };

      vi.mocked(mockModelImportExportService.exportModel).mockResolvedValue(mockResult);

      const params: ModelExportMCPRequest = {
        exportRequest: {
          sourceModelPath: '/path/to/source.osm',
          filePath: '/path/to/exported.idf',
          format: 'idf',
          detailLevel: 'detailed',
          exportOptions: {
            includeGeometry: true,
            includeHVACSystems: true,
            includeOutputVariables: true,
            prettyFormat: true,
          },
        },
      };

      const result = await (requestHandler as any).handleModelExport(params);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Successfully exported idf model');
      expect(result.output).toContain('/path/to/exported.idf');
      expect(result.output).toContain('1800ms');
      expect(result.data).toEqual(mockResult);
      expect(mockModelImportExportService.exportModel).toHaveBeenCalledWith(params.exportRequest);
    });

    it('should handle missing exportRequest parameter', async () => {
      const params = {} as ModelExportMCPRequest;

      const result = await (requestHandler as any).handleModelExport(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('exportRequest is required');
    });

    it('should handle export with report generation', async () => {
      const mockResult: ExportResult = {
        success: true,
        exportedFilePath: '/path/to/exported.pdf',
        format: 'pdf',
        reportPath: '/path/to/report.pdf',
        metadata: {
          exportedFileSize: 5120000,
          exportedElements: 0,
          processingTime: 5000,
          memoryUsage: 80000000,
          openStudioVersion: '3.5.0',
        },
      };

      vi.mocked(mockModelImportExportService.exportModel).mockResolvedValue(mockResult);

      const params: ModelExportMCPRequest = {
        exportRequest: {
          sourceModelPath: '/path/to/source.osm',
          filePath: '/path/to/exported.pdf',
          format: 'pdf',
          exportOptions: {
            reportOptions: {
              includeImages: true,
              includeTables: true,
              includeCharts: true,
              outputFormat: 'pdf',
            },
          },
        },
      };

      const result = await (requestHandler as any).handleModelExport(params);

      expect(result.success).toBe(true);
      expect(result.output).toContain('and report at /path/to/report.pdf');
    });

    it('should handle export service failure', async () => {
      const mockResult: ExportResult = {
        success: false,
        format: 'idf',
        metadata: {
          exportedFileSize: 0,
          exportedElements: 0,
          processingTime: 200,
          memoryUsage: 50000000,
          openStudioVersion: '3.5.0',
        },
        errors: ['Source model could not be loaded'],
      };

      vi.mocked(mockModelImportExportService.exportModel).mockResolvedValue(mockResult);

      const params: ModelExportMCPRequest = {
        exportRequest: {
          sourceModelPath: '/path/to/invalid.osm',
          filePath: '/path/to/exported.idf',
          format: 'idf',
        },
      };

      const result = await (requestHandler as any).handleModelExport(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Source model could not be loaded');
    });
  });

  describe('handleBatchOperations', () => {
    it('should handle batch operations request successfully', async () => {
      const mockResult: BatchOperationResult = {
        success: true,
        totalOperations: 3,
        successfulOperations: 2,
        failedOperations: 1,
        results: [
          {
            operation: 'import',
            format: 'idf',
            filePath: '/path/to/model1.idf',
            success: true,
            result: {
              success: true,
              format: 'idf',
              importedModelPath: '/path/to/imported1.osm',
              metadata: {
                originalFileSize: 1024000,
                importedElements: 100,
                processingTime: 2000,
                memoryUsage: 50000000,
                openStudioVersion: '3.5.0',
              },
            },
          },
          {
            operation: 'export',
            format: 'gbxml',
            filePath: '/path/to/exported.gbxml',
            success: true,
            result: {
              success: true,
              format: 'gbxml',
              exportedFilePath: '/path/to/exported.gbxml',
              metadata: {
                exportedFileSize: 2048000,
                exportedElements: 150,
                processingTime: 3000,
                memoryUsage: 60000000,
                openStudioVersion: '3.5.0',
              },
            },
          },
          {
            operation: 'import',
            format: 'idf',
            filePath: '/path/to/invalid.idf',
            success: false,
            error: 'Invalid file format',
          },
        ],
        summary: {
          totalProcessingTime: 8000,
          totalFilesProcessed: 3,
          totalFileSize: 3072000,
          averageProcessingTime: 2666.67,
        },
        reportPath: '/path/to/batch_report.html',
      };

      vi.mocked(mockModelImportExportService.batchOperation).mockResolvedValue(mockResult);

      const params: BatchImportExportMCPRequest = {
        batchRequest: {
          operations: [
            {
              operation: 'import',
              request: {
                filePath: '/path/to/model1.idf',
                format: 'idf',
              },
              priority: 1,
            },
            {
              operation: 'export',
              request: {
                sourceModelPath: '/path/to/source.osm',
                filePath: '/path/to/exported.gbxml',
                format: 'gbxml',
              },
              priority: 2,
            },
            {
              operation: 'import',
              request: {
                filePath: '/path/to/invalid.idf',
                format: 'idf',
              },
              priority: 1,
            },
          ],
          parallelProcessing: true,
          maxConcurrentOperations: 2,
          continueOnError: true,
          generateReport: true,
        },
      };

      const result = await (requestHandler as any).handleBatchOperations(params);

      expect(result.success).toBe(true);
      expect(result.output).toContain(
        'Batch operation completed: 2/3 operations successful (66.7%)',
      );
      expect(result.output).toContain('8000ms');
      expect(result.output).toContain('Report available at: /path/to/batch_report.html');
      expect(result.data).toEqual(mockResult);
    });

    it('should handle missing batchRequest parameter', async () => {
      const params = {} as BatchImportExportMCPRequest;

      const result = await (requestHandler as any).handleBatchOperations(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('batchRequest is required');
    });

    it('should handle empty operations array', async () => {
      const params: BatchImportExportMCPRequest = {
        batchRequest: {
          operations: [],
        },
      };

      const result = await (requestHandler as any).handleBatchOperations(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('At least one operation is required');
    });

    it('should handle batch operations service errors', async () => {
      vi.mocked(mockModelImportExportService.batchOperation).mockRejectedValue(
        new Error('Batch service error'),
      );

      const params: BatchImportExportMCPRequest = {
        batchRequest: {
          operations: [
            {
              operation: 'import',
              request: {
                filePath: '/path/to/model.osm',
                format: 'osm',
              },
            },
          ],
        },
      };

      const result = await (requestHandler as any).handleBatchOperations(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Batch service error');
    });
  });

  describe('handleFormatConversion', () => {
    it('should handle format conversion request successfully', async () => {
      const mockResult: ConversionResult = {
        success: true,
        sourceFormat: 'osm',
        targetFormat: 'idf',
        sourceFilePath: '/path/to/source.osm',
        targetFilePath: '/path/to/target.idf',
        metadata: {
          sourceFileSize: 2048000,
          targetFileSize: 1536000,
          processingTime: 3500,
          memoryUsage: 70000000,
          compressionRatio: 1.33,
        },
        mappingReport: {
          mappedElements: 180,
          unmappedElements: 5,
          modifiedElements: 20,
          elementMappings: [
            {
              sourceElement: 'Space',
              targetElement: 'Zone',
              mappingType: 'converted',
              notes: 'Combined thermal zones',
            },
          ],
        },
        validation: {
          isValid: true,
          warnings: [],
          errors: [],
          summary: {
            totalIssues: 0,
            criticalErrors: 0,
            warnings: 0,
            elementsChecked: 180,
            validationTime: 800,
          },
        },
      };

      vi.mocked(mockModelImportExportService.convertFormat).mockResolvedValue(mockResult);

      const params: FormatConversionMCPRequest = {
        conversionRequest: {
          sourceFilePath: '/path/to/source.osm',
          sourceFormat: 'osm',
          targetFilePath: '/path/to/target.idf',
          targetFormat: 'idf',
          conversionOptions: {
            validationLevel: 'basic',
            preserveMetadata: true,
            optimizeOutput: true,
            includeValidationReport: true,
          },
        },
      };

      const result = await (requestHandler as any).handleFormatConversion(params);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Successfully converted osm to idf');
      expect(result.output).toContain('3500ms');
      expect(result.output).toContain('(compression ratio: 1.33)');
      expect(result.output).toContain('Mapped 180 elements, skipped 5');
      expect(result.output).toContain('Validation: 0 errors, 0 warnings');
      expect(result.data).toEqual(mockResult);
    });

    it('should handle missing conversionRequest parameter', async () => {
      const params = {} as FormatConversionMCPRequest;

      const result = await (requestHandler as any).handleFormatConversion(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('conversionRequest is required');
    });

    it('should handle format conversion failure', async () => {
      const mockResult: ConversionResult = {
        success: false,
        sourceFormat: 'osm',
        targetFormat: 'idf',
        sourceFilePath: '/path/to/source.osm',
        targetFilePath: '/path/to/target.idf',
        metadata: {
          sourceFileSize: 2048000,
          targetFileSize: 0,
          processingTime: 500,
          memoryUsage: 50000000,
        },
        errors: ['Unsupported feature in source model'],
      };

      vi.mocked(mockModelImportExportService.convertFormat).mockResolvedValue(mockResult);

      const params: FormatConversionMCPRequest = {
        conversionRequest: {
          sourceFilePath: '/path/to/source.osm',
          sourceFormat: 'osm',
          targetFilePath: '/path/to/target.idf',
          targetFormat: 'idf',
        },
      };

      const result = await (requestHandler as any).handleFormatConversion(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unsupported feature in source model');
    });

    it('should handle conversion service errors', async () => {
      vi.mocked(mockModelImportExportService.convertFormat).mockRejectedValue(
        new Error('Conversion service error'),
      );

      const params: FormatConversionMCPRequest = {
        conversionRequest: {
          sourceFilePath: '/path/to/source.osm',
          sourceFormat: 'osm',
          targetFilePath: '/path/to/target.idf',
          targetFormat: 'idf',
        },
      };

      const result = await (requestHandler as any).handleFormatConversion(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Conversion service error');
    });
  });

  describe('handleFormatCapabilities', () => {
    it('should handle format capabilities request for specific format', async () => {
      const mockCapabilities: FormatCapabilities = {
        format: 'osm',
        name: 'OpenStudio Model',
        description: 'Native OpenStudio model format',
        fileExtensions: ['.osm'],
        supportsImport: true,
        supportsExport: true,
        supportedFeatures: {
          geometry: true,
          materials: true,
          constructions: true,
          loads: true,
          schedules: true,
          thermalZones: true,
          hvacSystems: true,
          plantLoops: true,
          results: false,
          metadata: true,
        },
        recommendedUse: ['Primary OpenStudio workflows', 'Model development'],
      };

      vi.mocked(mockModelImportExportService.getFormatCapabilities).mockReturnValue(
        mockCapabilities,
      );

      const params: GetFormatCapabilitiesMCPRequest = {
        format: 'osm',
      };

      const result = await (requestHandler as any).handleFormatCapabilities(params);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Retrieved capabilities for osm format');
      expect(result.data).toEqual({ format: mockCapabilities });
      expect(mockModelImportExportService.getFormatCapabilities).toHaveBeenCalledWith('osm');
    });

    it('should handle format capabilities request for all formats', async () => {
      const mockCapabilities: FormatCapabilities[] = [
        {
          format: 'osm',
          name: 'OpenStudio Model',
          description: 'Native OpenStudio model format',
          fileExtensions: ['.osm'],
          supportsImport: true,
          supportsExport: true,
          supportedFeatures: {
            geometry: true,
            materials: true,
            constructions: true,
            loads: true,
            schedules: true,
            thermalZones: true,
            hvacSystems: true,
            plantLoops: true,
            results: false,
            metadata: true,
          },
        },
        {
          format: 'idf',
          name: 'EnergyPlus Input Data Format',
          description: 'EnergyPlus simulation input file format',
          fileExtensions: ['.idf'],
          supportsImport: true,
          supportsExport: true,
          supportedFeatures: {
            geometry: true,
            materials: true,
            constructions: true,
            loads: true,
            schedules: true,
            thermalZones: true,
            hvacSystems: true,
            plantLoops: true,
            results: false,
            metadata: false,
          },
        },
      ];

      vi.mocked(mockModelImportExportService.getFormatCapabilities).mockReturnValue(
        mockCapabilities,
      );

      const params: GetFormatCapabilitiesMCPRequest = {
        includeAll: true,
      };

      const result = await (requestHandler as any).handleFormatCapabilities(params);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Retrieved capabilities for 2 supported formats');
      expect(result.data).toEqual({ formats: mockCapabilities });
      expect(mockModelImportExportService.getFormatCapabilities).toHaveBeenCalledWith(undefined);
    });

    it('should handle format capabilities service errors', async () => {
      vi.mocked(mockModelImportExportService.getFormatCapabilities).mockImplementation(() => {
        throw new Error('Unsupported format: xyz');
      });

      const params: GetFormatCapabilitiesMCPRequest = {
        format: 'xyz' as any,
      };

      const result = await (requestHandler as any).handleFormatCapabilities(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unsupported format: xyz');
    });
  });
});
