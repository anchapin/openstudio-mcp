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
    
    this.setupStdioHandler();
    this.log('Simple MCP Server started');
  }
  
  setupStdioHandler() {
    this.rl.on('line', (line) => {
      if (!line.trim()) return;
      
      try {
        const request = JSON.parse(line);
        this.handleMCPRequest(request);
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
          // Respond immediately to initialize
          this.sendResponse({
            id,
            result: {
              protocolVersion: '2024-11-05',
              capabilities: {
                tools: {}
              },
              serverInfo: {
                name: 'OpenStudio MCP Server (Simple)',
                version: '0.1.0'
              }
            }
          });
          this.log(`Initialize response sent for ${id}`);
          break;
          
        case 'tools/list':
          this.handleToolsList(id);
          this.log(`Tools list response sent for ${id}`);
          break;
          
        case 'tools/call':
          this.handleToolCall(id, params);
          break;
          
        default:
          this.sendError(id, 'METHOD_NOT_FOUND', `Unknown method: ${method}`);
          this.log(`Unknown method error sent for ${id}: ${method}`);
      }
    } catch (error) {
      this.log(`Error handling request: ${error}`);
      this.sendError(id, 'INTERNAL_ERROR', error.message);
    }
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
      id,
      result: {
        tools: tools
      }
    });
  }
  
  async handleToolCall(id, params) {
    const { name, arguments: args } = params;
    
    this.log(`Tool call: ${name} (id: ${id})`);
    
    try {
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
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      this.sendResponse({
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
      
      this.sendResponse({
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
  }
  
  sendResponse(response) {
    process.stdout.write(JSON.stringify(response) + '\n');
  }
  
  sendError(id, code, message, details = null) {
    this.sendResponse({
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