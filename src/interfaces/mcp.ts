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
    measureParams?: Record<string, unknown>;
    query?: string;
    [key: string]: unknown;
  };
}

/**
 * MCP Response interface
 */
export interface MCPResponse {
  id: string;
  type: string;
  status: 'success' | 'error';
  result?: unknown;
  error?: {
    code: string;
    message: string;
    details?: unknown;
    _metadata?: unknown;
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
