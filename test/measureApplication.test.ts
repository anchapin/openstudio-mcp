import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import * as measureApplicationService from '../src/services/measureApplicationService';
import openStudioCommands from '../src/utils/openStudioCommands';
import measureManager from '../src/utils/measureManager';
import fileOperations from '../src/utils/fileOperations';
import { BCLApiClient } from '../src/services/bclApiClient';

// Mock dependencies
vi.mock('../src/utils/openStudioCommands', () => ({
  default: {
    applyMeasure: vi.fn(),
    listMeasures: vi.fn(),
  }
}));

vi.mock('../src/utils/measureManager', () => ({
  default: {
    getMeasuresDir: vi.fn(),
    isMeasureInstalled: vi.fn(),
  }
}));

vi.mock('../src/utils/fileOperations', () => ({
  default: {
    fileExists: vi.fn(),
    directoryExists: vi.fn(),
    copyFile: vi.fn(),
    deleteFile: vi.fn(),
  }
}));

vi.mock('../src/services/bclApiClient', () => ({
  BCLApiClient: vi.fn().mockImplementation(() => ({
    downloadMeasure: vi.fn(),
    installMeasure: vi.fn(),
  }))
}));

// Mock logger
vi.mock('../src/utils/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

describe('Measure Application Service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('validateMeasureForApplication', () => {
    it('should validate a measure for application', async () => {
      // Mock dependencies
      (fileOperations.fileExists as any).mockResolvedValue(true);
      (fileOperations.directoryExists as any).mockResolvedValue(true);
      (measureManager.getMeasuresDir as any).mockReturnValue('/test/measures');
      (openStudioCommands.listMeasures as any).mockResolvedValue({
        success: true,
        data: [
          {
            uuid: 'test-measure',
            name: 'Test Measure',
            arguments: [
              {
                name: 'required_arg',
                required: true,
                type: 'Double'
              },
              {
                name: 'optional_arg',
                required: false,
                type: 'String'
              }
            ]
          }
        ]
      });

      // Test with valid arguments
      const result = await measureApplicationService.validateMeasureForApplication(
        'test-measure',
        '/path/to/model.osm',
        { required_arg: 42 }
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should return validation errors for missing model file', async () => {
      // Mock dependencies
      (fileOperations.fileExists as any).mockResolvedValue(false);

      const result = await measureApplicationService.validateMeasureForApplication(
        'test-measure',
        '/path/to/model.osm',
        {}
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Model file not found: /path/to/model.osm');
    });

    it('should return validation errors for invalid model file format', async () => {
      // Mock dependencies
      (fileOperations.fileExists as any).mockResolvedValue(true);
      (fileOperations.directoryExists as any).mockResolvedValue(true);

      const result = await measureApplicationService.validateMeasureForApplication(
        'test-measure',
        '/path/to/model.txt',
        {}
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid model file format: /path/to/model.txt. Must be an OSM file.');
    });

    it('should return validation errors for missing measure', async () => {
      // Mock dependencies
      (fileOperations.fileExists as any).mockResolvedValue(true);
      (fileOperations.directoryExists as any).mockResolvedValue(false);
      (measureManager.getMeasuresDir as any).mockReturnValue('/test/measures');

      const result = await measureApplicationService.validateMeasureForApplication(
        'test-measure',
        '/path/to/model.osm',
        {}
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Measure not installed: test-measure');
    });

    it('should return validation errors for missing required arguments', async () => {
      // Mock dependencies
      (fileOperations.fileExists as any).mockResolvedValue(true);
      (fileOperations.directoryExists as any).mockResolvedValue(true);
      (measureManager.getMeasuresDir as any).mockReturnValue('/test/measures');
      (openStudioCommands.listMeasures as any).mockResolvedValue({
        success: true,
        data: [
          {
            uuid: 'test-measure',
            name: 'Test Measure',
            arguments: [
              {
                name: 'required_arg',
                required: true,
                type: 'Double'
              }
            ]
          }
        ]
      });

      // Test with missing required argument
      const result = await measureApplicationService.validateMeasureForApplication(
        'test-measure',
        '/path/to/model.osm',
        {}
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required argument: required_arg');
    });

    it('should return validation errors for invalid argument types', async () => {
      // Mock dependencies
      (fileOperations.fileExists as any).mockResolvedValue(true);
      (fileOperations.directoryExists as any).mockResolvedValue(true);
      (measureManager.getMeasuresDir as any).mockReturnValue('/test/measures');
      (openStudioCommands.listMeasures as any).mockResolvedValue({
        success: true,
        data: [
          {
            uuid: 'test-measure',
            name: 'Test Measure',
            arguments: [
              {
                name: 'number_arg',
                required: false,
                type: 'Double'
              },
              {
                name: 'bool_arg',
                required: false,
                type: 'Boolean'
              },
              {
                name: 'string_arg',
                required: false,
                type: 'String'
              }
            ]
          }
        ]
      });

      // Test with invalid argument types
      const result = await measureApplicationService.validateMeasureForApplication(
        'test-measure',
        '/path/to/model.osm',
        {
          number_arg: 'not a number',
          bool_arg: 'not a boolean',
          string_arg: 42
        }
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid type for argument number_arg: expected number, got string');
      expect(result.errors).toContain('Invalid type for argument bool_arg: expected boolean, got string');
      expect(result.errors).toContain('Invalid type for argument string_arg: expected string, got number');
    });
  });

  describe('applyMeasure', () => {
    it('should apply a measure to a model', async () => {
      // Mock dependencies
      vi.spyOn(measureApplicationService, 'validateMeasureForApplication').mockResolvedValue({ valid: true, errors: [] });
      (measureManager.getMeasuresDir as any).mockReturnValue('/test/measures');
      (fileOperations.fileExists as any).mockResolvedValue(true);
      (fileOperations.directoryExists as any).mockResolvedValue(true);
      (fileOperations.copyFile as any).mockResolvedValue(undefined);
      (fileOperations.deleteFile as any).mockResolvedValue(undefined);
      (openStudioCommands.applyMeasure as any).mockResolvedValue({
        success: true,
        output: 'Measure applied successfully',
        data: {
          modelPath: '/path/to/output.osm',
          measurePath: '/test/measures/test-measure',
          arguments: { arg1: 42 }
        }
      });

      // Test applying a measure
      const result = await measureApplicationService.applyMeasure(
        '/path/to/model.osm',
        'test-measure',
        { arg1: 42 }
      );

      expect(result.success).toBe(true);
      expect(result.outputModelPath).toBe('/path/to/output.osm');
      expect(result.originalModelPath).toBe('/path/to/model.osm');
      expect(result.measureId).toBe('test-measure');
      expect(result.arguments).toEqual({ arg1: 42 });
      expect(fileOperations.copyFile).toHaveBeenCalledWith('/path/to/model.osm', '/path/to/model.osm.backup');
      expect(openStudioCommands.applyMeasure).toHaveBeenCalledWith(
        '/path/to/model.osm',
        '/test/measures/test-measure',
        { arg1: 42 },
        expect.any(String)
      );
      expect(fileOperations.deleteFile).toHaveBeenCalledWith('/path/to/model.osm.backup');
    });

    it('should handle validation failures', async () => {
      // Mock dependencies
      vi.spyOn(measureApplicationService, 'validateMeasureForApplication').mockResolvedValue({ 
        valid: false, 
        errors: ['Validation error'] 
      });

      // Test applying a measure with validation failure
      const result = await measureApplicationService.applyMeasure(
        '/path/to/model.osm',
        'test-measure',
        { arg1: 42 }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Measure validation failed');
      expect(openStudioCommands.applyMeasure).not.toHaveBeenCalled();
    });

    it('should handle measure application failures', async () => {
      // Mock dependencies
      vi.spyOn(measureApplicationService, 'validateMeasureForApplication').mockResolvedValue({ valid: true, errors: [] });
      (measureManager.getMeasuresDir as any).mockReturnValue('/test/measures');
      (fileOperations.fileExists as any).mockResolvedValue(true);
      (fileOperations.directoryExists as any).mockResolvedValue(true);
      (fileOperations.copyFile as any).mockResolvedValue(undefined);
      (openStudioCommands.applyMeasure as any).mockResolvedValue({
        success: false,
        output: 'Measure application failed',
        error: 'Error applying measure'
      });

      // Test applying a measure with application failure
      const result = await measureApplicationService.applyMeasure(
        '/path/to/model.osm',
        'test-measure',
        { arg1: 42 }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Error applying measure');
      expect(fileOperations.copyFile).toHaveBeenCalledWith('/path/to/model.osm', '/path/to/model.osm.backup');
      expect(openStudioCommands.applyMeasure).toHaveBeenCalled();
    });

    it('should apply a measure in-place', async () => {
      // Mock dependencies
      vi.spyOn(measureApplicationService, 'validateMeasureForApplication').mockResolvedValue({ valid: true, errors: [] });
      (measureManager.getMeasuresDir as any).mockReturnValue('/test/measures');
      (fileOperations.fileExists as any).mockResolvedValue(true);
      (fileOperations.directoryExists as any).mockResolvedValue(true);
      (fileOperations.copyFile as any).mockResolvedValue(undefined);
      (fileOperations.deleteFile as any).mockResolvedValue(undefined);
      (openStudioCommands.applyMeasure as any).mockResolvedValue({
        success: true,
        output: 'Measure applied successfully',
        data: {
          modelPath: '/path/to/model.osm',
          measurePath: '/test/measures/test-measure',
          arguments: { arg1: 42 }
        }
      });

      // Test applying a measure in-place
      const result = await measureApplicationService.applyMeasure(
        '/path/to/model.osm',
        'test-measure',
        { arg1: 42 },
        { inPlace: true }
      );

      expect(result.success).toBe(true);
      expect(result.outputModelPath).toBe('/path/to/model.osm');
      expect(openStudioCommands.applyMeasure).toHaveBeenCalledWith(
        '/path/to/model.osm',
        '/test/measures/test-measure',
        { arg1: 42 },
        '/path/to/model.osm'
      );
    });

    it('should extract warnings from the output', async () => {
      // Mock dependencies
      vi.spyOn(measureApplicationService, 'validateMeasureForApplication').mockResolvedValue({ valid: true, errors: [] });
      (measureManager.getMeasuresDir as any).mockReturnValue('/test/measures');
      (fileOperations.fileExists as any).mockResolvedValue(true);
      (fileOperations.directoryExists as any).mockResolvedValue(true);
      (fileOperations.copyFile as any).mockResolvedValue(undefined);
      (fileOperations.deleteFile as any).mockResolvedValue(undefined);
      (openStudioCommands.applyMeasure as any).mockResolvedValue({
        success: true,
        output: 'Measure applied successfully\nWarning: This is a warning\nWarning: Another warning',
        data: {
          modelPath: '/path/to/output.osm',
          measurePath: '/test/measures/test-measure',
          arguments: { arg1: 42 }
        }
      });

      // Test applying a measure with warnings
      const result = await measureApplicationService.applyMeasure(
        '/path/to/model.osm',
        'test-measure',
        { arg1: 42 }
      );

      expect(result.success).toBe(true);
      expect(result.warnings).toEqual(['This is a warning', 'Another warning']);
    });
  });

  describe('applyMeasuresInSequence', () => {
    it('should apply multiple measures in sequence', async () => {
      // Mock dependencies
      vi.spyOn(measureApplicationService, 'applyMeasure')
        .mockResolvedValueOnce({
          success: true,
          outputModelPath: '/path/to/intermediate.osm',
          originalModelPath: '/path/to/model.osm',
          measureId: 'measure1',
          arguments: { arg1: 42 }
        })
        .mockResolvedValueOnce({
          success: true,
          outputModelPath: '/path/to/output.osm',
          originalModelPath: '/path/to/intermediate.osm',
          measureId: 'measure2',
          arguments: { arg2: 'value' }
        });

      // Test applying measures in sequence
      const results = await measureApplicationService.applyMeasuresInSequence(
        '/path/to/model.osm',
        [
          { measureId: 'measure1', arguments: { arg1: 42 } },
          { measureId: 'measure2', arguments: { arg2: 'value' } }
        ]
      );

      expect(results.length).toBe(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(measureApplicationService.applyMeasure).toHaveBeenCalledTimes(2);
      expect(measureApplicationService.applyMeasure).toHaveBeenCalledWith(
        '/path/to/model.osm',
        'measure1',
        { arg1: 42 },
        expect.objectContaining({ inPlace: false })
      );
      expect(measureApplicationService.applyMeasure).toHaveBeenCalledWith(
        '/path/to/intermediate.osm',
        'measure2',
        { arg2: 'value' },
        expect.objectContaining({ inPlace: false })
      );
    });

    it('should stop the sequence if a measure fails', async () => {
      // Mock dependencies
      vi.spyOn(measureApplicationService, 'applyMeasure')
        .mockResolvedValueOnce({
          success: true,
          outputModelPath: '/path/to/intermediate.osm',
          originalModelPath: '/path/to/model.osm',
          measureId: 'measure1',
          arguments: { arg1: 42 }
        })
        .mockResolvedValueOnce({
          success: false,
          outputModelPath: '/path/to/intermediate.osm',
          originalModelPath: '/path/to/intermediate.osm',
          measureId: 'measure2',
          arguments: { arg2: 'value' },
          error: 'Measure application failed'
        });

      // Test applying measures in sequence with a failure
      const results = await measureApplicationService.applyMeasuresInSequence(
        '/path/to/model.osm',
        [
          { measureId: 'measure1', arguments: { arg1: 42 } },
          { measureId: 'measure2', arguments: { arg2: 'value' } },
          { measureId: 'measure3', arguments: { arg3: true } }
        ]
      );

      expect(results.length).toBe(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(measureApplicationService.applyMeasure).toHaveBeenCalledTimes(2);
      expect(measureApplicationService.applyMeasure).not.toHaveBeenCalledWith(
        expect.any(String),
        'measure3',
        expect.any(Object),
        expect.any(Object)
      );
    });
  });

  describe('mapMeasureParameters', () => {
    it('should map user parameters to measure arguments', async () => {
      // Mock dependencies
      (fileOperations.directoryExists as any).mockResolvedValue(true);
      (measureManager.getMeasuresDir as any).mockReturnValue('/test/measures');
      (openStudioCommands.listMeasures as any).mockResolvedValue({
        success: true,
        data: [
          {
            uuid: 'test-measure',
            name: 'Test Measure',
            arguments: [
              {
                name: 'number_arg',
                displayName: 'Number Argument',
                type: 'Double',
                defaultValue: 0
              },
              {
                name: 'bool_arg',
                displayName: 'Boolean Argument',
                type: 'Boolean',
                defaultValue: false
              },
              {
                name: 'string_arg',
                displayName: 'String Argument',
                type: 'String',
                defaultValue: 'default'
              }
            ]
          }
        ]
      });

      // Test mapping parameters
      const result = await measureApplicationService.mapMeasureParameters(
        'test-measure',
        {
          'Number Argument': '42',
          'bool_arg': 'true',
          'unknown_arg': 'value'
        }
      );

      expect(result).toEqual({
        number_arg: 42,
        bool_arg: true,
        string_arg: 'default',
        unknown_arg: 'value'
      });
    });

    it('should handle errors when measure is not installed', async () => {
      // Mock dependencies
      (fileOperations.directoryExists as any).mockResolvedValue(false);
      (measureManager.getMeasuresDir as any).mockReturnValue('/test/measures');

      // Test mapping parameters for non-existent measure
      await expect(measureApplicationService.mapMeasureParameters(
        'test-measure',
        { arg1: 42 }
      )).rejects.toThrow('Measure not installed: test-measure');
    });

    it('should handle errors when measure information cannot be retrieved', async () => {
      // Mock dependencies
      (fileOperations.directoryExists as any).mockResolvedValue(true);
      (measureManager.getMeasuresDir as any).mockReturnValue('/test/measures');
      (openStudioCommands.listMeasures as any).mockResolvedValue({
        success: false,
        error: 'Failed to list measures'
      });

      // Test mapping parameters with list measures failure
      await expect(measureApplicationService.mapMeasureParameters(
        'test-measure',
        { arg1: 42 }
      )).rejects.toThrow('Failed to list measures');
    });
  });

  describe('downloadAndApplyMeasure', () => {
    it('should download and apply a measure', async () => {
      // Mock dependencies
      (measureManager.isMeasureInstalled as any).mockResolvedValue(false);
      (BCLApiClient.prototype.downloadMeasure as any).mockResolvedValue(true);
      (BCLApiClient.prototype.installMeasure as any).mockResolvedValue(true);
      vi.spyOn(measureApplicationService, 'applyMeasure').mockResolvedValue({
        success: true,
        outputModelPath: '/path/to/output.osm',
        originalModelPath: '/path/to/model.osm',
        measureId: 'test-measure',
        arguments: { arg1: 42 }
      });

      // Test downloading and applying a measure
      const result = await measureApplicationService.downloadAndApplyMeasure(
        '/path/to/model.osm',
        'test-measure',
        { arg1: 42 }
      );

      expect(result.success).toBe(true);
      expect(BCLApiClient.prototype.downloadMeasure).toHaveBeenCalledWith('test-measure');
      expect(BCLApiClient.prototype.installMeasure).toHaveBeenCalledWith('test-measure');
      expect(measureApplicationService.applyMeasure).toHaveBeenCalledWith(
        '/path/to/model.osm',
        'test-measure',
        { arg1: 42 },
        {}
      );
    });

    it('should apply an already installed measure', async () => {
      // Mock dependencies
      (measureManager.isMeasureInstalled as any).mockResolvedValue(true);
      vi.spyOn(measureApplicationService, 'applyMeasure').mockResolvedValue({
        success: true,
        outputModelPath: '/path/to/output.osm',
        originalModelPath: '/path/to/model.osm',
        measureId: 'test-measure',
        arguments: { arg1: 42 }
      });

      // Test applying an already installed measure
      const result = await measureApplicationService.downloadAndApplyMeasure(
        '/path/to/model.osm',
        'test-measure',
        { arg1: 42 }
      );

      expect(result.success).toBe(true);
      expect(BCLApiClient.prototype.downloadMeasure).not.toHaveBeenCalled();
      expect(BCLApiClient.prototype.installMeasure).not.toHaveBeenCalled();
      expect(measureApplicationService.applyMeasure).toHaveBeenCalledWith(
        '/path/to/model.osm',
        'test-measure',
        { arg1: 42 },
        {}
      );
    });

    it('should handle download failures', async () => {
      // Mock dependencies
      (measureManager.isMeasureInstalled as any).mockResolvedValue(false);
      (BCLApiClient.prototype.downloadMeasure as any).mockResolvedValue(false);

      // Test downloading and applying a measure with download failure
      const result = await measureApplicationService.downloadAndApplyMeasure(
        '/path/to/model.osm',
        'test-measure',
        { arg1: 42 }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to download measure');
      expect(BCLApiClient.prototype.installMeasure).not.toHaveBeenCalled();
      expect(measureApplicationService.applyMeasure).not.toHaveBeenCalled();
    });

    it('should handle installation failures', async () => {
      // Mock dependencies
      (measureManager.isMeasureInstalled as any).mockResolvedValue(false);
      (BCLApiClient.prototype.downloadMeasure as any).mockResolvedValue(true);
      (BCLApiClient.prototype.installMeasure as any).mockResolvedValue(false);

      // Test downloading and applying a measure with installation failure
      const result = await measureApplicationService.downloadAndApplyMeasure(
        '/path/to/model.osm',
        'test-measure',
        { arg1: 42 }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to install downloaded measure');
      expect(measureApplicationService.applyMeasure).not.toHaveBeenCalled();
    });
  });
});