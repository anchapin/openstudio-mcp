/**
 * MCP (Model Context Protocol) interfaces
 */

/**
 * MCP Request interface
 */
export interface MCPRequest {
  id: string;
  type: string;
  params: {
    command?: string;
    modelPath?: string;
    measureId?: string;
    measureParams?: Record<string, any>;
    query?: string;
    [key: string]: any;
  };
}

/**
 * MCP Response interface
 */
export interface MCPResponse {
  id: string;
  type: string;
  status: 'success' | 'error';
  result?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * MCP Server interface
 */
export interface MCPServerInterface {
  registerCapabilities(): void;
  handleRequest(request: MCPRequest): Promise<MCPResponse>;
  validateRequest(request: MCPRequest): boolean;
}