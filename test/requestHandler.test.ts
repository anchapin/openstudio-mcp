/**
 * Request handler tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RequestHandler } from '../src/handlers/requestHandler';
import { MCPRequest } from '../src/interfaces';

// Mock logger
vi.mock('../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock validation
vi.mock('../src/utils/validation', () => ({
  validateRequest: vi.fn().mockImplementation((request) => {
    if (request.type === 'invalid.request') {
      return {
        valid: false,
        errors: ['Invalid request'],
        errorCode: 'INVALID_REQUEST'
      };
    }
    return { valid: true };
  }),
  getValidationSchema: vi.fn().mockReturnValue({})
}));

// Mock command processor
vi.mock('../src/services/commandProcessor', () => ({
  OpenStudioCommandProcessor: vi.fn().mockImplementation(() => ({
    processCommand: vi.fn().mockResolvedValue({
      success: true,
      output: 'Command processed successfully',
      data: { result: 'success' }
    })
  }))
}));

// Mock BCL API client
vi.mock('../src/services/bclApiClient', () => ({
  BCLApiClient: vi.fn().mockImplementation(() => ({
    searchMeasures: vi.fn().mockResolvedValue([
      {
        id: 'measure-1',
        name: 'Test Measure 1',
        description: 'Test measure description',
        version: '1.0.0',
        modelerDescription: 'Modeler description',
        tags: ['tag1', 'tag2'],
        arguments: []
      }
    ]),
    downloadMeasure: vi.fn().mockResolvedValue(true),
    installMeasure: vi.fn().mockResolvedValue(true),
    recommendMeasures: vi.fn().mockResolvedValue([
      {
        id: 'measure-1',
        name: 'Test Measure 1',
        description: 'Test measure description',
        version: '1.0.0',
        modelerDescription: 'Modeler description',
        tags: ['tag1', 'tag2'],
        arguments: []
      }
    ])
  }))
}));

// Mock model creation service
vi.mock('../src/services/modelCreationService', () => ({
  default: {
    createModel: vi.fn().mockResolvedValue({
      success: true,
      modelPath: '/path/to/model.osm',
      data: { modelInfo: 'test info' }
    })
  }
}));

// Mock OpenStudio commands
vi.mock('../src/utils/openStudioCommands', () => ({
  getModelInfo: vi.fn().mockResolvedValue({
    success: true,
    output: 'Model info',
    data: { modelInfo: 'test info' }
  })
}));

// Mock simulation service
vi.mock('../src/services/simulationService', () => ({
  default: {
    configureSimulationParameters: vi.fn().mockResolvedValue({
      modelPath: '/path/to/model.osm',
      weatherFile: '/path/to/weather.epw',
      outputDirectory: '/path/to/output',
      options: { designDaysOnly: false }
    }),
    runSimulation: vi.fn().mockResolvedValue({
      success: true,
      output: 'Simulation completed',
      data: { results: 'test results' }
    }),
    processSimulationResults: vi.fn().mockReturnValue({
      status: 'complete',
      id: 'sim-123',
      output: 'Simulation completed',
      duration: 10,
      outputDirectory: '/path/to/output',
      errors: [],
      warnings: [],
      eui: 100,
      totalSiteEnergy: 1000,
      totalSourceEnergy: 2000,
      electricityConsumption: 500,
      naturalGasConsumption: 500,
      districtHeatingConsumption: 0,
      districtCoolingConsumption: 0,
      cpuUsage: 50,
      memoryUsage: 1024
    }),
    getSimulationStatus: vi.fn().mockReturnValue({
      id: 'sim-123',
      status: 'complete',
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      duration: 10,
      outputDirectory: '/path/to/output',
      errors: [],
      warnings: [],
      eui: 100,
      totalSiteEnergy: 1000,
      totalSourceEnergy: 2000,
      electricityConsumption: 500,
      naturalGasConsumption: 500,
      districtHeatingConsumption: 0,
      districtCoolingConsumption: 0,
      cpuUsage: 50,
      memoryUsage: 1024
    }),
    cancelSimulation: vi.fn().mockReturnValue(true)
  }
}));

// Mock measure application service
vi.mock('../src/services/measureApplicationService', () => ({
  default: {
    mapMeasureParameters: vi.fn().mockResolvedValue({
      param1: 'mapped-value1',
      param2: 'mapped-value2'
    }),
    downloadAndApplyMeasure: vi.fn().mockResolvedValue({
      success: true,
      outputModelPath: '/path/to/output.osm',
      originalModelPath: '/path/to/model.osm',
      measureId: 'measure-1',
      arguments: { param1: 'value1' },
      warnings: [],
      output: 'Measure applied successfully'
    }),
    applyMeasure: vi.fn().mockResolvedValue({
      success: true,
      outputModelPath: '/path/to/output.osm',
      originalModelPath: '/path/to/model.osm',
      measureId: 'measure-1',
      arguments: { param1: 'value1' },
      warnings: [],
      output: 'Measure applied successfully'
    })
  }
}));

describe('RequestHandler', () => {
  let requestHandler: RequestHandler;
  
  beforeEach(() => {
    vi.clearAllMocks();
    requestHandler = new RequestHandler();
  });
  
  describe('constructor', () => {
    it('should register default handlers', () => {
      const handlers = requestHandler.getHandlers();
      expect(handlers.size).toBeGreaterThan(0);
      expect(handlers.has('openstudio.model.create')).toBe(true);
      expect(handlers.has('openstudio.simulation.run')).toBe(true);
      expect(handlers.has('openstudio.bcl.search')).toBe(true);
      expect(handlers.has('openstudio.measure.apply')).toBe(true);
    });
  });
  
  describe('handleRequest', () => {
    it('should handle a valid request', async () => {
      const request: MCPRequest = {
        id: 'test-id',
        type: 'openstudio.model.create',
        params: {
          templateType: 'empty',
          path: '/path/to/model.osm'
        }
      };
      
      const response = await requestHandler.handleRequest(request);
      
      expect(response.id).toBe('test-id');
      expect(response.type).toBe('openstudio.model.create');
      expect(response.status).toBe('success');
      expect(response.result).toBeDefined();
    });
    
    it('should reject an invalid request', async () => {
      const request: MCPRequest = {
        id: 'test-id',
        type: 'invalid.request',
        params: {}
      };
      
      const response = await requestHandler.handleRequest(request);
      
      expect(response.id).toBe('test-id');
      expect(response.type).toBe('invalid.request');
      expect(response.status).toBe('error');
      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe('INVALID_REQUEST');
    });
    
    it('should reject a request with an unknown type', async () => {
      const request: MCPRequest = {
        id: 'test-id',
        type: 'unknown.type',
        params: {}
      };
      
      const response = await requestHandler.handleRequest(request);
      
      expect(response.id).toBe('test-id');
      expect(response.type).toBe('unknown.type');
      expect(response.status).toBe('error');
      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe('UNKNOWN_REQUEST_TYPE');
    });
    
    it('should handle errors during handler execution', async () => {
      // Create a handler that throws an error
      requestHandler.registerHandler(
        'test.error',
        () => { throw new Error('Test error'); },
        {},
        'Test error handler'
      );
      
      const request: MCPRequest = {
        id: 'test-id',
        type: 'test.error',
        params: {}
      };
      
      const response = await requestHandler.handleRequest(request);
      
      expect(response.id).toBe('test-id');
      expect(response.type).toBe('test.error');
      expect(response.status).toBe('error');
      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe('INTERNAL_ERROR');
    });
  });
  
  describe('Model handlers', () => {
    it('should handle model create request', async () => {
      const request: MCPRequest = {
        id: 'test-id',
        type: 'openstudio.model.create',
        params: {
          templateType: 'empty',
          path: '/path/to/model.osm'
        }
      };
      
      const response = await requestHandler.handleRequest(request);
      
      expect(response.status).toBe('success');
      expect(response.result?.data).toHaveProperty('modelPath');
    });
    
    it('should handle model open request', async () => {
      const request: MCPRequest = {
        id: 'test-id',
        type: 'openstudio.model.open',
        params: {
          path: '/path/to/model.osm'
        }
      };
      
      const response = await requestHandler.handleRequest(request);
      
      expect(response.status).toBe('success');
      expect(response.result?.data).toHaveProperty('modelPath');
      expect(response.result?.data).toHaveProperty('modelInfo');
    });
    
    it('should handle model info request', async () => {
      const request: MCPRequest = {
        id: 'test-id',
        type: 'openstudio.model.info',
        params: {
          modelPath: '/path/to/model.osm',
          detailLevel: 'detailed'
        }
      };
      
      const response = await requestHandler.handleRequest(request);
      
      expect(response.status).toBe('success');
      expect(response.result?.data).toHaveProperty('modelInfo');
    });
  });
  
  describe('Simulation handlers', () => {
    it('should handle simulation run request', async () => {
      const request: MCPRequest = {
        id: 'test-id',
        type: 'openstudio.simulation.run',
        params: {
          modelPath: '/path/to/model.osm',
          weatherFile: '/path/to/weather.epw',
          outputDirectory: '/path/to/output',
          autoConfig: true
        }
      };
      
      const response = await requestHandler.handleRequest(request);
      
      expect(response.status).toBe('success');
      expect(response.result?.data).toHaveProperty('simulationId');
      expect(response.result?.data).toHaveProperty('status');
      expect(response.result?.data).toHaveProperty('results');
    });
    
    it('should handle simulation status request', async () => {
      const request: MCPRequest = {
        id: 'test-id',
        type: 'openstudio.simulation.status',
        params: {
          simulationId: 'sim-123'
        }
      };
      
      const response = await requestHandler.handleRequest(request);
      
      expect(response.status).toBe('success');
      expect(response.result?.data).toHaveProperty('simulationId');
      expect(response.result?.data).toHaveProperty('status');
    });
    
    it('should handle simulation cancel request', async () => {
      const request: MCPRequest = {
        id: 'test-id',
        type: 'openstudio.simulation.cancel',
        params: {
          simulationId: 'sim-123'
        }
      };
      
      const response = await requestHandler.handleRequest(request);
      
      expect(response.status).toBe('success');
      expect(response.result?.data).toHaveProperty('simulationId');
      expect(response.result?.data).toHaveProperty('cancelled');
      expect(response.result?.data.cancelled).toBe(true);
    });
  });
  
  describe('BCL handlers', () => {
    it('should handle BCL search request', async () => {
      const request: MCPRequest = {
        id: 'test-id',
        type: 'openstudio.bcl.search',
        params: {
          query: 'energy efficiency',
          limit: 10
        }
      };
      
      const response = await requestHandler.handleRequest(request);
      
      expect(response.status).toBe('success');
      expect(response.result?.data).toHaveProperty('measures');
      expect(response.result?.data).toHaveProperty('query');
      expect(Array.isArray(response.result?.data.measures)).toBe(true);
    });
    
    it('should handle BCL download request', async () => {
      const request: MCPRequest = {
        id: 'test-id',
        type: 'openstudio.bcl.download',
        params: {
          measureId: 'measure-1'
        }
      };
      
      const response = await requestHandler.handleRequest(request);
      
      expect(response.status).toBe('success');
      expect(response.result?.data).toHaveProperty('measureId');
      expect(response.result?.data).toHaveProperty('installed');
      expect(response.result?.data.installed).toBe(true);
    });
    
    it('should handle BCL recommend request', async () => {
      const request: MCPRequest = {
        id: 'test-id',
        type: 'openstudio.bcl.recommend',
        params: {
          context: 'energy efficiency improvement',
          modelPath: '/path/to/model.osm',
          limit: 5
        }
      };
      
      const response = await requestHandler.handleRequest(request);
      
      expect(response.status).toBe('success');
      expect(response.result?.data).toHaveProperty('measures');
      expect(response.result?.data).toHaveProperty('context');
      expect(Array.isArray(response.result?.data.measures)).toBe(true);
    });
  });
  
  describe('Measure handlers', () => {
    it('should handle measure apply request', async () => {
      const request: MCPRequest = {
        id: 'test-id',
        type: 'openstudio.measure.apply',
        params: {
          modelPath: '/path/to/model.osm',
          measureId: 'measure-1',
          arguments: { param1: 'value1' },
          mapParameters: true,
          downloadIfNeeded: true
        }
      };
      
      const response = await requestHandler.handleRequest(request);
      
      expect(response.status).toBe('success');
      expect(response.result?.data).toHaveProperty('modelPath');
      expect(response.result?.data).toHaveProperty('measureId');
      expect(response.result?.data).toHaveProperty('arguments');
    });
  });
});