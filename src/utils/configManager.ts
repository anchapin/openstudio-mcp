import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { logger } from './index';

/**
 * Configuration manager for the OpenStudio MCP Server
 * Handles loading configuration from various sources with the following precedence:
 * 1. Environment variables
 * 2. Config file specified by --config flag
 * 3. Config file in the current directory (.env)
 * 4. Config file in the user's home directory (~/.openstudio-mcp-server/config)
 * 5. Default values
 */
export class ConfigManager {
  private configPath: string | null = null;

  /**
   * Initialize the configuration manager
   */
  constructor() {
    // Load environment variables from .env file if it exists
    dotenv.config();
  }

  /**
   * Get the configuration directory
   * In production mode (packaged executable), this is in the user's home directory
   * In development mode, this is in the current directory
   */
  public getConfigDir(): string {
    // If running as a packaged executable, use the user's home directory
    if ((process as unknown as { pkg?: boolean }).pkg) {
      const homeDir = process.env.HOME || process.env.USERPROFILE || '';
      return path.join(homeDir, '.openstudio-mcp-server');
    }

    // Otherwise, use the current directory
    return process.cwd();
  }

  /**
   * Load configuration from a file
   * @param configPath Path to the configuration file
   */
  public loadConfigFile(configPath?: string): void {
    // If a config path is provided, use it
    if (configPath) {
      this.configPath = configPath;

      if (fs.existsSync(configPath)) {
        logger.info(`Loading configuration from ${configPath}`);
        const envConfig = dotenv.parse(fs.readFileSync(configPath));

        // Set environment variables from the config file
        for (const key in envConfig) {
          if (Object.prototype.hasOwnProperty.call(envConfig, key)) {
            process.env[key] = envConfig[key];
          }
        }
      } else {
        logger.warn(`Configuration file not found: ${configPath}`);
      }
      return;
    }

    // Try to load from the default locations
    const configDir = this.getConfigDir();
    const defaultConfigPath = path.join(configDir, '.env');

    if (fs.existsSync(defaultConfigPath)) {
      logger.info(`Loading configuration from ${defaultConfigPath}`);
      this.configPath = defaultConfigPath;
      dotenv.config({ path: defaultConfigPath });
    } else {
      // If running as a packaged executable, check the user's home directory
      if ((process as unknown as { pkg?: boolean }).pkg) {
        const homeDir = process.env.HOME || process.env.USERPROFILE || '';
        const homeConfigPath = path.join(homeDir, '.openstudio-mcp-server', 'config');

        if (fs.existsSync(homeConfigPath)) {
          logger.info(`Loading configuration from ${homeConfigPath}`);
          this.configPath = homeConfigPath;
          dotenv.config({ path: homeConfigPath });
        }
      }
    }
  }

  /**
   * Save the current configuration to a file
   * @param configPath Path to save the configuration file
   */
  public saveConfigFile(configPath?: string): void {
    const savePath = configPath || this.configPath || path.join(this.getConfigDir(), '.env');

    // Ensure the directory exists
    const configDir = path.dirname(savePath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    // Build the configuration content
    const configContent = [
      '# Server configuration',
      `PORT=${process.env.PORT || 3000}`,
      `HOST=${process.env.HOST || '0.0.0.0'}`,
      '',
      '# OpenStudio configuration',
      `OPENSTUDIO_CLI_PATH=${process.env.OPENSTUDIO_CLI_PATH || 'openstudio'}`,
      `OPENSTUDIO_TIMEOUT=${process.env.OPENSTUDIO_TIMEOUT || 300000}`,
      '',
      '# BCL configuration',
      `BCL_API_URL=${process.env.BCL_API_URL || 'https://bcl.nrel.gov/api/v1'}`,
      `BCL_MEASURES_DIR=${process.env.BCL_MEASURES_DIR || './measures'}`,
      '',
      '# Logging configuration',
      `LOG_LEVEL=${process.env.LOG_LEVEL || 'info'}`,
    ].join('\n');

    // Write the configuration file
    fs.writeFileSync(savePath, configContent);
    logger.info(`Configuration saved to ${savePath}`);
  }
}

export const configManager = new ConfigManager();
