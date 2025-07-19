/**
 * MCP Server tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import http from 'http';

// Mock logger first
vi.mock('../src/utils/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock WebSocket
vi.mock('ws', () => {
  const MockWebSocketServer = vi.fn().mockImplementation(() => {
    const mockWss = new EventEmitter();
    mockWss.clients = new Set();
    mockWss.close = vi.fn((callback) => {
      if (callback) callback();
    });
    return mockWss;
  });
  
  const MockWebSocket = vi.fn().mockImplementation(() => {
    const mockWs = new EventEmitter();
    mockWs.send = vi.fn();
    mockWs.close = vi.fn();
    return mockWs;
  });
  
  return {
    WebSocketServer: MockWebSocketServer,
    WebSocket: MockWebSocket
  };
});

// Mock http server
vi.mock('http', () => {
  const mockServer = {
    listen: vi.fn((port, callback) => {
      if (callback) callback();
      return mockServer;
    }),
    close: vi.fn((callback) => {
      if (callback) callback();
    })
  };
  
  return {
    createServer: vi.fn(() => mockServer),
    Server: vi.fn(() => mockServer)
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

// Mock validation
vi.mock('../src/utils/validation', () => {
  return {
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
  };
});

// Mock request handler
vi.mock('../src/handlers/requestHandler', () => {
  return {
    RequestHandler: vi.fn().mockImplementation(() => ({
      handleRequest: vi.fn().mockImplementation(async (request) => {
        return {
          id: request.id,
          type: request.type,
          success: true,
          data: { result: 'success' }
        };
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
    }
  }
}));

// Import after mocking
import { WebSocket, WebSocketServer } from 'ws';
import { MCPServer } from '../src/services/mcpServer';
import { MCPRequest } from '../src/interfaces';
import { validateRequest } from '../src/utils/validation';
import { RequestHandler } from '../src/handlers/requestHandler';
import logger from '../src/utils/logger';

describe('MCPServer', () => {
  let mcpServer: MCPServer;
  let mockHttpServer: http.Server;
  let mockWsServer: WebSocketServer;
  let mockRequestHandler: RequestHandler;
  
  beforeEach(() => {
    // Reset all mocks
    vi.resetAllMocks();
    
    // Create a new instance of MCPServer for each test
    mcpServer = new MCPServer(3000);
    mockHttpServer = mcpServer['httpServer'];
    mockWsServer = mcpServer['wsServer'];
    mockRequestHandler = mcpServer['requestHandler'];
  });
  
  afterEach(() => {
    // Clean up
    vi.clearAllMocks();
  });
  
  describe('constructor', () => {
    it('should create a new MCPServer instance', () => {
      expect(mcpServer).toBeInstanceOf(MCPServer);
    });
    
    it('should initialize with default values', () => {
      expect(mcpServer.port).toBe(3000);
      expect(mcpServer.clients).toEqual(new Set());
    });
    
    it('should initialize with custom port', () => {
      const customServer = new MCPServer(4000);
      expect(customServer.port).toBe(4000);
    });
  });
  
  describe('getCapabilities', () => {
    it('should return server capabilities', () => {
      const capabilities = mcpServer.getCapabilities();
      
      expect(capabilities).toHaveProperty('serverInfo');
      expect(capabilities.serverInfo).toHaveProperty('name');
      expect(capabilities.serverInfo).toHaveProperty('version');
    });
  });
  
  describe('start', () => {
    it('should start the server on the specified port', async () => {
      await mcpServer.start();
      
      expect(mockHttpServer.listen).toHaveBeenCalledWith(3000, expect.any(Function));
    });
    
    it('should handle errors when starting the server', async () => {
      (mockHttpServer.listen as any).mockImplementation(() => {
        throw new Error('Failed to start server');
      });
      
      await expect(mcpServer.start()).rejects.toThrow('Failed to start server');
    });
  });
  
  describe('stop', () => {
    it('should close the server', async () => {
      // Start the server first
      await mcpServer.start();
      
      // Stop the server
      await mcpServer.stop();
      
      expect(mockHttpServer.close).toHaveBeenCalled();
      expect(mockWsServer.close).toHaveBeenCalled();
    });
    
    it('should handle case when server is not running', async () => {
      // Don't start the server
      mcpServer.server = undefined;
      
      // Stop the server
      await mcpServer.stop();
      
      // No error should be thrown
    });
  });
  
  describe('handleConnection', () => {
    it('should handle a WebSocket connection', () => {
      const ws = new WebSocket('ws://localhost:3000');
      mcpServer.handleConnection(ws);
      
      expect(mcpServer.clients.size).toBe(1);
      expect(mcpServer.clients.has(ws)).toBe(true);
      expect(ws.send).toHaveBeenCalled();
    });
    
    it('should handle a message from a client', () => {
      const ws = new WebSocket('ws://localhost:3000');
      mcpServer.handleConnection(ws);
      
      // Simulate a message event
      const message = JSON.stringify({
        id: '123',
        type: 'valid.request',
        params: {}
      });
      
      ws.emit('message', message);
      
      // The request handler should be called
      expect(mockRequestHandler.handleRequest).toHaveBeenCalled();
    });
    
    it('should handle an invalid message from a client', () => {
      const ws = new WebSocket('ws://localhost:3000');
      mcpServer.handleConnection(ws);
      
      // Simulate an invalid message event
      const message = 'invalid json';
      
      ws.emit('message', message);
      
      // The client should receive an error response
      expect(ws.send).toHaveBeenCalledWith(expect.stringContaining('error'));
    });
    
    it('should handle client disconnection', () => {
      const ws = new WebSocket('ws://localhost:3000');
      mcpServer.handleConnection(ws);
      
      // Simulate a close event
      ws.emit('close');
      
      expect(mcpServer.clients.size).toBe(0);
    });
    
    it('should handle WebSocket errors', () => {
      const ws = new WebSocket('ws://localhost:3000');
      mcpServer.handleConnection(ws);
      
      // Simulate an error event
      ws.emit('error', new Error('WebSocket error'));
      
      // The error should be logged
      expect(logger.error).toHaveBeenCalled();
    });
  });
  
  describe('broadcast', () => {
    it('should send a message to all connected clients', () => {
      // Create multiple clients
      const ws1 = new WebSocket('ws://localhost:3000');
      const ws2 = new WebSocket('ws://localhost:3000');
      
      mcpServer.handleConnection(ws1);
      mcpServer.handleConnection(ws2);
      
      // Reset the mock to clear the initial capabilities message
      vi.mocked(ws1.send).mockClear();
      vi.mocked(ws2.send).mockClear();
      
      // Broadcast a message
      const message = { type: 'broadcast', data: 'test' };
      mcpServer.broadcast(message);
      
      // Both clients should receive the message
      expect(ws1.send).toHaveBeenCalledWith(JSON.stringify(message));
      expect(ws2.send).toHaveBeenCalledWith(JSON.stringify(message));
    });
    
    it('should handle errors when sending to clients', () => {
      // Create a client
      const ws = new WebSocket('ws://localhost:3000');
      mcpServer.handleConnection(ws);
      
      // Make send throw an error
      vi.mocked(ws.send).mockImplementation(() => {
        throw new Error('Send error');
      });
      
      // Reset the mock to clear the initial capabilities message
      vi.mocked(ws.send).mockClear();
      
      // Broadcast a message
      const message = { type: 'broadcast', data: 'test' };
      mcpServer.broadcast(message);
      
      // The error should be caught and the client should be removed
      expect(mcpServer.clients.size).toBe(0);
    });
  });
});
