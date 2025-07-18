/**
 * Request router for MCP requests
 */
import { MCPRequest, CommandResult } from '../interfaces';
import { logger } from '../utils';
import { RequestHandler } from './requestHandler';

/**
 * Request router class
 * Responsible for routing requests to the appropriate handler
 */
export class RequestRouter {
  private requestHandler: RequestHandler;

  /**
   * Constructor
   * @param requestHandler Request handler instance
   */
  constructor(requestHandler: RequestHandler) {
    this.requestHandler = requestHandler;
  }

  /**
   * Route a request to the appropriate handler
   * @param request MCP request
   * @returns Promise resolving to a command result
   */
  public async routeRequest(request: MCPRequest): Promise<CommandResult> {
    logger.info({ requestId: request.id, requestType: request.type }, 'Routing request');
    
    // Get the handler for the request type
    const handlerMetadata = this.requestHandler.getHandler(request.type);
    
    if (!handlerMetadata) {
      logger.warn({ requestId: request.id, requestType: request.type }, 'No handler found for request type');
      return {
        success: false,
        output: '',
        error: `No handler found for request type: ${request.type}`,
        data: {
          availableTypes: Array.from(this.requestHandler.getHandlers().keys())
        }
      };
    }
    
    try {
      // Execute the handler
      logger.info({ requestId: request.id, requestType: request.type }, 'Executing handler');
      return await handlerMetadata.handler(request.params);
    } catch (error) {
      logger.error({ 
        requestId: request.id, 
        requestType: request.type,
        error: error instanceof Error ? error.message : String(error)
      }, 'Error executing handler');
      
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Get all available request types
   * @returns Array of available request types
   */
  public getAvailableRequestTypes(): string[] {
    return Array.from(this.requestHandler.getHandlers().keys());
  }
}