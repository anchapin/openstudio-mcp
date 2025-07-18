/**
 * Test setup file for Vitest
 * This file is executed before running tests
 */
import { vi } from 'vitest';

// Set up global mocks that should be available for all tests

// Mock fs module
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn(),
    readFileSync: vi.fn().mockReturnValue(''),
    writeFileSync: vi.fn(),
    appendFileSync: vi.fn(),
    unlinkSync: vi.fn(),
    statSync: vi.fn().mockReturnValue({ mode: 0o777 }),
    promises: {
      readFile: vi.fn().mockResolvedValue(''),
      writeFile: vi.fn().mockResolvedValue(undefined),
      appendFile: vi.fn().mockResolvedValue(undefined),
      unlink: vi.fn().mockResolvedValue(undefined),
      mkdir: vi.fn().mockResolvedValue(undefined),
      access: vi.fn().mockResolvedValue(undefined),
      readdir: vi.fn().mockResolvedValue([]),
      stat: vi.fn().mockResolvedValue({ isDirectory: () => true })
    }
  };
});

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

// Mock config
vi.mock('../src/config', async () => {
  const actual = await vi.importActual('../src/config');
  return {
    default: {
      server: {
        port: 3000,
        host: 'localhost'
      },
      openStudio: {
        cliPath: '/path/to/openstudio',
        version: '3.5.0'
      },
      bcl: {
        apiUrl: 'https://bcl.nrel.gov/api',
        measuresDir: './measures',
        tempDir: './temp'
      },
      logging: {
        level: 'info',
        format: 'pretty'
      }
    }
  };
});

// Global beforeEach hook
beforeEach(() => {
  vi.clearAllMocks();
});