/**
 * Command processor service
 * 
 * This service is responsible for processing commands and executing them
 * using the secure command execution module.
 */
import { CommandProcessor, CommandResult, FileOperation, FileOperationResult } from '../interfaces';
import { logger, commandExecutor } from '../utils';
import config from '../config';
import fs from 'fs/promises';
import path from 'path';
import { isPathSafe } from '../utils/validation';

/**
 * Command processor implementation
 */
export class OpenStudioCommandProcessor implements CommandProcessor {
  /**
   * Process a command
   * @param command Command to process
   * @param params Command parameters
   * @returns Promise that resolves with the command result
   */
  public async processCommand(command: string, params: any): Promise<CommandResult> {
    logger.info({ command, params }, 'Processing command');
    
    try {
      // Prepare command execution options
      const options = {
        cwd: params.workingDirectory,
        env: params.env,
        timeout: params.timeout || config.openStudio.timeout,
        memoryLimit: params.memoryLimit || 2048, // Default to 2GB memory limit
        niceness: params.niceness || 10, // Default to lower priority
        restricted: params.restricted !== false, // Default to restricted mode
      };
      
      // Execute the command with args if provided
      const result = await commandExecutor.executeCommand(
        command, 
        params.args || [], 
        options
      );
      
      return {
        success: result.success,
        output: result.stdout,
        error: result.error,
        data: {
          exitCode: result.exitCode,
          stderr: result.stderr,
          executionTime: result.executionTime,
        },
      };
    } catch (error) {
      logger.error({ command, params, error }, 'Error processing command');
      
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Execute an OpenStudio CLI command
   * @param command OpenStudio CLI command
   * @param args Command arguments
   * @returns Promise that resolves with the command result
   */
  public async executeOpenStudioCommand(command: string, args: string[] = []): Promise<CommandResult> {
    logger.info({ command, args }, 'Executing OpenStudio command');
    
    try {
      // Execute the OpenStudio command with enhanced options
      const result = await commandExecutor.executeOpenStudioCommand(command, args, {
        timeout: config.openStudio.timeout,
        memoryLimit: 2048, // Default to 2GB memory limit
        niceness: 10, // Default to lower priority
        restricted: true, // Default to restricted mode
      });
      
      return {
        success: result.success,
        output: result.stdout,
        error: result.error,
        data: {
          exitCode: result.exitCode,
          stderr: result.stderr,
          executionTime: result.executionTime,
        },
      };
    } catch (error) {
      logger.error({ command, args, error }, 'Error executing OpenStudio command');
      
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Handle a file operation
   * @param operation File operation to handle
   * @returns Promise that resolves with the file operation result
   */
  public async handleFileOperation(operation: FileOperation): Promise<FileOperationResult> {
    logger.info({ operation }, 'Handling file operation');
    
    // Validate the path
    if (!isPathSafe(operation.path)) {
      logger.warn({ operation }, 'Unsafe file path');
      return {
        success: false,
        error: 'Unsafe file path',
      };
    }
    
    try {
      switch (operation.type) {
        case 'read':
          return await this.readFile(operation.path);
        case 'write':
          return await this.writeFile(operation.path, operation.content || '');
        case 'delete':
          return await this.deleteFile(operation.path);
        default:
          logger.warn({ operation }, 'Unknown file operation type');
          return {
            success: false,
            error: `Unknown file operation type: ${operation.type}`,
          };
      }
    } catch (error) {
      logger.error({ operation, error }, 'Error handling file operation');
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Read a file
   * @param filePath Path to the file
   * @returns Promise that resolves with the file content
   */
  private async readFile(filePath: string): Promise<FileOperationResult> {
    try {
      // Ensure the file exists
      await fs.access(filePath);
      
      // Read the file
      const content = await fs.readFile(filePath, 'utf8');
      
      return {
        success: true,
        content,
      };
    } catch (error) {
      logger.error({ filePath, error }, 'Error reading file');
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Write a file
   * @param filePath Path to the file
   * @param content File content
   * @returns Promise that resolves with the file operation result
   */
  private async writeFile(filePath: string, content: string): Promise<FileOperationResult> {
    try {
      // Ensure the directory exists
      const directory = path.dirname(filePath);
      await fs.mkdir(directory, { recursive: true });
      
      // Write the file
      await fs.writeFile(filePath, content, 'utf8');
      
      return {
        success: true,
      };
    } catch (error) {
      logger.error({ filePath, error }, 'Error writing file');
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Delete a file
   * @param filePath Path to the file
   * @returns Promise that resolves with the file operation result
   */
  private async deleteFile(filePath: string): Promise<FileOperationResult> {
    try {
      // Ensure the file exists
      await fs.access(filePath);
      
      // Delete the file
      await fs.unlink(filePath);
      
      return {
        success: true,
      };
    } catch (error) {
      logger.error({ filePath, error }, 'Error deleting file');
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}