/**
 * Response formatter service
 *
 * This service is responsible for formatting responses to MCP requests.
 * It provides methods for formatting success and error responses,
 * as well as including metadata in responses.
 */
import { MCPResponse, CommandResult } from '../interfaces';
import { logger, outputProcessor } from '../utils';
import { OutputFormat } from '../utils/outputProcessor';

/**
 * Response metadata interface
 */
export interface ResponseMetadata {
  timestamp?: string;
  duration?: number;
  requestId?: string;
  serverVersion?: string;
  openStudioVersion?: string;
  [key: string]: unknown;
}

/**
 * Response formatter options
 */
export interface ResponseFormatterOptions {
  includeMetadata?: boolean;
  includeRawOutput?: boolean;
  includeTimestamp?: boolean;
  serverVersion?: string;
  openStudioVersion?: string;
  processOutput?: boolean;
  outputFormat?: 'text' | 'json' | 'table' | 'chart';
  maxSummaryLength?: number;
  includeHighlights?: boolean;
}

/**
 * Response formatter service
 */
export class ResponseFormatter {
  private defaultOptions: ResponseFormatterOptions;

  /**
   * Constructor
   * @param options Default options for the response formatter
   */
  constructor(options: ResponseFormatterOptions = {}) {
    this.defaultOptions = {
      includeMetadata: true,
      includeRawOutput: true,
      includeTimestamp: true,
      ...options,
    };
  }

  /**
   * Format a success response
   * @param requestId Request ID
   * @param requestType Request type
   * @param result Command result
   * @param options Response formatter options
   * @returns Formatted MCP response
   */
  public formatSuccess(
    requestId: string,
    requestType: string,
    result: CommandResult,
    options: ResponseFormatterOptions = {},
  ): MCPResponse {
    const mergedOptions = { ...this.defaultOptions, ...options };

    logger.debug({ requestId, requestType }, 'Formatting success response');

    // Create the base response
    const response: MCPResponse = {
      id: requestId,
      type: requestType,
      status: 'success',
      result: {},
    };

    // Add the result data
    if (result.data) {
      response.result = { ...response.result, ...result.data };
    }

    // Process output if requested
    if (mergedOptions.processOutput && result.output) {
      // Convert output format to the format expected by the output processor
      const outputFormat = mergedOptions.outputFormat
        ? OutputFormat[mergedOptions.outputFormat.toUpperCase() as keyof typeof OutputFormat]
        : OutputFormat.TEXT;

      // Process the output
      const processedOutput = outputProcessor.processOutput(result.output, {
        maxSummaryLength: mergedOptions.maxSummaryLength,
        format: outputFormat,
        includeRawOutput: mergedOptions.includeRawOutput,
      });

      // Add processed output to the response
      if (processedOutput && processedOutput.summary !== undefined) {
        response.result.processedOutput = {
          summary: processedOutput.summary,
        };

        // Include highlights if requested
        if (
          mergedOptions.includeHighlights &&
          processedOutput.highlights &&
          processedOutput.highlights.length > 0
        ) {
          response.result.processedOutput.highlights = processedOutput.highlights;
        }

        // Include formatted output
        if (processedOutput.formatted !== undefined) {
          response.result.processedOutput.formatted = processedOutput.formatted;
        }
      } else {
        response.result.processedOutput = {
          summary: 'No output available',
        };
      }

      // Include raw output if requested
      if (mergedOptions.includeRawOutput) {
        response.result.output = result.output;
      }
    } else if (mergedOptions.includeRawOutput && result.output) {
      // Include raw output if requested and not processing
      response.result.output = result.output;
    }

    // Include metadata if requested
    if (mergedOptions.includeMetadata) {
      const metadata: ResponseMetadata = {
        timestamp: mergedOptions.includeTimestamp ? new Date().toISOString() : undefined,
        requestId,
        serverVersion: mergedOptions.serverVersion,
        openStudioVersion: mergedOptions.openStudioVersion,
      };

      // Remove undefined values
      Object.keys(metadata).forEach((key) => {
        if (metadata[key] === undefined) {
          delete metadata[key];
        }
      });

      // Only add metadata if there are properties
      if (Object.keys(metadata).length > 0) {
        response.result._metadata = metadata;
      }
    }

    return response;
  }

  /**
   * Format an error response
   * @param requestId Request ID
   * @param requestType Request type
   * @param error Error message or object
   * @param code Error code
   * @param details Additional error details
   * @param options Response formatter options
   * @returns Formatted MCP response
   */
  public formatError(
    requestId: string,
    requestType: string,
    error: string | Error,
    code: string = 'COMMAND_FAILED',
    details?: unknown,
    options: ResponseFormatterOptions = {},
  ): MCPResponse {
    const mergedOptions = { ...this.defaultOptions, ...options };

    logger.debug({ requestId, requestType, error, code }, 'Formatting error response');

    // Extract error message
    const errorMessage = error instanceof Error ? error.message : error;

    // Create the base response
    const response: MCPResponse = {
      id: requestId,
      type: requestType,
      status: 'error',
      error: {
        code,
        message: errorMessage,
      },
    };

    // Process error message if requested
    if (mergedOptions.processOutput && typeof errorMessage === 'string') {
      // Process the error message to make it more user-friendly
      const processedOutput = outputProcessor.processOutput(errorMessage, {
        maxSummaryLength: mergedOptions.maxSummaryLength || 200,
        format: OutputFormat.TEXT,
        includeRawOutput: false,
      });

      // Use the processed summary as the error message if it's available and different from the original
      if (
        processedOutput &&
        processedOutput.summary !== undefined &&
        processedOutput.summary !== errorMessage &&
        response.error
      ) {
        response.error.message = processedOutput.summary;

        // Store the original error message in the details
        if (!response.error.details) {
          response.error.details = { originalMessage: errorMessage };
        } else if (typeof response.error.details === 'object') {
          response.error.details.originalMessage = errorMessage;
        }
      }

      // Add highlights if available and requested
      if (
        processedOutput &&
        processedOutput.highlights &&
        mergedOptions.includeHighlights &&
        processedOutput.highlights.length > 0 &&
        response.error
      ) {
        if (!response.error.details) {
          response.error.details = { highlights: processedOutput.highlights };
        } else if (typeof response.error.details === 'object') {
          response.error.details.highlights = processedOutput.highlights;
        }
      }
    }

    // Add details if provided
    if (details && response.error) {
      if (!response.error.details) {
        response.error.details = details;
      } else if (typeof response.error.details === 'object' && typeof details === 'object') {
        response.error.details = { ...response.error.details, ...details };
      }
    }

    // Include metadata if requested
    if (mergedOptions.includeMetadata) {
      const metadata: ResponseMetadata = {
        timestamp: mergedOptions.includeTimestamp ? new Date().toISOString() : undefined,
        requestId,
        serverVersion: mergedOptions.serverVersion,
        openStudioVersion: mergedOptions.openStudioVersion,
      };

      // Remove undefined values
      Object.keys(metadata).forEach((key) => {
        if (metadata[key] === undefined) {
          delete metadata[key];
        }
      });

      // Only add metadata if there are properties
      if (Object.keys(metadata).length > 0 && response.error) {
        response.error._metadata = metadata;
      }
    }

    return response;
  }

  /**
   * Format a command result into an MCP response
   * @param requestId Request ID
   * @param requestType Request type
   * @param result Command result
   * @param options Response formatter options
   * @returns Formatted MCP response
   */
  public formatResponse(
    requestId: string,
    requestType: string,
    result: CommandResult,
    options: ResponseFormatterOptions = {},
  ): MCPResponse {
    if (result.success) {
      return this.formatSuccess(requestId, requestType, result, options);
    } else {
      return this.formatError(
        requestId,
        requestType,
        result.error || 'Command execution failed',
        'COMMAND_FAILED',
        result,
        options,
      );
    }
  }

  /**
   * Add metadata to a response
   * @param response MCP response
   * @param metadata Response metadata
   * @returns MCP response with metadata
   */
  public addMetadata(response: MCPResponse, metadata: ResponseMetadata): MCPResponse {
    // Create a deep copy of the response
    const responseCopy = JSON.parse(JSON.stringify(response)) as MCPResponse;

    // Add metadata to the appropriate location
    if (responseCopy.status === 'success') {
      responseCopy.result = responseCopy.result || {};
      responseCopy.result._metadata = {
        ...(responseCopy.result._metadata || {}),
        ...metadata,
      };
    } else {
      responseCopy.error = responseCopy.error || {
        code: 'UNKNOWN_ERROR',
        message: 'Unknown error',
      };
      if (responseCopy.error) {
        responseCopy.error._metadata = {
          ...(responseCopy.error._metadata || {}),
          ...metadata,
        };
      }
    }

    return responseCopy;
  }
}

// Create a default instance of the response formatter
const responseFormatter = new ResponseFormatter();

export default responseFormatter;
