/**
 * Request handler tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Import after mocking
import { RequestHandler } from '../src/handlers/requestHandler';
import { MCPRequest } from '../src/interfaces';
import { validateRequest } from '../src/utils/validation';
import { OpenStudioCommandProcessor } from '../src/services/commandProcessor';
import { BCLApiClient } from '../src/services/bclApiClient';
import logger from '../src/utils/logger';

describe('RequestHandler', () => {
  vi.setConfig({ testTimeout: 10000 }); // Added 10s timeout
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
    return 
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
    return 
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
    return 
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
    return 
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
    return 
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
    return 
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
