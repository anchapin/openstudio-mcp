import { startServer } from './server';
import { configManager } from './utils/configManager';
import { logger } from './utils';
import fs from 'fs';

// Parse command line arguments
const args = process.argv.slice(2);
let configPath: string | undefined;
let shouldGenerateConfig = false;

// Process command line arguments
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--config' && i + 1 < args.length) {
    configPath = args[i + 1];
    i++;
  } else if (args[i] === '--generate-config') {
    shouldGenerateConfig = true;
  } else if (args[i] === '--help' || args[i] === '-h') {
    logger.info(`
OpenStudio MCP Server

Usage:
  openstudio-mcp-server [options]

Options:
  --config <path>      Path to configuration file
  --generate-config    Generate a default configuration file
  --help, -h           Show this help message
`);
    process.exit(0);
  }
}

// Load configuration
configManager.loadConfigFile(configPath);

// Generate configuration if requested
if (shouldGenerateConfig) {
  configManager.saveConfigFile();
  process.exit(0);
}

// Ensure measures directory exists
const measuresDir = process.env.BCL_MEASURES_DIR || './measures';
if (!fs.existsSync(measuresDir)) {
  fs.mkdirSync(measuresDir, { recursive: true });
}

// Get port from environment variables
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Start the server
startServer(PORT)
  .then(() => {
    logger.info(`OpenStudio MCP Server running on port ${PORT}`);
  })
  .catch((error) => {
    logger.error('Failed to start server:', error);
    process.exit(1);
  });
