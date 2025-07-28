#!/usr/bin/env node

/**
 * MCP Client Wrapper for OpenStudio MCP Server
 * This wrapper connects to the WebSocket server and translates MCP stdio protocol
 */

const WebSocket = require('ws');
const readline = require('readline');

class MCPClientWrapper {
  constructor(serverUrl = 'ws://localhost:3000') {
    this.serverUrl = serverUrl;
    this.ws = null;
    this.requestId = 1;
    this.pendingRequests = new Map();
    this.connected = false;
    
    // Setup stdin/stdout for MCP protocol
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false
    });
    
    this.connect();
    this.setupStdinHandler();
  }
  
  connect() {
    this.ws = new WebSocket(this.serverUrl);
    
    this.ws.on('open', () => {
      this.connected = true;
      process.stderr.write('Connected to OpenStudio MCP Server\n');
    });
    
    this.ws.on('message', (data) => {
      try {
        const response = JSON.parse(data.toString());
        
        // Filter out capabilities messages unless specifically requested
        if (response.type === 'capabilities' && response.id === 'server') {
          // Only forward capabilities if it was requested
          if (!this.pendingRequests.has('capabilities')) {
            return;
          }
        }
        
        // Forward response to stdout for MCP client
        process.stdout.write(JSON.stringify(response) + '\n');
      } catch (error) {
        process.stderr.write(`Error parsing server response: ${error}\n`);
      }
    });
    
    this.ws.on('error', (error) => {
      process.stderr.write(`WebSocket error: ${error}\n`);
    });
    
    this.ws.on('close', () => {
      this.connected = false;
      process.stderr.write('Disconnected from OpenStudio MCP Server\n');
      process.exit(1);
    });
  }
  
  setupStdinHandler() {
    this.rl.on('line', (line) => {
      if (!line.trim()) return;
      
      try {
        const request = JSON.parse(line);
        
        // Add request ID if not present
        if (!request.id) {
          request.id = `req-${this.requestId++}`;
        }
        
        // Track capabilities requests
        if (request.method === 'tools/list' || request.type === 'capabilities') {
          this.pendingRequests.set('capabilities', true);
        }
        
        // Convert MCP method calls to OpenStudio MCP format if needed
        if (request.method && !request.type) {
          request.type = this.convertMethodToType(request.method);
          request.params = request.params || {};
        }
        
        // Send to WebSocket server
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify(request));
        } else {
          process.stderr.write('WebSocket not connected\n');
          // Send error response
          const errorResponse = {
            id: request.id,
            error: {
              code: 'CONNECTION_ERROR',
              message: 'WebSocket not connected'
            }
          };
          process.stdout.write(JSON.stringify(errorResponse) + '\n');
        }
      } catch (error) {
        process.stderr.write(`Error parsing stdin: ${error}\n`);
      }
    });
    
    this.rl.on('close', () => {
      if (this.ws) {
        this.ws.close();
      }
    });
  }
  
  convertMethodToType(method) {
    // Convert standard MCP methods to OpenStudio MCP types
    const methodMap = {
      'tools/list': 'capabilities',
      'tools/call': 'tool_call'
    };
    
    return methodMap[method] || method;
  }
}

// Handle process signals
process.on('SIGINT', () => {
  process.exit(0);
});

process.on('SIGTERM', () => {
  process.exit(0);
});

// Start the wrapper
new MCPClientWrapper();