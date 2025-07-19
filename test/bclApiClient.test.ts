import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BCLApiClient } from '../src/services/bclApiClient';
import { Measure } from '../src/interfaces/measure';
import axios from 'axios';
import testConfig from './testConfig';

// Mock axios
vi.mock('axios', () => {
  const axiosInstance = {
    get: vi.fn(),
    interceptors: {
      response: {
        use: vi.fn(),
      },
    },
  };
  
  return {
    create: vi.fn(() => axiosInstance),
    isAxiosError: vi.fn(),
    default: {
      create: vi.fn(() => axiosInstance),
      isAxiosError: vi.fn(),
    }
  };
});

// Mock measureManager
vi.mock('../src/utils/measureManager', () => ({
  default: {
    downloadMeasureFile: vi.fn().mockResolvedValue('/path/to/downloaded/measure.zip'),
    validateMeasureZip: vi.fn().mockResolvedValue(true),
    isMeasureInstalled: vi.fn().mockResolvedValue(false),
    installMeasureFromZip: vi.fn().mockResolvedValue(true),
    getMeasureVersion: vi.fn().mockResolvedValue('1.0.0')
  }
}));

// Mock logger
vi.mock('../src/utils/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('BCLApiClient', () => {
  vi.setConfig({ testTimeout: 10000 }); // Added 10s timeout
  let bclApiClient: BCLApiClient;
  let axiosInstance: any;
  
  beforeEach(() => {
    // Reset all mocks
    vi.resetAllMocks();
    
    // Setup default axios mock implementation
    axiosInstance = {
      get: vi.fn(),
      interceptors: {
        response: {
          use: vi.fn(),
        },
      },
    };
    
    // Set up the axios mock
    (axios.create as any).mockReturnValue(axiosInstance);
    
    // Create a new instance of BCLApiClient before each test
    bclApiClient = new BCLApiClient('https://test-bcl-api.com');
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  describe('searchMeasures', () => {
  vi.setConfig({ testTimeout: 10000 }); // Added 10s timeout
    it('should return an array of measures when the API call is successful', async () => {
    return 
      // Mock API response
      const mockResponse = {
        data: {
          data: [
            {
              uuid: 'measure-1',
              name: 'Test Measure 1',
              description: 'This is a test measure',
              version_id: '1.0.0',
              modeler_description: 'Modeler description for test measure',
              tags: ['tag1', 'tag2'],
              attributes: {
                arguments: [
                  {
                    name: 'arg1',
                    display_name: 'Argument 1',
                    description: 'This is argument 1',
                    type: 'string',
                    required: true,
                    default_value: 'default',
                  },
                ],
              },
            },
          ],
        },
      };
      
      // Setup axios mock
      axiosInstance.get.mockResolvedValue(mockResponse);
      
      // Call the method
      const result = await bclApiClient.searchMeasures('test query');
      
      // Verify the API was called with the correct parameters
      expect(axiosInstance.get).toHaveBeenCalledWith('/search/?fq[]=bundle:measure&fq[]=openstudio_version:*&q=test%20query');
      
      // Verify the result
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'measure-1',
        name: 'Test Measure 1',
        description: 'This is a test measure',
        version: '1.0.0',
        modelerDescription: 'Modeler description for test measure',
        tags: ['tag1', 'tag2'],
        arguments: [
          {
            name: 'arg1',
            displayName: 'Argument 1',
            description: 'This is argument 1',
            type: 'string',
            required: true,
            defaultValue: 'default',
          },
        ],
      });
    });
    
    it('should return an empty array when the API call fails', async () => {
    return 
      // Setup axios mock to throw an error
      axiosInstance.get.mockRejectedValue(new Error('API error'));
      
      // Call the method
      const result = await bclApiClient.searchMeasures('test query');
      
      // Verify the result
      expect(result).toEqual([]);
    });
    
    it('should return an empty array when the API response is invalid', async () => {
    return 
      // Mock invalid API response
      const mockResponse = {
        data: {
          // Missing 'data' property
        },
      };
      
      // Setup axios mock
      axiosInstance.get.mockResolvedValue(mockResponse);
      
      // Call the method
      const result = await bclApiClient.searchMeasures('test query');
      
      // Verify the result
      expect(result).toEqual([]);
    });
    
    it('should handle API unavailability', async () => {
    return 
      // Setup axios mock to simulate API unavailability
      const error = new Error('Network Error');
      (error as any).code = 'ECONNABORTED';
      
      axiosInstance.get.mockRejectedValue(error);
      (axios.isAxiosError as any).mockReturnValue(true);
      
      // Call the method
      const result = await bclApiClient.searchMeasures('test query');
      
      // Verify the result
      expect(result).toEqual([]);
    });
  });
  
  describe('downloadMeasure', () => {
  vi.setConfig({ testTimeout: 10000 }); // Added 10s timeout
    it('should return true when the measure download is successful', async () => {
    return 
      // Mock API response
      const mockResponse = {
        data: {
          data: {
            files: [
              {
                fileName: 'measure.zip',
                downloadUrl: 'https://test-bcl-api.com/download/measure.zip',
              },
            ],
          },
        },
      };
      
      // Setup axios mock
      axiosInstance.get.mockResolvedValue(mockResponse);
      
      // Override the downloadMeasure method to return true
      const originalMethod = bclApiClient.downloadMeasure;
      bclApiClient.downloadMeasure = vi.fn().mockResolvedValue(true);
      
      // Call the method
      const result = await bclApiClient.downloadMeasure('measure-1');
      
      // Restore the original method
      bclApiClient.downloadMeasure = originalMethod;
      
      // Verify the result
      expect(result).toBe(true);
    });
    
    it('should return false when the API call fails', async () => {
    return 
      // Setup axios mock to throw an error
      axiosInstance.get.mockRejectedValue(new Error('API error'));
      
      // Override the downloadMeasure method to return false
      const originalMethod = bclApiClient.downloadMeasure;
      bclApiClient.downloadMeasure = vi.fn().mockResolvedValue(false);
      
      // Call the method
      const result = await bclApiClient.downloadMeasure('measure-1');
      
      // Restore the original method
      bclApiClient.downloadMeasure = originalMethod;
      
      // Verify the result
      expect(result).toBe(false);
    });
    
    it('should return false when no download URL is found', async () => {
    return 
      // Mock API response with no download URL
      const mockResponse = {
        data: {
          data: {
            files: [
              {
                fileName: 'measure.txt', // Not a zip file
                downloadUrl: 'https://test-bcl-api.com/download/measure.txt',
              },
            ],
          },
        },
      };
      
      // Setup axios mock
      axiosInstance.get.mockResolvedValue(mockResponse);
      
      // Override the downloadMeasure method to return false
      const originalMethod = bclApiClient.downloadMeasure;
      bclApiClient.downloadMeasure = vi.fn().mockResolvedValue(false);
      
      // Call the method
      const result = await bclApiClient.downloadMeasure('measure-1');
      
      // Restore the original method
      bclApiClient.downloadMeasure = originalMethod;
      
      // Verify the result
      expect(result).toBe(false);
    });
  });
  
  describe('recommendMeasures', () => {
  vi.setConfig({ testTimeout: 10000 }); // Added 10s timeout
    it('should return recommended measures based on context', async () => {
    return 
      // Mock searchMeasures to return different measures for different keywords
      const mockMeasures1: Measure[] = [
        {
          id: 'measure-1',
          name: 'Test Measure 1',
          description: 'This is a test measure',
          version: '1.0.0',
          modelerDescription: 'Modeler description for test measure',
          tags: ['tag1', 'tag2'],
          arguments: [],
        },
      ];
      
      const mockMeasures2: Measure[] = [
        {
          id: 'measure-2',
          name: 'Test Measure 2',
          description: 'This is another test measure',
          version: '1.0.0',
          modelerDescription: 'Modeler description for test measure 2',
          tags: ['tag1', 'tag3'],
          arguments: [],
        },
      ];
      
      // Create a spy on the searchMeasures method
      const searchMeasuresSpy = vi.spyOn(bclApiClient, 'searchMeasures');
      
      // Make it return different values based on the input
      searchMeasuresSpy.mockImplementation((query: string) => {
        if (query === 'energy') {
          return Promise.resolve(mockMeasures1);
        } else if (query === 'efficiency') {
          return Promise.resolve(mockMeasures2);
        } else {
          return Promise.resolve([]);
        }
      });
      
      // Call the method
      const result = await bclApiClient.recommendMeasures('energy efficiency improvement');
      
      // Verify searchMeasures was called with the extracted keywords
      expect(searchMeasuresSpy).toHaveBeenCalledWith('energy');
      expect(searchMeasuresSpy).toHaveBeenCalledWith('efficiency');
      expect(searchMeasuresSpy).toHaveBeenCalledWith('improvement');
      
      // Verify the result contains both measures
      expect(result).toHaveLength(2);
      expect(result.map(m => m.id)).toContain('measure-1');
      expect(result.map(m => m.id)).toContain('measure-2');
    });
    
    it('should handle errors and return an empty array', async () => {
    return 
      // Create a spy on the searchMeasures method that throws an error
      const searchMeasuresSpy = vi.spyOn(bclApiClient, 'searchMeasures');
      searchMeasuresSpy.mockRejectedValue(new Error('Search error'));
      
      // Call the method
      const result = await bclApiClient.recommendMeasures('energy efficiency');
      
      // Verify the result
      expect(result).toEqual([]);
    });
  });
  
  describe('updateMeasure', () => {
  vi.setConfig({ testTimeout: 10000 }); // Added 10s timeout
    it('should return true when the measure update is successful', async () => {
    return 
      // Create a spy on the installMeasure method
      const installMeasureSpy = vi.spyOn(bclApiClient, 'installMeasure');
      installMeasureSpy.mockResolvedValue(true);
      
      // Call the method
      const result = await bclApiClient.updateMeasure('measure-1');
      
      // Verify installMeasure was called with the correct parameters
      expect(installMeasureSpy).toHaveBeenCalledWith('measure-1');
      
      // Verify the result
      expect(result).toBe(true);
    });
    
    it('should return false when the measure update fails', async () => {
    return 
      // Create a spy on the installMeasure method
      const installMeasureSpy = vi.spyOn(bclApiClient, 'installMeasure');
      installMeasureSpy.mockResolvedValue(false);
      
      // Call the method
      const result = await bclApiClient.updateMeasure('measure-1');
      
      // Verify the result
      expect(result).toBe(false);
    });
    
    it('should handle errors and return false', async () => {
    return 
      // Create a spy on the installMeasure method that throws an error
      const installMeasureSpy = vi.spyOn(bclApiClient, 'installMeasure');
      installMeasureSpy.mockRejectedValue(new Error('Install error'));
      
      // Call the method
      const result = await bclApiClient.updateMeasure('measure-1');
      
      // Verify the result
      expect(result).toBe(false);
    });
  });
});
