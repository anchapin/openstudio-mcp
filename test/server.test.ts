/**
 * Server tests
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import WebSocket from 'ws';
import { startServer } from '../src/server';

describe('Server', () => {
  let server: http.Server;
  const TEST_PORT = 3001;
  
  beforeAll(async () => {
    server = await startServer(TEST_PORT);
  });
  
  afterAll(() => {
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
  
  it('should handle WebSocket connections and receive capabilities', (done) => {
    const ws = new WebSocket(`ws://localhost:${TEST_PORT}`);
    
    ws.on('open', () => {
      // The server should automatically send capabilities upon connection
    });
    
    ws.on('message', (data) => {
      const response = JSON.parse(data.toString());
      
      // First message should be capabilities
      if (response.type === 'capabilities') {
        expect(response.status).toBe('success');
        expect(response.result).toHaveProperty('capabilities');
        expect(response.result).toHaveProperty('serverInfo');
        
        // Now send a test request
        ws.send(JSON.stringify({ 
          id: '123', 
          type: 'openstudio.model.create', 
          params: {
            templateType: 'empty',
            path: '/tmp/test.osm'
          } 
        }));
      } else {
        // Response to our test request
        expect(response.id).toBe('123');
        expect(response.type).toBe('openstudio.model.create');
        expect(response.status).toBe('success');
        
        ws.close();
        done();
      }
    });
  });
  
  it('should reject invalid requests', (done) => {
    const ws = new WebSocket(`ws://localhost:${TEST_PORT}`);
    
    let receivedCapabilities = false;
    
    ws.on('open', () => {
      // Wait for capabilities message first
    });
    
    ws.on('message', (data) => {
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
        done();
      }
    });
  });
});