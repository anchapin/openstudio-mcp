/**
 * Server integration tests
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import WebSocket from 'ws';
import { startServer } from '../../src/server';
import config from '../../src/config';

// These tests require a running server
// They are integration tests that test the full server functionality
describe('Server Integration', () => {
  let server: http.Server;
  const TEST_PORT = 3099; // Use a different port for testing
  
  beforeAll(async () => {
    // Override config port for testing
    config.server.port = TEST_PORT;
    
    // Start the server
    server = await startServer(TEST_PORT);
  });
  
  afterAll(() => {
    // Close the server
    server.close();
  });
  
  it('should respond to health check', async () => {
    const response = await fetch(`http://localhost:${TEST_PORT}/health`);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.status).toBe('ok');
    expect(data.server).toBe('OpenStudio MCP Server');
  });
  
  it('should expose capabilities endpoint', async () => {
    const response = await fetch(`http://localhost:${TEST_PORT}/capabilities`);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data).toHaveProperty('capabilities');
    expect(Array.isArray(data.capabilities)).toBe(true);
    expect(data.capabilities.length).toBeGreaterThan(0);
  });
  
  it('should handle WebSocket connections and receive capabilities', () => {
    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${TEST_PORT}`);
      
      ws.on('open', () => {
        // The server should automatically send capabilities upon connection
      });
      
      ws.on('message', (data) => {
        try {
          const response = JSON.parse(data.toString());
          
          // First message should be capabilities
          if (response.type === 'capabilities') {
            expect(response.status).toBe('success');
            expect(response.result).toHaveProperty('capabilities');
            expect(response.result).toHaveProperty('serverInfo');
            
            ws.close();
            resolve();
          }
        } catch (error) {
          reject(error);
        }
      });
      
      ws.on('error', (error) => {
        reject(error);
      });
    });
  });
  
  it('should reject invalid requests', () => {
    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${TEST_PORT}`);
      
      let receivedCapabilities = false;
      
      ws.on('open', () => {
        // Wait for capabilities message first
      });
      
      ws.on('message', (data) => {
        try {
          const response = JSON.parse(data.toString());
          
          if (!receivedCapabilities && response.type === 'capabilities') {
            receivedCapabilities = true;
            
            // Send an invalid request (missing required params)
            ws.send(JSON.stringify({ 
              id: '456', 
              type: 'openstudio.model.create', 
              params: {} // Missing required templateType and path
            }));
          } else if (receivedCapabilities) {
            // Should be an error response
            expect(response.status).toBe('error');
            expect(response).toHaveProperty('error');
            
            ws.close();
            resolve();
          }
        } catch (error) {
          reject(error);
        }
      });
      
      ws.on('error', (error) => {
        reject(error);
      });
    });
  });
});