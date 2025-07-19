/**
 * Request handler tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock logger first
vi.mock('../src/utils/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock validation
vi.mock('../src/utils/validation', () => {
  const mockValidateRequest = vi.fn((request) => {
    console.log('Mock validateRequest called with:', request);
    if (request.type === 'invalid.request') {
      return {
        valid: false,
        errors: ['Invalid request'],
        errorCode: 'INVALID_REQUEST'
      };
    }
    return { 
      valid: true,
      errors: undefined,
      errorCode: undefined
    };
  });
  
  console.log('Setting up validation mock with mockValidateRequest:', mockValidateRequest);
  
  return {
    validateRequest: mockValidateRequest,
    getValidationSchema: vi.fn().mockReturnValue({})
  };
});

// Mock command processor
vi.mock('../src/services/commandProcessor', () => {
  return {
    OpenStudioCommandProcessor: vi.fn().mockImplementation(() => ({
      processCommand: vi.fn().mockImplementation(async (command, args) => {
        if (command === 'error.command') {
          throw new Error('Command processing error');
        }
        return {
          success: true,
          output: 'Command processed successfully',
          data: { result: 'success' }
        };
      })
    }))
  };
});

// Mock BCL API client
vi.mock('../src/services/bclApiClient', () => {
  return {
    BCLApiClient: vi.fn().mockImplementation(() => ({
      searchMeasures: vi.fn().mockResolvedValue([
        {
          id: 'measure-1',
          name: 'Test Measure 1',
          description: 'Test measure description',
          version: '1.0.0'
        }
      ]),
      downloadMeasure: vi.fn().mockResolvedValue({
        success: true,
        path: '/path/to/measure'
      })
    }))
  };
});

// Mock config
vi.mock('../src/config', () => ({
  default: {
    server: {
      port: 3000
    },
    logging: {
      level: 'info',
      prettyPrint: false
    },
    bcl: {
      apiUrl: 'https://bcl.nrel.gov/api/v1'
    }
  }
}));

// Import after mocking
import { RequestHandler } from '../src/handlers/requestHandler';
import { MCPRequest } from '../src/interfaces';
import { validateRequest } from '../src/utils/validation';
import { OpenStudioCommandProcessor } from '../src/services/commandProcessor';
import { BCLApiClient } from '../src/services/bclApiClient';
import logger from '../src/utils/logger';

describe('RequestHandler', () => {
  let requestHandler: RequestHandler;
  let mockRequest: MCPRequest;
  
  beforeEach(() => {
    // Reset all mocks
    vi.resetAllMocks();
    
    // Create a new instance of RequestHandler for each test
    requestHandler = new RequestHandler();
    
    mockRequest = {
      id: 'test-request-id',
      type: 'openstudio.run',
      params: {
        command: 'run',
        args: ['--arg1', '--arg2']
      }
    };
  });
  
  afterEach(() => {
    // Clean up
    vi.clearAllMocks();
  });
  
  it('should handle valid requests successfully', async () => {
    const response = await requestHandler.handleRequest(mockRequest);
    
    expect(response).toEqual({
      id: 'test-request-id',
      type: 'openstudio.run',
      status: 'success',
      result: {
        output: 'Command processed successfully',
        data: { result: 'success' }
      }
    });
    expect(validateRequest).toHaveBeenCalledWith(mockRequest);
  });
  
  it('should reject invalid requests', async () => {
    const invalidRequest = {
      ...mockRequest,
      type: 'invalid.request'
    };
    
    const response = await requestHandler.handleRequest(invalidRequest);
    
    expect(response).toEqual({
      id: 'test-request-id',
      type: 'invalid.request',
      status: 'error',
      error: {
        code: 'INVALID_REQUEST',
        message: 'Invalid request format or parameters',
        details: ['Invalid request']
      }
    });
    expect(validateRequest).toHaveBeenCalledWith(invalidRequest);
  });
  
  it('should handle errors during command processing', async () => {
    mockRequest.params.command = 'error.command';
    
    const response = await requestHandler.handleRequest(mockRequest);
    
    expect(response).toEqual({
      id: 'test-request-id',
      type: 'openstudio.run',
      status: 'error',
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        details: 'Command processing error'
      }
    });
  });
  
  it('should handle BCL measure search requests', async () => {
    const bclRequest = {
      id: 'bcl-request-id',
      type: 'openstudio.bcl.search',
      params: {
        query: 'test measure'
      }
    };
    
    const response = await requestHandler.handleRequest(bclRequest);
    
    expect(response).toEqual({
      id: 'bcl-request-id',
      type: 'openstudio.bcl.search',
      status: 'success',
      result: {
        output: expect.any(String),
        data: {
          measures: [{
            id: 'measure-1',
            name: 'Test Measure 1',
            description: 'Test measure description',
            version: '1.0.0'
          }],
          totalFound: 1,
          query: 'test measure'
        }
      }
    });
  });
  
  it('should handle BCL measure download requests', async () => {
    const bclRequest = {
      id: 'bcl-request-id',
      type: 'openstudio.bcl.download',
      params: {
        measureId: 'measure-1'
      }
    };
    
    const response = await requestHandler.handleRequest(bclRequest);
    
    expect(response).toEqual({
      id: 'bcl-request-id',
      type: 'openstudio.bcl.download',
      status: 'success',
      result: {
        output: expect.any(String),
        data: {
          measureId: 'measure-1',
          installed: true,
          location: expect.stringContaining('measure-1')
        }
      }
    });
  });
  
  it('should handle unknown request types', async () => {
    const unknownRequest = {
      ...mockRequest,
      type: 'unknown.request'
    };
    
    const response = await requestHandler.handleRequest(unknownRequest);
    
    expect(response).toEqual({
      id: 'test-request-id',
      type: 'unknown.request',
      status: 'error',
      error: {
        code: 'UNKNOWN_REQUEST_TYPE',
        message: expect.stringContaining('Unknown request type'),
        details: {
          availableTypes: expect.any(Array)
        }
      }
    });
  });
});
