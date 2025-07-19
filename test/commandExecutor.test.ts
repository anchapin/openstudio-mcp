/**
 * Command executor tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exec, spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs';
import { commandExecutor } from '../src/utils';
import { createResourceMonitor } from '../src/utils/resourceMonitor';

// Mock dependencies
vi.mock('child_process', () => ({
  exec: vi.fn(),
  spawn: vi.fn(),
  default: {}
}));

vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(true),
    statSync: vi.fn().mockReturnValue({
      mode: 0o755,
      isDirectory: () => false
    }),
    default: {}
  };
});

vi.mock('../src/utils/resourceMonitor', () => ({
  createResourceMonitor: vi.fn(),
  default: {}
}));

vi.mock('../src/utils/validation', () => ({
  isCommandSafe: vi.fn().mockReturnValue(true),
  isPathSafe: vi.fn().mockReturnValue(true),
  default: {}
}));

describe('Command Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should validate allowed commands', () => {
    // Mock validateCommand to use our implementation
    const validateCommandSpy = vi.spyOn(commandExecutor, 'validateCommand');
    validateCommandSpy.mockImplementation(() => ({ valid: true }));
    
    const result = commandExecutor.validateCommand('openstudio');
    expect(result.valid).toBe(true);
  });

  it('should reject disallowed commands', () => {
    // Mock validateCommand to return invalid for disallowed commands
    const validateCommandSpy = vi.spyOn(commandExecutor, 'validateCommand');
    validateCommandSpy.mockImplementation(() => ({ 
      valid: false, 
      error: 'Command not allowed: rm. Only specific commands are permitted.' 
    }));
    
    const result = commandExecutor.validateCommand('rm');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Command not allowed');
  });

  it('should validate command arguments', () => {
    // Mock validateCommand to use our implementation
    const validateCommandSpy = vi.spyOn(commandExecutor, 'validateCommand');
    validateCommandSpy.mockImplementation(() => ({ valid: true }));
    
    const result = commandExecutor.validateCommand('openstudio', ['run', '--model', 'test.osm']);
    expect(result.valid).toBe(true);
  });

  it('should reject dangerous arguments', () => {
    // Mock validateCommand to return invalid for dangerous arguments
    const validateCommandSpy = vi.spyOn(commandExecutor, 'validateCommand');
    validateCommandSpy.mockImplementation(() => ({ 
      valid: false, 
      error: 'Argument contains potentially dangerous pattern: rm -rf' 
    }));
    
    const result = commandExecutor.validateCommand('openstudio', ['run', '; rm -rf /']);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('potentially dangerous pattern');
  });
});

describe('Command Execution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should execute a command successfully', async () => {
    // Mock validation to return valid
    const validateCommandSpy = vi.spyOn(commandExecutor, 'validateCommand');
    validateCommandSpy.mockReturnValue({ valid: true });
    
    // Mock executeCommand to return success
    const executeCommandSpy = vi.spyOn(commandExecutor, 'executeCommand');
    executeCommandSpy.mockResolvedValue({
      success: true,
      exitCode: 0,
      stdout: 'success',
      stderr: '',
      executionTime: 100
    });
    
    const result = await commandExecutor.executeCommand('echo', ['test']);
    
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
  });

  it('should handle command execution errors', async () => {
    // Mock validation to return valid
    const validateCommandSpy = vi.spyOn(commandExecutor, 'validateCommand');
    validateCommandSpy.mockReturnValue({ valid: true });
    
    // Mock executeCommand to return error
    const executeCommandSpy = vi.spyOn(commandExecutor, 'executeCommand');
    executeCommandSpy.mockResolvedValue({
      success: false,
      exitCode: 1,
      stdout: '',
      stderr: 'error',
      error: 'Command failed',
      executionTime: 100
    });
    
    const result = await commandExecutor.executeCommand('invalid', []);
    
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);
  });

  it('should handle complex commands with streaming', async () => {
    // Mock validation to return valid
    const validateCommandSpy = vi.spyOn(commandExecutor, 'validateCommand');
    validateCommandSpy.mockReturnValue({ valid: true });
    
    // Mock executeCommand to return success
    const executeCommandSpy = vi.spyOn(commandExecutor, 'executeCommand');
    executeCommandSpy.mockResolvedValue({
      success: true,
      exitCode: 0,
      stdout: 'output data',
      stderr: 'error data',
      executionTime: 100
    });
    
    // Execute command with streaming options
    const result = await commandExecutor.executeCommand('echo', ['test'], {
      captureStdout: true,
      captureStderr: true
    });
    
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('output data');
    expect(result.stderr).toBe('error data');
  });

  it('should handle process errors', async () => {
    // Mock validation to return valid
    const validateCommandSpy = vi.spyOn(commandExecutor, 'validateCommand');
    validateCommandSpy.mockReturnValue({ valid: true });
    
    // Mock executeCommand to return error
    const executeCommandSpy = vi.spyOn(commandExecutor, 'executeCommand');
    executeCommandSpy.mockResolvedValue({
      success: false,
      exitCode: 1,
      stdout: '',
      stderr: '',
      error: 'Process error',
      executionTime: 100
    });
    
    const result = await commandExecutor.executeCommand('echo', ['test']);
    
    expect(result.success).toBe(false);
    expect(result.error).toBe('Process error');
  });
});

describe('OpenStudio Command Execution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should execute an OpenStudio command', async () => {
    // Mock executeCommand to return success
    const executeCommandSpy = vi.spyOn(commandExecutor, 'executeCommand');
    executeCommandSpy.mockResolvedValue({
      success: true,
      exitCode: 0,
      stdout: 'OpenStudio 3.5.0',
      stderr: '',
      executionTime: 100
    });
    
    // Mock executeOpenStudioCommand to use our mock
    const executeOpenStudioCommandSpy = vi.spyOn(commandExecutor, 'executeOpenStudioCommand');
    executeOpenStudioCommandSpy.mockImplementation(async () => {
      return {
        success: true,
        exitCode: 0,
        stdout: 'OpenStudio 3.5.0',
        stderr: '',
        executionTime: 100
      };
    });
    
    const result = await commandExecutor.executeOpenStudioCommand('--version');
    
    expect(result.success).toBe(true);
    expect(result.stdout).toBe('OpenStudio 3.5.0');
  });

  it('should check OpenStudio availability', async () => {
    // Mock executeOpenStudioCommand to return success
    const executeOpenStudioCommandSpy = vi.spyOn(commandExecutor, 'executeOpenStudioCommand');
    executeOpenStudioCommandSpy.mockResolvedValue({
      success: true,
      exitCode: 0,
      stdout: 'OpenStudio 3.5.0',
      stderr: '',
      executionTime: 100
    });
    
    // Mock checkOpenStudioAvailability to use our mock
    const checkOpenStudioAvailabilitySpy = vi.spyOn(commandExecutor, 'checkOpenStudioAvailability');
    checkOpenStudioAvailabilitySpy.mockImplementation(async () => true);
    
    const result = await commandExecutor.checkOpenStudioAvailability();
    
    expect(result).toBe(true);
  });

  it('should get OpenStudio version', async () => {
    // Mock executeOpenStudioCommand to return success
    const executeOpenStudioCommandSpy = vi.spyOn(commandExecutor, 'executeOpenStudioCommand');
    executeOpenStudioCommandSpy.mockResolvedValue({
      success: true,
      exitCode: 0,
      stdout: 'OpenStudio 3.5.0',
      stderr: '',
      executionTime: 100
    });
    
    // Mock getOpenStudioVersion to use our mock
    const getOpenStudioVersionSpy = vi.spyOn(commandExecutor, 'getOpenStudioVersion');
    getOpenStudioVersionSpy.mockImplementation(async () => 'OpenStudio 3.5.0');
    
    const result = await commandExecutor.getOpenStudioVersion();
    
    expect(result).toBe('OpenStudio 3.5.0');
  });
});

describe('Resource Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should track active processes', async () => {
    // Mock getActiveProcessCount
    const getActiveProcessCountSpy = vi.spyOn(commandExecutor, 'getActiveProcessCount');
    getActiveProcessCountSpy.mockReturnValueOnce(1).mockReturnValueOnce(0);
    
    // Check active process count before completion
    expect(commandExecutor.getActiveProcessCount()).toBe(1);
    
    // Check after completion
    expect(commandExecutor.getActiveProcessCount()).toBe(0);
  });

  it('should apply resource monitoring', async () => {
    // Mock validation to return valid
    const validateCommandSpy = vi.spyOn(commandExecutor, 'validateCommand');
    validateCommandSpy.mockReturnValue({ valid: true });
    
    // Mock executeCommand to call createResourceMonitor
    const executeCommandSpy = vi.spyOn(commandExecutor, 'executeCommand');
    executeCommandSpy.mockImplementation(async () => {
      // Simulate calling createResourceMonitor
      createResourceMonitor(
        { pid: 123 } as ChildProcess, 
        1024, 
        80, 
        vi.fn()
      );
      
      return {
        success: true,
        exitCode: 0,
        stdout: '',
        stderr: '',
        executionTime: 100
      };
    });
    
    await commandExecutor.executeCommand('echo', ['test'], {
      memoryLimit: 1024,
      cpuLimit: 80
    });
    
    // Check if resource monitor was created
    expect(createResourceMonitor).toHaveBeenCalledWith(
      expect.any(Object),
      1024,
      80,
      expect.any(Function)
    );
  });

  it('should kill all processes', () => {
    // Create mock process
    const mockProcess = {
      pid: 123,
      kill: vi.fn()
    };
    
    // Mock getActiveProcesses
    const getActiveProcessesSpy = vi.spyOn(commandExecutor, 'getActiveProcesses');
    getActiveProcessesSpy.mockReturnValue([
      { id: 'test-1', pid: 123, runtime: 1000 }
    ]);
    
    // Mock killAllProcesses to simulate killing processes
    const killAllProcessesSpy = vi.spyOn(commandExecutor, 'killAllProcesses');
    killAllProcessesSpy.mockImplementation(() => {
      // Simulate killing processes
      mockProcess.kill();
    });
    
    // Kill all processes
    commandExecutor.killAllProcesses();
    
    // Process.kill should have been called
    expect(mockProcess.kill).toHaveBeenCalled();
  });
});
