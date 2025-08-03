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
  parameters: Record<string, unknown>;
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
        'Failed to detect OpenStudio version. Make sure OpenStudio CLI is installed and available in your PATH.',
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

    // Register model import/export capabilities
    this.capabilities.push({
      name: 'openstudio.model.import',
      description: 'Import models from various formats (IDF, gbXML, IFC, SDD)',
      parameters: {
        importRequest: {
          type: 'object',
          description: 'Model import request',
          required: true,
          properties: {
            filePath: {
              type: 'string',
              description: 'Path to the file to import',
              required: true,
            },
            format: {
              type: 'string',
              description: 'Source file format',
              enum: ['osm', 'idf', 'gbxml', 'ifc', 'sdd', 'json'],
              required: true,
            },
            targetModelPath: {
              type: 'string',
              description: 'Target path for imported model',
              required: false,
            },
            validationLevel: {
              type: 'string',
              description: 'Level of validation to perform',
              enum: ['none', 'basic', 'strict', 'comprehensive'],
              required: false,
            },
            importOptions: {
              type: 'object',
              description: 'Import options',
              required: false,
              properties: {
                mergeWithExisting: { type: 'boolean', required: false },
                overwriteExisting: { type: 'boolean', required: false },
                createBackup: { type: 'boolean', required: false },
                ignoreErrors: { type: 'boolean', required: false },
                convertUnits: { type: 'boolean', required: false },
                targetUnits: { type: 'string', enum: ['SI', 'IP'], required: false },
                importGeometry: { type: 'boolean', required: false },
                importLoads: { type: 'boolean', required: false },
                importSchedules: { type: 'boolean', required: false },
                importMaterials: { type: 'boolean', required: false },
                importConstructions: { type: 'boolean', required: false },
                importThermalZones: { type: 'boolean', required: false },
                importHVACSystems: { type: 'boolean', required: false },
                importPlantLoops: { type: 'boolean', required: false },
              },
            },
            validateOutput: { type: 'boolean', required: false },
            backupOriginal: { type: 'boolean', required: false },
          },
        },
      },
    });

    this.capabilities.push({
      name: 'openstudio.model.export',
      description: 'Export models to various formats (IDF, gbXML, JSON, CSV, PDF, HTML)',
      parameters: {
        exportRequest: {
          type: 'object',
          description: 'Model export request',
          required: true,
          properties: {
            sourceModelPath: {
              type: 'string',
              description: 'Path to the source model file',
              required: true,
            },
            filePath: {
              type: 'string',
              description: 'Path for the exported file',
              required: true,
            },
            format: {
              type: 'string',
              description: 'Target export format',
              enum: ['osm', 'idf', 'gbxml', 'ifc', 'sdd', 'json', 'csv', 'xlsx', 'pdf', 'html'],
              required: true,
            },
            detailLevel: {
              type: 'string',
              description: 'Level of detail to include',
              enum: ['minimal', 'standard', 'detailed', 'complete'],
              required: false,
            },
            exportOptions: {
              type: 'object',
              description: 'Export options',
              required: false,
              properties: {
                includeGeometry: { type: 'boolean', required: false },
                includeLoads: { type: 'boolean', required: false },
                includeSchedules: { type: 'boolean', required: false },
                includeMaterials: { type: 'boolean', required: false },
                includeConstructions: { type: 'boolean', required: false },
                includeThermalZones: { type: 'boolean', required: false },
                includeHVACSystems: { type: 'boolean', required: false },
                includePlantLoops: { type: 'boolean', required: false },
                includeOutputVariables: { type: 'boolean', required: false },
                includeResults: { type: 'boolean', required: false },
                includeMetadata: { type: 'boolean', required: false },
                compressionLevel: { type: 'number', required: false },
                prettyFormat: { type: 'boolean', required: false },
                includeComments: { type: 'boolean', required: false },
                reportOptions: {
                  type: 'object',
                  required: false,
                  properties: {
                    includeImages: { type: 'boolean', required: false },
                    includeTables: { type: 'boolean', required: false },
                    includeCharts: { type: 'boolean', required: false },
                    templatePath: { type: 'string', required: false },
                    outputFormat: {
                      type: 'string',
                      enum: ['pdf', 'html', 'docx'],
                      required: false,
                    },
                  },
                },
              },
            },
            validateOutput: { type: 'boolean', required: false },
            backupOriginal: { type: 'boolean', required: false },
          },
        },
      },
    });

    this.capabilities.push({
      name: 'openstudio.model.batch_operations',
      description: 'Perform batch import/export operations on multiple files',
      parameters: {
        batchRequest: {
          type: 'object',
          description: 'Batch operation request',
          required: true,
          properties: {
            operations: {
              type: 'array',
              description: 'Array of import/export operations',
              required: true,
              items: {
                type: 'object',
                properties: {
                  operation: { type: 'string', enum: ['import', 'export'], required: true },
                  request: { type: 'object', required: true },
                  priority: { type: 'number', required: false },
                },
              },
            },
            parallelProcessing: { type: 'boolean', required: false },
            maxConcurrentOperations: { type: 'number', required: false },
            continueOnError: { type: 'boolean', required: false },
            generateReport: { type: 'boolean', required: false },
          },
        },
      },
    });

    this.capabilities.push({
      name: 'openstudio.model.convert_format',
      description: 'Convert between different model formats',
      parameters: {
        conversionRequest: {
          type: 'object',
          description: 'Format conversion request',
          required: true,
          properties: {
            sourceFilePath: {
              type: 'string',
              description: 'Path to the source file',
              required: true,
            },
            sourceFormat: {
              type: 'string',
              description: 'Source file format',
              enum: ['osm', 'idf', 'gbxml', 'ifc', 'sdd', 'json'],
              required: true,
            },
            targetFilePath: {
              type: 'string',
              description: 'Path for the converted file',
              required: true,
            },
            targetFormat: {
              type: 'string',
              description: 'Target file format',
              enum: ['osm', 'idf', 'gbxml', 'ifc', 'sdd', 'json', 'csv', 'pdf', 'html'],
              required: true,
            },
            conversionOptions: {
              type: 'object',
              description: 'Conversion options',
              required: false,
              properties: {
                validationLevel: {
                  type: 'string',
                  enum: ['none', 'basic', 'strict', 'comprehensive'],
                  required: false,
                },
                preserveMetadata: { type: 'boolean', required: false },
                optimizeOutput: { type: 'boolean', required: false },
                includeValidationReport: { type: 'boolean', required: false },
                customMappings: { type: 'object', required: false },
              },
            },
          },
        },
      },
    });

    this.capabilities.push({
      name: 'openstudio.model.format_capabilities',
      description: 'Get information about supported file formats and their capabilities',
      parameters: {
        format: {
          type: 'string',
          description: 'Specific format to get capabilities for (optional)',
          enum: ['osm', 'idf', 'gbxml', 'ifc', 'sdd', 'json', 'csv', 'xlsx', 'pdf', 'html'],
          required: false,
        },
        includeAll: {
          type: 'boolean',
          description: 'Include capabilities for all supported formats',
          required: false,
        },
      },
    });

    // Register workflow capabilities
    this.capabilities.push({
      name: 'openstudio.workflow.run',
      description: 'Execute an OpenStudio Workflow (OSW) file',
      parameters: {
        workflow: {
          type: 'string',
          description: 'Path to OSW file or workflow object as JSON string',
          required: true,
        },
        options: {
          type: 'object',
          description: 'Workflow execution options',
          required: false,
          properties: {
            debug: {
              type: 'boolean',
              description: 'Enable debug mode',
              required: false,
            },
            measuresOnly: {
              type: 'boolean',
              description: 'Run measures only (skip simulation)',
              required: false,
            },
            postProcessOnly: {
              type: 'boolean',
              description: 'Run reporting measures only',
              required: false,
            },
            preserveRunDir: {
              type: 'boolean',
              description: 'Preserve run directory after execution',
              required: false,
            },
            outputDirectory: {
              type: 'string',
              description: 'Output directory for results',
              required: false,
            },
          },
        },
      },
    });

    this.capabilities.push({
      name: 'openstudio.workflow.validate',
      description: 'Validate an OpenStudio Workflow (OSW) file',
      parameters: {
        workflow: {
          type: 'string',
          description: 'Path to OSW file or workflow object as JSON string',
          required: true,
        },
        baseDirectory: {
          type: 'string',
          description: 'Base directory for resolving relative paths',
          required: false,
        },
      },
    });

    this.capabilities.push({
      name: 'openstudio.workflow.create',
      description: 'Create an OpenStudio Workflow (OSW) file',
      parameters: {
        templateName: {
          type: 'string',
          description: 'Template name (basic_analysis, calibration, hvac_analysis)',
          enum: ['basic_analysis', 'calibration', 'hvac_analysis', 'custom'],
          required: false,
        },
        name: {
          type: 'string',
          description: 'Workflow name',
          required: false,
        },
        description: {
          type: 'string',
          description: 'Workflow description',
          required: false,
        },
        seedFile: {
          type: 'string',
          description: 'Path to seed model file',
          required: true,
        },
        weatherFile: {
          type: 'string',
          description: 'Path to weather file',
          required: false,
        },
        steps: {
          type: 'array',
          description: 'Custom workflow steps',
          required: false,
          items: {
            type: 'object',
            properties: {
              measureDirName: {
                type: 'string',
                description: 'Measure directory name',
                required: true,
              },
              arguments: {
                type: 'object',
                description: 'Measure arguments',
                required: false,
              },
              name: {
                type: 'string',
                description: 'Step name',
                required: false,
              },
              description: {
                type: 'string',
                description: 'Step description',
                required: false,
              },
            },
          },
        },
        outputPath: {
          type: 'string',
          description: 'Output path for the workflow file',
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
      logger.warn(
        {
          request,
          errors: validationResult.errors,
          errorCode: validationResult.errorCode,
        },
        'Request validation failed',
      );
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
      includeRawOutput: true,
    };

    try {
      // Route the request using the RequestRouter
      const result = await requestRouter.routeRequest(request);

      // Use the response formatter to format the response
      return responseFormatter.formatResponse(request.id, request.type, result, formatterOptions);
    } catch (error) {
      // Handle unexpected errors
      logger.error(
        {
          requestId: request.id,
          requestType: request.type,
          error: error instanceof Error ? error.message : String(error),
        },
        'Error executing handler',
      );

      // Use the response formatter to format the error response
      return responseFormatter.formatError(
        request.id,
        request.type,
        error instanceof Error ? error.message : String(error),
        'INTERNAL_ERROR',
        { originalError: error instanceof Error ? error.stack : String(error) },
        formatterOptions,
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
