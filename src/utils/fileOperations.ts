/**
 * Secure file operations module
 * 
 * This module provides secure file operations with proper permissions,
 * temporary file management, and cleanup procedures.
 * 
 * Security features:
 * - Path validation to prevent directory traversal
 * - Permission checks for file operations
 * - Secure temporary file creation
 * - Automatic cleanup of temporary files
 * - File operation logging
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { promisify } from 'util';
import { logger } from './index';
import { isPathSafe } from './validation';
import config from '../config';

// Promisify fs functions
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const appendFileAsync = promisify(fs.appendFile);
const mkdirAsync = promisify(fs.mkdir);
const statAsync = promisify(fs.stat);
const unlinkAsync = promisify(fs.unlink);
const readdirAsync = promisify(fs.readdir);
const rmdirAsync = promisify(fs.rmdir);
const accessAsync = promisify(fs.access);
const copyFileAsync = promisify(fs.copyFile);

/**
 * File operation options
 */
export interface FileOperationOptions {
  /** Encoding for file operations */
  encoding?: BufferEncoding;
  /** File mode (permissions) */
  mode?: number;
  /** Whether to create parent directories if they don't exist */
  createDirectories?: boolean;
  /** Maximum file size in bytes */
  maxSize?: number;
  /** Whether to overwrite existing files */
  overwrite?: boolean;
  /** Whether to preserve the original file */
  preserveOriginal?: boolean;
  /** Whether to use a temporary file for writing */
  useTemporary?: boolean;
  /** Custom temporary directory */
  tempDir?: string;
}

/**
 * Default file operation options
 */
const defaultOptions: FileOperationOptions = {
  encoding: 'utf8',
  mode: 0o644, // rw-r--r--
  createDirectories: true,
  maxSize: 50 * 1024 * 1024, // 50MB
  overwrite: false,
  preserveOriginal: true,
  useTemporary: true,
};

/**
 * Temporary file registry to track files for cleanup
 */
const temporaryFiles = new Set<string>();

/**
 * Validate a file path
 * @param filePath Path to validate
 * @returns Validation result with success flag and optional error message
 */
export function validatePath(filePath: string): { valid: boolean; error?: string } {
  // Check if path is defined
  if (!filePath || typeof filePath !== 'string') {
    return { valid: false, error: 'Path must be a non-empty string' };
  }

  // Normalize path for consistent validation
  const normalizedPath = path.normalize(filePath);
  
  // Check for path traversal attempts
  if (normalizedPath.includes('..')) {
    return { valid: false, error: 'Path contains directory traversal patterns' };
  }

  // Check for unsafe characters or command injection
  if (!isPathSafe(normalizedPath)) {
    return { valid: false, error: 'Path contains potentially unsafe characters or commands' };
  }

  // Check if path is absolute and outside allowed directories
  if (path.isAbsolute(normalizedPath)) {
    // Get allowed directories from config
    const allowedDirs = config.fileOperations?.allowedDirectories || [];
    
    // Check if path is within allowed directories
    const isAllowed = allowedDirs.some(dir => normalizedPath.startsWith(dir));
    
    if (!isAllowed) {
      return { valid: false, error: 'Path is outside allowed directories' };
    }
  }

  return { valid: true };
}

/**
 * Check if a file exists
 * @param filePath Path to check
 * @returns Promise that resolves with true if the file exists, false otherwise
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await accessAsync(filePath, fs.constants.F_OK);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Check if a directory exists
 * @param dirPath Path to check
 * @returns Promise that resolves with true if the directory exists, false otherwise
 */
export async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stats = await statAsync(dirPath);
    return stats.isDirectory();
  } catch (error) {
    return false;
  }
}

/**
 * Create a directory if it doesn't exist
 * @param dirPath Path to create
 * @param recursive Whether to create parent directories
 * @returns Promise that resolves when the directory is created
 */
export async function ensureDirectory(dirPath: string, recursive = true): Promise<void> {
  // Validate path
  const validation = validatePath(dirPath);
  if (!validation.valid) {
    throw new Error(`Invalid directory path: ${validation.error}`);
  }

  try {
    // Check if directory exists
    if (await directoryExists(dirPath)) {
      return;
    }

    // Create directory
    await mkdirAsync(dirPath, { recursive });
    logger.debug({ dirPath }, 'Created directory');
  } catch (error) {
    logger.error({ dirPath, error }, 'Failed to create directory');
    throw new Error(`Failed to create directory: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Generate a temporary file path
 * @param prefix Prefix for the temporary file
 * @param suffix Suffix for the temporary file
 * @param tempDir Custom temporary directory
 * @returns Temporary file path
 */
export function generateTempFilePath(
  prefix = 'openstudio-mcp-',
  suffix = '',
  tempDir?: string
): string {
  // Generate a random string
  const randomString = crypto.randomBytes(16).toString('hex');
  
  // Use custom temp directory or system temp directory
  const tempDirectory = tempDir || os.tmpdir();
  
  // Generate temporary file path
  return path.join(tempDirectory, `${prefix}${randomString}${suffix}`);
}

/**
 * Create a temporary file
 * @param content Content to write to the temporary file
 * @param options File operation options
 * @returns Promise that resolves with the temporary file path
 */
export async function createTempFile(
  content: string | Buffer,
  options: FileOperationOptions = {}
): Promise<string> {
  const opts = { ...defaultOptions, ...options };
  
  // Generate temporary file path
  const tempFilePath = generateTempFilePath(
    'openstudio-mcp-',
    '',
    opts.tempDir
  );
  
  try {
    // Write content to temporary file
    await writeFileAsync(tempFilePath, content, {
      encoding: opts.encoding,
      mode: opts.mode,
    });
    
    // Register temporary file for cleanup
    temporaryFiles.add(tempFilePath);
    
    logger.debug({ tempFilePath }, 'Created temporary file');
    return tempFilePath;
  } catch (error) {
    logger.error({ tempFilePath, error }, 'Failed to create temporary file');
    throw new Error(`Failed to create temporary file: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Read a file securely
 * @param filePath Path to read
 * @param options File operation options
 * @returns Promise that resolves with the file content
 */
export async function readFile(
  filePath: string,
  options: FileOperationOptions = {}
): Promise<string | Buffer> {
  const opts = { ...defaultOptions, ...options };
  
  // Validate path
  const validation = validatePath(filePath);
  if (!validation.valid) {
    throw new Error(`Invalid file path: ${validation.error}`);
  }

  try {
    // Check if file exists
    if (!await fileExists(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Check file size
    const stats = await statAsync(filePath);
    if (opts.maxSize && stats.size > opts.maxSize) {
      throw new Error(`File size exceeds maximum allowed size (${stats.size} > ${opts.maxSize} bytes)`);
    }

    // Read file
    const content = await readFileAsync(filePath, {
      encoding: opts.encoding,
    });

    logger.debug({ filePath }, 'Read file');
    return content;
  } catch (error) {
    logger.error({ filePath, error }, 'Failed to read file');
    throw new Error(`Failed to read file: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Write to a file securely
 * @param filePath Path to write
 * @param content Content to write
 * @param options File operation options
 * @returns Promise that resolves when the file is written
 */
export async function writeFile(
  filePath: string,
  content: string | Buffer,
  options: FileOperationOptions = {}
): Promise<void> {
  const opts = { ...defaultOptions, ...options };
  
  // Validate path
  const validation = validatePath(filePath);
  if (!validation.valid) {
    throw new Error(`Invalid file path: ${validation.error}`);
  }

  try {
    // Check if file exists and overwrite is not allowed
    if (!opts.overwrite && await fileExists(filePath)) {
      throw new Error(`File already exists: ${filePath}`);
    }

    // Create parent directories if needed
    if (opts.createDirectories) {
      const dirPath = path.dirname(filePath);
      await ensureDirectory(dirPath);
    }

    // Check content size
    if (opts.maxSize && content.length > opts.maxSize) {
      throw new Error(`Content size exceeds maximum allowed size (${content.length} > ${opts.maxSize} bytes)`);
    }

    // If using temporary file for atomic write
    if (opts.useTemporary) {
      // Create temporary file
      const tempFilePath = generateTempFilePath(
        'openstudio-mcp-',
        path.extname(filePath),
        path.dirname(filePath)
      );
      
      // Write to temporary file
      await writeFileAsync(tempFilePath, content, {
        encoding: opts.encoding,
        mode: opts.mode,
      });
      
      // Move temporary file to destination
      await copyFileAsync(tempFilePath, filePath);
      
      // Delete temporary file
      await unlinkAsync(tempFilePath);
      
      logger.debug({ filePath, tempFilePath }, 'Wrote file using temporary file');
    } else {
      // Write directly to destination
      await writeFileAsync(filePath, content, {
        encoding: opts.encoding,
        mode: opts.mode,
      });
      
      logger.debug({ filePath }, 'Wrote file directly');
    }
  } catch (error) {
    logger.error({ filePath, error }, 'Failed to write file');
    throw new Error(`Failed to write file: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Append to a file securely
 * @param filePath Path to append to
 * @param content Content to append
 * @param options File operation options
 * @returns Promise that resolves when the content is appended
 */
export async function appendFile(
  filePath: string,
  content: string | Buffer,
  options: FileOperationOptions = {}
): Promise<void> {
  const opts = { ...defaultOptions, ...options };
  
  // Validate path
  const validation = validatePath(filePath);
  if (!validation.valid) {
    throw new Error(`Invalid file path: ${validation.error}`);
  }

  try {
    // Create parent directories if needed
    if (opts.createDirectories) {
      const dirPath = path.dirname(filePath);
      await ensureDirectory(dirPath);
    }

    // Check if file exists and create if it doesn't
    if (!await fileExists(filePath)) {
      await writeFileAsync(filePath, '', {
        encoding: opts.encoding,
        mode: opts.mode,
      });
    }

    // Check content size
    if (opts.maxSize) {
      const stats = await statAsync(filePath);
      const newSize = stats.size + content.length;
      
      if (newSize > opts.maxSize) {
        throw new Error(`Resulting file size would exceed maximum allowed size (${newSize} > ${opts.maxSize} bytes)`);
      }
    }

    // Append to file
    await appendFileAsync(filePath, content, {
      encoding: opts.encoding,
    });
    
    logger.debug({ filePath }, 'Appended to file');
  } catch (error) {
    logger.error({ filePath, error }, 'Failed to append to file');
    throw new Error(`Failed to append to file: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Delete a file securely
 * @param filePath Path to delete
 * @returns Promise that resolves when the file is deleted
 */
export async function deleteFile(filePath: string): Promise<void> {
  // Validate path
  const validation = validatePath(filePath);
  if (!validation.valid) {
    throw new Error(`Invalid file path: ${validation.error}`);
  }

  try {
    // Check if file exists
    if (!await fileExists(filePath)) {
      logger.debug({ filePath }, 'File not found, skipping deletion');
      return;
    }

    // Delete file
    await unlinkAsync(filePath);
    logger.debug({ filePath }, 'Deleted file');
    
    // Remove from temporary files registry if it was registered
    if (temporaryFiles.has(filePath)) {
      temporaryFiles.delete(filePath);
    }
  } catch (error) {
    logger.error({ filePath, error }, 'Failed to delete file');
    throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Copy a file securely
 * @param sourcePath Source file path
 * @param destinationPath Destination file path
 * @param options File operation options
 * @returns Promise that resolves when the file is copied
 */
export async function copyFile(
  sourcePath: string,
  destinationPath: string,
  options: FileOperationOptions = {}
): Promise<void> {
  const opts = { ...defaultOptions, ...options };
  
  // Validate paths
  const sourceValidation = validatePath(sourcePath);
  if (!sourceValidation.valid) {
    throw new Error(`Invalid source path: ${sourceValidation.error}`);
  }
  
  const destValidation = validatePath(destinationPath);
  if (!destValidation.valid) {
    throw new Error(`Invalid destination path: ${destValidation.error}`);
  }

  try {
    // Check if source file exists
    if (!await fileExists(sourcePath)) {
      throw new Error(`Source file not found: ${sourcePath}`);
    }

    // Check if destination file exists and overwrite is not allowed
    if (!opts.overwrite && await fileExists(destinationPath)) {
      throw new Error(`Destination file already exists: ${destinationPath}`);
    }

    // Create parent directories if needed
    if (opts.createDirectories) {
      const dirPath = path.dirname(destinationPath);
      await ensureDirectory(dirPath);
    }

    // Check file size
    if (opts.maxSize) {
      const stats = await statAsync(sourcePath);
      if (stats.size > opts.maxSize) {
        throw new Error(`File size exceeds maximum allowed size (${stats.size} > ${opts.maxSize} bytes)`);
      }
    }

    // Copy file
    await copyFileAsync(sourcePath, destinationPath);
    logger.debug({ sourcePath, destinationPath }, 'Copied file');
  } catch (error) {
    logger.error({ sourcePath, destinationPath, error }, 'Failed to copy file');
    throw new Error(`Failed to copy file: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Move a file securely
 * @param sourcePath Source file path
 * @param destinationPath Destination file path
 * @param options File operation options
 * @returns Promise that resolves when the file is moved
 */
export async function moveFile(
  sourcePath: string,
  destinationPath: string,
  options: FileOperationOptions = {}
): Promise<void> {
  const opts = { ...defaultOptions, ...options };
  
  try {
    // Copy file
    await copyFile(sourcePath, destinationPath, opts);
    
    // Delete source file if not preserving original
    if (!opts.preserveOriginal) {
      await deleteFile(sourcePath);
      logger.debug({ sourcePath, destinationPath }, 'Moved file');
    } else {
      logger.debug({ sourcePath, destinationPath }, 'Copied file (preserving original)');
    }
    
    // Update temporary files registry if it was registered
    if (temporaryFiles.has(sourcePath) && !opts.preserveOriginal) {
      temporaryFiles.delete(sourcePath);
      temporaryFiles.add(destinationPath);
    }
  } catch (error) {
    logger.error({ sourcePath, destinationPath, error }, 'Failed to move file');
    throw new Error(`Failed to move file: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * List files in a directory
 * @param dirPath Directory path
 * @returns Promise that resolves with an array of file names
 */
export async function listFiles(dirPath: string): Promise<string[]> {
  // Validate path
  const validation = validatePath(dirPath);
  if (!validation.valid) {
    throw new Error(`Invalid directory path: ${validation.error}`);
  }

  try {
    // Check if directory exists
    if (!await directoryExists(dirPath)) {
      throw new Error(`Directory not found: ${dirPath}`);
    }

    // List files
    const files = await readdirAsync(dirPath);
    logger.debug({ dirPath, fileCount: files.length }, 'Listed files in directory');
    return files;
  } catch (error) {
    logger.error({ dirPath, error }, 'Failed to list files in directory');
    throw new Error(`Failed to list files in directory: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Create a temporary directory
 * @param prefix Prefix for the temporary directory
 * @param tempDir Custom temporary directory
 * @returns Promise that resolves with the temporary directory path
 */
export async function createTempDirectory(
  prefix = 'openstudio-mcp-',
  tempDir?: string
): Promise<string> {
  // Generate a random string
  const randomString = crypto.randomBytes(16).toString('hex');
  
  // Use custom temp directory or system temp directory
  const tempDirectory = tempDir || os.tmpdir();
  
  // Generate temporary directory path
  const tempDirPath = path.join(tempDirectory, `${prefix}${randomString}`);
  
  try {
    // Create directory
    await mkdirAsync(tempDirPath, { recursive: true });
    logger.debug({ tempDirPath }, 'Created temporary directory');
    return tempDirPath;
  } catch (error) {
    logger.error({ tempDirPath, error }, 'Failed to create temporary directory');
    throw new Error(`Failed to create temporary directory: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Delete a directory and its contents recursively
 * @param dirPath Directory path
 * @returns Promise that resolves when the directory is deleted
 */
export async function deleteDirectory(dirPath: string): Promise<void> {
  // Validate path
  const validation = validatePath(dirPath);
  if (!validation.valid) {
    throw new Error(`Invalid directory path: ${validation.error}`);
  }

  try {
    // Check if directory exists
    if (!await directoryExists(dirPath)) {
      logger.debug({ dirPath }, 'Directory not found, skipping deletion');
      return;
    }

    // List files in directory
    const files = await readdirAsync(dirPath);
    
    // Delete each file/subdirectory
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = await statAsync(filePath);
      
      if (stats.isDirectory()) {
        // Recursively delete subdirectory
        await deleteDirectory(filePath);
      } else {
        // Delete file
        await deleteFile(filePath);
      }
    }
    
    // Delete empty directory
    await rmdirAsync(dirPath);
    logger.debug({ dirPath }, 'Deleted directory');
  } catch (error) {
    logger.error({ dirPath, error }, 'Failed to delete directory');
    throw new Error(`Failed to delete directory: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Clean up temporary files
 * @returns Promise that resolves when all temporary files are cleaned up
 */
export async function cleanupTemporaryFiles(): Promise<void> {
  logger.info(`Cleaning up ${temporaryFiles.size} temporary files`);
  
  const promises: Promise<void>[] = [];
  
  for (const filePath of temporaryFiles) {
    promises.push(
      deleteFile(filePath).catch(error => {
        logger.error({ filePath, error }, 'Failed to delete temporary file during cleanup');
      })
    );
  }
  
  await Promise.all(promises);
  temporaryFiles.clear();
  
  logger.info('Temporary file cleanup complete');
}

// Set up process exit handlers to clean up resources
process.on('exit', () => {
  // Synchronous cleanup on exit
  for (const filePath of temporaryFiles) {
    try {
      fs.unlinkSync(filePath);
      logger.debug({ filePath }, 'Deleted temporary file on exit');
    } catch (error) {
      logger.error({ filePath, error }, 'Failed to delete temporary file on exit');
    }
  }
  
  temporaryFiles.clear();
});

process.on('SIGINT', () => {
  logger.info('Received SIGINT, cleaning up temporary files');
  cleanupTemporaryFiles().finally(() => {
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, cleaning up temporary files');
  cleanupTemporaryFiles().finally(() => {
    process.exit(0);
  });
});

// Export the module
export default {
  validatePath,
  fileExists,
  directoryExists,
  ensureDirectory,
  generateTempFilePath,
  createTempFile,
  readFile,
  writeFile,
  appendFile,
  deleteFile,
  copyFile,
  moveFile,
  listFiles,
  createTempDirectory,
  deleteDirectory,
  cleanupTemporaryFiles,
};