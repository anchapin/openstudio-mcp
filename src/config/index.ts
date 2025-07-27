/**
 * Application configuration
 */
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables from .env file
dotenv.config();

// Default configuration
const config = {
  // Server configuration
  server: {
    port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
    host: process.env.HOST || '0.0.0.0',
  },
  
  // OpenStudio configuration
  openStudio: {
    // Path to OpenStudio CLI executable
    cliPath: process.env.OPENSTUDIO_CLI_PATH || 'openstudio',
    // Default timeout for OpenStudio commands (in milliseconds)
    timeout: process.env.OPENSTUDIO_TIMEOUT ? parseInt(process.env.OPENSTUDIO_TIMEOUT, 10) : 300000,
  },
  
  // BCL configuration
  bcl: {
    // BCL API URL
    apiUrl: process.env.BCL_API_URL || 'https://bcl.nrel.gov/api/v1',
    // Directory to store downloaded measures
    measuresDir: process.env.BCL_MEASURES_DIR || path.join(process.cwd(), 'measures'),
  },
  
  // Temporary directory for file operations
  tempDir: process.env.TEMP_DIR || path.join(process.cwd(), 'temp'),
  
  // Model templates configuration
  modelTemplates: {
    // Directory to store model templates
    templatesDir: process.env.MODEL_TEMPLATES_DIR || path.join(process.cwd(), 'templates'),
    // Default weather file path
    defaultWeatherFile: process.env.DEFAULT_WEATHER_FILE || '',
  },
  
  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    prettyPrint: process.env.NODE_ENV !== 'production',
  },
  
  // Security configuration
  security: {
    allowedDirectories: process.env.ALLOWED_DIRECTORIES ? 
      process.env.ALLOWED_DIRECTORIES.split(',').map(dir => dir.trim()) : 
      [],
  },
  
  // File operations configuration
  fileOperations: {
    allowedDirectories: process.env.ALLOWED_DIRECTORIES ? 
      process.env.ALLOWED_DIRECTORIES.split(',').map(dir => dir.trim()) : 
      [],
  },
};

// Create measures directory if it doesn't exist
if (!fs.existsSync(config.bcl.measuresDir)) {
  fs.mkdirSync(config.bcl.measuresDir, { recursive: true });
}

// Create temp directory if it doesn't exist
if (!fs.existsSync(config.tempDir)) {
  fs.mkdirSync(config.tempDir, { recursive: true });
}

// Create templates directory if it doesn't exist
if (!fs.existsSync(config.modelTemplates.templatesDir)) {
  fs.mkdirSync(config.modelTemplates.templatesDir, { recursive: true });
}

export default config;