/**
 * Request handler for MCP requests
 */
import {
  MCPRequest,
  MCPResponse,
  CommandResult,
  WorkflowCreateRequest,
  MeasureUpdateRequest,
  MeasureArgumentComputationRequest,
  MeasureTestRequest,
} from '../interfaces';
import { logger, openStudioCommands } from '../utils';
import { validateRequest, getValidationSchema } from '../utils/validation';
import { OpenStudioCommandProcessor } from '../services/commandProcessor';
import { BCLApiClient } from '../services/bclApiClient';
import { OpenStudioWorkflow } from '../services/workflowService';
import enhancedMeasureService from '../services/enhancedMeasureService';
import config from '../config';
import path from 'path';

/**
 * Handler function type
 */
type RequestHandlerFunction = (params: Record<string, unknown>) => Promise<CommandResult>;

/**
 * Handler metadata
 */
interface HandlerMetadata {
  handler: RequestHandlerFunction;
  schema: object;
  description: string;
}

/**
 * Request handler class
 */
export class RequestHandler {
  private handlers: Map<string, HandlerMetadata> = new Map();
  private commandProcessor: OpenStudioCommandProcessor;
  private bclApiClient: BCLApiClient;

  /**
   * Constructor
   */
  constructor() {
    this.commandProcessor = new OpenStudioCommandProcessor();
    this.bclApiClient = new BCLApiClient(config.bcl.apiUrl);
    this.registerDefaultHandlers();
  }

  /**
   * Register default handlers
   */
  private registerDefaultHandlers(): void {
    // Register model handlers
    this.registerHandler(
      'openstudio.model.create',
      this.handleModelCreate.bind(this),
      getValidationSchema('openstudio.model.create') || {},
      'Create a new OpenStudio model',
    );

    this.registerHandler(
      'openstudio.model.open',
      this.handleModelOpen.bind(this),
      getValidationSchema('openstudio.model.open') || {},
      'Open an existing OpenStudio model',
    );

    this.registerHandler(
      'openstudio.model.save',
      this.handleModelSave.bind(this),
      getValidationSchema('openstudio.model.save') || {},
      'Save an OpenStudio model',
    );

    this.registerHandler(
      'openstudio.model.info',
      this.handleModelInfo.bind(this),
      getValidationSchema('openstudio.model.info') || {},
      'Get information about an OpenStudio model',
    );

    // Register simulation handlers
    this.registerHandler(
      'openstudio.simulation.run',
      this.handleSimulationRun.bind(this),
      getValidationSchema('openstudio.simulation.run') || {},
      'Run an OpenStudio simulation',
    );

    this.registerHandler(
      'openstudio.simulation.status',
      this.handleSimulationStatus.bind(this),
      getValidationSchema('openstudio.simulation.status') || {},
      'Get the status of a simulation',
    );

    this.registerHandler(
      'openstudio.simulation.cancel',
      this.handleSimulationCancel.bind(this),
      getValidationSchema('openstudio.simulation.cancel') || {},
      'Cancel a running simulation',
    );

    // Register BCL handlers
    this.registerHandler(
      'openstudio.bcl.search',
      this.handleBclSearch.bind(this),
      getValidationSchema('openstudio.bcl.search') || {},
      'Search for measures in the Building Component Library',
    );

    this.registerHandler(
      'openstudio.bcl.download',
      this.handleBclDownload.bind(this),
      getValidationSchema('openstudio.bcl.download') || {},
      'Download a measure from the Building Component Library',
    );

    this.registerHandler(
      'openstudio.bcl.recommend',
      this.handleBclRecommend.bind(this),
      getValidationSchema('openstudio.bcl.recommend') || {},
      'Get measure recommendations based on context',
    );

    // Register measure handlers
    this.registerHandler(
      'openstudio.measure.apply',
      this.handleMeasureApply.bind(this),
      getValidationSchema('openstudio.measure.apply') || {},
      'Apply a measure to an OpenStudio model',
    );

    // Register measure workflow handlers
    this.registerHandler(
      'openstudio.measure.workflow.create',
      this.handleMeasureWorkflowCreate.bind(this),
      getValidationSchema('openstudio.measure.workflow.create') || {},
      'Create a measure application workflow',
    );

    this.registerHandler(
      'openstudio.measure.workflow.execute',
      this.handleMeasureWorkflowExecute.bind(this),
      getValidationSchema('openstudio.measure.workflow.execute') || {},
      'Execute a measure application workflow',
    );

    this.registerHandler(
      'openstudio.measure.workflow.validate',
      this.handleMeasureWorkflowValidate.bind(this),
      getValidationSchema('openstudio.measure.workflow.validate') || {},
      'Validate a measure application workflow',
    );

    // Register OpenStudio Workflow (OSW) handlers
    this.registerHandler(
      'openstudio.workflow.run',
      this.handleWorkflowRun.bind(this),
      getValidationSchema('openstudio.workflow.run') || {},
      'Execute an OpenStudio Workflow (OSW) file',
    );

    this.registerHandler(
      'openstudio.workflow.validate',
      this.handleWorkflowValidate.bind(this),
      getValidationSchema('openstudio.workflow.validate') || {},
      'Validate an OpenStudio Workflow (OSW) file',
    );

    this.registerHandler(
      'openstudio.workflow.create',
      this.handleWorkflowCreate.bind(this),
      getValidationSchema('openstudio.workflow.create') || {},
      'Create an OpenStudio Workflow (OSW) file',
    );

    // Register enhanced measure management handlers
    this.registerHandler(
      'openstudio.measure.update',
      this.handleMeasureUpdate.bind(this),
      getValidationSchema('openstudio.measure.update') || {},
      'Update measure metadata and files',
    );

    this.registerHandler(
      'openstudio.measure.arguments.compute',
      this.handleMeasureArgumentsCompute.bind(this),
      getValidationSchema('openstudio.measure.arguments.compute') || {},
      'Compute measure arguments dynamically based on model context',
    );

    this.registerHandler(
      'openstudio.measure.test',
      this.handleMeasureTest.bind(this),
      getValidationSchema('openstudio.measure.test') || {},
      'Run measure tests and generate reports',
    );
    logger.info(`Registered ${this.handlers.size} request handlers`);
  }

  /**
   * Register a handler for a request type
   * @param requestType Request type
   * @param handler Handler function
   * @param schema JSON schema for request validation
   * @param description Description of the handler
   */
  public registerHandler(
    requestType: string,
    handler: RequestHandlerFunction,
    schema: object,
    description: string,
  ): void {
    this.handlers.set(requestType, {
      handler,
      schema,
      description,
    });
    logger.debug(`Registered handler for ${requestType}: ${description}`);
  }

  /**
   * Get all registered handlers
   * @returns Map of request types to handler metadata
   */
  public getHandlers(): Map<string, HandlerMetadata> {
    return this.handlers;
  }

  /**
   * Get handler for a request type
   * @param requestType Request type
   * @returns Handler metadata or undefined if not found
   */
  public getHandler(requestType: string): HandlerMetadata | undefined {
    return this.handlers.get(requestType);
  }

  /**
   * Handle an MCP request
   * @param request MCP request
   * @returns MCP response
   */
  public async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    logger.info({ requestId: request.id, requestType: request.type }, 'Processing request');

    // Validate the request
    const validationResult = validateRequest(request);
    if (!validationResult.valid) {
      logger.warn(
        {
          requestId: request.id,
          requestType: request.type,
          errors: validationResult.errors,
        },
        'Request validation failed',
      );

      return {
        id: request.id,
        type: request.type,
        status: 'error',
        error: {
          code: validationResult.errorCode || 'INVALID_REQUEST',
          message: 'Invalid request format or parameters',
          details: validationResult.errors,
        },
      };
    }

    // Get the handler for the request type
    const handlerMetadata = this.handlers.get(request.type);
    if (!handlerMetadata) {
      logger.warn({ request }, `No handler registered for request type: ${request.type}`);
      return {
        id: request.id,
        type: request.type,
        status: 'error',
        error: {
          code: 'UNKNOWN_REQUEST_TYPE',
          message: `Unknown request type: ${request.type}`,
          details: {
            availableTypes: Array.from(this.handlers.keys()),
          },
        },
      };
    }

    try {
      // Execute the handler
      logger.info(
        {
          requestId: request.id,
          requestType: request.type,
        },
        'Executing handler',
      );

      const result = await handlerMetadata.handler(request.params);

      // Return the response
      if (result.success) {
        logger.info(
          {
            requestId: request.id,
            requestType: request.type,
          },
          'Request processed successfully',
        );

        return {
          id: request.id,
          type: request.type,
          status: 'success',
          result: {
            output: result.output,
            data: result.data,
          },
        };
      } else {
        logger.warn(
          {
            requestId: request.id,
            requestType: request.type,
            error: result.error,
          },
          'Command execution failed',
        );

        return {
          id: request.id,
          type: request.type,
          status: 'error',
          error: {
            code: 'COMMAND_FAILED',
            message: result.error || 'Command execution failed',
            details: result,
          },
        };
      }
    } catch (error) {
      logger.error(
        {
          requestId: request.id,
          requestType: request.type,
          error: error instanceof Error ? error.message : String(error),
        },
        'Error executing handler',
      );

      return {
        id: request.id,
        type: request.type,
        status: 'error',
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
          details: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * Handler for openstudio.model.create
   * @param params Request parameters
   * @returns Command result
   */
  private async handleModelCreate(params: Record<string, unknown>): Promise<CommandResult> {
    logger.info({ params }, 'Model create request received');

    try {
      // Validate required parameters
      if (!params.templateType || !params.path) {
        return {
          success: false,
          output: '',
          error: 'Missing required parameters: templateType and path are required',
        };
      }

      // Import the model creation service
      const modelCreationService = (await import('../services/modelCreationService')).default;

      // Create the model using the model creation service
      const result = await modelCreationService.createModel({
        templateType: params.templateType as 'empty' | 'office' | 'residential',
        templateOptions: (params.options as Record<string, unknown>) || {},
        outputDirectory: path.dirname(params.path as string),
        modelName: path.basename(params.path as string),
        includeDefaultMeasures: (params.includeDefaultMeasures as boolean) || false,
      });

      if (!result.success) {
        return {
          success: false,
          output: '',
          error: result.error || 'Failed to create model',
        };
      }

      return {
        success: true,
        output: `Successfully created model at ${result.modelPath}`,
        data: {
          modelPath: result.modelPath,
          templateType: params.templateType,
          options: params.options || {},
          ...(result.data as Record<string, unknown>),
        },
      };
    } catch (error) {
      logger.error({ params, error }, 'Error creating model');

      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Handler for openstudio.model.open
   * @param params Request parameters
   * @returns Command result
   */
  private async handleModelOpen(params: Record<string, unknown>): Promise<CommandResult> {
    logger.info({ params }, 'Model open request received');

    try {
      // Validate required parameters
      if (!params.path) {
        return {
          success: false,
          output: '',
          error: 'Missing required parameter: path is required',
        };
      }

      // For now, we'll just get model info as a way to "open" the model
      // In a more advanced implementation, we might want to load the model into memory
      const result = await openStudioCommands.getModelInfo(params.path as string);

      return {
        success: result.success,
        output: result.output,
        error: result.error,
        data: {
          modelPath: params.path,
          modelInfo: result.data,
        },
      };
    } catch (error) {
      logger.error({ params, error }, 'Error opening model');

      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Placeholder handler for openstudio.model.save
   * @param params Request parameters
   * @returns Command result
   */
  private async handleModelSave(params: Record<string, unknown>): Promise<CommandResult> {
    // This is a placeholder that will be implemented in a future task
    logger.info({ params }, 'Model save request received');
    return {
      success: true,
      output: 'Model save operation not yet implemented',
      data: { params },
    };
  }

  /**
   * Handler for openstudio.simulation.run
   * @param params Request parameters
   * @returns Command result
   */
  private async handleSimulationRun(params: Record<string, unknown>): Promise<CommandResult> {
    logger.info({ params }, 'Simulation run request received');

    try {
      // Validate required parameters
      if (!params.modelPath) {
        return {
          success: false,
          output: '',
          error: 'Missing required parameter: modelPath is required',
        };
      }

      // Import the simulation service
      const simulationService = (await import('../services/simulationService')).default;

      // Configure simulation parameters if not provided
      let simulationParams;

      if (params.autoConfig) {
        // Auto-configure simulation parameters based on model analysis
        simulationParams = await simulationService.configureSimulationParameters(
          params.modelPath as string,
        );

        // Override with any explicitly provided parameters
        if (params.weatherFile) {
          simulationParams.weatherFile = params.weatherFile;
        }

        if (params.outputDirectory) {
          simulationParams.outputDirectory = params.outputDirectory;
        }

        if (params.options) {
          simulationParams.options = {
            ...simulationParams.options,
            ...params.options,
          };
        }
      } else {
        // Use provided parameters
        simulationParams = {
          modelPath: params.modelPath,
          weatherFile: params.weatherFile,
          outputDirectory: params.outputDirectory,
          options: params.options,
        };
      }

      // Run the simulation
      const simulationResult = await simulationService.runSimulation(simulationParams);

      // Process the simulation results
      const processedResult = simulationService.processSimulationResults(simulationResult);

      return {
        success: processedResult.status === 'complete',
        output: processedResult.output || '',
        error: processedResult.error,
        data: {
          simulationId: processedResult.id,
          status: processedResult.status,
          duration: processedResult.duration,
          outputDirectory: processedResult.outputDirectory,
          errors: processedResult.errors,
          warnings: processedResult.warnings,
          results: {
            eui: processedResult.eui,
            totalSiteEnergy: processedResult.totalSiteEnergy,
            totalSourceEnergy: processedResult.totalSourceEnergy,
            electricityConsumption: processedResult.electricityConsumption,
            naturalGasConsumption: processedResult.naturalGasConsumption,
            districtHeatingConsumption: processedResult.districtHeatingConsumption,
            districtCoolingConsumption: processedResult.districtCoolingConsumption,
          },
          resourceUsage: {
            cpuUsage: processedResult.cpuUsage,
            memoryUsage: processedResult.memoryUsage,
          },
        },
      };
    } catch (error) {
      logger.error({ params, error }, 'Error running simulation');

      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Handler for openstudio.bcl.search
   * @param params Request parameters
   * @returns Command result
   */
  private async handleBclSearch(params: Record<string, unknown>): Promise<CommandResult> {
    logger.info({ params }, 'BCL search request received');

    try {
      // Validate required parameters
      if (!params.query) {
        return {
          success: false,
          output: '',
          error: 'Missing required parameter: query is required',
        };
      }

      // Search for measures using the BCL API client
      const measures = await this.bclApiClient.searchMeasures(params.query as string);

      // Apply limit if specified
      const limit = params.limit ? parseInt(params.limit as string, 10) : undefined;
      const limitedMeasures = limit ? measures.slice(0, limit) : measures;

      return {
        success: true,
        output: `Found ${limitedMeasures.length} measures matching query: ${params.query}`,
        data: {
          measures: limitedMeasures,
          totalFound: measures.length,
          query: params.query,
        },
      };
    } catch (error) {
      logger.error({ params, error }, 'Error searching BCL measures');

      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Handler for openstudio.bcl.download
   * @param params Request parameters
   * @returns Command result
   */
  private async handleBclDownload(params: Record<string, unknown>): Promise<CommandResult> {
    logger.info({ params }, 'BCL download request received');

    try {
      // Validate required parameters
      if (!params.measureId) {
        return {
          success: false,
          output: '',
          error: 'Missing required parameter: measureId is required',
        };
      }

      // Download the measure using the BCL API client
      const downloadSuccess = await this.bclApiClient.downloadMeasure(params.measureId as string);

      if (!downloadSuccess) {
        return {
          success: false,
          output: '',
          error: `Failed to download measure with ID: ${params.measureId}`,
        };
      }

      // Install the measure
      const installSuccess = await this.bclApiClient.installMeasure(params.measureId as string);

      if (!installSuccess) {
        return {
          success: false,
          output: '',
          error: `Failed to install measure with ID: ${params.measureId}`,
        };
      }

      return {
        success: true,
        output: `Successfully downloaded and installed measure with ID: ${params.measureId}`,
        data: {
          measureId: params.measureId,
          installed: true,
          location: `${config.bcl.measuresDir}/${params.measureId}`,
        },
      };
    } catch (error) {
      logger.error({ params, error }, 'Error downloading BCL measure');

      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Handler for openstudio.measure.apply
   * @param params Request parameters
   * @returns Command result
   */
  private async handleMeasureApply(params: Record<string, unknown>): Promise<CommandResult> {
    logger.info({ params }, 'Measure apply request received');

    try {
      // Validate required parameters
      if (!params.modelPath) {
        return {
          success: false,
          output: '',
          error: 'Missing required parameter: modelPath is required',
        };
      }

      if (!params.measureId) {
        return {
          success: false,
          output: '',
          error: 'Missing required parameter: measureId is required',
        };
      }

      // Import the measure application service
      const measureApplicationService = (await import('../services/measureApplicationService'))
        .default;

      // Map user parameters to measure arguments if needed
      let measureArgs = (params.arguments as Record<string, unknown>) || {};

      if (params.mapParameters) {
        try {
          measureArgs = await measureApplicationService.mapMeasureParameters(
            params.measureId as string,
            (params.arguments as Record<string, unknown>) || {},
          );
        } catch (error) {
          logger.warn(
            {
              measureId: params.measureId,
              arguments: params.arguments,
              error: error instanceof Error ? error.message : String(error),
            },
            'Error mapping measure parameters, using original arguments',
          );
        }
      }

      // Determine if we should download the measure from BCL if not installed
      if (params.downloadIfNeeded) {
        // Apply the measure, downloading it if needed
        const result = await measureApplicationService.downloadAndApplyMeasure(
          params.modelPath as string,
          params.measureId as string,
          measureArgs,
          {
            createBackup: params.createBackup !== false,
            validateModel: params.validateModel !== false,
            validateMeasure: params.validateMeasure !== false,
            inPlace: params.inPlace === true,
            outputPath: params.outputPath as string | undefined,
          },
        );

        return {
          success: result.success,
          output: result.success
            ? `Successfully applied measure ${params.measureId} to model ${params.modelPath}`
            : `Failed to apply measure: ${result.error}`,
          error: result.error,
          data: {
            modelPath: result.outputModelPath,
            originalModelPath: result.originalModelPath,
            measureId: result.measureId,
            arguments: result.arguments,
            warnings: result.warnings,
            output: result.output,
          },
        };
      } else {
        // Apply the measure directly
        const result = await measureApplicationService.applyMeasure(
          params.modelPath as string,
          params.measureId as string,
          measureArgs,
          {
            createBackup: params.createBackup !== false,
            validateModel: params.validateModel !== false,
            validateMeasure: params.validateMeasure !== false,
            inPlace: params.inPlace === true,
            outputPath: params.outputPath as string | undefined,
          },
        );

        return {
          success: result.success,
          output: result.success
            ? `Successfully applied measure ${params.measureId} to model ${params.modelPath}`
            : `Failed to apply measure: ${result.error}`,
          error: result.error,
          data: {
            modelPath: result.outputModelPath,
            originalModelPath: result.originalModelPath,
            measureId: result.measureId,
            arguments: result.arguments,
            warnings: result.warnings,
            output: result.output,
          },
        };
      }
    } catch (error) {
      logger.error({ params, error }, 'Error applying measure');

      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Handler for openstudio.model.info
   * @param params Request parameters
   * @returns Command result
   */
  private async handleModelInfo(params: Record<string, unknown>): Promise<CommandResult> {
    logger.info({ params }, 'Model info request received');

    try {
      // Validate required parameters
      if (!params.modelPath) {
        return {
          success: false,
          output: '',
          error: 'Missing required parameter: modelPath is required',
        };
      }

      // Get model information using the OpenStudio CLI command mapping
      const result = await openStudioCommands.getModelInfo(
        params.modelPath as string,
        (params.detailLevel as 'basic' | 'detailed' | 'complete') || 'basic',
      );

      return {
        success: result.success,
        output: result.output,
        error: result.error,
        data: result.data,
      };
    } catch (error) {
      logger.error({ params, error }, 'Error getting model information');

      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Handler for openstudio.bcl.recommend
   * @param params Request parameters
   * @returns Command result
   */
  private async handleBclRecommend(params: Record<string, unknown>): Promise<CommandResult> {
    logger.info({ params }, 'BCL recommend request received');

    try {
      // Validate required parameters
      if (!params.context) {
        return {
          success: false,
          output: '',
          error: 'Missing required parameter: context is required',
        };
      }

      // Get measure recommendations based on context and model path (if provided)
      const measures = await this.bclApiClient.recommendMeasures(
        params.context as string,
        params.modelPath as string | undefined,
      );

      // Apply limit if specified
      const limit = params.limit ? parseInt(params.limit as string, 10) : undefined;
      const limitedMeasures = limit ? measures.slice(0, limit) : measures;

      // Prepare response data
      const responseData: Record<string, unknown> = {
        measures: limitedMeasures,
        totalFound: measures.length,
        context: params.context,
      };

      // Include model path in response if provided
      if (params.modelPath) {
        responseData.modelPath = params.modelPath;
        responseData.modelBasedRecommendation = true;
      }

      // Include information about automatically downloaded measures
      const downloadedMeasures = limitedMeasures.slice(0, 3);
      if (downloadedMeasures.length > 0) {
        responseData.downloadedMeasures = downloadedMeasures.map((m) => ({
          id: m.id,
          name: m.name,
        }));
      }

      return {
        success: true,
        output: `Found ${limitedMeasures.length} recommended measures based on context${params.modelPath ? ' and model analysis' : ''}`,
        data: responseData,
      };
    } catch (error) {
      logger.error({ params, error }, 'Error recommending BCL measures');

      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Handler for openstudio.simulation.status
   * @param params Request parameters
   * @returns Command result
   */
  private async handleSimulationStatus(params: Record<string, unknown>): Promise<CommandResult> {
    logger.info({ params }, 'Simulation status request received');

    try {
      // Validate required parameters
      if (!params.simulationId) {
        return {
          success: false,
          output: '',
          error: 'Missing required parameter: simulationId is required',
        };
      }

      // Import the simulation service
      const simulationService = (await import('../services/simulationService')).default;

      // Get the simulation status
      const simulationResult = simulationService.getSimulationStatus(params.simulationId as string);

      if (!simulationResult) {
        return {
          success: false,
          output: '',
          error: `Simulation with ID ${params.simulationId} not found`,
        };
      }

      return {
        success: true,
        output: `Simulation status: ${simulationResult.status}`,
        data: {
          simulationId: simulationResult.id,
          status: simulationResult.status,
          startTime: simulationResult.startTime,
          endTime: simulationResult.endTime,
          duration: simulationResult.duration,
          outputDirectory: simulationResult.outputDirectory,
          errors: simulationResult.errors,
          warnings: simulationResult.warnings,
          results: {
            eui: simulationResult.eui,
            totalSiteEnergy: simulationResult.totalSiteEnergy,
            totalSourceEnergy: simulationResult.totalSourceEnergy,
            electricityConsumption: simulationResult.electricityConsumption,
            naturalGasConsumption: simulationResult.naturalGasConsumption,
            districtHeatingConsumption: simulationResult.districtHeatingConsumption,
            districtCoolingConsumption: simulationResult.districtCoolingConsumption,
          },
          resourceUsage: {
            cpuUsage: simulationResult.cpuUsage,
            memoryUsage: simulationResult.memoryUsage,
          },
        },
      };
    } catch (error) {
      logger.error({ params, error }, 'Error getting simulation status');

      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Handler for openstudio.simulation.cancel
   * @param params Request parameters
   * @returns Command result
   */
  private async handleSimulationCancel(params: Record<string, unknown>): Promise<CommandResult> {
    logger.info({ params }, 'Simulation cancel request received');

    try {
      // Validate required parameters
      if (!params.simulationId) {
        return {
          success: false,
          output: '',
          error: 'Missing required parameter: simulationId is required',
        };
      }

      // Import the simulation service
      const simulationService = (await import('../services/simulationService')).default;

      // Cancel the simulation
      const cancelled = simulationService.cancelSimulation(params.simulationId as string);

      if (!cancelled) {
        return {
          success: false,
          output: '',
          error: `Failed to cancel simulation with ID ${params.simulationId}. The simulation may not exist or may have already completed.`,
        };
      }

      return {
        success: true,
        output: `Successfully cancelled simulation with ID ${params.simulationId}`,
        data: {
          simulationId: params.simulationId,
          cancelled: true,
        },
      };
    } catch (error) {
      logger.error({ params, error }, 'Error cancelling simulation');

      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Handler for openstudio.measure.workflow.create
   * @param params Request parameters
   * @returns Command result
   */
  private async handleMeasureWorkflowCreate(
    params: Record<string, unknown>,
  ): Promise<CommandResult> {
    logger.info({ params }, 'Measure workflow create request received');

    try {
      // Validate required parameters
      if (!params.modelPath) {
        return {
          success: false,
          output: '',
          error: 'Missing required parameter: modelPath is required',
        };
      }

      // Import the measure application workflow module
      const measureApplicationWorkflow = (await import('../services/measureApplicationWorkflow'))
        .default;

      let workflow;

      // Create workflow from template or custom steps
      if (params.templateName) {
        // Create from template
        workflow = await measureApplicationWorkflow.createWorkflowFromTemplate(
          params.templateName as string,
          params.modelPath as string,
        );
      } else if (params.steps && Array.isArray(params.steps)) {
        // Create custom workflow
        workflow = measureApplicationWorkflow.createCustomWorkflow(
          (params.name as string) || 'Custom Workflow',
          (params.description as string) || 'Custom measure application workflow',
          params.modelPath as string,
          params.steps as {
            name: string;
            description: string;
            measureId: string;
            arguments: Record<string, unknown>;
            inPlace?: boolean;
            outputPath?: string;
          }[],
          {
            stopOnError: params.stopOnError !== false,
            createBackup: params.createBackup !== false,
            validate: params.validate !== false,
          },
        );
      } else {
        return {
          success: false,
          output: '',
          error: 'Either templateName or steps must be provided',
        };
      }

      // Download required measures if requested
      if (params.downloadMeasures) {
        const downloadedMeasures =
          await measureApplicationWorkflow.downloadWorkflowMeasures(workflow);

        if (downloadedMeasures.length > 0) {
          logger.info({ downloadedMeasures }, 'Downloaded measures for workflow');
        }
      }

      return {
        success: true,
        output: `Successfully created measure application workflow: ${workflow.name}`,
        data: {
          workflow,
        },
      };
    } catch (error) {
      logger.error({ params, error }, 'Error creating measure workflow');

      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Handler for openstudio.measure.workflow.execute
   * @param params Request parameters
   * @returns Command result
   */
  private async handleMeasureWorkflowExecute(
    params: Record<string, unknown>,
  ): Promise<CommandResult> {
    logger.info({ params }, 'Measure workflow execute request received');

    try {
      // Validate required parameters
      if (!params.workflow) {
        return {
          success: false,
          output: '',
          error: 'Missing required parameter: workflow is required',
        };
      }

      // Import the measure application workflow module
      const measureApplicationWorkflow = (await import('../services/measureApplicationWorkflow'))
        .default;

      // Download required measures if requested
      if (params.downloadMeasures) {
        const downloadedMeasures = await measureApplicationWorkflow.downloadWorkflowMeasures(
          params.workflow as import('../services/measureApplicationWorkflow').MeasureWorkflow,
        );

        if (downloadedMeasures.length > 0) {
          logger.info({ downloadedMeasures }, 'Downloaded measures for workflow');
        }
      }

      // Execute the workflow
      const result = await measureApplicationWorkflow.executeMeasureWorkflow(
        params.workflow as import('../services/measureApplicationWorkflow').MeasureWorkflow,
      );

      // Generate a report if requested
      let report;
      if (params.generateReport) {
        report = measureApplicationWorkflow.generateWorkflowReport(result);
      }

      return {
        success: result.success,
        output: result.success
          ? `Successfully executed workflow: ${(params.workflow as { name: string }).name}`
          : `Workflow execution failed: ${result.error}`,
        error: result.error,
        data: {
          workflowResult: result,
          report,
        },
      };
    } catch (error) {
      logger.error({ params, error }, 'Error executing measure workflow');

      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Handler for openstudio.measure.workflow.validate
   * @param params Request parameters
   * @returns Command result
   */
  private async handleMeasureWorkflowValidate(
    params: Record<string, unknown>,
  ): Promise<CommandResult> {
    logger.info({ params }, 'Measure workflow validate request received');

    try {
      // Validate required parameters
      if (!params.workflow) {
        return {
          success: false,
          output: '',
          error: 'Missing required parameter: workflow is required',
        };
      }

      // Import the measure application workflow module
      const measureApplicationWorkflow = await import('../services/measureApplicationWorkflow');

      // Check if we're creating from a template or custom workflow
      if (params.templateName) {
        // Validate required parameters for template workflow
        if (!params.modelPath) {
          return {
            success: false,
            output: '',
            error: 'Missing required parameter: modelPath is required for template workflows',
          };
        }

        // Create workflow from template
        const workflow = await measureApplicationWorkflow.createWorkflowFromTemplate(
          params.templateName as string,
          params.modelPath as string,
        );

        return {
          success: true,
          output: `Successfully created ${workflow.name} workflow for model ${params.modelPath}`,
          data: {
            workflow,
            templateName: params.templateName,
          },
        };
      } else if (params.workflow) {
        // Custom workflow provided directly
        // Validate required parameters for custom workflow
        const workflowCheck = params.workflow as {
          name?: string;
          inputModelPath?: string;
          steps?: unknown[];
        };
        if (!workflowCheck.name || !workflowCheck.inputModelPath || !workflowCheck.steps) {
          return {
            success: false,
            output: '',
            error: 'Invalid workflow: name, inputModelPath, and steps are required',
          };
        }

        // Create custom workflow
        const workflowObj = params.workflow as {
          name: string;
          description?: string;
          inputModelPath: string;
          steps: unknown[];
          stopOnError?: boolean;
          createBackup?: boolean;
          validate?: boolean;
        };
        const workflow = measureApplicationWorkflow.createCustomWorkflow(
          workflowObj.name,
          workflowObj.description || `Custom workflow for ${workflowObj.inputModelPath}`,
          workflowObj.inputModelPath,
          workflowObj.steps as {
            name: string;
            description: string;
            measureId: string;
            arguments: Record<string, unknown>;
            inPlace?: boolean;
            outputPath?: string;
          }[],
          {
            stopOnError: workflowObj.stopOnError,
            createBackup: workflowObj.createBackup,
            validate: workflowObj.validate,
          },
        );

        return {
          success: true,
          output: `Successfully created custom workflow ${workflow.name} for model ${workflow.inputModelPath}`,
          data: { workflow },
        };
      } else {
        return {
          success: false,
          output: '',
          error: 'Either templateName or workflow must be provided',
        };
      }
    } catch (error) {
      logger.error({ params, error }, 'Error creating measure workflow');

      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Handler for openstudio.workflow.run
   * @param params Request parameters
   * @returns Command result
   */
  private async handleWorkflowRun(params: Record<string, unknown>): Promise<CommandResult> {
    logger.info({ params }, 'Workflow run request received');

    try {
      // Validate required parameters
      if (!params.workflow) {
        return {
          success: false,
          output: '',
          error: 'Missing required parameter: workflow is required',
        };
      }

      // Import the workflow service
      const workflowService = (await import('../services/workflowService')).default;

      let workflowResult;
      const options = (params.options as Record<string, unknown>) || {};

      // Handle workflow parameter (path or object)
      if (typeof params.workflow === 'string') {
        // Workflow is a file path
        if (params.workflow.endsWith('.osw')) {
          // Execute workflow file directly
          workflowResult = await workflowService.executeWorkflowFile(params.workflow as string, {
            debug: options.debug as boolean,
            measuresOnly: options.measuresOnly as boolean,
            postProcessOnly: options.postProcessOnly as boolean,
            preserveRunDir: options.preserveRunDir as boolean,
            outputDirectory: options.outputDirectory as string,
          });
        } else {
          // Try to parse as JSON workflow object
          try {
            const workflowObj = JSON.parse(params.workflow as string);
            workflowResult = await workflowService.executeWorkflow(workflowObj, {
              debug: options.debug as boolean,
              measuresOnly: options.measuresOnly as boolean,
              postProcessOnly: options.postProcessOnly as boolean,
              preserveRunDir: options.preserveRunDir as boolean,
              outputDirectory: options.outputDirectory as string,
            });
          } catch (parseError) {
            return {
              success: false,
              output: '',
              error: `Invalid workflow parameter: must be a valid OSW file path or JSON workflow object`,
            };
          }
        }
      } else if (typeof params.workflow === 'object') {
        // Workflow is an object
        workflowResult = await workflowService.executeWorkflow(
          params.workflow as OpenStudioWorkflow,
          {
            debug: options.debug as boolean,
            measuresOnly: options.measuresOnly as boolean,
            postProcessOnly: options.postProcessOnly as boolean,
            preserveRunDir: options.preserveRunDir as boolean,
            outputDirectory: options.outputDirectory as string,
          },
        );
      } else {
        return {
          success: false,
          output: '',
          error: 'Invalid workflow parameter: must be a file path or workflow object',
        };
      }

      return {
        success: workflowResult.success,
        output: workflowResult.success
          ? `Successfully executed workflow${workflowResult.stepResults?.length ? ` with ${workflowResult.stepResults.length} steps` : ''}`
          : `Workflow execution failed: ${workflowResult.error}`,
        error: workflowResult.error,
        data: {
          duration: workflowResult.duration,
          outputDirectory: workflowResult.outputDirectory,
          stepResults: workflowResult.stepResults,
          finalModelPath: workflowResult.finalModelPath,
          simulationResults: workflowResult.simulationResults,
        },
      };
    } catch (error) {
      logger.error({ params, error }, 'Error executing workflow');

      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Handler for openstudio.workflow.validate
   * @param params Request parameters
   * @returns Command result
   */
  private async handleWorkflowValidate(params: Record<string, unknown>): Promise<CommandResult> {
    logger.info({ params }, 'Workflow validate request received');

    try {
      // Validate required parameters
      if (!params.workflow) {
        return {
          success: false,
          output: '',
          error: 'Missing required parameter: workflow is required',
        };
      }

      // Import the workflow service
      const workflowService = (await import('../services/workflowService')).default;

      let workflowObj;
      let baseDirectory = params.baseDirectory as string | undefined;

      // Handle workflow parameter (path or object)
      if (typeof params.workflow === 'string') {
        if (params.workflow.endsWith('.osw')) {
          // Parse workflow file
          workflowObj = await workflowService.parseWorkflowFile(params.workflow as string);

          // Set base directory to workflow file directory if not specified
          if (!baseDirectory) {
            const path = await import('path');
            baseDirectory = path.dirname(params.workflow as string);
          }
        } else {
          // Try to parse as JSON workflow object
          try {
            workflowObj = JSON.parse(params.workflow as string);
          } catch (parseError) {
            return {
              success: false,
              output: '',
              error: `Invalid workflow parameter: must be a valid OSW file path or JSON workflow object`,
            };
          }
        }
      } else if (typeof params.workflow === 'object') {
        // Workflow is an object
        workflowObj = params.workflow;
      } else {
        return {
          success: false,
          output: '',
          error: 'Invalid workflow parameter: must be a file path or workflow object',
        };
      }

      // Validate the workflow
      const validationResult = await workflowService.validateWorkflow(workflowObj, baseDirectory);

      return {
        success: validationResult.valid,
        output: validationResult.valid
          ? `Workflow validation passed${validationResult.warnings.length > 0 ? ` with ${validationResult.warnings.length} warnings` : ''}`
          : `Workflow validation failed with ${validationResult.errors.length} errors`,
        error: validationResult.valid ? undefined : validationResult.errors.join(', '),
        data: {
          valid: validationResult.valid,
          errors: validationResult.errors,
          warnings: validationResult.warnings,
          missingFiles: validationResult.missingFiles,
          invalidMeasures: validationResult.invalidMeasures,
        },
      };
    } catch (error) {
      logger.error({ params, error }, 'Error validating workflow');

      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Handler for openstudio.workflow.create
   * @param params Request parameters
   * @returns Command result
   */
  private async handleWorkflowCreate(params: Record<string, unknown>): Promise<CommandResult> {
    logger.info({ params }, 'Workflow create request received');

    try {
      // Validate required parameters
      if (!params.seedFile) {
        return {
          success: false,
          output: '',
          error: 'Missing required parameter: seedFile is required',
        };
      }

      // Import the workflow service
      const workflowService = (await import('../services/workflowService')).default;

      let workflow;

      if (params.templateName && params.templateName !== 'custom') {
        // Create workflow from template
        workflow = workflowService.createWorkflowFromTemplate(
          params.templateName as string,
          params.seedFile as string,
          params.weatherFile as string | undefined,
        );
      } else {
        // Create custom workflow
        workflow = {
          version: '3.8.0',
          seed_file: params.seedFile as string,
          weather_file: params.weatherFile as string | undefined,
          steps: [],
          created_at: new Date().toISOString(),
          run_options: {
            debug: false,
            cleanup: true,
          },
        };

        // Add custom steps if provided
        if (params.steps && Array.isArray(params.steps)) {
          const createParams = params as unknown as WorkflowCreateRequest;
          workflow.steps = createParams.steps!.map((step) => ({
            measure_dir_name: step.measureDirName,
            arguments: step.arguments || {},
            name: step.name,
            description: step.description,
          }));
        }
      }

      // Set name and description if provided
      if (params.name) {
        workflow.name = params.name as string;
      }

      if (params.description) {
        workflow.description = params.description as string;
      }

      // Save workflow if output path is provided
      if (params.outputPath) {
        await workflowService.saveWorkflow(workflow, params.outputPath as string);
      }

      return {
        success: true,
        output: `Successfully created workflow${params.templateName ? ` from template: ${params.templateName}` : ''} with ${workflow.steps.length} steps`,
        data: {
          workflow,
          savedTo: params.outputPath || null,
        },
      };
    } catch (error) {
      logger.error({ params, error }, 'Error creating workflow');

      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Handle measure update request
   * @param params Request parameters
   * @returns Command result
   */
  async handleMeasureUpdate(params: Record<string, unknown>): Promise<CommandResult> {
    try {
      logger.info({ params }, 'Handling measure update request');

      const request = params as unknown as MeasureUpdateRequest;

      if (request.updateAll) {
        // Update all measures
        const results = await enhancedMeasureService.updateAllMeasures(request.options);
        const successCount = results.filter((r) => r.success).length;
        const failureCount = results.length - successCount;

        return {
          success: failureCount === 0,
          output: `Updated ${successCount} measures successfully${failureCount > 0 ? `, ${failureCount} failed` : ''}`,
          data: {
            results,
            summary: {
              total: results.length,
              successful: successCount,
              failed: failureCount,
            },
          },
        };
      } else if (request.measureId) {
        // Update single measure
        const result = await enhancedMeasureService.updateMeasure(
          request.measureId,
          request.options,
        );

        return {
          success: result.success,
          output: result.message,
          data: result,
          error: result.error,
        };
      } else {
        return {
          success: false,
          output: '',
          error: 'Either measureId or updateAll must be specified',
        };
      }
    } catch (error) {
      logger.error({ params, error }, 'Error handling measure update request');

      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Handle measure arguments computation request
   * @param params Request parameters
   * @returns Command result
   */
  async handleMeasureArgumentsCompute(params: Record<string, unknown>): Promise<CommandResult> {
    try {
      logger.info({ params }, 'Handling measure arguments computation request');

      const request = params as unknown as MeasureArgumentComputationRequest;

      if (!request.measureId) {
        return {
          success: false,
          output: '',
          error: 'measureId is required',
        };
      }

      const result = await enhancedMeasureService.computeMeasureArguments(
        request.measureId,
        request.options,
      );

      return {
        success: result.success,
        output: result.success
          ? `Successfully computed ${result.arguments.length} arguments for measure: ${request.measureId}`
          : `Failed to compute arguments for measure: ${request.measureId}`,
        data: result,
        error: result.error,
      };
    } catch (error) {
      logger.error({ params, error }, 'Error handling measure arguments computation request');

      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Handle measure test request
   * @param params Request parameters
   * @returns Command result
   */
  async handleMeasureTest(params: Record<string, unknown>): Promise<CommandResult> {
    try {
      logger.info({ params }, 'Handling measure test request');

      const request = params as unknown as MeasureTestRequest;

      if (!request.measureId) {
        return {
          success: false,
          output: '',
          error: 'measureId is required',
        };
      }

      const result = await enhancedMeasureService.runMeasureTests(
        request.measureId,
        request.options,
      );

      return {
        success: result.success,
        output: result.success
          ? `All tests passed for measure: ${request.measureId} (${result.testsPassed}/${result.testsExecuted} tests)`
          : `Tests failed for measure: ${request.measureId} (${result.testsPassed}/${result.testsExecuted} tests, ${result.testsFailed} failed)`,
        data: result,
        error: result.error,
      };
    } catch (error) {
      logger.error({ params, error }, 'Error handling measure test request');

      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
