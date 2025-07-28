#!/usr/bin/env node

/**
 * Silent MCP stdio server for OpenStudio MCP
 * This version produces no stderr output to avoid VS Code "error" logs
 */

const readline = require('readline');

class SilentMCPServer {
  constructor() {
    // Setup stdio interface
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false
    });
    
    this.setupStdioHandler();
    // No startup message - completely silent
  }
  
  setupStdioHandler() {
    this.rl.on('line', (line) => {
      if (!line.trim()) return;
      
      try {
        const request = JSON.parse(line);
        this.handleMCPRequest(request);
      } catch (error) {
        // Silent error handling - just send error response
        this.sendError(null, 'PARSE_ERROR', 'Invalid JSON in request');
      }
    });
    
    this.rl.on('close', () => {
      // Silent close
    });
  }
  
  handleMCPRequest(request) {
    const { id, method, params } = request;
    
    try {
      switch (method) {
        case 'initialize':
          this.sendResponse({
            id,
            result: {
              protocolVersion: '2024-11-05',
              capabilities: {
                tools: {}
              },
              serverInfo: {
                name: 'OpenStudio MCP Server',
                version: '0.1.0'
              }
            }
          });
          break;
          
        case 'tools/list':
          this.handleToolsList(id);
          break;
          
        case 'tools/call':
          this.handleToolCall(id, params);
          break;
          
        default:
          this.sendError(id, 'METHOD_NOT_FOUND', `Unknown method: ${method}`);
      }
    } catch (error) {
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
    
    try {
      // Make HTTP request to the OpenStudio server
      const response = await fetch('http://localhost:3000/mcp/tools/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name,
          arguments: args
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      this.sendResponse({
        id,
        result: result
      });
      
    } catch (error) {
      this.sendResponse({
        id,
        result: {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}\n\nThis tool requires the OpenStudio MCP server to be running on http://localhost:3000`
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
}

// Add fetch polyfill for older Node versions
if (!global.fetch) {
  try {
    global.fetch = require('node-fetch');
  } catch (error) {
    // Fallback if node-fetch is not available
    global.fetch = () => Promise.reject(new Error('fetch not available'));
  }
}

// Handle process signals silently
process.on('SIGINT', () => {
  process.exit(0);
});

process.on('SIGTERM', () => {
  process.exit(0);
});

// Start the silent MCP server
new SilentMCPServer();