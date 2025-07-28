#!/usr/bin/env node

/**
 * MCP stdio server for OpenStudio MCP
 * This implements the standard MCP protocol over stdio for VS Code integration
 */

const WebSocket = require('ws');
const readline = require('readline');

class MCPStdioServer {
  constructor() {
    this.serverUrl = 'ws://localhost:3000';
    this.ws = null;
    this.requestId = 1;
    this.connected = false;
    this.capabilities = [];
    
    // Setup stdio interface
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false
    });
    
    this.connect();
    this.setupStdioHandler();
  }
  
  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.serverUrl);
      
      // Set a connection timeout
      const timeout = setTimeout(() => {
        this.log('Connection timeout - proceeding without WebSocket');
        this.connected = false;
        resolve(); // Don't reject, just proceed
      }, 2000);
      
      this.ws.on('open', () => {
        clearTimeout(timeout);
        this.connected = true;
        this.log('Connected to OpenStudio MCP Server');
        resolve();
      });
      
      this.ws.on('message', (data) => {
        try {
          const response = JSON.parse(data.toString());
          this.handleServerMessage(response);
        } catch (error) {
          this.log(`Error parsing server response: ${error}`);
        }
      });
      
      this.ws.on('error', (error) => {
        clearTimeout(timeout);
        this.log(`WebSocket error: ${error}`);
        // Don't reject immediately, try to continue
        this.connected = false;
        resolve();
      });
      
      this.ws.on('close', () => {
        this.connected = false;
        this.log('Disconnected from OpenStudio MCP Server');
        // Don't exit immediately, let MCP client handle it
      });
    });
  }
  
  handleServerMessage(response) {
    // Store capabilities when received
    if (response.type === 'capabilities' && response.result && response.result.capabilities) {
      this.capabilities = response.result.capabilities;
      return;
    }
    
    // Forward other responses to stdout
    this.sendResponse(response);
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
      if (this.ws) {
        this.ws.close();
      }
    });
  }
  
  async handleMCPRequest(request) {
    const { id, method, params } = request;
    
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
                name: 'OpenStudio MCP Server',
                version: '0.1.0'
              }
            }
          });
          break;
          
        case 'tools/list':
          await this.handleToolsList(id);
          break;
          
        case 'tools/call':
          if (!this.connected) {
            this.sendError(id, 'CONNECTION_ERROR', 'OpenStudio server not available');
            return;
          }
          await this.handleToolCall(id, params);
          break;
          
        default:
          this.sendError(id, 'METHOD_NOT_FOUND', `Unknown method: ${method}`);
      }
    } catch (error) {
      this.log(`Error handling request: ${error}`);
      this.sendError(id, 'INTERNAL_ERROR', error.message);
    }
  }
  
  async handleToolsList(id) {
    // If not connected, provide fallback capabilities
    if (!this.connected || this.capabilities.length === 0) {
      const fallbackTools = this.getFallbackTools();
      this.sendResponse({
        id,
        result: {
          tools: fallbackTools
        }
      });
      return;
    }
    
    const tools = this.capabilities.map(cap => ({
      name: cap.name,
      description: cap.description,
      inputSchema: {
        type: 'object',
        properties: this.convertParametersToSchema(cap.parameters),
        required: this.getRequiredParameters(cap.parameters)
      }
    }));
    
    this.sendResponse({
      id,
      result: {
        tools: tools
      }
    });
  }
  
  async handleToolCall(id, params) {
    const { name, arguments: args } = params;
    
    // Convert to OpenStudio MCP format
    const openStudioRequest = {
      id: `tool-${this.requestId++}`,
      type: name,
      params: args || {}
    };
    
    // Send to OpenStudio server and wait for response
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(openStudioRequest));
      
      // Set up one-time listener for this specific request
      const responseHandler = (data) => {
        try {
          const response = JSON.parse(data.toString());
          if (response.id === openStudioRequest.id) {
            this.ws.removeListener('message', responseHandler);
            
            // Convert response to MCP format
            if (response.status === 'success') {
              this.sendResponse({
                id,
                result: {
                  content: [
                    {
                      type: 'text',
                      text: JSON.stringify(response.result, null, 2)
                    }
                  ]
                }
              });
            } else {
              this.sendError(id, 'TOOL_ERROR', response.error?.message || 'Tool execution failed', response.error);
            }
          }
        } catch (error) {
          this.log(`Error parsing tool response: ${error}`);
          this.sendError(id, 'TOOL_ERROR', 'Error parsing tool response');
        }
      };
      
      this.ws.on('message', responseHandler);
      
      // Set timeout for tool call
      setTimeout(() => {
        this.ws.removeListener('message', responseHandler);
        this.sendError(id, 'TIMEOUT', 'Tool call timed out');
      }, 30000);
    } else {
      this.sendError(id, 'CONNECTION_ERROR', 'Not connected to OpenStudio server');
    }
  }
  
  async requestCapabilities() {
    return new Promise((resolve) => {
      if (this.capabilities.length > 0) {
        resolve();
        return;
      }
      
      // Capabilities are sent automatically on connection
      // Wait a bit for them to arrive
      setTimeout(() => {
        resolve();
      }, 1000);
    });
  }
  
  convertParametersToSchema(parameters) {
    const schema = {};
    for (const [key, param] of Object.entries(parameters)) {
      schema[key] = {
        type: param.type || 'string',
        description: param.description || ''
      };
      
      if (param.enum) {
        schema[key].enum = param.enum;
      }
      
      if (param.properties) {
        schema[key].properties = param.properties;
      }
    }
    return schema;
  }
  
  getRequiredParameters(parameters) {
    return Object.entries(parameters)
      .filter(([_, param]) => param.required)
      .map(([key, _]) => key);
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
  
  getFallbackTools() {
    return [
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
      }
    ];
  }
  
  log(message) {
    process.stderr.write(`[MCP] ${message}\n`);
  }
}

// Handle process signals
process.on('SIGINT', () => {
  process.exit(0);
});

process.on('SIGTERM', () => {
  process.exit(0);
});

// Start the MCP stdio server
new MCPStdioServer();