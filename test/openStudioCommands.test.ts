/**
 * OpenStudio commands tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getOpenStudioVersion,
  createModel,
  getModelInfo,
  runSimulation,
  listMeasures,
  applyMeasure,
  convertModel
} from '../src/utils/openStudioCommands';
import * as commandExecutor from '../src/utils/commandExecutor';

// Mock the command executor
vi.mock('../src/utils/commandExecutor', () => ({
  executeOpenStudioCommand: vi.fn(),
}));

// Mock fs
vi.mock('fs', () => ({
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

describe('OpenStudio Commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });
  
  describe('getOpenStudioVersion', () => {
    it('should return the OpenStudio version', async () => {
      // Mock successful execution
      vi.spyOn(commandExecutor, 'executeOpenStudioCommand').mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: 'OpenStudio 3.5.0',
        stderr: '',
        executionTime: 100,
      });
      
      const result = await getOpenStudioVersion();
      
      expect(commandExecutor.executeOpenStudioCommand).toHaveBeenCalledWith('--version');
      expect(result.success).toBe(true);
      expect(result.output).toBe('OpenStudio 3.5.0');
    });
    
    it('should handle errors', async () => {
      // Mock failed execution
      vi.spyOn(commandExecutor, 'executeOpenStudioCommand').mockRejectedValue(new Error('Command failed'));
      
      const result = await getOpenStudioVersion();
      
      expect(commandExecutor.executeOpenStudioCommand).toHaveBeenCalledWith('--version');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Command failed');
    });
  });
  
  describe('createModel', () => {
    it('should create an empty model', async () => {
      // Mock successful execution
      vi.spyOn(commandExecutor, 'executeOpenStudioCommand').mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: 'Model created successfully',
        stderr: '',
        executionTime: 100,
      });
      
      const result = await createModel('empty', '/path/to/model.osm');
      
      expect(commandExecutor.executeOpenStudioCommand).toHaveBeenCalledWith(
        'create',
        ['--empty', '/path/to/model.osm'],
        expect.any(Object)
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        modelPath: '/path/to/model.osm',
        templateType: 'empty',
      });
    });
    
    it('should create an office building model', async () => {
      // Mock successful execution
      vi.spyOn(commandExecutor, 'executeOpenStudioCommand').mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: 'Model created successfully',
        stderr: '',
        executionTime: 100,
      });
      
      const result = await createModel('office', '/path/to/model.osm');
      
      expect(commandExecutor.executeOpenStudioCommand).toHaveBeenCalledWith(
        'create',
        ['--template', 'office', '/path/to/model.osm'],
        expect.any(Object)
      );
      expect(result.success).toBe(true);
    });
    
    it('should validate template type', async () => {
      // @ts-ignore - Testing invalid input
      const result = await createModel('invalid', '/path/to/model.osm');
      
      expect(commandExecutor.executeOpenStudioCommand).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid template type');
    });
    
    it('should validate output path', async () => {
      const result = await createModel('empty', '');
      
      expect(commandExecutor.executeOpenStudioCommand).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid output path');
    });
  });
  
  describe('getModelInfo', () => {
    it('should get model information', async () => {
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
      
      const result = await getModelInfo('/path/to/model.osm');
      
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
    
    it('should get detailed model information', async () => {
      // Mock successful execution
      vi.spyOn(commandExecutor, 'executeOpenStudioCommand').mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: 'Detailed model information',
        stderr: '',
        executionTime: 100,
      });
      
      const result = await getModelInfo('/path/to/model.osm', 'detailed');
      
      expect(commandExecutor.executeOpenStudioCommand).toHaveBeenCalledWith(
        'model',
        ['--info', '--detailed', '/path/to/model.osm'],
        expect.any(Object)
      );
      expect(result.success).toBe(true);
    });
    
    it('should validate model path', async () => {
      // Mock file not existing
      const fs = require('fs');
      fs.existsSync.mockReturnValueOnce(false);
      
      const result = await getModelInfo('/path/to/nonexistent.osm');
      
      expect(commandExecutor.executeOpenStudioCommand).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });
  
  describe('runSimulation', () => {
    it('should run a simulation', async () => {
      // Mock successful execution
      vi.spyOn(commandExecutor, 'executeOpenStudioCommand').mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: `
          Simulation completed successfully
          EUI: 120.5 kWh/m²/year
          Total Site Energy: 500.2 GJ
          Total Source Energy: 800.3 GJ
          Electricity Consumption: 150000 kWh
          Natural Gas Consumption: 200.1 GJ
        `,
        stderr: '',
        executionTime: 100,
      });
      
      const result = await runSimulation('/path/to/model.osm');
      
      expect(commandExecutor.executeOpenStudioCommand).toHaveBeenCalledWith(
        'energyplus',
        ['--run', '/path/to/model.osm'],
        expect.objectContaining({
          timeout: 600000,
          memoryLimit: 4096,
        })
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual(expect.objectContaining({
        success: true,
        outputDirectory: '/path/to',
        errors: [],
        warnings: [],
        eui: 120.5,
        totalSiteEnergy: 500.2,
        totalSourceEnergy: 800.3,
        electricityConsumption: 150000,
        naturalGasConsumption: 200.1,
      }));
    });
    
    it('should run a simulation with weather file and output directory', async () => {
      // Mock successful execution
      vi.spyOn(commandExecutor, 'executeOpenStudioCommand').mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: 'Simulation completed successfully',
        stderr: '',
        executionTime: 100,
      });
      
      const result = await runSimulation(
        '/path/to/model.osm',
        '/path/to/weather.epw',
        '/path/to/output'
      );
      
      expect(commandExecutor.executeOpenStudioCommand).toHaveBeenCalledWith(
        'energyplus',
        [
          '--run',
          '--weather', '/path/to/weather.epw',
          '--output', '/path/to/output',
          '/path/to/model.osm'
        ],
        expect.any(Object)
      );
      expect(result.success).toBe(true);
    });
    
    it('should handle simulation errors', async () => {
      // Mock execution with errors
      vi.spyOn(commandExecutor, 'executeOpenStudioCommand').mockResolvedValue({
        success: false,
        exitCode: 1,
        stdout: `
          Error: Invalid weather file
          Error: Simulation failed
          Warning: Missing schedule
        `,
        stderr: 'Simulation error',
        executionTime: 100,
        error: 'Simulation failed',
      });
      
      const result = await runSimulation('/path/to/model.osm');
      
      expect(result.success).toBe(false);
      expect(result.data.errors).toEqual([
        'Invalid weather file',
        'Simulation failed',
      ]);
      expect(result.data.warnings).toEqual([
        'Missing schedule',
      ]);
    });
  });
  
  describe('listMeasures', () => {
    it('should list available measures', async () => {
      // Mock successful execution
      vi.spyOn(commandExecutor, 'executeOpenStudioCommand').mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: `
          Measure: 
          Name: SetWindowToWallRatio
          Description: Sets window to wall ratio
          Version: 1.0.0
          UUID: 123e4567-e89b-12d3-a456-426614174000
          
          Argument: 
          Name: wwr
          Display Name: Window to Wall Ratio
          Description: Window to wall ratio
          Type: Double
          Required: true
          Default: 0.4
          
          Measure: 
          Name: AddOverhang
          Description: Adds overhang to windows
          Version: 2.0.0
          UUID: 123e4567-e89b-12d3-a456-426614174001
          
          Argument: 
          Name: depth
          Display Name: Overhang Depth
          Description: Depth of the overhang
          Type: Double
          Required: true
          Default: 0.5
        `,
        stderr: '',
        executionTime: 100,
      });
      
      const result = await listMeasures();
      
      expect(commandExecutor.executeOpenStudioCommand).toHaveBeenCalledWith(
        'measure',
        ['--list'],
        expect.any(Object)
      );
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toEqual({
        name: 'SetWindowToWallRatio',
        description: 'Sets window to wall ratio',
        version: '1.0.0',
        uuid: '123e4567-e89b-12d3-a456-426614174000',
        arguments: [
          {
            name: 'wwr',
            displayName: 'Window to Wall Ratio',
            description: 'Window to wall ratio',
            type: 'Double',
            required: true,
            defaultValue: 0.4,
          },
        ],
      });
    });
    
    it('should list measures from a specific directory', async () => {
      // Mock successful execution
      vi.spyOn(commandExecutor, 'executeOpenStudioCommand').mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: 'Measures list',
        stderr: '',
        executionTime: 100,
      });
      
      const result = await listMeasures('/path/to/measures');
      
      expect(commandExecutor.executeOpenStudioCommand).toHaveBeenCalledWith(
        'measure',
        ['--list', '--dir', '/path/to/measures'],
        expect.any(Object)
      );
      expect(result.success).toBe(true);
    });
  });
  
  describe('applyMeasure', () => {
    it('should apply a measure to a model', async () => {
      // Mock successful execution
      vi.spyOn(commandExecutor, 'executeOpenStudioCommand').mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: 'Measure applied successfully',
        stderr: '',
        executionTime: 100,
      });
      
      const result = await applyMeasure(
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
      
      const result = await applyMeasure(
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
    
    it('should validate model path', async () => {
      // Mock file not existing
      const fs = require('fs');
      fs.existsSync.mockReturnValueOnce(false);
      
      const result = await applyMeasure(
        '/path/to/nonexistent.osm',
        '/path/to/measure',
        {}
      );
      
      expect(commandExecutor.executeOpenStudioCommand).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });
  
  describe('convertModel', () => {
    it('should convert a model to a different format', async () => {
      // Mock successful execution
      vi.spyOn(commandExecutor, 'executeOpenStudioCommand').mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: 'Model converted successfully',
        stderr: '',
        executionTime: 100,
      });
      
      const result = await convertModel('/path/to/model.osm', '/path/to/model.idf');
      
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
    
    it('should validate input path', async () => {
      // Mock file not existing
      const fs = require('fs');
      fs.existsSync.mockReturnValueOnce(false);
      
      const result = await convertModel('/path/to/nonexistent.osm', '/path/to/model.idf');
      
      expect(commandExecutor.executeOpenStudioCommand).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });
});
  describ
e('getWeatherFileInfo', () => {
    it('should get weather file information', async () => {
      // Mock successful execution
      vi.spyOn(commandExecutor, 'executeOpenStudioCommand').mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: `
          Weather File: USA_CO_Denver.epw
          Location: Denver, CO, USA
          Latitude: 39.76
          Longitude: -104.86
          Elevation: 1650
          Time Zone: -7
          Data Period: 1/1/2019 to 12/31/2019
        `,
        stderr: '',
        executionTime: 100,
      });
      
      const result = await getWeatherFileInfo('/path/to/weather.epw');
      
      expect(commandExecutor.executeOpenStudioCommand).toHaveBeenCalledWith(
        'weather',
        ['--info', '/path/to/weather.epw'],
        expect.any(Object)
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        path: '/path/to/weather.epw',
        location: 'Denver, CO, USA',
        latitude: 39.76,
        longitude: -104.86,
        elevation: 1650,
        timeZone: -7,
        dataPeriod: '1/1/2019 to 12/31/2019',
      });
    });
    
    it('should validate weather file path', async () => {
      // Mock file not existing
      const fs = require('fs');
      fs.existsSync.mockReturnValueOnce(false);
      
      const result = await getWeatherFileInfo('/path/to/nonexistent.epw');
      
      expect(commandExecutor.executeOpenStudioCommand).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });
  
  describe('runParametricAnalysis', () => {
    it('should run a parametric analysis', async () => {
      // Mock successful execution
      vi.spyOn(commandExecutor, 'executeOpenStudioCommand').mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: 'Parametric analysis completed successfully',
        stderr: '',
        executionTime: 100,
      });
      
      const result = await runParametricAnalysis(
        '/path/to/model.osm',
        '/path/to/parameters.json',
        '/path/to/output'
      );
      
      expect(commandExecutor.executeOpenStudioCommand).toHaveBeenCalledWith(
        'analysis',
        [
          '--parametric',
          '/path/to/model.osm',
          '/path/to/parameters.json',
          '--output',
          '/path/to/output'
        ],
        expect.objectContaining({
          timeout: 1800000,
          memoryLimit: 8192,
        })
      );
      expect(result.success).toBe(true);
    });
    
    it('should validate model path', async () => {
      // Mock file not existing
      const fs = require('fs');
      fs.existsSync.mockReturnValueOnce(false);
      
      const result = await runParametricAnalysis(
        '/path/to/nonexistent.osm',
        '/path/to/parameters.json'
      );
      
      expect(commandExecutor.executeOpenStudioCommand).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });
  
  describe('runWorkflow', () => {
    it('should run a workflow', async () => {
      // Mock successful execution
      vi.spyOn(commandExecutor, 'executeOpenStudioCommand').mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: 'Workflow completed successfully',
        stderr: '',
        executionTime: 100,
      });
      
      const result = await runWorkflow('/path/to/workflow.json', {
        parallel: true,
        jobs: 4,
        includeRadiance: true,
      });
      
      expect(commandExecutor.executeOpenStudioCommand).toHaveBeenCalledWith(
        'run',
        [
          '--workflow',
          '/path/to/workflow.json',
          '--parallel',
          '--jobs',
          '4',
          '--include-radiance'
        ],
        expect.any(Object)
      );
      expect(result.success).toBe(true);
    });
    
    it('should validate workflow path', async () => {
      // Mock file not existing
      const fs = require('fs');
      fs.existsSync.mockReturnValueOnce(false);
      
      const result = await runWorkflow('/path/to/nonexistent.json');
      
      expect(commandExecutor.executeOpenStudioCommand).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });
  
  describe('validateModel', () => {
    it('should validate a model', async () => {
      // Mock successful execution
      vi.spyOn(commandExecutor, 'executeOpenStudioCommand').mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: `
          Model validation completed
          Warning: Missing schedule for light
          Warning: Incomplete construction
        `,
        stderr: '',
        executionTime: 100,
      });
      
      const result = await validateModel('/path/to/model.osm');
      
      expect(commandExecutor.executeOpenStudioCommand).toHaveBeenCalledWith(
        'model',
        ['--validate', '/path/to/model.osm'],
        expect.any(Object)
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        modelPath: '/path/to/model.osm',
        valid: true,
        errors: [],
        warnings: ['Missing schedule for light', 'Incomplete construction'],
      });
    });
    
    it('should report validation errors', async () => {
      // Mock execution with errors
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
      
      const result = await validateModel('/path/to/model.osm');
      
      expect(result.success).toBe(false);
      expect(result.data).toEqual({
        modelPath: '/path/to/model.osm',
        valid: false,
        errors: ['Invalid construction', 'Missing required object'],
        warnings: ['Incomplete schedule'],
      });
    });
  });  de
scribe('findWeatherFiles', () => {
    it('should find weather files matching a pattern', async () => {
      // Mock successful execution
      vi.spyOn(commandExecutor, 'executeOpenStudioCommand').mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: `
          /path/to/weather/USA_CO_Denver.epw : Denver, CO, USA
          /path/to/weather/USA_CO_Boulder.epw : Boulder, CO, USA
        `,
        stderr: '',
        executionTime: 100,
      });
      
      const result = await findWeatherFiles('CO', 5);
      
      expect(commandExecutor.executeOpenStudioCommand).toHaveBeenCalledWith(
        'weather',
        ['--search', 'CO', '--limit', '5'],
        expect.any(Object)
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual([
        {
          path: '/path/to/weather/USA_CO_Denver.epw',
          location: 'Denver, CO, USA',
        },
        {
          path: '/path/to/weather/USA_CO_Boulder.epw',
          location: 'Boulder, CO, USA',
        },
      ]);
    });
    
    it('should validate search pattern', async () => {
      const result = await findWeatherFiles('');
      
      expect(commandExecutor.executeOpenStudioCommand).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });
  });
  
  describe('isOpenStudioAvailable', () => {
    it('should return true when OpenStudio is available', async () => {
      // Mock successful execution
      vi.spyOn(commandExecutor, 'executeOpenStudioCommand').mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: 'OpenStudio 3.5.0',
        stderr: '',
        executionTime: 100,
      });
      
      const result = await isOpenStudioAvailable();
      
      expect(result).toBe(true);
    });
    
    it('should return false when OpenStudio is not available', async () => {
      // Mock failed execution
      vi.spyOn(commandExecutor, 'executeOpenStudioCommand').mockResolvedValue({
        success: false,
        exitCode: 1,
        stdout: '',
        stderr: 'Command not found',
        executionTime: 100,
        error: 'Command not found',
      });
      
      const result = await isOpenStudioAvailable();
      
      expect(result).toBe(false);
    });
  });
  
  describe('getAvailableTemplates', () => {
    it('should return the list of available templates', async () => {
      // Mock successful execution
      vi.spyOn(commandExecutor, 'executeOpenStudioCommand').mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: `
          Available templates:
          empty
          office
          residential
          warehouse
          retail
        `,
        stderr: '',
        executionTime: 100,
      });
      
      const result = await getAvailableTemplates();
      
      expect(commandExecutor.executeOpenStudioCommand).toHaveBeenCalledWith(
        'create',
        ['--list-templates'],
        expect.any(Object)
      );
      expect(result).toEqual(['empty', 'office', 'residential', 'warehouse', 'retail']);
    });
    
    it('should return an empty array when no templates are available', async () => {
      // Mock failed execution
      vi.spyOn(commandExecutor, 'executeOpenStudioCommand').mockResolvedValue({
        success: false,
        exitCode: 1,
        stdout: '',
        stderr: 'Error listing templates',
        executionTime: 100,
        error: 'Error listing templates',
      });
      
      const result = await getAvailableTemplates();
      
      expect(result).toEqual([]);
    });
  });
  
  describe('createModelFromTemplate', () => {
    it('should create a model from a template', async () => {
      // Mock successful execution
      vi.spyOn(commandExecutor, 'executeOpenStudioCommand').mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: 'Model created successfully',
        stderr: '',
        executionTime: 100,
      });
      
      const result = await createModelFromTemplate(
        'office',
        '/path/to/model.osm',
        { floors: 3, area: 10000 }
      );
      
      expect(commandExecutor.executeOpenStudioCommand).toHaveBeenCalledWith(
        'create',
        [
          '--template',
          'office',
          '/path/to/model.osm',
          '--floors',
          '3',
          '--area',
          '10000'
        ],
        expect.any(Object)
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        modelPath: '/path/to/model.osm',
        templateName: 'office',
        options: { floors: 3, area: 10000 },
      });
    });
    
    it('should validate template name', async () => {
      const result = await createModelFromTemplate('', '/path/to/model.osm');
      
      expect(commandExecutor.executeOpenStudioCommand).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });
  }); 
 describe('mergeModels', () => {
    it('should merge two models', async () => {
      // Mock successful execution
      vi.spyOn(commandExecutor, 'executeOpenStudioCommand').mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: 'Models merged successfully',
        stderr: '',
        executionTime: 100,
      });
      
      const result = await mergeModels(
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
    
    it('should validate model paths', async () => {
      // Mock file not existing
      const fs = require('fs');
      fs.existsSync.mockReturnValueOnce(false);
      
      const result = await mergeModels(
        '/path/to/nonexistent.osm',
        '/path/to/secondary.osm',
        '/path/to/merged.osm'
      );
      
      expect(commandExecutor.executeOpenStudioCommand).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });
  
  describe('updateModel', () => {
    it('should update a model to the latest version', async () => {
      // Mock successful execution
      vi.spyOn(commandExecutor, 'executeOpenStudioCommand').mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: 'Model updated successfully',
        stderr: '',
        executionTime: 100,
      });
      
      const result = await updateModel('/path/to/model.osm', '/path/to/updated.osm');
      
      expect(commandExecutor.executeOpenStudioCommand).toHaveBeenCalledWith(
        'model',
        ['--update', '/path/to/model.osm', '/path/to/updated.osm'],
        expect.any(Object)
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        modelPath: '/path/to/model.osm',
        outputPath: '/path/to/updated.osm',
      });
    });
    
    it('should update a model in place when no output path is specified', async () => {
      // Mock successful execution
      vi.spyOn(commandExecutor, 'executeOpenStudioCommand').mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: 'Model updated successfully',
        stderr: '',
        executionTime: 100,
      });
      
      const result = await updateModel('/path/to/model.osm');
      
      expect(commandExecutor.executeOpenStudioCommand).toHaveBeenCalledWith(
        'model',
        ['--update', '/path/to/model.osm'],
        expect.any(Object)
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        modelPath: '/path/to/model.osm',
        outputPath: '/path/to/model.osm',
      });
    });
  });
  
  describe('getModelSpaces', () => {
    it('should get the list of spaces in a model', async () => {
      // Mock successful execution
      vi.spyOn(commandExecutor, 'executeOpenStudioCommand').mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: `
          123e4567-e89b-12d3-a456-426614174000: Office 101 (100.5 m², 300.0 m³) [Office Zone]
          123e4567-e89b-12d3-a456-426614174001: Office 102 (120.0 m², 360.0 m³) [Office Zone]
          123e4567-e89b-12d3-a456-426614174002: Corridor (50.0 m², 150.0 m³)
        `,
        stderr: '',
        executionTime: 100,
      });
      
      const result = await getModelSpaces('/path/to/model.osm');
      
      expect(commandExecutor.executeOpenStudioCommand).toHaveBeenCalledWith(
        'model',
        ['--list-spaces', '/path/to/model.osm'],
        expect.any(Object)
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual([
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Office 101',
          area: 100.5,
          volume: 300.0,
          thermalZone: 'Office Zone',
        },
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          name: 'Office 102',
          area: 120.0,
          volume: 360.0,
          thermalZone: 'Office Zone',
        },
        {
          id: '123e4567-e89b-12d3-a456-426614174002',
          name: 'Corridor',
          area: 50.0,
          volume: 150.0,
        },
      ]);
    });
  });
  
  describe('getModelThermalZones', () => {
    it('should get the list of thermal zones in a model', async () => {
      // Mock successful execution
      vi.spyOn(commandExecutor, 'executeOpenStudioCommand').mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: `
          123e4567-e89b-12d3-a456-426614174000: Office Zone (spaces: 2, area: 220.5 m², volume: 660.0 m³)
          123e4567-e89b-12d3-a456-426614174001: Corridor Zone (spaces: 1, area: 50.0 m², volume: 150.0 m³)
        `,
        stderr: '',
        executionTime: 100,
      });
      
      const result = await getModelThermalZones('/path/to/model.osm');
      
      expect(commandExecutor.executeOpenStudioCommand).toHaveBeenCalledWith(
        'model',
        ['--list-zones', '/path/to/model.osm'],
        expect.any(Object)
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual([
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Office Zone',
          spaces: 2,
          area: 220.5,
          volume: 660.0,
        },
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          name: 'Corridor Zone',
          spaces: 1,
          area: 50.0,
          volume: 150.0,
        },
      ]);
    });
  });