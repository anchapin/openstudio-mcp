/**
 * Tests for the OSM file processor module
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  validateOSMFile,
  extractOSMInformation,
  extractDetailedOSMInformation,
  modifyOSMWithMeasure,
  convertOSMFile,
  mergeOSMFiles
} from '../src/utils/osmFileProcessor';
import * as commandExecutor from '../src/utils/commandExecutor';
import * as fileOperations from '../src/utils/fileOperations';

// Mock the command executor
vi.mock('../src/utils/commandExecutor', () => ({
  executeOpenStudioCommand: vi.fn(),
}));

// Mock file operations
vi.mock('../src/utils/fileOperations', () => ({
  fileExists: vi.fn().mockResolvedValue(true),
  directoryExists: vi.fn().mockResolvedValue(true),
  ensureDirectory: vi.fn().mockResolvedValue(undefined),
  createTempFile: vi.fn().mockResolvedValue('/tmp/temp-file.osm'),
  copyFile: vi.fn().mockResolvedValue(undefined),
  deleteFile: vi.fn().mockResolvedValue(undefined),
}));

// Mock fs
vi.mock('fs', () => ({
  promises: {
    stat: vi.fn().mockResolvedValue({ size: 1000 }),
  },
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn(),
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

describe('OSM File Processor', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });
  
  describe('validateOSMFile', () => {
    it('should validate a valid OSM file', async () => {
      // Mock successful execution
      vi.spyOn(commandExecutor, 'executeOpenStudioCommand').mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: 'Model validation completed successfully',
        stderr: '',
        executionTime: 100,
      });
      
      const result = await validateOSMFile('/path/to/model.osm');
      
      expect(commandExecutor.executeOpenStudioCommand).toHaveBeenCalledWith(
        'model',
        ['--validate', '/path/to/model.osm'],
        expect.any(Object)
      );
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });
    
    it('should detect validation errors and warnings', async () => {
      // Mock execution with errors and warnings
      vi.spyOn(commandExecutor, 'executeOpenStudioCommand').mockResolvedValue({
        success: false,
        exitCode: 1,
        stdout: `
          Model validation failed
          Error: Invalid construction
          Error: Missing required object
          Warning: Incomplete schedule
        `,
        stderr: 'Validation errors found',
        executionTime: 100,
        error: 'Validation failed',
      });
      
      const result = await validateOSMFile('/path/to/model.osm');
      
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(['Invalid construction', 'Missing required object']);
      expect(result.warnings).toEqual(['Incomplete schedule']);
    });
    
    it('should validate file path', async () => {
      const result = await validateOSMFile('');
      
      expect(commandExecutor.executeOpenStudioCommand).not.toHaveBeenCalled();
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Invalid OSM file path');
    });
    
    it('should check if file exists', async () => {
      // Mock file not existing
      vi.spyOn(fileOperations, 'fileExists').mockResolvedValueOnce(false);
      
      const result = await validateOSMFile('/path/to/nonexistent.osm');
      
      expect(commandExecutor.executeOpenStudioCommand).not.toHaveBeenCalled();
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('not found');
    });
    
    it('should check file size', async () => {
      // Mock file size exceeding limit
      vi.spyOn(fs.promises, 'stat').mockResolvedValueOnce({ size: 100 * 1024 * 1024 } as any);
      
      const result = await validateOSMFile('/path/to/model.osm', { maxFileSize: 50 * 1024 * 1024 });
      
      expect(commandExecutor.executeOpenStudioCommand).not.toHaveBeenCalled();
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('exceeds maximum allowed size');
    });
  });
  
  describe('extractOSMInformation', () => {
    it('should extract basic model information', async () => {
      // Mock successful execution
      vi.spyOn(commandExecutor, 'executeOpenStudioCommand').mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: `
          OpenStudio Version: 3.5.0
          Spaces: 10
          Thermal Zones: 5
          Constructions: 20
          Materials: 30
          Weather File: USA_CO_Denver.epw
          Building Type: Office
          Floor Area: 1000.5 m²
          Stories: 3
        `,
        stderr: '',
        executionTime: 100,
      });
      
      const result = await extractOSMInformation('/path/to/model.osm');
      
      expect(commandExecutor.executeOpenStudioCommand).toHaveBeenCalledWith(
        'model',
        ['--info', '/path/to/model.osm'],
        expect.any(Object)
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        version: '3.5.0',
        spaces: 10,
        thermalZones: 5,
        constructions: 20,
        materials: 30,
        weatherFile: 'USA_CO_Denver.epw',
        buildingType: 'Office',
        floorArea: 1000.5,
        stories: 3,
      });
    });
    
    it('should extract detailed model information', async () => {
      // Mock successful execution
      vi.spyOn(commandExecutor, 'executeOpenStudioCommand').mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: 'Detailed model information',
        stderr: '',
        executionTime: 100,
      });
      
      const result = await extractOSMInformation('/path/to/model.osm', 'detailed');
      
      expect(commandExecutor.executeOpenStudioCommand).toHaveBeenCalledWith(
        'model',
        ['--info', '--detailed', '/path/to/model.osm'],
        expect.any(Object)
      );
      expect(result.success).toBe(true);
    });
    
    it('should extract complete model information', async () => {
      // Mock successful execution
      vi.spyOn(commandExecutor, 'executeOpenStudioCommand').mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: 'Complete model information',
        stderr: '',
        executionTime: 100,
      });
      
      const result = await extractOSMInformation('/path/to/model.osm', 'complete');
      
      expect(commandExecutor.executeOpenStudioCommand).toHaveBeenCalledWith(
        'model',
        ['--info', '--detailed', '--complete', '/path/to/model.osm'],
        expect.any(Object)
      );
      expect(result.success).toBe(true);
    });
    
    it('should validate the model if requested', async () => {
      // Mock validation failure
      vi.spyOn(commandExecutor, 'executeOpenStudioCommand').mockResolvedValueOnce({
        success: false,
        exitCode: 1,
        stdout: 'Error: Invalid construction',
        stderr: '',
        executionTime: 100,
        error: 'Validation failed',
      });
      
      const result = await extractOSMInformation('/path/to/model.osm', 'basic', { validate: true });
      
      expect(commandExecutor.executeOpenStudioCommand).toHaveBeenCalledWith(
        'model',
        ['--validate', '/path/to/model.osm'],
        expect.any(Object)
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('validation failed');
    });
  });
  
  describe('extractDetailedOSMInformation', () => {
    it('should extract detailed model information', async () => {
      // Mock basic info execution
      vi.spyOn(commandExecutor, 'executeOpenStudioCommand').mockResolvedValueOnce({
        success: true,
        exitCode: 0,
        stdout: `
          OpenStudio Version: 3.5.0
          Spaces: 2
          Thermal Zones: 1
          Constructions: 2
          Materials: 3
        `,
        stderr: '',
        executionTime: 100,
      });
      
      // Mock detailed info execution
      vi.spyOn(commandExecutor, 'executeOpenStudioCommand').mockResolvedValueOnce({
        success: true,
        exitCode: 0,
        stdout: `
          Spaces:
            Office 1: Type = Office, Area = 100.5 m², Volume = 301.5 m³, Thermal Zone = Zone 1
            Office 2: Type = Office, Area = 120.0 m², Volume = 360.0 m³, Thermal Zone = Zone 1
          
          Thermal Zones:
            Zone 1: Type = Conditioned, Area = 220.5 m², Volume = 661.5 m³, Spaces = Office 1, Office 2
          
          Constructions:
            Exterior Wall: Type = Opaque, Layers = Brick, Insulation, Gypsum
            Interior Wall: Type = Opaque, Layers = Gypsum, Gypsum
          
          Materials:
            Brick: Type = Standard, Thickness = 0.1 m, Conductivity = 0.89 W/m-K, Density = 1920 kg/m³, Specific Heat = 790 J/kg-K
            Insulation: Type = Standard, Thickness = 0.05 m, Conductivity = 0.03 W/m-K
            Gypsum: Type = Standard, Thickness = 0.012 m
          
          Surfaces:
            North Wall: Type = Wall, Area = 30.0 m², Construction = Exterior Wall, Space = Office 1, Outside Boundary Condition = Outdoors
            South Wall: Type = Wall, Area = 30.0 m², Construction = Exterior Wall, Space = Office 1, Outside Boundary Condition = Outdoors
          
          SubSurfaces:
            Window 1: Type = FixedWindow, Area = 4.0 m², Construction = Double Glazing, Parent Surface = North Wall
        `,
        stderr: '',
        executionTime: 100,
      });
      
      const result = await extractDetailedOSMInformation('/path/to/model.osm');
      
      expect(commandExecutor.executeOpenStudioCommand).toHaveBeenCalledTimes(2);
      expect(result).not.toBeNull();
      expect(result?.modelInfo).toEqual({
        version: '3.5.0',
        spaces: 2,
        thermalZones: 1,
        constructions: 2,
        materials: 3,
      });
      
      // Check spaces
      expect(result?.spaces).toHaveLength(2);
      expect(result?.spaces?.[0]).toEqual({
        name: 'Office 1',
        type: 'Office',
        area: 100.5,
        volume: 301.5,
        thermalZone: 'Zone 1',
      });
      
      // Check thermal zones
      expect(result?.thermalZones).toHaveLength(1);
      expect(result?.thermalZones?.[0]).toEqual({
        name: 'Zone 1',
        type: 'Conditioned',
        area: 220.5,
        volume: 661.5,
        spaces: ['Office 1', 'Office 2'],
      });
      
      // Check constructions
      expect(result?.constructions).toHaveLength(2);
      expect(result?.constructions?.[0]).toEqual({
        name: 'Exterior Wall',
        type: 'Opaque',
        layers: ['Brick', 'Insulation', 'Gypsum'],
      });
      
      // Check materials
      expect(result?.materials).toHaveLength(3);
      expect(result?.materials?.[0]).toEqual({
        name: 'Brick',
        type: 'Standard',
        thickness: 0.1,
        conductivity: 0.89,
        density: 1920,
        specificHeat: 790,
      });
      
      // Check surfaces
      expect(result?.surfaces).toHaveLength(2);
      expect(result?.surfaces?.[0]).toEqual({
        name: 'North Wall',
        type: 'Wall',
        area: 30.0,
        construction: 'Exterior Wall',
        space: 'Office 1',
        outsideBoundaryCondition: 'Outdoors',
      });
      
      // Check subsurfaces
      expect(result?.subSurfaces).toHaveLength(1);
      expect(result?.subSurfaces?.[0]).toEqual({
        name: 'Window 1',
        type: 'FixedWindow',
        area: 4.0,
        construction: 'Double Glazing',
        parentSurface: 'North Wall',
      });
    });
    
    it('should return null if basic info extraction fails', async () => {
      // Mock basic info execution failure
      vi.spyOn(commandExecutor, 'executeOpenStudioCommand').mockResolvedValueOnce({
        success: false,
        exitCode: 1,
        stdout: '',
        stderr: 'Error extracting basic info',
        executionTime: 100,
        error: 'Error extracting basic info',
      });
      
      const result = await extractDetailedOSMInformation('/path/to/model.osm');
      
      expect(result).toBeNull();
    });
    
    it('should return null if detailed info extraction fails', async () => {
      // Mock basic info execution success
      vi.spyOn(commandExecutor, 'executeOpenStudioCommand').mockResolvedValueOnce({
        success: true,
        exitCode: 0,
        stdout: 'Basic model information',
        stderr: '',
        executionTime: 100,
      });
      
      // Mock detailed info execution failure
      vi.spyOn(commandExecutor, 'executeOpenStudioCommand').mockResolvedValueOnce({
        success: false,
        exitCode: 1,
        stdout: '',
        stderr: 'Error extracting detailed info',
        executionTime: 100,
        error: 'Error extracting detailed info',
      });
      
      const result = await extractDetailedOSMInformation('/path/to/model.osm');
      
      expect(result).toBeNull();
    });
  });
  
  describe('modifyOSMWithMeasure', () => {
    it('should apply a measure to a model', async () => {
      // Mock successful execution
      vi.spyOn(commandExecutor, 'executeOpenStudioCommand').mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: 'Measure applied successfully',
        stderr: '',
        executionTime: 100,
      });
      
      const result = await modifyOSMWithMeasure(
        '/path/to/model.osm',
        '/path/to/measure',
        { wwr: 0.4 }
      );
      
      expect(commandExecutor.executeOpenStudioCommand).toHaveBeenCalledWith(
        'measure',
        [
          '--apply',
          '/path/to/measure',
          '/path/to/model.osm',
          '--argument',
          'wwr=0.4'
        ],
        expect.any(Object)
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        modelPath: '/path/to/model.osm',
        measurePath: '/path/to/measure',
        arguments: { wwr: 0.4 },
      });
    });
    
    it('should apply a measure with output path', async () => {
      // Mock successful execution
      vi.spyOn(commandExecutor, 'executeOpenStudioCommand').mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: 'Measure applied successfully',
        stderr: '',
        executionTime: 100,
      });
      
      const result = await modifyOSMWithMeasure(
        '/path/to/model.osm',
        '/path/to/measure',
        { wwr: 0.4 },
        '/path/to/output.osm'
      );
      
      expect(commandExecutor.executeOpenStudioCommand).toHaveBeenCalledWith(
        'measure',
        [
          '--apply',
          '/path/to/measure',
          '/path/to/model.osm',
          '--argument',
          'wwr=0.4',
          '--output',
          '/path/to/output.osm'
        ],
        expect.any(Object)
      );
      expect(result.success).toBe(true);
      expect(result.data.modelPath).toBe('/path/to/output.osm');
    });
    
    it('should use a temporary file when requested', async () => {
      // Mock successful execution
      vi.spyOn(commandExecutor, 'executeOpenStudioCommand').mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: 'Measure applied successfully',
        stderr: '',
        executionTime: 100,
      });
      
      const result = await modifyOSMWithMeasure(
        '/path/to/model.osm',
        '/path/to/measure',
        { wwr: 0.4 },
        undefined,
        { useTemporary: true }
      );
      
      expect(fileOperations.createTempFile).toHaveBeenCalled();
      expect(commandExecutor.executeOpenStudioCommand).toHaveBeenCalledWith(
        'measure',
        [
          '--apply',
          '/path/to/measure',
          '/path/to/model.osm',
          '--argument',
          'wwr=0.4',
          '--output',
          '/tmp/temp-file.osm'
        ],
        expect.any(Object)
      );
      expect(fileOperations.copyFile).toHaveBeenCalledWith(
        '/tmp/temp-file.osm',
        '/path/to/model.osm',
        { overwrite: true }
      );
      expect(fileOperations.deleteFile).toHaveBeenCalledWith('/tmp/temp-file.osm');
      expect(result.success).toBe(true);
    });
    
    it('should validate the model if requested', async () => {
      // Mock validation failure
      vi.spyOn(commandExecutor, 'executeOpenStudioCommand').mockResolvedValueOnce({
        success: false,
        exitCode: 1,
        stdout: 'Error: Invalid construction',
        stderr: '',
        executionTime: 100,
        error: 'Validation failed',
      });
      
      const result = await modifyOSMWithMeasure(
        '/path/to/model.osm',
        '/path/to/measure',
        { wwr: 0.4 },
        undefined,
        { validate: true }
      );
      
      expect(commandExecutor.executeOpenStudioCommand).toHaveBeenCalledWith(
        'model',
        ['--validate', '/path/to/model.osm'],
        expect.any(Object)
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('validation failed');
    });
  });
  
  describe('convertOSMFile', () => {
    it('should convert a model to a different format', async () => {
      // Mock successful execution
      vi.spyOn(commandExecutor, 'executeOpenStudioCommand').mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: 'Model converted successfully',
        stderr: '',
        executionTime: 100,
      });
      
      const result = await convertOSMFile('/path/to/model.osm', '/path/to/model.idf');
      
      expect(commandExecutor.executeOpenStudioCommand).toHaveBeenCalledWith(
        'model',
        ['--convert', '/path/to/model.osm', '/path/to/model.idf'],
        expect.any(Object)
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        inputPath: '/path/to/model.osm',
        outputPath: '/path/to/model.idf',
        inputFormat: '.osm',
        outputFormat: '.idf',
      });
    });
    
    it('should ensure the output directory exists', async () => {
      // Mock successful execution
      vi.spyOn(commandExecutor, 'executeOpenStudioCommand').mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: 'Model converted successfully',
        stderr: '',
        executionTime: 100,
      });
      
      await convertOSMFile('/path/to/model.osm', '/path/to/output/model.idf');
      
      expect(fileOperations.ensureDirectory).toHaveBeenCalledWith('/path/to/output');
    });
    
    it('should validate the model if requested', async () => {
      // Mock validation failure
      vi.spyOn(commandExecutor, 'executeOpenStudioCommand').mockResolvedValueOnce({
        success: false,
        exitCode: 1,
        stdout: 'Error: Invalid construction',
        stderr: '',
        executionTime: 100,
        error: 'Validation failed',
      });
      
      const result = await convertOSMFile(
        '/path/to/model.osm',
        '/path/to/model.idf',
        { validate: true }
      );
      
      expect(commandExecutor.executeOpenStudioCommand).toHaveBeenCalledWith(
        'model',
        ['--validate', '/path/to/model.osm'],
        expect.any(Object)
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('validation failed');
    });
  });
  
  describe('mergeOSMFiles', () => {
    it('should merge two models', async () => {
      // Mock successful execution
      vi.spyOn(commandExecutor, 'executeOpenStudioCommand').mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: 'Models merged successfully',
        stderr: '',
        executionTime: 100,
      });
      
      const result = await mergeOSMFiles(
        '/path/to/primary.osm',
        '/path/to/secondary.osm',
        '/path/to/merged.osm'
      );
      
      expect(commandExecutor.executeOpenStudioCommand).toHaveBeenCalledWith(
        'model',
        ['--merge', '/path/to/primary.osm', '/path/to/secondary.osm', '/path/to/merged.osm'],
        expect.any(Object)
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        primaryModelPath: '/path/to/primary.osm',
        secondaryModelPath: '/path/to/secondary.osm',
        outputPath: '/path/to/merged.osm',
      });
    });
    
    it('should ensure the output directory exists', async () => {
      // Mock successful execution
      vi.spyOn(commandExecutor, 'executeOpenStudioCommand').mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: 'Models merged successfully',
        stderr: '',
        executionTime: 100,
      });
      
      await mergeOSMFiles(
        '/path/to/primary.osm',
        '/path/to/secondary.osm',
        '/path/to/output/merged.osm'
      );
      
      expect(fileOperations.ensureDirectory).toHaveBeenCalledWith('/path/to/output');
    });
    
    it('should validate both models if requested', async () => {
      // Mock first validation success
      vi.spyOn(commandExecutor, 'executeOpenStudioCommand').mockResolvedValueOnce({
        success: true,
        exitCode: 0,
        stdout: 'Model validation completed successfully',
        stderr: '',
        executionTime: 100,
      });
      
      // Mock second validation failure
      vi.spyOn(commandExecutor, 'executeOpenStudioCommand').mockResolvedValueOnce({
        success: false,
        exitCode: 1,
        stdout: 'Error: Invalid construction',
        stderr: '',
        executionTime: 100,
        error: 'Validation failed',
      });
      
      const result = await mergeOSMFiles(
        '/path/to/primary.osm',
        '/path/to/secondary.osm',
        '/path/to/merged.osm',
        { validate: true }
      );
      
      expect(commandExecutor.executeOpenStudioCommand).toHaveBeenCalledWith(
        'model',
        ['--validate', '/path/to/primary.osm'],
        expect.any(Object)
      );
      expect(commandExecutor.executeOpenStudioCommand).toHaveBeenCalledWith(
        'model',
        ['--validate', '/path/to/secondary.osm'],
        expect.any(Object)
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('Secondary OSM file validation failed');
    });
  });
});