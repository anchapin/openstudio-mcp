/**
 * Command interfaces
 */

/**
 * Command result interface
 */
export interface CommandResult {
  success: boolean;
  output: string;
  error?: string;
  data?: any;
}

/**
 * Command processor interface
 */
export interface CommandProcessor {
  processCommand(command: string, params: any): Promise<CommandResult>;
  executeOpenStudioCommand(command: string, args: string[]): Promise<CommandResult>;
  handleFileOperation(operation: FileOperation): Promise<FileOperationResult>;
}

/**
 * File operation interface
 */
export interface FileOperation {
  type: 'read' | 'write' | 'delete';
  path: string;
  content?: string;
}

/**
 * File operation result interface
 */
export interface FileOperationResult {
  success: boolean;
  content?: string;
  error?: string;
}