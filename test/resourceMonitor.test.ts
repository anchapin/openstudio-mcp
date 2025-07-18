/**
 * Resource monitor tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProcessResourceMonitor, createResourceMonitor } from '../src/utils/resourceMonitor';
import { EventEmitter } from 'events';
import os from 'os';

// Mock logger
vi.mock('../src/utils/logger', async () => {
  return {
    default: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    },
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    }
  };
});

// Mock os module
vi.mock('os', () => ({
  totalmem: vi.fn().mockReturnValue(16 * 1024 * 1024 * 1024), // 16GB
  freemem: vi.fn().mockReturnValue(8 * 1024 * 1024 * 1024),   // 8GB
  cpus: vi.fn().mockReturnValue([
    { model: 'Test CPU', speed: 2500, times: { user: 100, nice: 0, sys: 50, idle: 200, irq: 0 } },
    { model: 'Test CPU', speed: 2500, times: { user: 150, nice: 0, sys: 75, idle: 100, irq: 0 } }
  ])
}));

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn((cmd, callback) => {
    if (cmd.includes('ps -p')) {
      callback(null, { stdout: '500000' }); // 500MB in KB
    } else {
      callback(new Error('Command not found'));
    }
  })
}));

// Mock process.cpuUsage
const mockCpuUsage = vi.spyOn(process, 'cpuUsage');
let cpuUsageCounter = 0;

mockCpuUsage.mockImplementation(() => {
  cpuUsageCounter += 100000;
  return {
    user: cpuUsageCounter,
    system: cpuUsageCounter / 2
  };
});

// Mock process.memoryUsage
vi.spyOn(process, 'memoryUsage').mockReturnValue({
  rss: 500 * 1024 * 1024, // 500MB
  heapTotal: 200 * 1024 * 1024,
  heapUsed: 150 * 1024 * 1024,
  external: 50 * 1024 * 1024,
  arrayBuffers: 10 * 1024 * 1024
});

describe('Resource Monitor', () => {
  let mockChildProcess: any;
  let onLimitExceeded: any;
  
  beforeEach(() => {
    vi.useFakeTimers();
    
    // Create a mock child process
    mockChildProcess = new EventEmitter();
    mockChildProcess.pid = 12345;
    mockChildProcess.kill = vi.fn();
    
    // Create a mock callback
    onLimitExceeded = vi.fn();
    
    // Reset counter
    cpuUsageCounter = 0;
  });
  
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });
  
  describe('ProcessResourceMonitor', () => {
    it('should start and stop monitoring', () => {
      const monitor = new ProcessResourceMonitor(
        mockChildProcess,
        1024, // 1GB memory limit
        50,   // 50% CPU limit
        onLimitExceeded
      );
      
      // Start monitoring
      monitor.start();
      
      // Advance time to trigger a check
      vi.advanceTimersByTime(1000);
      
      // Stop monitoring
      monitor.stop();
      
      // Advance time again
      vi.advanceTimersByTime(1000);
      
      // onLimitExceeded should not have been called
      expect(onLimitExceeded).not.toHaveBeenCalled();
    });
    
    it('should detect memory limit exceeded', () => {
      // Mock process.memoryUsage to return a large value
      vi.spyOn(process, 'memoryUsage').mockReturnValueOnce({
        rss: 2000 * 1024 * 1024, // 2GB
        heapTotal: 1500 * 1024 * 1024,
        heapUsed: 1400 * 1024 * 1024,
        external: 100 * 1024 * 1024,
        arrayBuffers: 50 * 1024 * 1024
      });
      
      const monitor = new ProcessResourceMonitor(
        mockChildProcess,
        1024, // 1GB memory limit
        50,   // 50% CPU limit
        onLimitExceeded
      );
      
      // Start monitoring
      monitor.start();
      
      // Advance time to trigger a check
      vi.advanceTimersByTime(1000);
      
      // onLimitExceeded should have been called with 'memory'
      expect(onLimitExceeded).toHaveBeenCalledWith('memory');
    });
    
    it('should detect CPU limit exceeded after multiple checks', () => {
      // Mock process.cpuUsage to return increasing values
      mockCpuUsage.mockImplementation(() => {
        cpuUsageCounter += 10000000; // Very high CPU usage
        return {
          user: cpuUsageCounter,
          system: cpuUsageCounter / 2
        };
      });
      
      const monitor = new ProcessResourceMonitor(
        mockChildProcess,
        1024, // 1GB memory limit
        10,   // 10% CPU limit
        onLimitExceeded
      );
      
      // Start monitoring
      monitor.start();
      
      // Advance time to trigger multiple checks
      for (let i = 0; i < 5; i++) {
        vi.advanceTimersByTime(1000);
      }
      
      // onLimitExceeded should have been called with 'cpu'
      expect(onLimitExceeded).toHaveBeenCalledWith('cpu');
    });
    
    it('should handle process without pid', () => {
      // Create a mock child process without pid
      const processWithoutPid = new EventEmitter();
      processWithoutPid.kill = vi.fn();
      
      const monitor = new ProcessResourceMonitor(
        processWithoutPid as any,
        1024,
        50,
        onLimitExceeded
      );
      
      // Start monitoring
      monitor.start();
      
      // Advance time
      vi.advanceTimersByTime(1000);
      
      // onLimitExceeded should not have been called
      expect(onLimitExceeded).not.toHaveBeenCalled();
    });
    
    it('should handle errors when checking resource usage', async () => {
      // Mock process.cpuUsage to throw an error
      mockCpuUsage.mockImplementationOnce(() => {
        throw new Error('CPU usage error');
      });
      
      const monitor = new ProcessResourceMonitor(
        mockChildProcess,
        1024,
        50,
        onLimitExceeded
      );
      
      // Start monitoring
      monitor.start();
      
      // Advance time
      vi.advanceTimersByTime(1000);
      
      // onLimitExceeded should not have been called
      expect(onLimitExceeded).not.toHaveBeenCalled();
    });
  });
  
  describe('createResourceMonitor', () => {
    it('should create and start a resource monitor', () => {
      const monitor = createResourceMonitor(
        mockChildProcess,
        1024,
        50,
        onLimitExceeded
      );
      
      // Advance time
      vi.advanceTimersByTime(1000);
      
      // Stop the monitor to clean up
      monitor.stop();
      
      // onLimitExceeded should not have been called
      expect(onLimitExceeded).not.toHaveBeenCalled();
    });
  });
});