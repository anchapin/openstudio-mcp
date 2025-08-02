/**\n * Resource monitor tests\n */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProcessResourceMonitor, createResourceMonitor } from '../src/utils/resourceMonitor';
import { EventEmitter } from 'events';
import type { ChildProcess } from 'child_process';

// Mock logger
vi.mock('../src/utils/logger', () => {
  return {
    default: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  };
});

// Mock os module
vi.mock('os', () => ({
  totalmem: vi.fn().mockReturnValue(16 * 1024 * 1024 * 1024), // 16GB
  freemem: vi.fn().mockReturnValue(8 * 1024 * 1024 * 1024), // 8GB
  cpus: vi.fn().mockReturnValue([
    { model: 'Test CPU', speed: 2500, times: { user: 100, nice: 0, sys: 50, idle: 200, irq: 0 } },
    { model: 'Test CPU', speed: 2500, times: { user: 150, nice: 0, sys: 75, idle: 100, irq: 0 } },
  ]),
}));

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn((cmd, callback) => {
    if (cmd.includes('ps -p')) {
      callback(null, { stdout: '1024 KB' });
    } else {
      callback(new Error('Command failed'));
    }
  }),
}));

describe('ResourceMonitor', () => {
  vi.setConfig({ testTimeout: 30000 });
  let mockChildProcess: EventEmitter;
  let onLimitExceeded: ReturnType<typeof vi.fn>;
  let monitor: ProcessResourceMonitor | null = null;

  beforeEach(() => {
    // Create a mock child process
    mockChildProcess = new EventEmitter();
    Object.defineProperty(mockChildProcess, 'pid', {
      value: 12345,
      writable: false,
      enumerable: true,
      configurable: true,
    });

    // Create a mock callback
    onLimitExceeded = vi.fn();

    // Always use real timers for resource monitor tests
    vi.useRealTimers();
  });

  afterEach(() => {
    // Clean up any active monitor
    if (monitor) {
      monitor.stop();
      monitor = null;
    }

    // Clear all mocks and timers
    vi.clearAllMocks();
    vi.clearAllTimers();
  });

  describe('ProcessResourceMonitor', () => {
    it('should create a monitor instance', () => {
      monitor = new ProcessResourceMonitor(
        mockChildProcess as unknown as ChildProcess,
        1024, // 1GB memory limit
        50, // 50% CPU limit
        onLimitExceeded,
      );

      expect(monitor).toBeInstanceOf(ProcessResourceMonitor);
    });

    it('should have start and stop methods', () => {
      monitor = new ProcessResourceMonitor(
        mockChildProcess as unknown as ChildProcess,
        1024,
        50,
        onLimitExceeded,
      );

      expect(typeof monitor.start).toBe('function');
      expect(typeof monitor.stop).toBe('function');
    });
  });

  describe('createResourceMonitor', () => {
    it('should create a monitor using factory function', () => {
      monitor = createResourceMonitor(
        mockChildProcess as unknown as ChildProcess,
        1024,
        50,
        onLimitExceeded,
      );

      expect(monitor).toBeInstanceOf(ProcessResourceMonitor);
    });
  });
});
