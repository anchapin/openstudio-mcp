/**
 * MCP Server implementation
 */
import express from 'express';
import http from 'http';
import WebSocket from 'ws';
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

  // Basic health check endpoint
  app.get('/health', (_req, res) => {
    res.status(200).json({ 
      status: 'ok',
      server: 'OpenStudio MCP Server',
      version: process.env.npm_package_version || '0.1.0'
    });
  });
  
  // API endpoint to get capabilities
  app.get('/capabilities', (_req, res) => {
    res.status(200).json({
      capabilities: mcpServer.getCapabilities()
    });
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