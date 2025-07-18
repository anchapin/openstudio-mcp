/**
 * MCP Server tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MCPServer } from '../src/services/mcpServer';
import { MCPRequest } from '../src/interfaces';
import { EventEmitter } from 'events';

// Mock WebSocket
vi.mock('ws', () => {
  return {
    default: vi.fn().mockImplementation(() => {
      const mockWs = new EventEmitter();
      mockWs.send = vi.fn();
      mockWs.close = vi.fn();
      return mockWs;
    })
  };
});

// Mock child_process
vi.mock('child_process', () => {
  return {
    exec: vi.fn((cmd, callback) => {
      if (cmd.includes('--version')) {
        callback(null, { stdout: 'OpenStudio 3.5.0\n' });
      } else {
        callback(new Error('Command not found'));
      }
    }),
    spawn: vi.fn()
  };
});

// Mock logger
vi.mock('../src/utils/logger', async () => {
  return {
    default: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    },
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    }
  };
});

// Mock validation
vi.mock('../src/utils/validation', () => {
  return {
    validateRequest: vi.fn().mockImplementation((request) => {
      if (request.type === 'invalid.request') {
        return { valid: false, errors: ['Invalid request'] };
      }
      return { valid: true };
    })
  };
});

// Mock RequestHandler and RequestRouter
vi.mock('../src/handlers/requestRouter', () => {
  return {
    RequestRouter: vi.fn().mockImplementation(() => ({
      routeRequest: vi.fn().mockImplementation((request) => {
        if (request.type === 'openstudio.model.create') {
          return Promise.resolve({
            success: true,
            output: 'Model created successfully',
            data: { modelPath: '/path/to/model.osm' }
          });
        } else if (request.type === 'error.test') {
          return Promise.resolve({
            success: false,
            output: '',
            error: 'Test error'
          });
        } else {
          return Promise.reject(new Error('Unknown request type'));
        }
      })
    }))
  };
});

// Mock responseFormatter
vi.mock('../src/services/responseFormatter', () => {
  return {
    default: {
      formatResponse: vi.fn().mockImplementation((id, type, result, options) => {
        if (result.success) {
          return {
            id,
            type,
            status: 'success',
            result: {
              output: result.output,
              data: result.data
            }
          };
        } else {
          return {
            id,
            type,
            status: 'error',
            error: {
              code: 'COMMAND_FAILED',
              message: result.error
            }
          };
        }
      }),
      formatError: vi.fn().mockImplementation((id, type, message, code, details, options) => {
        return {
          id,
          type,
          status: 'error',
          error: {
            code,
            message,
            details
          }
        };
      })
    }
  };
});

describe('MCPServer', () => {
  let mcpServer: MCPServer;
  
  beforeEach(() => {
    vi.clearAllMocks();
    mcpServer = new MCPServer();
  });
  
  describe('constructor', () => {
    it('should initialize capabilities', () => {
      expect(mcpServer.getCapabilities().length).toBeGreaterThan(0);
    });
  });
  
  describe('registerCapabilities', () => {
    it('should register capabilities', () => {
      mcpServer.registerCapabilities();
      // This is mostly a logging function, so we just verify it doesn't throw
      expect(mcpServer.getCapabilities().length).toBeGreaterThan(0);
    });
  });
  
  describe('validateRequest', () => {
    it('should validate a valid request', () => {
      const request: MCPRequest = {
        id: 'test-id',
        type: 'openstudio.model.create',
        params: {
          templateType: 'empty',
          path: '/path/to/model.osm'
        }
      };
      
      expect(mcpServer.validateRequest(request)).toBe(true);
    });
    
    it('should reject an invalid request', () => {
      const request: MCPRequest = {
        id: 'test-id',
        type: 'invalid.request',
        params: {}
      };
      
      expect(mcpServer.validateRequest(request)).toBe(false);
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
      
      const response = await mcpServer.handleRequest(request);
      
      expect(response.id).toBe('test-id');
      expect(response.type).toBe('openstudio.model.create');
      expect(response.status).toBe('success');
      expect(response.result).toBeDefined();
      expect(response.result?.output).toBe('Model created successfully');
      expect(response.result?.data).toHaveProperty('modelPath');
    });
    
    it('should handle an error response', async () => {
      const request: MCPRequest = {
        id: 'test-id',
        type: 'error.test',
        params: {}
      };
      
      const response = await mcpServer.handleRequest(request);
      
      expect(response.id).toBe('test-id');
      expect(response.type).toBe('error.test');
      expect(response.status).toBe('error');
      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe('COMMAND_FAILED');
      expect(response.error?.message).toBe('Test error');
    });
    
    it('should handle an unexpected error', async () => {
      const request: MCPRequest = {
        id: 'test-id',
        type: 'unknown.type',
        params: {}
      };
      
      const response = await mcpServer.handleRequest(request);
      
      expect(response.id).toBe('test-id');
      expect(response.type).toBe('unknown.type');
      expect(response.status).toBe('error');
      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe('INTERNAL_ERROR');
    });
  });
  
  describe('handleConnection', () => {
    it('should handle a WebSocket connection', () => {
      const WebSocket = require('ws').default;
      const ws = new WebSocket('ws://localhost:3000');
      mcpServer.handleConnection(ws);
      
      // Should send capabilities on connection
      expect(ws.send).toHaveBeenCalled();
      
      // Parse the sent message
      const sentMessage = JSON.parse((ws.send as any).mock.calls[0][0]);
      expect(sentMessage.type).toBe('capabilities');
      expect(sentMessage.status).toBe('success');
      expect(sentMessage.result).toHaveProperty('capabilities');
      expect(sentMessage.result).toHaveProperty('serverInfo');
    });
    
    it('should handle a message from a client', () => {
      const WebSocket = require('ws').default;
      const ws = new WebSocket('ws://localhost:3000');
      mcpServer.handleConnection(ws);
      
      // Reset the mock to clear the capabilities message
      (ws.send as any).mockClear();
      
      // Emit a message event with a valid request
      ws.emit('message', JSON.stringify({
        id: 'test-id',
        type: 'openstudio.model.create',
        params: {
          templateType: 'empty',
          path: '/path/to/model.osm'
        }
      }));
      
      // Should send a response
      expect(ws.send).toHaveBeenCalled();
    });
    
    it('should handle an invalid message from a client', () => {
      const WebSocket = require('ws').default;
      const ws = new WebSocket('ws://localhost:3000');
      mcpServer.handleConnection(ws);
      
      // Reset the mock to clear the capabilities message
      (ws.send as any).mockClear();
      
      // Emit a message event with invalid JSON
      ws.emit('message', 'not json');
      
      // Should send an error response
      expect(ws.send).toHaveBeenCalled();
      const sentMessage = JSON.parse((ws.send as any).mock.calls[0][0]);
      expect(sentMessage.status).toBe('error');
    });
    
    it('should handle client disconnection', () => {
      const WebSocket = require('ws').default;
      const ws = new WebSocket('ws://localhost:3000');
      mcpServer.handleConnection(ws);
      
      // Emit a close event
      ws.emit('close');
      
      // No assertions needed, just verifying it doesn't throw
    });
    
    it('should handle WebSocket errors', () => {
      const WebSocket = require('ws').default;
      const ws = new WebSocket('ws://localhost:3000');
      mcpServer.handleConnection(ws);
      
      // Emit an error event
      ws.emit('error', new Error('WebSocket error'));
      
      // No assertions needed, just verifying it doesn't throw
    });
  });
});