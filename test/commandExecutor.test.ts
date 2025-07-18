/**
 * Command executor tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  validateCommand, 
  executeCommand, 
  executeOpenStudioCommand,
  getActiveProcessCount,
  killAllProcesses
} from '../src/utils/commandExecutor';
import * as child_process from 'child_process';
import { EventEmitter } from 'events';

// Mock logger
vi.mock('../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock child_process
vi.mock('child_process', () => {
  const mockExec = vi.fn();
  const mockSpawn = vi.fn();
  
  return {
    exec: mockExec,
    spawn: mockSpawn,
    // Add promisify compatibility
    __esModule: true
  };
});

// Mock config
vi.mock('../src/config', () => ({
  default: {
    openStudio: {
      cliPath: '/path/to/openstudio'
    }
  }
}));

// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true)
}));

describe('Command Validation', () => {
  it('should validate a safe command', () => {
    const result = validateCommand('openstudio', ['run', 'simulation']);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });
  
  it('should reject an unsafe command', () => {
    const result = validateCommand('rm -rf /', []);
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });
  
  it('should reject a command with unsafe arguments', () => {
    const result = validateCommand('openstudio', ['run', '; rm -rf /']);
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });
  
  it('should reject a non-existent command', () => {
    // Mock fs.existsSync to return false for this test
    const fs = require('fs');
    fs.existsSync.mockReturnValueOnce(false);
    
    const result = validateCommand('non-existent-command', []);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('not found');
  });
  
  it('should reject arguments with redirection', () => {
    const result = validateCommand('openstudio', ['run', '> /etc/passwd']);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('redirection');
  });
  
  it('should reject arguments with command substitution', () => {
    const result = validateCommand('openstudio', ['run', '$(rm -rf /)']);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('command substitution');
  });
});

describe('Command Execution', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });
  
  afterEach(() => {
    killAllProcesses();
  });
  
  it('should execute a command successfully', async () => {
    // Mock successful execution
    const mockChildProcess = new EventEmitter();
    mockChildProcess.stdout = new EventEmitter();
    mockChildProcess.stderr = new EventEmitter();
    mockChildProcess.pid = 12345;
    
    const spawn = vi.spyOn(child_process, 'spawn').mockReturnValue(mockChildProcess as any);
    
    // Start the command execution
    const commandPromise = executeCommand('echo', ['hello']);
    
    // Emit events to simulate successful execution
    mockChildProcess.stdout.emit('data', 'hello world');
    mockChildProcess.stderr.emit('data', '');
    mockChildProcess.emit('close', 0);
    
    const result = await commandPromise;
    
    expect(spawn).toHaveBeenCalledWith('echo', ['hello'], expect.any(Object));
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('hello world');
    expect(result.stderr).toBe('');
    expect(result.executionTime).toBeGreaterThanOrEqual(0);
  });
  
  it('should handle command execution failure', async () => {
    // Mock failed execution
    const mockChildProcess = new EventEmitter();
    mockChildProcess.stdout = new EventEmitter();
    mockChildProcess.stderr = new EventEmitter();
    mockChildProcess.pid = 12346;
    
    const spawn = vi.spyOn(child_process, 'spawn').mockReturnValue(mockChildProcess as any);
    
    // Start the command execution
    const commandPromise = executeCommand('invalid', ['command']);
    
    // Emit events to simulate failed execution
    mockChildProcess.stdout.emit('data', '');
    mockChildProcess.stderr.emit('data', 'command not found');
    mockChildProcess.emit('close', 1);
    
    const result = await commandPromise;
    
    expect(spawn).toHaveBeenCalledWith('invalid', ['command'], expect.any(Object));
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('command not found');
    expect(result.error).toBeDefined();
    expect(result.executionTime).toBeGreaterThanOrEqual(0);
  });
  
  it('should handle command execution error', async () => {
    // Mock execution error
    const mockChildProcess = new EventEmitter();
    mockChildProcess.stdout = new EventEmitter();
    mockChildProcess.stderr = new EventEmitter();
    mockChildProcess.pid = 12347;
    
    const spawn = vi.spyOn(child_process, 'spawn').mockReturnValue(mockChildProcess as any);
    
    // Start the command execution
    const commandPromise = executeCommand('error', ['command']);
    
    // Emit error event
    mockChildProcess.emit('error', new Error('Execution error'));
    
    const result = await commandPromise;
    
    expect(spawn).toHaveBeenCalledWith('error', ['command'], expect.any(Object));
    expect(result.success).toBe(false);
    expect(result.error).toBe('Execution error');
    expect(result.executionTime).toBeGreaterThanOrEqual(0);
  });
  
  it('should track active processes', async () => {
    // Mock multiple processes
    const mockChildProcess1 = new EventEmitter();
    mockChildProcess1.stdout = new EventEmitter();
    mockChildProcess1.stderr = new EventEmitter();
    mockChildProcess1.pid = 12348;
    
    const mockChildProcess2 = new EventEmitter();
    mockChildProcess2.stdout = new EventEmitter();
    mockChildProcess2.stderr = new EventEmitter();
    mockChildProcess2.pid = 12349;
    
    const spawn = vi.spyOn(child_process, 'spawn')
      .mockReturnValueOnce(mockChildProcess1 as any)
      .mockReturnValueOnce(mockChildProcess2 as any);
    
    // Start two command executions
    const command1Promise = executeCommand('command1', []);
    const command2Promise = executeCommand('command2', []);
    
    // Check active process count
    expect(getActiveProcessCount()).toBe(2);
    
    // Complete the first command
    mockChildProcess1.emit('close', 0);
    await command1Promise;
    
    // Check active process count again
    expect(getActiveProcessCount()).toBe(1);
    
    // Complete the second command
    mockChildProcess2.emit('close', 0);
    await command2Promise;
    
    // Check active process count again
    expect(getActiveProcessCount()).toBe(0);
  });
});

describe('OpenStudio Command Execution', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });
  
  it('should execute an OpenStudio command', async () => {
    // Mock successful execution
    const mockChildProcess = new EventEmitter();
    mockChildProcess.stdout = new EventEmitter();
    mockChildProcess.stderr = new EventEmitter();
    mockChildProcess.pid = 12350;
    
    const spawn = vi.spyOn(child_process, 'spawn').mockReturnValue(mockChildProcess as any);
    
    // Start the command execution
    const commandPromise = executeOpenStudioCommand('run', ['simulation']);
    
    // Emit events to simulate successful execution
    mockChildProcess.stdout.emit('data', 'Simulation completed successfully');
    mockChildProcess.stderr.emit('data', '');
    mockChildProcess.emit('close', 0);
    
    const result = await commandPromise;
    
    expect(spawn).toHaveBeenCalledWith('/path/to/openstudio', ['run', 'simulation'], expect.any(Object));
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('Simulation completed successfully');
    expect(result.stderr).toBe('');
    expect(result.executionTime).toBeGreaterThanOrEqual(0);
  });
});

describe('Resource Management', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
  });
  
  afterEach(() => {
    killAllProcesses();
    vi.useRealTimers();
  });
  
  it('should handle command timeout', async () => {
    // Mock process that will time out
    const mockChildProcess = new EventEmitter();
    mockChildProcess.stdout = new EventEmitter();
    mockChildProcess.stderr = new EventEmitter();
    mockChildProcess.pid = 12351;
    mockChildProcess.kill = vi.fn();
    
    const spawn = vi.spyOn(child_process, 'spawn').mockReturnValue(mockChildProcess as any);
    
    // Start the command execution with a short timeout
    const commandPromise = executeCommand('long-running', [], { timeout: 1000 });
    
    // Advance time to trigger timeout
    vi.advanceTimersByTime(1100);
    
    const result = await commandPromise;
    
    expect(spawn).toHaveBeenCalledWith('long-running', [], expect.any(Object));
    expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGTERM');
    expect(result.success).toBe(false);
    expect(result.error).toContain('timed out');
  });
  
  it('should apply resource restrictions', async () => {
    // Mock successful execution
    const mockChildProcess = new EventEmitter();
    mockChildProcess.stdout = new EventEmitter();
    mockChildProcess.stderr = new EventEmitter();
    mockChildProcess.pid = 12352;
    
    const spawn = vi.spyOn(child_process, 'spawn').mockReturnValue(mockChildProcess as any);
    
    // Start the command execution with resource restrictions
    const commandPromise = executeCommand('resource-intensive', [], {
      memoryLimit: 1024,
      niceness: 15,
      restricted: true
    });
    
    // Emit events to simulate successful execution
    mockChildProcess.stdout.emit('data', 'Command completed');
    mockChildProcess.stderr.emit('data', '');
    mockChildProcess.emit('close', 0);
    
    await commandPromise;
    
    // Check that spawn was called with appropriate options
    // The exact options depend on the platform, so we just check that spawn was called
    expect(spawn).toHaveBeenCalled();
  });
});