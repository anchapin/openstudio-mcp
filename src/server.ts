/**
 * MCP Server implementation
 */
import express from 'express';
import http from 'http';
import * as WebSocket from 'ws';
import { logger } from './utils';
import config from './config';
import { MCPServer } from './services/mcpServer';

/**
 * Start the MCP server
 * @param port Port to listen on
 * @returns Promise that resolves when the server is started
 */
export async function startServer(port: number = config.server.port): Promise<http.Server> {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocket.Server({ server });

  // Create MCP server instance
  const mcpServer = new MCPServer();

  // Register MCP server capabilities
  mcpServer.registerCapabilities();

  // Enable JSON parsing for HTTP requests
  app.use(express.json());

  // Basic health check endpoint
  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      server: 'OpenStudio MCP Server',
      version: process.env.npm_package_version || '0.1.0',
    });
  });

  // API endpoint to get capabilities
  app.get('/capabilities', (_req, res) => {
    res.status(200).json({
      capabilities: mcpServer.getCapabilities(),
    });
  });

  // MCP HTTP endpoint for VS Code integration
  app.post('/mcp/', async (req, res) => {
    try {
      const request = req.body;
      logger.info({ request }, 'Received HTTP MCP request');

      // Handle MCP request
      const response = await mcpServer.handleRequest(request);

      res.status(200).json(response);
    } catch (error) {
      logger.error({ error }, 'Error handling HTTP MCP request');
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
          details: error instanceof Error ? error.message : String(error),
        },
      });
    }
  });

  // MCP tools/list endpoint
  app.get('/mcp/tools/list', (_req, res) => {
    const capabilities = mcpServer.getCapabilities();
    const tools = capabilities.map((cap) => ({
      name: cap.name,
      description: cap.description,
      inputSchema: {
        type: 'object',
        properties: cap.parameters,
        required: Object.keys(cap.parameters as Record<string, unknown>).filter(
          (key) =>
            ((cap.parameters as Record<string, unknown>)[key] as { required?: boolean }).required,
        ),
      },
    }));

    res.status(200).json({
      tools: tools,
    });
  });

  // MCP tools/call endpoint
  app.post('/mcp/tools/call', async (req, res) => {
    try {
      const { name, arguments: args } = req.body;

      const request = {
        id: `http-${Date.now()}`,
        type: name,
        params: args || {},
      };

      const response = await mcpServer.handleRequest(request);

      res.status(200).json({
        content: [
          {
            type: 'text',
            text: JSON.stringify(response.result || response.error, null, 2),
          },
        ],
      });
    } catch (error) {
      logger.error({ error }, 'Error calling tool via HTTP');
      res.status(500).json({
        error: {
          code: 'TOOL_CALL_ERROR',
          message: 'Error calling tool',
          details: error instanceof Error ? error.message : String(error),
        },
      });
    }
  });

  // Handle WebSocket connections
  wss.on('connection', (ws) => {
    // Delegate connection handling to MCP server
    mcpServer.handleConnection(ws);
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      logger.info(`OpenStudio MCP Server listening on port ${port}`);
      resolve(server);
    });
  });
}
