/**
 * MCP Server implementation
 */
import WebSocket from 'ws';
import { MCPRequest, MCPResponse, MCPServerInterface } from '../interfaces';
import { logger } from '../utils';
import { validateRequest } from '../utils/validation';
import { RequestHandler } from '../handlers';
import { RequestRouter } from '../handlers/requestRouter';
import responseFormatter from './responseFormatter';
import config from '../config';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Create singleton instances of the RequestHandler and RequestRouter
const requestHandler = new RequestHandler();
const requestRouter = new RequestRouter(requestHandler);

/**
 * MCP Server capabilities
 */
export interface MCPCapability {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

/**
 * MCP Server implementation
 */
export class MCPServer implements MCPServerInterface {
  private capabilities: MCPCapability[] = [];
  private clients: Map<WebSocket, { id: string }> = new Map();
  private openStudioVersion: string = 'Unknown';

  /**
   * Constructor
   */
  constructor() {
    this.initializeCapabilities();
    this.detectOpenStudioVersion();
  }

  /**
   * Detect OpenStudio version
   */
  private async detectOpenStudioVersion(): Promise<void> {
    try {
      const { stdout } = await execAsync(`${config.openStudio.cliPath} --version`);
      this.openStudioVersion = stdout.trim();
      logger.info(`Detected OpenStudio version: ${this.openStudioVersion}`);
    } catch (error) {
      logger.warn(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to detect OpenStudio version. Make sure OpenStudio CLI is installed and available in your PATH.'
      );
    }
  }

  /**
   * Initialize server capabilities
   */
  private initializeCapabilities(): void {
    // Register OpenStudio model capabilities
    this.capabilities.push({
      name: 'openstudio.model.create',
      description: 'Create a new OpenStudio model',
      parameters: {
        templateType: {
          type: 'string',
          description: 'Type of template to use',
          enum: ['empty', 'office', 'residential', 'retail', 'warehouse', 'school', 'hospital'],
          required: true,
        },
        path: {
          type: 'string',
          description: 'Path to save the model',
          required: true,
        },
        options: {
          type: 'object',
          description: 'Template options',
          required: false,
          properties: {
            buildingType: {
              type: 'string',
              description: 'Building type (e.g., MediumOffice, MidriseApartment)',
              required: false,
            },
            buildingVintage: {
              type: 'string',
              description: 'Building vintage (e.g., 90.1-2013)',
              required: false,
            },
            climateZone: {
              type: 'string',
              description: 'Climate zone (e.g., ASHRAE 169-2013-5A)',
              required: false,
            },
            weatherFilePath: {
              type: 'string',
              description: 'Path to weather file',
              required: false,
            },
            floorArea: {
              type: 'number',
              description: 'Floor area in square meters',
              required: false,
            },
            numStories: {
              type: 'number',
              description: 'Number of stories',
              required: false,
            },
            aspectRatio: {
              type: 'number',
              description: 'Aspect ratio (length/width)',
              required: false,
            },
            floorToFloorHeight: {
              type: 'number',
              description: 'Floor to floor height in meters',
              required: false,
            },
            includeHVAC: {
              type: 'boolean',
              description: 'Whether to include HVAC systems',
              required: false,
            },
          },
        },
        includeDefaultMeasures: {
          type: 'boolean',
          description: 'Whether to include default measures for the template type',
          required: false,
        },
      },
    });

    this.capabilities.push({
      name: 'openstudio.model.open',
      description: 'Open an existing OpenStudio model',
      parameters: {
        path: {
          type: 'string',
          description: 'Path to the model file',
          required: true,
        },
      },
    });

    this.capabilities.push({
      name: 'openstudio.model.save',
      description: 'Save an OpenStudio model',
      parameters: {
        path: {
          type: 'string',
          description: 'Path to save the model',
          required: true,
        },
      },
    });
    
    this.capabilities.push({
      name: 'openstudio.model.info',
      description: 'Get information about an OpenStudio model',
      parameters: {
        modelPath: {
          type: 'string',
          description: 'Path to the model file',
          required: true,
        },
        detailLevel: {
          type: 'string',
          description: 'Level of detail to include in the model information',
          enum: ['basic', 'detailed', 'complete'],
          required: false,
        },
      },
    });

    // Register OpenStudio simulation capabilities
    this.capabilities.push({
      name: 'openstudio.simulation.run',
      description: 'Run an OpenStudio simulation',
      parameters: {
        modelPath: {
          type: 'string',
          description: 'Path to the model file',
          required: true,
        },
        weatherFile: {
          type: 'string',
          description: 'Path to the weather file',
          required: false,
        },
        outputDirectory: {
          type: 'string',
          description: 'Directory to save simulation results',
          required: false,
        },
      },
    });

    // Register BCL capabilities
    this.capabilities.push({
      name: 'openstudio.bcl.search',
      description: 'Search for measures in the Building Component Library',
      parameters: {
        query: {
          type: 'string',
          description: 'Search query',
          required: true,
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return',
          required: false,
        },
      },
    });

    this.capabilities.push({
      name: 'openstudio.bcl.download',
      description: 'Download a measure from the Building Component Library',
      parameters: {
        measureId: {
          type: 'string',
          description: 'ID of the measure to download',
          required: true,
        },
      },
    });
    
    this.capabilities.push({
      name: 'openstudio.bcl.recommend',
      description: 'Get measure recommendations based on context',
      parameters: {
        context: {
          type: 'string',
          description: 'Context description for measure recommendation',
          required: true,
        },
        modelPath: {
          type: 'string',
          description: 'Optional path to a model file for context-aware recommendations',
          required: false,
        },
        limit: {
          type: 'number',
          description: 'Maximum number of recommendations to return',
          required: false,
        },
      },
    });

    // Register measure capabilities
    this.capabilities.push({
      name: 'openstudio.measure.apply',
      description: 'Apply a measure to an OpenStudio model',
      parameters: {
        modelPath: {
          type: 'string',
          description: 'Path to the model file',
          required: true,
        },
        measurePath: {
          type: 'string',
          description: 'Path to the measure directory',
          required: true,
        },
        arguments: {
          type: 'object',
          description: 'Measure arguments',
          required: false,
        },
      },
    });

    logger.info(`Initialized ${this.capabilities.length} capabilities`);
  }

  /**
   * Register capabilities with the MCP client
   */
  public registerCapabilities(): void {
    logger.info('Registering capabilities with MCP client');
    // In a real implementation, this would send the capabilities to the MCP client
    // For now, we just log them
    logger.info({ capabilities: this.capabilities }, 'Registered capabilities');
  }

  /**
   * Handle a WebSocket connection
   * @param ws WebSocket connection
   */
  public handleConnection(ws: WebSocket): void {
    const clientId = `client-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    this.clients.set(ws, { id: clientId });
    logger.info({ clientId }, 'Client connected');

    ws.on('message', async (message: WebSocket.Data) => {
      try {
        const request = JSON.parse(message.toString()) as MCPRequest;
        logger.info({ clientId, request }, 'Received request');

        // Validate the request
        if (!this.validateRequest(request)) {
          const errorResponse: MCPResponse = {
            id: request.id || 'unknown',
            type: request.type || 'unknown',
            status: 'error',
            error: {
              code: 'INVALID_REQUEST',
              message: 'Invalid request format',
            },
          };
          ws.send(JSON.stringify(errorResponse));
          return;
        }

        // Process the request
        const response = await this.handleRequest(request);
        ws.send(JSON.stringify(response));
      } catch (error) {
        logger.error({ clientId, error }, 'Error processing message');
        const errorResponse: MCPResponse = {
          id: 'unknown',
          type: 'unknown',
          status: 'error',
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : String(error),
          },
        };
        ws.send(JSON.stringify(errorResponse));
      }
    });

    ws.on('close', () => {
      logger.info({ clientId }, 'Client disconnected');
      this.clients.delete(ws);
    });

    ws.on('error', (error: Error) => {
      logger.error({ clientId, error: error.message }, 'WebSocket error');
    });

    // Send capabilities to the client
    this.sendCapabilities(ws);
  }

  /**
   * Send capabilities to a client
   * @param ws WebSocket connection
   */
  private sendCapabilities(ws: WebSocket): void {
    const client = this.clients.get(ws);
    if (!client) return;

    const capabilitiesResponse: MCPResponse = {
      id: 'server',
      type: 'capabilities',
      status: 'success',
      result: {
        capabilities: this.capabilities,
        serverInfo: {
          name: 'OpenStudio MCP Server',
          version: process.env.npm_package_version || '0.1.0',
          openStudioVersion: this.openStudioVersion,
        },
      },
    };

    ws.send(JSON.stringify(capabilitiesResponse));
    logger.info({ clientId: client.id }, 'Sent capabilities to client');
  }

  /**
   * Validate an MCP request
   * @param request MCP request
   * @returns True if the request is valid, false otherwise
   */
  public validateRequest(request: MCPRequest): boolean {
    // Use the validation utility
    const validationResult = validateRequest(request);
    
    if (!validationResult.valid) {
      logger.warn({ 
        request, 
        errors: validationResult.errors,
        errorCode: validationResult.errorCode 
      }, 'Request validation failed');
      return false;
    }
    
    return true;
  }

  /**
   * Handle an MCP request
   * @param request MCP request
   * @returns MCP response
   */
  public async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    // Use the RequestRouter to route the request to the appropriate handler
    logger.info({ requestId: request.id, requestType: request.type }, 'Routing request to handler');
    
    // Prepare response formatter options
    const formatterOptions = {
      serverVersion: process.env.npm_package_version || '0.1.0',
      openStudioVersion: this.openStudioVersion,
      includeMetadata: true,
      includeRawOutput: true
    };
    
    try {
      // Route the request using the RequestRouter
      const result = await requestRouter.routeRequest(request);
      
      // Use the response formatter to format the response
      return responseFormatter.formatResponse(
        request.id,
        request.type,
        result,
        formatterOptions
      );
    } catch (error) {
      // Handle unexpected errors
      logger.error({ 
        requestId: request.id,
        requestType: request.type,
        error: error instanceof Error ? error.message : String(error)
      }, 'Error executing handler');
      
      // Use the response formatter to format the error response
      return responseFormatter.formatError(
        request.id,
        request.type,
        error instanceof Error ? error.message : String(error),
        'INTERNAL_ERROR',
        { originalError: error instanceof Error ? error.stack : String(error) },
        formatterOptions
      );
    }
  }

  /**
   * Get the list of capabilities
   * @returns List of capabilities
   */
  public getCapabilities(): MCPCapability[] {
    return this.capabilities;
  }
}