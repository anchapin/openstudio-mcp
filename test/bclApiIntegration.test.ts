import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RequestHandler } from '../src/handlers/requestHandler';
import { BCLApiClient } from '../src/services/bclApiClient';
import { Measure } from '../src/interfaces/measure';

// Mock the BCLApiClient
vi.mock('../src/services/bclApiClient', () => {
  return {
    BCLApiClient: vi.fn().mockImplementation(() => ({
      searchMeasures: vi.fn(),
      downloadMeasure: vi.fn(),
      installMeasure: vi.fn(),
      recommendMeasures: vi.fn(),
      updateMeasure: vi.fn()
    }))
  };
});

// Mock the logger
vi.mock('../src/utils/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock the config
vi.mock('../src/config', () => ({
  default: {
    bcl: {
      apiUrl: 'https://test-bcl-api.com',
      measuresDir: '/test/measures'
    }
  }
}));

// Mock the measure manager
vi.mock('../src/utils/measureManager', () => ({
  default: {
    downloadMeasureFile: vi.fn(),
    validateMeasureZip: vi.fn(),
    installMeasureFromZip: vi.fn(),
    isMeasureInstalled: vi.fn(),
    getMeasureVersion: vi.fn()
  }
}));

// Mock the validation utils
vi.mock('../src/utils/validation', () => ({
  getValidationSchema: vi.fn().mockReturnValue({}),
  validateRequest: vi.fn().mockReturnValue({ valid: true })
}));

// Mock the OpenStudioCommandProcessor
vi.mock('../src/services/commandProcessor', () => ({
  OpenStudioCommandProcessor: vi.fn().mockImplementation(() => ({}))
}));

// Mock the openStudioCommands
vi.mock('../src/utils', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  },
  commandExecutor: {},
  openStudioCommands: {}
}));

describe('BCL API Integration with RequestHandler', () => {
  let requestHandler: RequestHandler;
  let mockBclApiClient: any;
  
  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
    
    // Create a new instance of RequestHandler
    requestHandler = new RequestHandler();
    
    // Get the mocked BCLApiClient instance
    mockBclApiClient = (BCLApiClient as unknown as jest.Mock).mock.results[0].value;
  });
  
  describe('handleBclSearch', () => {
    it('should call searchMeasures with the correct query', async () => {
      // Setup mock response
      const mockMeasures: Measure[] = [
        {
          id: 'measure-1',
          name: 'Test Measure 1',
          description: 'This is a test measure',
          version: '1.0.0',
          modelerDescription: 'Modeler description for test measure',
          tags: ['tag1', 'tag2'],
          arguments: []
        }
      ];
      mockBclApiClient.searchMeasures.mockResolvedValue(mockMeasures);
      
      // Call the method using handleRequest
      const result = await (requestHandler as any).handleBclSearch({
        query: 'test query'
      });
      
      // Verify searchMeasures was called with the correct query
      expect(mockBclApiClient.searchMeasures).toHaveBeenCalledWith('test query');
      
      // Verify the result
      expect(result.success).toBe(true);
      expect(result.data.measures).toEqual(mockMeasures);
      expect(result.data.query).toBe('test query');
    });
    
    it('should return an error when query is missing', async () => {
      // Call the method without a query
      const result = await (requestHandler as any).handleBclSearch({});
      
      // Verify searchMeasures was not called
      expect(mockBclApiClient.searchMeasures).not.toHaveBeenCalled();
      
      // Verify the result
      expect(result.success).toBe(false);
      expect(result.error).toContain('query is required');
    });
    
    it('should apply limit when specified', async () => {
      // Setup mock response with multiple measures
      const mockMeasures: Measure[] = [
        {
          id: 'measure-1',
          name: 'Test Measure 1',
          description: 'This is a test measure',
          version: '1.0.0',
          modelerDescription: 'Modeler description for test measure',
          tags: ['tag1', 'tag2'],
          arguments: []
        },
        {
          id: 'measure-2',
          name: 'Test Measure 2',
          description: 'This is another test measure',
          version: '1.0.0',
          modelerDescription: 'Modeler description for test measure 2',
          tags: ['tag1', 'tag3'],
          arguments: []
        },
        {
          id: 'measure-3',
          name: 'Test Measure 3',
          description: 'This is yet another test measure',
          version: '1.0.0',
          modelerDescription: 'Modeler description for test measure 3',
          tags: ['tag2', 'tag3'],
          arguments: []
        }
      ];
      mockBclApiClient.searchMeasures.mockResolvedValue(mockMeasures);
      
      // Call the method with a limit
      const result = await (requestHandler as any).handleBclSearch({
        query: 'test query',
        limit: 2
      });
      
      // Verify the result
      expect(result.success).toBe(true);
      expect(result.data.measures.length).toBe(2);
      expect(result.data.totalFound).toBe(3);
    });
    
    it('should handle errors from the BCL API client', async () => {
      // Setup mock to throw an error
      mockBclApiClient.searchMeasures.mockRejectedValue(new Error('API error'));
      
      // Call the method
      const result = await (requestHandler as any).handleBclSearch({
        query: 'test query'
      });
      
      // Verify the result
      expect(result.success).toBe(false);
      expect(result.error).toBe('API error');
    });
  });
  
  describe('handleBclDownload', () => {
    it('should call downloadMeasure and installMeasure with the correct measureId', async () => {
      // Setup mock responses
      mockBclApiClient.downloadMeasure.mockResolvedValue(true);
      mockBclApiClient.installMeasure.mockResolvedValue(true);
      
      // Call the method
      const result = await (requestHandler as any).handleBclDownload({
        measureId: 'measure-1'
      });
      
      // Verify downloadMeasure was called with the correct measureId
      expect(mockBclApiClient.downloadMeasure).toHaveBeenCalledWith('measure-1');
      
      // Verify installMeasure was called with the correct measureId
      expect(mockBclApiClient.installMeasure).toHaveBeenCalledWith('measure-1');
      
      // Verify the result
      expect(result.success).toBe(true);
      expect(result.data.measureId).toBe('measure-1');
      expect(result.data.installed).toBe(true);
    });
    
    it('should return an error when measureId is missing', async () => {
      // Call the method without a measureId
      const result = await (requestHandler as any).handleBclDownload({});
      
      // Verify downloadMeasure was not called
      expect(mockBclApiClient.downloadMeasure).not.toHaveBeenCalled();
      
      // Verify the result
      expect(result.success).toBe(false);
      expect(result.error).toContain('measureId is required');
    });
    
    it('should return an error when download fails', async () => {
      // Setup mock responses
      mockBclApiClient.downloadMeasure.mockResolvedValue(false);
      
      // Call the method
      const result = await (requestHandler as any).handleBclDownload({
        measureId: 'measure-1'
      });
      
      // Verify installMeasure was not called
      expect(mockBclApiClient.installMeasure).not.toHaveBeenCalled();
      
      // Verify the result
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to download measure');
    });
    
    it('should return an error when installation fails', async () => {
      // Setup mock responses
      mockBclApiClient.downloadMeasure.mockResolvedValue(true);
      mockBclApiClient.installMeasure.mockResolvedValue(false);
      
      // Call the method
      const result = await (requestHandler as any).handleBclDownload({
        measureId: 'measure-1'
      });
      
      // Verify the result
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to install measure');
    });
    
    it('should handle errors from the BCL API client', async () => {
      // Setup mock to throw an error
      mockBclApiClient.downloadMeasure.mockRejectedValue(new Error('API error'));
      
      // Call the method
      const result = await (requestHandler as any).handleBclDownload({
        measureId: 'measure-1'
      });
      
      // Verify the result
      expect(result.success).toBe(false);
      expect(result.error).toBe('API error');
    });
  });
  
  describe('handleBclRecommend', () => {
    it('should call recommendMeasures with the correct context', async () => {
      // Setup mock response
      const mockMeasures: Measure[] = [
        {
          id: 'measure-1',
          name: 'Test Measure 1',
          description: 'This is a test measure',
          version: '1.0.0',
          modelerDescription: 'Modeler description for test measure',
          tags: ['tag1', 'tag2'],
          arguments: []
        }
      ];
      mockBclApiClient.recommendMeasures.mockResolvedValue(mockMeasures);
      
      // Call the method
      const result = await (requestHandler as any).handleBclRecommend({
        context: 'energy efficiency'
      });
      
      // Verify recommendMeasures was called with the correct context
      expect(mockBclApiClient.recommendMeasures).toHaveBeenCalledWith('energy efficiency');
      
      // Verify the result
      expect(result.success).toBe(true);
      expect(result.data.measures).toEqual(mockMeasures);
      expect(result.data.context).toBe('energy efficiency');
    });
    
    it('should return an error when context is missing', async () => {
      // Call the method without a context
      const result = await (requestHandler as any).handleBclRecommend({});
      
      // Verify recommendMeasures was not called
      expect(mockBclApiClient.recommendMeasures).not.toHaveBeenCalled();
      
      // Verify the result
      expect(result.success).toBe(false);
      expect(result.error).toContain('context is required');
    });
    
    it('should apply limit when specified', async () => {
      // Setup mock response with multiple measures
      const mockMeasures: Measure[] = [
        {
          id: 'measure-1',
          name: 'Test Measure 1',
          description: 'This is a test measure',
          version: '1.0.0',
          modelerDescription: 'Modeler description for test measure',
          tags: ['tag1', 'tag2'],
          arguments: []
        },
        {
          id: 'measure-2',
          name: 'Test Measure 2',
          description: 'This is another test measure',
          version: '1.0.0',
          modelerDescription: 'Modeler description for test measure 2',
          tags: ['tag1', 'tag3'],
          arguments: []
        }
      ];
      mockBclApiClient.recommendMeasures.mockResolvedValue(mockMeasures);
      
      // Call the method with a limit
      const result = await (requestHandler as any).handleBclRecommend({
        context: 'energy efficiency',
        limit: 1
      });
      
      // Verify the result
      expect(result.success).toBe(true);
      expect(result.data.measures.length).toBe(1);
      expect(result.data.totalFound).toBe(2);
    });
    
    it('should handle model path parameter', async () => {
      // Setup mock response
      const mockMeasures: Measure[] = [
        {
          id: 'measure-1',
          name: 'Test Measure 1',
          description: 'This is a test measure',
          version: '1.0.0',
          modelerDescription: 'Modeler description for test measure',
          tags: ['tag1', 'tag2'],
          arguments: []
        }
      ];
      mockBclApiClient.recommendMeasures.mockResolvedValue(mockMeasures);
      
      // Call the method with a model path
      const result = await (requestHandler as any).handleBclRecommend({
        context: 'energy efficiency',
        modelPath: '/path/to/model.osm'
      });
      
      // Verify recommendMeasures was called with the correct context
      expect(mockBclApiClient.recommendMeasures).toHaveBeenCalledWith('energy efficiency');
      
      // Verify the result
      expect(result.success).toBe(true);
      expect(result.data.measures).toEqual(mockMeasures);
    });
    
    it('should handle errors from the BCL API client', async () => {
      // Setup mock to throw an error
      mockBclApiClient.recommendMeasures.mockRejectedValue(new Error('API error'));
      
      // Call the method
      const result = await (requestHandler as any).handleBclRecommend({
        context: 'energy efficiency'
      });
      
      // Verify the result
      expect(result.success).toBe(false);
      expect(result.error).toBe('API error');
    });
  });
});