#!/usr/bin/env node

/**
 * Simple MCP stdio server for OpenStudio MCP
 * This provides immediate responses to avoid timeout issues
 */

const readline = require('readline');

class SimpleMCPServer {
  constructor() {
    // Setup stdio interface
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false
    });
    
    // Track pending requests to handle cancellations
    this.pendingRequests = new Map();
    
    this.setupStdioHandler();
    this.log('Simple MCP Server started');
  }
  
  setupStdioHandler() {
    this.rl.on('line', (line) => {
      if (!line.trim()) return;
      
      this.log(`Received: ${line.trim()}`);
      
      try {
        const request = JSON.parse(line);
        // Handle request immediately without any delays
        setImmediate(() => this.handleMCPRequest(request));
      } catch (error) {
        this.log(`Error parsing stdin: ${error}`);
        this.sendError(null, 'PARSE_ERROR', 'Invalid JSON in request');
      }
    });
    
    this.rl.on('close', () => {
      this.log('MCP Server closed');
    });
  }
  
  handleMCPRequest(request) {
    const { id, method, params } = request;
    
    // Log the request for debugging
    this.log(`Handling request: ${method} (id: ${id})`);
    
    try {
      switch (method) {
        case 'initialize':
          // Respond immediately to initialize with proper capabilities
          const initResponse = {
            jsonrpc: '2.0',
            id,
            result: {
              protocolVersion: '2024-11-05',
              capabilities: {
                tools: {
                  listChanged: false
                },
                resources: {
                  subscribe: false,
                  listChanged: false
                }
              },
              serverInfo: {
                name: 'OpenStudio MCP Server (Simple)',
                version: '0.1.0'
              }
            }
          };
          this.sendResponse(initResponse);
          this.log(`Initialize response sent for ${id}`);
          break;
          
        case 'tools/list':
          this.handleToolsList(id);
          this.log(`Tools list response sent for ${id}`);
          break;
          
        case 'tools/call':
          this.handleToolCall(id, params);
          break;
          
        case 'resources/list':
          this.handleResourcesList(id);
          this.log(`Resources list response sent for ${id}`);
          break;
          
        case 'resources/templates/list':
          this.handleResourceTemplatesList(id);
          this.log(`Resource templates list response sent for ${id}`);
          break;
          
        case 'notifications/cancelled':
          // Handle cancellation notifications - these don't need a response
          const cancelledId = params?.requestId;
          if (cancelledId && this.pendingRequests.has(cancelledId)) {
            this.pendingRequests.delete(cancelledId);
            this.log(`Request cancelled: ${cancelledId}`);
          } else {
            this.log(`Request cancelled: ${cancelledId || 'unknown'}`);
          }
          return; // Don't send a response for notifications
          
        case 'notifications/initialized':
          // Handle initialized notifications - these don't need a response
          this.log('Client initialized');
          return; // Don't send a response for notifications
          
        default:
          // Check if it's a notification (no response expected)
          if (method.startsWith('notifications/')) {
            this.log(`Unhandled notification: ${method}`);
            return; // Don't send error responses for notifications
          }
          
          this.sendError(id, 'METHOD_NOT_FOUND', `Unknown method: ${method}`);
          this.log(`Unknown method error sent for ${id}: ${method}`);
      }
    } catch (error) {
      this.log(`Error handling request: ${error}`);
      this.sendError(id, 'INTERNAL_ERROR', error.message);
    }
  }
  
  handleResourcesList(id) {
    // Return empty resources list since we don't have any resources
    this.sendResponse({
      jsonrpc: '2.0',
      id,
      result: {
        resources: []
      }
    });
  }
  
  handleResourceTemplatesList(id) {
    // Return empty resource templates list since we don't have any templates
    this.sendResponse({
      jsonrpc: '2.0',
      id,
      result: {
        resourceTemplates: []
      }
    });
  }
  
  handleToolsList(id) {
    const tools = [
      {
        name: 'openstudio.model.create',
        description: 'Create a new OpenStudio model',
        inputSchema: {
          type: 'object',
          properties: {
            templateType: {
              type: 'string',
              description: 'Type of template to use',
              enum: ['empty', 'office', 'residential']
            },
            path: {
              type: 'string',
              description: 'Path to save the model'
            }
          },
          required: ['templateType', 'path']
        }
      },
      {
        name: 'openstudio.model.info',
        description: 'Get information about an OpenStudio model',
        inputSchema: {
          type: 'object',
          properties: {
            modelPath: {
              type: 'string',
              description: 'Path to the model file'
            },
            detailLevel: {
              type: 'string',
              description: 'Level of detail',
              enum: ['basic', 'detailed', 'complete']
            }
          },
          required: ['modelPath']
        }
      },
      {
        name: 'openstudio.bcl.search',
        description: 'Search for measures in the Building Component Library',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results'
            }
          },
          required: ['query']
        }
      },
      {
        name: 'openstudio.bcl.recommend',
        description: 'Get measure recommendations based on context',
        inputSchema: {
          type: 'object',
          properties: {
            context: {
              type: 'string',
              description: 'Context description for recommendations'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of recommendations'
            }
          },
          required: ['context']
        }
      },
      {
        name: 'openstudio.simulation.run',
        description: 'Run an OpenStudio simulation',
        inputSchema: {
          type: 'object',
          properties: {
            modelPath: {
              type: 'string',
              description: 'Path to the model file'
            },
            weatherFile: {
              type: 'string',
              description: 'Path to weather file'
            }
          },
          required: ['modelPath']
        }
      }
    ];
    
    this.sendResponse({
      jsonrpc: '2.0',
      id,
      result: {
        tools: tools
      }
    });
  }
  
  async handleToolCall(id, params) {
    const { name, arguments: args } = params;
    
    this.log(`Tool call: ${name} (id: ${id})`);
    
    // Track this request
    this.pendingRequests.set(id, { name, startTime: Date.now() });
    
    try {
      // Check if request was cancelled before starting
      if (!this.pendingRequests.has(id)) {
        this.log(`Request ${id} was cancelled before execution`);
        return;
      }
      
      // Add timeout protection
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      // Make HTTP request to the OpenStudio server
      const response = await fetch('http://localhost:3000/mcp/tools/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name,
          arguments: args
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // Check if request was cancelled during execution
      if (!this.pendingRequests.has(id)) {
        this.log(`Request ${id} was cancelled during execution`);
        return;
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      this.sendResponse({
        jsonrpc: '2.0',
        id,
        result: result
      });
      
      this.log(`Tool call completed: ${name} (id: ${id})`);
      
    } catch (error) {
      this.log(`Tool call error: ${error.message}`);
      
      let errorMessage = `Error: ${error.message}`;
      
      if (error.name === 'AbortError') {
        errorMessage = 'Tool call timed out after 10 seconds';
      } else if (error.code === 'ECONNREFUSED') {
        errorMessage = 'OpenStudio MCP server is not running. Please start it with: npm start';
      }
      
      // Only send response if request wasn't cancelled
      if (this.pendingRequests.has(id)) {
        this.sendResponse({
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: `${errorMessage}\n\nMake sure the OpenStudio MCP server is running on http://localhost:3000`
              }
            ]
          }
        });
      }
    } finally {
      // Clean up pending request
      this.pendingRequests.delete(id);
    }
  }
  
  sendResponse(response) {
    // Ensure all responses have the required jsonrpc field
    if (!response.jsonrpc) {
      response.jsonrpc = '2.0';
    }
    
    const responseStr = JSON.stringify(response) + '\n';
    process.stdout.write(responseStr);
    // Force flush to ensure immediate delivery
    if (process.stdout.flush) {
      process.stdout.flush();
    }
    this.log(`Response sent for id ${response.id}`);
  }
  
  sendError(id, code, message, details = null) {
    this.sendResponse({
      jsonrpc: '2.0',
      id,
      error: {
        code,
        message,
        data: details
      }
    });
  }
  
  log(message) {
    // Always log for debugging timeout issues
    process.stderr.write(`[SimpleMCP] ${message}\n`);
  }
}

// Add fetch polyfill for older Node versions
if (!global.fetch) {
  try {
    global.fetch = require('node-fetch');
  } catch (error) {
    // Fallback if node-fetch is not available - use built-in fetch for Node 18+
    if (typeof fetch !== 'undefined') {
      global.fetch = fetch;
    } else {
      global.fetch = () => Promise.reject(new Error('fetch not available - install node-fetch or use Node 18+'));
    }
  }
}

// Handle process signals
process.on('SIGINT', () => {
  process.exit(0);
});

process.on('SIGTERM', () => {
  process.exit(0);
});

// Start the simple MCP server
new SimpleMCPServer();