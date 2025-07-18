/**
 * Secure command execution module
 * 
 * This module provides a secure way to execute OpenStudio CLI commands
 * with proper validation, error handling, and resource management.
 * 
 * Security features:
 * - Command validation to prevent injection attacks
 * - Path validation to prevent directory traversal
 * - Resource limits for CPU and memory usage
 * - Timeouts for long-running commands
 * - Process isolation and cleanup
 * - Concurrent process management
 * - Graceful termination of processes
 */
import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { logger } from './index';
import { isCommandSafe, isPathSafe } from './validation';
import { createResourceMonitor } from './resourceMonitor';
import config from '../config';
import path from 'path';
import fs from 'fs';
import os from 'os';

// Promisified exec for simple command execution
const execAsync = promisify(exec);

/**
 * Command execution options
 */
export interface CommandExecutionOptions {
  /** Maximum execution time in milliseconds */
  timeout?: number;
  /** Working directory for the command */
  cwd?: string;
  /** Environment variables to pass to the command */
  env?: NodeJS.ProcessEnv;
  /** Maximum buffer size for stdout/stderr in bytes */
  maxBuffer?: number;
  /** Whether to capture and return stdout */
  captureStdout?: boolean;
  /** Whether to capture and return stderr */
  captureStderr?: boolean;
  /** Maximum CPU priority (nice value, higher means lower priority) */
  niceness?: number;
  /** Maximum memory limit in MB */
  memoryLimit?: number;
  /** Maximum CPU usage percentage (0-100), 0 means no limit */
  cpuLimit?: number;
  /** Whether to run in a restricted environment */
  restricted?: boolean;
  /** Maximum number of concurrent processes, 0 means no limit */
  maxConcurrentProcesses?: number;
  /** Whether to kill the process if the parent process exits */
  killOnExit?: boolean;
}

/**
 * Command execution result
 */
export interface CommandExecutionResult {
  /** Whether the command executed successfully */
  success: boolean;
  /** Exit code of the command */
  exitCode: number | null;
  /** Standard output from the command */
  stdout: string;
  /** Standard error from the command */
  stderr: string;
  /** Error message if the command failed */
  error?: string;
  /** Execution time in milliseconds */
  executionTime: number;
}

/**
 * Active command processes
 */
const activeProcesses = new Map<string, {
  process: ChildProcess;
  timeout: NodeJS.Timeout | null;
  startTime: number;
}>();

/**
 * Default command execution options
 */
const defaultOptions: CommandExecutionOptions = {
  timeout: 300000, // 5 minutes
  maxBuffer: 10 * 1024 * 1024, // 10 MB
  captureStdout: true,
  captureStderr: true,
  niceness: 10, // Lower priority than normal processes
  memoryLimit: 2048, // 2GB memory limit
  cpuLimit: 80, // 80% CPU limit
  restricted: true, // Run in restricted environment by default
  maxConcurrentProcesses: 5, // Maximum 5 concurrent processes
  killOnExit: true, // Kill processes when parent exits
};

/**
 * Clean up resources for a command
 * @param id Command ID
 */
function cleanupCommand(id: string): void {
  const command = activeProcesses.get(id);
  if (command) {
    if (command.timeout) {
      clearTimeout(command.timeout);
    }
    activeProcesses.delete(id);
  }
}

/**
 * Kill all active processes
 */
export function killAllProcesses(): void {
  logger.info(`Killing ${activeProcesses.size} active processes`);
  
  for (const [id, command] of activeProcesses.entries()) {
    try {
      if (command.process.pid) {
        process.kill(command.process.pid, 'SIGTERM');
        logger.info(`Killed process ${command.process.pid} (${id})`);
      }
    } catch (error) {
      logger.error({ error }, `Failed to kill process ${id}`);
    }
    cleanupCommand(id);
  }
}

/**
 * Get the number of active processes
 * @returns Number of active processes
 */
export function getActiveProcessCount(): number {
  return activeProcesses.size;
}

/**
 * Get information about active processes
 * @returns Array of active process information
 */
export function getActiveProcesses(): Array<{
  id: string;
  pid: number | undefined;
  runtime: number;
}> {
  const now = Date.now();
  return Array.from(activeProcesses.entries()).map(([id, command]) => ({
    id,
    pid: command.process.pid,
    runtime: now - command.startTime,
  }));
}

/**
 * Validate command and arguments
 * @param command Command to execute
 * @param args Command arguments
 * @returns Validation result with success flag and optional error message
 */
export function validateCommand(
  command: string,
  args: string[] = []
): { valid: boolean; error?: string; securityRisk?: string } {
  // Check if command is defined
  if (!command || typeof command !== 'string') {
    return { valid: false, error: 'Command must be a non-empty string' };
  }

  // Normalize command path for consistent validation
  const normalizedCommand = command.trim().toLowerCase();
  
  // Whitelist of allowed commands for OpenStudio MCP server
  const allowedCommands = [
    'openstudio',
    'energyplus',
    'radiance',
    'ruby',
    'python',
    'node',
    'npm'
  ];
  
  // Check if command is in the whitelist or is a path to one of the allowed commands
  const isAllowedCommand = allowedCommands.some(allowed => 
    normalizedCommand === allowed || 
    normalizedCommand.endsWith(`/${allowed}`) ||
    normalizedCommand.endsWith(`\\${allowed}`) ||
    normalizedCommand.endsWith(`/${allowed}.exe`) ||
    normalizedCommand.endsWith(`\\${allowed}.exe`)
  );
  
  if (!isAllowedCommand) {
    return { 
      valid: false, 
      error: `Command not allowed: ${command}. Only specific commands are permitted.`,
      securityRisk: 'UNAUTHORIZED_COMMAND'
    };
  }

  // Check if command is safe (no injection patterns)
  if (!isCommandSafe(command)) {
    return { 
      valid: false, 
      error: 'Command contains potentially unsafe operations',
      securityRisk: 'COMMAND_INJECTION'
    };
  }

  // Check if command exists and is executable
  const commandPath = command.startsWith('./') || command.startsWith('/') || command.includes('\\')
    ? command 
    : config.openStudio.cliPath || command;

  try {
    // Check if the file exists
    if (!fs.existsSync(commandPath)) {
      return { valid: false, error: `Command not found: ${commandPath}` };
    }
    
    // On Unix-like systems, check if the file is executable
    if (process.platform !== 'win32') {
      try {
        // Check file permissions
        const stats = fs.statSync(commandPath);
        const isExecutable = !!(stats.mode & 0o111); // Check if any execute bit is set
        
        if (!isExecutable) {
          return { valid: false, error: `Command is not executable: ${commandPath}` };
        }
      } catch (error) {
        return { 
          valid: false, 
          error: `Error checking command permissions: ${error instanceof Error ? error.message : String(error)}` 
        };
      }
    }
  } catch (error) {
    return { 
      valid: false, 
      error: `Error checking command existence: ${error instanceof Error ? error.message : String(error)}` 
    };
  }

  // Validate arguments
  const dangerousPatterns = [
    // Command injection
    ';', '&&', '||', '|', 
    // Redirection
    '>', '<', '>>', '2>', '2>&1', 
    // Command substitution
    '`', '$(',
    // Dangerous commands
    'rm -rf', 'rm -r', 'rmdir', 'del /s', 'del /q',
    'format', 'mkfs', 'dd if=', 'wget', 'curl',
    '/bin/sh', '/bin/bash', 'cmd.exe', 'powershell',
    'eval', 'exec', 'system', 'chmod', 'chown'
  ];

  for (const arg of args) {
    if (typeof arg !== 'string') {
      return { valid: false, error: 'All arguments must be strings' };
    }

    // Check for dangerous patterns in arguments
    for (const pattern of dangerousPatterns) {
      if (arg.includes(pattern)) {
        return { 
          valid: false, 
          error: `Argument contains potentially dangerous pattern: ${pattern}`,
          securityRisk: 'DANGEROUS_ARGUMENT'
        };
      }
    }

    // Check for path arguments that might contain unsafe characters
    if (arg.startsWith('/') || arg.startsWith('./') || arg.includes('\\')) {
      if (!isPathSafe(arg)) {
        return { 
          valid: false, 
          error: `Argument contains potentially unsafe path: ${arg}`,
          securityRisk: 'UNSAFE_PATH'
        };
      }
      
      // Check for path traversal attempts
      if (arg.includes('..')) {
        const normalizedPath = path.normalize(arg);
        if (normalizedPath.includes('..')) {
          return { 
            valid: false, 
            error: `Argument contains path traversal attempt: ${arg}`,
            securityRisk: 'PATH_TRAVERSAL'
          };
        }
      }
    }
    
    // Check for environment variable expansion in arguments
    if (arg.includes('$$') && process.platform !== 'win32') {
      const envVarPattern = /\$([A-Za-z0-9_]+)|\${([A-Za-z0-9_]+)}/;
      if (envVarPattern.test(arg)) {
        return { 
          valid: false, 
          error: `Argument contains environment variable expansion: ${arg}`,
          securityRisk: 'ENV_VAR_EXPANSION'
        };
      }
    }
    
    // Check for Windows environment variable expansion
    if (arg.includes('%') && process.platform === 'win32') {
      const winEnvVarPattern = /%([A-Za-z0-9_]+)%/;
      if (winEnvVarPattern.test(arg)) {
        return { 
          valid: false, 
          error: `Argument contains environment variable expansion: ${arg}`,
          securityRisk: 'ENV_VAR_EXPANSION'
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Execute a command with arguments
 * @param command Command to execute
 * @param args Command arguments
 * @param options Command execution options
 * @returns Promise that resolves with the command execution result
 */
export async function executeCommand(
  command: string,
  args: string[] = [],
  options: CommandExecutionOptions = {}
): Promise<CommandExecutionResult> {
  const startTime = Date.now();
  const opts = { ...defaultOptions, ...options };
  const commandId = `cmd-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  
  // Validate command and arguments
  const validation = validateCommand(command, args);
  if (!validation.valid) {
    logger.warn({ command, args }, validation.error);
    return {
      success: false,
      exitCode: 1,
      stdout: '',
      stderr: '',
      error: validation.error,
      executionTime: 0,
    };
  }

  // For simple commands without streaming or complex options, use exec
  if (!opts.captureStdout && !opts.captureStderr) {
    try {
      // Use execAsync for simple commands
      const commandString = `${command} ${args.join(' ')}`;
      logger.info({ command: commandString }, 'Executing command');
      
      const { stdout, stderr } = await execAsync(commandString, {
        timeout: opts.timeout,
        cwd: opts.cwd,
        env: { ...process.env, ...opts.env },
        maxBuffer: opts.maxBuffer,
      });
      
      const executionTime = Date.now() - startTime;
      logger.info({ 
        command, 
        args, 
        executionTime 
      }, 'Command executed successfully');
      
      return {
        success: true,
        exitCode: 0,
        stdout: stdout.toString(),
        stderr: stderr.toString(),
        executionTime,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const err = error as { code?: number; killed?: boolean; signal?: string; stdout?: string; stderr?: string };
      
      logger.error({ 
        command, 
        args, 
        error: error instanceof Error ? error.message : String(error),
        executionTime 
      }, 'Command execution failed');
      
      return {
        success: false,
        exitCode: typeof err.code === 'number' ? err.code : 1,
        stdout: err.stdout?.toString() || '',
        stderr: err.stderr?.toString() || '',
        error: error instanceof Error ? error.message : String(error),
        executionTime,
      };
    }
  }

  // For more complex commands, use spawn with streaming
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    
    logger.info({ command, args }, 'Spawning command process');
    
    // Prepare spawn options
    const spawnOptions: any = {
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env },
    };
    
    // Apply resource restrictions based on platform
    if (opts.restricted) {
      // Set restricted environment variables
      spawnOptions.env = {
        ...spawnOptions.env,
        // Restrict access to sensitive environment variables
        HOME: undefined,
        AWS_ACCESS_KEY_ID: undefined,
        AWS_SECRET_ACCESS_KEY: undefined,
        AWS_SESSION_TOKEN: undefined,
        // Set a safe PATH to prevent access to potentially dangerous commands
        PATH: process.platform === 'win32' 
          ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32')
          : '/usr/local/bin:/usr/bin:/bin',
      };
    }
    
    // Apply CPU and memory limits based on platform
    if (process.platform !== 'win32' && opts.niceness !== undefined && opts.niceness > 0) {
      // On Unix-like systems, we can use nice to set process priority
      command = 'nice';
      args = [`-n${opts.niceness}`, command, ...args];
    }
    
    // Log resource limits being applied
    logger.debug({ 
      command, 
      resourceLimits: {
        timeout: opts.timeout,
        memoryLimit: opts.memoryLimit,
        niceness: opts.niceness,
        restricted: opts.restricted
      }
    }, 'Applying resource limits to command');
    
    // Spawn the process
    const process = spawn(command, args, spawnOptions);
    
    // Set up timeout if specified
    let timeout: NodeJS.Timeout | null = null;
    if (opts.timeout) {
      timeout = setTimeout(() => {
        logger.warn({ command, args, timeout: opts.timeout }, 'Command execution timed out');
        
        if (process.pid) {
          try {
            // Try to kill the process
            process.kill('SIGTERM');
            
            // If process doesn't exit within 2 seconds, force kill it
            setTimeout(() => {
              try {
                if (process.pid && !process.killed) {
                  process.kill('SIGKILL');
                  logger.warn({ pid: process.pid }, 'Force killed process after timeout');
                }
              } catch (error) {
                logger.error({ 
                  pid: process.pid, 
                  error: error instanceof Error ? error.message : String(error) 
                }, 'Failed to force kill process');
              }
            }, 2000);
          } catch (error) {
            logger.error({ 
              command, 
              args, 
              error: error instanceof Error ? error.message : String(error) 
            }, 'Failed to kill process on timeout');
          }
        }
        
        cleanupCommand(commandId);
        
        resolve({
          success: false,
          exitCode: null,
          stdout,
          stderr,
          error: `Command execution timed out after ${opts.timeout}ms`,
          executionTime: Date.now() - startTime,
        });
      }, opts.timeout);
    }
    
    // Check if we've reached the maximum number of concurrent processes
    if (opts.maxConcurrentProcesses && opts.maxConcurrentProcesses > 0) {
      const activeCount = getActiveProcessCount();
      if (activeCount >= opts.maxConcurrentProcesses) {
        logger.warn({
          command,
          args,
          activeCount,
          maxConcurrentProcesses: opts.maxConcurrentProcesses
        }, 'Maximum number of concurrent processes reached');
        
        return {
          success: false,
          exitCode: 1,
          stdout: '',
          stderr: '',
          error: `Maximum number of concurrent processes reached (${activeCount}/${opts.maxConcurrentProcesses})`,
          executionTime: Date.now() - startTime,
        };
      }
    }
    
    // Set up resource monitoring
    if (process.pid && (opts.memoryLimit || opts.cpuLimit)) {
      // Create resource monitor with both memory and CPU limits
      createResourceMonitor(
        process, 
        opts.memoryLimit || 0,
        opts.cpuLimit || 0,
        (reason) => {
          logger.warn({ 
            command, 
            args, 
            memoryLimit: opts.memoryLimit,
            cpuLimit: opts.cpuLimit,
            reason
          }, `Process exceeded ${reason} limit`);
          
          if (process.pid && !process.killed) {
            try {
              // Try to kill the process
              process.kill('SIGTERM');
              
              // If process doesn't exit within 2 seconds, force kill it
              setTimeout(() => {
                try {
                  if (process.pid && !process.killed) {
                    process.kill('SIGKILL');
                    logger.warn({ pid: process.pid }, `Force killed process after ${reason} limit exceeded`);
                  }
                } catch (error) {
                  logger.error({ 
                    pid: process.pid, 
                    error: error instanceof Error ? error.message : String(error) 
                  }, 'Failed to force kill process');
                }
              }, 2000);
            } catch (error) {
              logger.error({ 
                command, 
                args, 
                error: error instanceof Error ? error.message : String(error) 
              }, `Failed to kill process on ${reason} limit exceeded`);
            }
          }
          
          // Don't resolve here, let the process exit handler handle it
        }
      );
    }
    
    // Store the process in the active processes map
    activeProcesses.set(commandId, {
      process,
      timeout,
      startTime,
    });
    
    // Capture stdout if requested
    if (opts.captureStdout && process.stdout) {
      process.stdout.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
        logger.debug({ command, chunk }, 'Command stdout');
      });
    }
    
    // Capture stderr if requested
    if (opts.captureStderr && process.stderr) {
      process.stderr.on('data', (data) => {
        const chunk = data.toString();
        stderr += chunk;
        logger.debug({ command, chunk }, 'Command stderr');
      });
    }
    
    // Handle process exit
    process.on('close', (code) => {
      const executionTime = Date.now() - startTime;
      cleanupCommand(commandId);
      
      if (code === 0) {
        logger.info({ 
          command, 
          args, 
          executionTime 
        }, 'Command executed successfully');
        
        resolve({
          success: true,
          exitCode: code,
          stdout,
          stderr,
          executionTime,
        });
      } else {
        logger.warn({ 
          command, 
          args, 
          exitCode: code,
          executionTime 
        }, 'Command execution failed');
        
        resolve({
          success: false,
          exitCode: code,
          stdout,
          stderr,
          error: `Command exited with code ${code}`,
          executionTime,
        });
      }
    });
    
    // Handle process error
    process.on('error', (error) => {
      const executionTime = Date.now() - startTime;
      cleanupCommand(commandId);
      
      logger.error({ 
        command, 
        args, 
        error: error.message,
        executionTime 
      }, 'Command execution error');
      
      resolve({
        success: false,
        exitCode: 1,
        stdout,
        stderr,
        error: error.message,
        executionTime,
      });
    });
  });
}

/**
 * Execute an OpenStudio CLI command
 * @param subcommand OpenStudio subcommand (e.g., 'run', 'measure')
 * @param args Command arguments
 * @param options Command execution options
 * @returns Promise that resolves with the command execution result
 */
export async function executeOpenStudioCommand(
  subcommand: string,
  args: string[] = [],
  options: CommandExecutionOptions = {}
): Promise<CommandExecutionResult> {
  // Get the OpenStudio CLI path from config
  const cliPath = config.openStudio.cliPath;
  
  // Validate the CLI path
  if (!cliPath) {
    logger.error('OpenStudio CLI path not configured');
    return {
      success: false,
      exitCode: 1,
      stdout: '',
      stderr: '',
      error: 'OpenStudio CLI path not configured',
      executionTime: 0,
    };
  }
  
  // Execute the command
  return executeCommand(cliPath, [subcommand, ...args], options);
}

/**
 * Check if OpenStudio CLI is available
 * @returns Promise that resolves with true if OpenStudio CLI is available, false otherwise
 */
export async function checkOpenStudioAvailability(): Promise<boolean> {
  try {
    const result = await executeOpenStudioCommand('--version');
    return result.success;
  } catch (error) {
    logger.error({ error }, 'Failed to check OpenStudio availability');
    return false;
  }
}

/**
 * Get OpenStudio version
 * @returns Promise that resolves with the OpenStudio version or null if not available
 */
export async function getOpenStudioVersion(): Promise<string | null> {
  try {
    const result = await executeOpenStudioCommand('--version');
    if (result.success) {
      return result.stdout.trim();
    }
    return null;
  } catch (error) {
    logger.error({ error }, 'Failed to get OpenStudio version');
    return null;
  }
}

// Set up process exit handlers to clean up resources
process.on('exit', () => {
  killAllProcesses();
});

process.on('SIGINT', () => {
  logger.info('Received SIGINT, cleaning up resources');
  killAllProcesses();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, cleaning up resources');
  killAllProcesses();
  process.exit(0);
});

// Export the module
export default {
  executeCommand,
  executeOpenStudioCommand,
  validateCommand,
  killAllProcesses,
  getActiveProcessCount,
  getActiveProcesses,
  checkOpenStudioAvailability,
  getOpenStudioVersion,
};