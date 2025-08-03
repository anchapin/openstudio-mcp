/**
 * Tests for Model Import/Export Service
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { ModelImportExportService } from '../../src/services/modelImportExportService';
import { OpenStudioCommandProcessor } from '../../src/services/commandProcessor';
import {
  ModelImportRequest,
  ModelExportRequest,
  BatchImportExportRequest,
  FormatConversionRequest,
  ModelFormat,
} from '../../src/interfaces/modelImportExport';

// Mock dependencies
vi.mock('../../src/services/commandProcessor');
vi.mock('../../src/utils/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));
vi.mock('fs', () => ({
  promises: {
    stat: vi.fn(),
    access: vi.fn(),
    copyFile: vi.fn(),
    writeFile: vi.fn(),
  },
}));

describe('ModelImportExportService', () => {
  let modelImportExportService: ModelImportExportService;
  let mockCommandProcessor: OpenStudioCommandProcessor;
  let mockFs: typeof fs;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock command processor
    mockCommandProcessor = {
      executeCommand: vi.fn(),
    } as unknown as OpenStudioCommandProcessor;

    // Mock fs
    mockFs = fs as unknown as typeof fs;
    vi.mocked(mockFs.stat).mockResolvedValue({
      size: 1024000,
      isFile: () => true,
      isDirectory: () => false,
    } as any);
    vi.mocked(mockFs.access).mockResolvedValue(undefined);
    vi.mocked(mockFs.copyFile).mockResolvedValue(undefined);
    vi.mocked(mockFs.writeFile).mockResolvedValue(undefined);

    modelImportExportService = new ModelImportExportService();
    // Override the internal command processor with our mock
    (modelImportExportService as any).commandProcessor = mockCommandProcessor;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('importModel', () => {
    it('should successfully import an OSM model', async () => {
      const request: ModelImportRequest = {
        filePath: '/path/to/model.osm',
        format: 'osm',
        targetModelPath: '/path/to/imported.osm',
        validateOutput: true,
      };

      vi.mocked(mockCommandProcessor.executeCommand).mockResolvedValue({
        success: true,
        output: 'Model imported successfully',
        error: '',
      });

      const result = await modelImportExportService.importModel(request);

      expect(result.success).toBe(true);
      expect(result.format).toBe('osm');
      expect(result.importedModelPath).toBe('/path/to/imported.osm');
      expect(result.metadata.processingTime).toBeGreaterThan(0);
      expect(mockCommandProcessor.executeCommand).toHaveBeenCalled();
    });

    it('should successfully import an IDF model', async () => {
      const request: ModelImportRequest = {
        filePath: '/path/to/model.idf',
        format: 'idf',
        targetModelPath: '/path/to/imported.osm',
        validationLevel: 'strict',
      };

      vi.mocked(mockCommandProcessor.executeCommand).mockResolvedValue({
        success: true,
        output: 'IDF model converted successfully',
        error: '',
      });

      const result = await modelImportExportService.importModel(request);

      expect(result.success).toBe(true);
      expect(result.format).toBe('idf');
      expect(result.importedModelPath).toBe('/path/to/imported.osm');
      expect(mockCommandProcessor.executeCommand).toHaveBeenCalledWith(
        expect.stringContaining('ReverseTranslator'),
        expect.any(Object),
      );
    });

    it('should successfully import a gbXML model', async () => {
      const request: ModelImportRequest = {
        filePath: '/path/to/model.gbxml',
        format: 'gbxml',
        importOptions: {
          importGeometry: true,
          importMaterials: true,
          convertUnits: true,
          targetUnits: 'SI',
        },
      };

      vi.mocked(mockCommandProcessor.executeCommand).mockResolvedValue({
        success: true,
        output: 'gbXML model converted successfully',
        error: '',
      });

      const result = await modelImportExportService.importModel(request);

      expect(result.success).toBe(true);
      expect(result.format).toBe('gbxml');
      expect(mockCommandProcessor.executeCommand).toHaveBeenCalledWith(
        expect.stringContaining('GbXMLReverseTranslator'),
        expect.any(Object),
      );
    });

    it('should handle import errors gracefully', async () => {
      const request: ModelImportRequest = {
        filePath: '/path/to/invalid.osm',
        format: 'osm',
      };

      vi.mocked(mockCommandProcessor.executeCommand).mockResolvedValue({
        success: false,
        output: '',
        error: 'Invalid model file',
      });

      const result = await modelImportExportService.importModel(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('OSM import failed: Invalid model file');
    });

    it('should validate input parameters', async () => {
      const request: ModelImportRequest = {
        filePath: '',
        format: 'osm',
      };

      const result = await modelImportExportService.importModel(request);

      expect(result.success).toBe(false);
      expect(result.errors?.[0]).toContain('File path is required');
    });

    it('should check file size limits', async () => {
      const request: ModelImportRequest = {
        filePath: '/path/to/huge.osm',
        format: 'osm',
      };

      // Mock large file size
      vi.mocked(mockFs.stat).mockResolvedValue({
        size: 200 * 1024 * 1024, // 200MB
        isFile: () => true,
        isDirectory: () => false,
      } as any);

      const result = await modelImportExportService.importModel(request);

      expect(result.success).toBe(false);
      expect(result.errors?.[0]).toContain('exceeds maximum allowed size');
    });

    it('should handle file not found errors', async () => {
      const request: ModelImportRequest = {
        filePath: '/path/to/nonexistent.osm',
        format: 'osm',
      };

      vi.mocked(mockFs.access).mockRejectedValue(new Error('File not found'));

      const result = await modelImportExportService.importModel(request);

      expect(result.success).toBe(false);
      expect(result.errors?.[0]).toContain('File not found');
    });

    it('should create backup when requested', async () => {
      const request: ModelImportRequest = {
        filePath: '/path/to/model.osm',
        format: 'osm',
        backupOriginal: true,
      };

      vi.mocked(mockCommandProcessor.executeCommand).mockResolvedValue({
        success: true,
        output: 'Model imported successfully',
        error: '',
      });

      const result = await modelImportExportService.importModel(request);

      expect(result.success).toBe(true);
      expect(mockFs.copyFile).toHaveBeenCalledWith(
        '/path/to/model.osm',
        expect.stringMatching(/.*\.backup\.\d+$/),
      );
    });
  });

  describe('exportModel', () => {
    it('should successfully export to OSM format', async () => {
      const request: ModelExportRequest = {
        sourceModelPath: '/path/to/source.osm',
        filePath: '/path/to/exported.osm',
        format: 'osm',
        detailLevel: 'complete',
      };

      const result = await modelImportExportService.exportModel(request);

      expect(result.success).toBe(true);
      expect(result.format).toBe('osm');
      expect(result.exportedFilePath).toBe('/path/to/exported.osm');
      expect(mockFs.copyFile).toHaveBeenCalledWith('/path/to/source.osm', '/path/to/exported.osm');
    });

    it('should successfully export to IDF format', async () => {
      const request: ModelExportRequest = {
        sourceModelPath: '/path/to/source.osm',
        filePath: '/path/to/exported.idf',
        format: 'idf',
        exportOptions: {
          includeGeometry: true,
          includeHVACSystems: true,
          prettyFormat: true,
        },
      };

      vi.mocked(mockCommandProcessor.executeCommand).mockResolvedValue({
        success: true,
        output: 'IDF export successful',
        error: '',
      });

      const result = await modelImportExportService.exportModel(request);

      expect(result.success).toBe(true);
      expect(result.format).toBe('idf');
      expect(result.exportedFilePath).toBe('/path/to/exported.idf');
      expect(mockCommandProcessor.executeCommand).toHaveBeenCalledWith(
        expect.stringContaining('ForwardTranslator'),
        expect.any(Object),
      );
    });

    it('should successfully export to gbXML format', async () => {
      const request: ModelExportRequest = {
        sourceModelPath: '/path/to/source.osm',
        filePath: '/path/to/exported.gbxml',
        format: 'gbxml',
        exportOptions: {
          includeGeometry: true,
          includeMaterials: true,
          includeMetadata: true,
        },
      };

      vi.mocked(mockCommandProcessor.executeCommand).mockResolvedValue({
        success: true,
        output: 'gbXML export successful',
        error: '',
      });

      const result = await modelImportExportService.exportModel(request);

      expect(result.success).toBe(true);
      expect(result.format).toBe('gbxml');
      expect(result.exportedFilePath).toBe('/path/to/exported.gbxml');
      expect(mockCommandProcessor.executeCommand).toHaveBeenCalledWith(
        expect.stringContaining('GbXMLForwardTranslator'),
        expect.any(Object),
      );
    });

    it('should successfully export to JSON format', async () => {
      const request: ModelExportRequest = {
        sourceModelPath: '/path/to/source.osm',
        filePath: '/path/to/exported.json',
        format: 'json',
        exportOptions: {
          prettyFormat: true,
          includeMetadata: true,
        },
      };

      vi.mocked(mockCommandProcessor.executeCommand).mockResolvedValue({
        success: true,
        output: 'JSON export successful',
        error: '',
      });

      const result = await modelImportExportService.exportModel(request);

      expect(result.success).toBe(true);
      expect(result.format).toBe('json');
      expect(result.exportedFilePath).toBe('/path/to/exported.json');
    });

    it('should successfully export to CSV format', async () => {
      const request: ModelExportRequest = {
        sourceModelPath: '/path/to/source.osm',
        filePath: '/path/to/exported.csv',
        format: 'csv',
        exportOptions: {
          includeResults: true,
        },
      };

      const result = await modelImportExportService.exportModel(request);

      expect(result.success).toBe(true);
      expect(result.format).toBe('csv');
      expect(result.exportedFilePath).toBe('/path/to/exported.csv');
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should successfully export to PDF format', async () => {
      const request: ModelExportRequest = {
        sourceModelPath: '/path/to/source.osm',
        filePath: '/path/to/exported.pdf',
        format: 'pdf',
        exportOptions: {
          reportOptions: {
            includeImages: true,
            includeTables: true,
            includeCharts: true,
          },
        },
      };

      const result = await modelImportExportService.exportModel(request);

      expect(result.success).toBe(true);
      expect(result.format).toBe('pdf');
      expect(result.exportedFilePath).toBe('/path/to/exported.pdf');
      expect(result.reportPath).toBeDefined();
    });

    it('should handle export errors gracefully', async () => {
      const request: ModelExportRequest = {
        sourceModelPath: '/path/to/invalid.osm',
        filePath: '/path/to/exported.idf',
        format: 'idf',
      };

      vi.mocked(mockCommandProcessor.executeCommand).mockResolvedValue({
        success: false,
        output: '',
        error: 'Export failed',
      });

      const result = await modelImportExportService.exportModel(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('IDF export failed: Export failed');
    });

    it('should validate export parameters', async () => {
      const request: ModelExportRequest = {
        sourceModelPath: '',
        filePath: '/path/to/exported.idf',
        format: 'idf',
      };

      const result = await modelImportExportService.exportModel(request);

      expect(result.success).toBe(false);
      expect(result.errors?.[0]).toContain('Source model path is required');
    });
  });

  describe('batchOperation', () => {
    it('should successfully process batch operations sequentially', async () => {
      const request: BatchImportExportRequest = {
        operations: [
          {
            operation: 'import',
            request: {
              filePath: '/path/to/model1.idf',
              format: 'idf' as ModelFormat,
            },
          },
          {
            operation: 'export',
            request: {
              sourceModelPath: '/path/to/model2.osm',
              filePath: '/path/to/exported.gbxml',
              format: 'gbxml' as ModelFormat,
            },
          },
        ],
        parallelProcessing: false,
        continueOnError: true,
        generateReport: true,
      };

      vi.mocked(mockCommandProcessor.executeCommand).mockResolvedValue({
        success: true,
        output: 'Operation successful',
        error: '',
      });

      const result = await modelImportExportService.batchOperation(request);

      expect(result.success).toBe(true);
      expect(result.totalOperations).toBe(2);
      expect(result.successfulOperations).toBe(2);
      expect(result.failedOperations).toBe(0);
      expect(result.results).toHaveLength(2);
      expect(result.reportPath).toBeDefined();
    });

    it('should successfully process batch operations in parallel', async () => {
      const request: BatchImportExportRequest = {
        operations: [
          {
            operation: 'import',
            request: {
              filePath: '/path/to/model1.osm',
              format: 'osm' as ModelFormat,
            },
            priority: 1,
          },
          {
            operation: 'import',
            request: {
              filePath: '/path/to/model2.osm',
              format: 'osm' as ModelFormat,
            },
            priority: 2,
          },
        ],
        parallelProcessing: true,
        maxConcurrentOperations: 2,
      };

      vi.mocked(mockCommandProcessor.executeCommand).mockResolvedValue({
        success: true,
        output: 'Operation successful',
        error: '',
      });

      const result = await modelImportExportService.batchOperation(request);

      expect(result.success).toBe(true);
      expect(result.totalOperations).toBe(2);
      expect(result.successfulOperations).toBe(2);
    });

    it('should handle errors and continue when continueOnError is true', async () => {
      const request: BatchImportExportRequest = {
        operations: [
          {
            operation: 'import',
            request: {
              filePath: '/path/to/valid.osm',
              format: 'osm' as ModelFormat,
            },
          },
          {
            operation: 'import',
            request: {
              filePath: '/path/to/invalid.osm',
              format: 'osm' as ModelFormat,
            },
          },
          {
            operation: 'import',
            request: {
              filePath: '/path/to/another.osm',
              format: 'osm' as ModelFormat,
            },
          },
        ],
        continueOnError: true,
      };

      vi.mocked(mockCommandProcessor.executeCommand)
        .mockResolvedValueOnce({
          success: true,
          output: 'Operation successful',
          error: '',
        })
        .mockResolvedValueOnce({
          success: false,
          output: '',
          error: 'Operation failed',
        })
        .mockResolvedValueOnce({
          success: true,
          output: 'Operation successful',
          error: '',
        });

      const result = await modelImportExportService.batchOperation(request);

      expect(result.totalOperations).toBe(3);
      expect(result.successfulOperations).toBe(2);
      expect(result.failedOperations).toBe(1);
      expect(result.success).toBe(false); // Overall failure due to one failed operation
    });

    it('should stop on first error when continueOnError is false', async () => {
      const request: BatchImportExportRequest = {
        operations: [
          {
            operation: 'import',
            request: {
              filePath: '/path/to/invalid.osm',
              format: 'osm' as ModelFormat,
            },
          },
          {
            operation: 'import',
            request: {
              filePath: '/path/to/valid.osm',
              format: 'osm' as ModelFormat,
            },
          },
        ],
        continueOnError: false,
      };

      vi.mocked(mockCommandProcessor.executeCommand).mockResolvedValue({
        success: false,
        output: '',
        error: 'Operation failed',
      });

      const result = await modelImportExportService.batchOperation(request);

      expect(result.successfulOperations).toBe(0);
      expect(result.failedOperations).toBe(1);
      expect(result.results).toHaveLength(1); // Should stop after first failure
    });
  });

  describe('convertFormat', () => {
    it('should successfully convert OSM to IDF', async () => {
      const request: FormatConversionRequest = {
        sourceFilePath: '/path/to/source.osm',
        sourceFormat: 'osm',
        targetFilePath: '/path/to/target.idf',
        targetFormat: 'idf',
        conversionOptions: {
          validationLevel: 'basic',
          preserveMetadata: true,
          includeValidationReport: true,
        },
      };

      vi.mocked(mockCommandProcessor.executeCommand).mockResolvedValue({
        success: true,
        output: 'Conversion successful',
        error: '',
      });

      const result = await modelImportExportService.convertFormat(request);

      expect(result.success).toBe(true);
      expect(result.sourceFormat).toBe('osm');
      expect(result.targetFormat).toBe('idf');
      expect(result.sourceFilePath).toBe('/path/to/source.osm');
      expect(result.targetFilePath).toBe('/path/to/target.idf');
      expect(result.metadata.processingTime).toBeGreaterThan(0);
    });

    it('should successfully convert IDF to gbXML', async () => {
      const request: FormatConversionRequest = {
        sourceFilePath: '/path/to/source.idf',
        sourceFormat: 'idf',
        targetFilePath: '/path/to/target.gbxml',
        targetFormat: 'gbxml',
        conversionOptions: {
          optimizeOutput: true,
        },
      };

      vi.mocked(mockCommandProcessor.executeCommand)
        .mockResolvedValueOnce({
          // First call: IDF to OSM
          success: true,
          output: 'IDF imported successfully',
          error: '',
        })
        .mockResolvedValueOnce({
          // Second call: OSM to gbXML
          success: true,
          output: 'gbXML exported successfully',
          error: '',
        });

      const result = await modelImportExportService.convertFormat(request);

      expect(result.success).toBe(true);
      expect(result.sourceFormat).toBe('idf');
      expect(result.targetFormat).toBe('gbxml');
    });

    it('should validate conversion parameters', async () => {
      const request: FormatConversionRequest = {
        sourceFilePath: '/path/to/source.osm',
        sourceFormat: 'osm',
        targetFilePath: '/path/to/target.osm',
        targetFormat: 'osm', // Same format
      };

      const result = await modelImportExportService.convertFormat(request);

      expect(result.success).toBe(false);
      expect(result.errors?.[0]).toContain('Source and target formats cannot be the same');
    });

    it('should handle conversion errors', async () => {
      const request: FormatConversionRequest = {
        sourceFilePath: '/path/to/source.osm',
        sourceFormat: 'osm',
        targetFilePath: '/path/to/target.idf',
        targetFormat: 'idf',
      };

      vi.mocked(mockCommandProcessor.executeCommand).mockResolvedValue({
        success: false,
        output: '',
        error: 'Conversion failed',
      });

      const result = await modelImportExportService.convertFormat(request);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('getFormatCapabilities', () => {
    it('should return capabilities for a specific format', () => {
      const capabilities = modelImportExportService.getFormatCapabilities('osm');

      expect(capabilities).toMatchObject({
        format: 'osm',
        name: 'OpenStudio Model',
        supportsImport: true,
        supportsExport: true,
        fileExtensions: ['.osm'],
      });
    });

    it('should return capabilities for all formats', () => {
      const capabilities = modelImportExportService.getFormatCapabilities();

      expect(Array.isArray(capabilities)).toBe(true);
      expect(capabilities.length).toBeGreaterThan(0);
      expect(capabilities.every((cap) => cap.format && cap.name)).toBe(true);
    });

    it('should throw error for unsupported format', () => {
      expect(() => {
        modelImportExportService.getFormatCapabilities('unsupported' as ModelFormat);
      }).toThrow('Unsupported format: unsupported');
    });
  });

  describe('validation and error handling', () => {
    it('should validate unsupported format for import', async () => {
      const request: ModelImportRequest = {
        filePath: '/path/to/model.xyz',
        format: 'xyz' as ModelFormat,
      };

      const result = await modelImportExportService.importModel(request);

      expect(result.success).toBe(false);
      expect(result.errors?.[0]).toContain('Unsupported format: xyz');
    });

    it('should validate format that does not support import', async () => {
      const request: ModelImportRequest = {
        filePath: '/path/to/model.pdf',
        format: 'pdf',
      };

      const result = await modelImportExportService.importModel(request);

      expect(result.success).toBe(false);
      expect(result.errors?.[0]).toContain('does not support import operations');
    });

    it('should validate format that does not support export', async () => {
      const request: ModelExportRequest = {
        sourceModelPath: '/path/to/source.osm',
        filePath: '/path/to/target.xyz',
        format: 'xyz' as ModelFormat,
      };

      const result = await modelImportExportService.exportModel(request);

      expect(result.success).toBe(false);
      expect(result.errors?.[0]).toContain('Unsupported format: xyz');
    });

    it('should handle file system errors gracefully', async () => {
      const request: ModelImportRequest = {
        filePath: '/path/to/model.osm',
        format: 'osm',
      };

      vi.mocked(mockFs.stat).mockRejectedValue(new Error('Permission denied'));

      const result = await modelImportExportService.importModel(request);

      expect(result.success).toBe(false);
      expect(result.errors?.[0]).toContain('Permission denied');
    });
  });
});
