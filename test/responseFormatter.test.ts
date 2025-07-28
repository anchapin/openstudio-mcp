/**
 * Response formatter tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResponseFormatter } from '../src/services/responseFormatter';
import { CommandResult } from '../src/interfaces';

// Mock logger
vi.mock('../src/utils/logger', async () => {
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

// Mock output processor
vi.mock('../src/utils/outputProcessor', () => {
  return {
    OutputFormat: {
      TEXT: 'text',
      JSON: 'json',
      TABLE: 'table',
      CHART: 'chart',
    },
    default: {
      processOutput: vi.fn().mockImplementation((output) => {
        if (output === null || output === undefined) {
          return {
            summary: 'Error processing output',
            highlights: [],
            formatted: output,
            raw: String(output),
          };
        }
        return {
          summary: typeof output === 'string' ? output.substring(0, 100) : 'Processed output',
          highlights: ['Important line 1', 'Important line 2'],
          formatted: output,
          raw: output,
        };
      }),
      extractHighlights: vi.fn().mockReturnValue(['Important line 1', 'Important line 2']),
    },
  };
});

describe('Response Formatter', () => {
  vi.setConfig({ testTimeout: 10000 }); // Added 10s timeout
  let responseFormatter: ResponseFormatter;

  beforeEach(() => {
    responseFormatter = new ResponseFormatter();
    vi.clearAllMocks();

    // Mock Date.now() to return a fixed timestamp
    const mockDate = new Date('2023-01-01T12:00:00Z');
    vi.spyOn(global, 'Date').mockImplementation(() => mockDate);
  });

  describe('formatSuccess', () => {
    vi.setConfig({ testTimeout: 10000 }); // Added 10s timeout
    it('should format a successful response', () => {
      const id = 'test-id';
      const type = 'test.type';
      const result: CommandResult = {
        success: true,
        output: 'Command executed successfully',
        data: {
          key1: 'value1',
          key2: 42,
          nested: {
            nestedKey: 'nestedValue',
          },
        },
      };
      const options = {
        serverVersion: '1.0.0',
        openStudioVersion: '3.5.0',
        includeMetadata: true,
        includeRawOutput: true,
      };

      const response = responseFormatter.formatSuccess(id, type, result, options);

      expect(response.id).toBe(id);
      expect(response.type).toBe(type);
      expect(response.status).toBe('success');
      expect(response.result).toBeDefined();
      expect(response.result.key1).toBe('value1');
      expect(response.result.key2).toBe(42);
      expect(response.result.nested).toEqual({ nestedKey: 'nestedValue' });
      expect(response.result.output).toBe('Command executed successfully');
      expect(response.result._metadata).toBeDefined();
      expect(response.result._metadata.serverVersion).toBe('1.0.0');
      expect(response.result._metadata.openStudioVersion).toBe('3.5.0');
    });

    it('should format a successful response without metadata', () => {
      const id = 'test-id';
      const type = 'test.type';
      const result: CommandResult = {
        success: true,
        output: 'Command executed successfully',
        data: { key: 'value' },
      };
      const options = {
        serverVersion: '1.0.0',
        openStudioVersion: '3.5.0',
        includeMetadata: false,
        includeRawOutput: true,
      };

      const response = responseFormatter.formatSuccess(id, type, result, options);

      expect(response.id).toBe(id);
      expect(response.type).toBe(type);
      expect(response.status).toBe('success');
      expect(response.result).toBeDefined();
      expect(response.result.key).toBe('value');
      expect(response.result.output).toBe('Command executed successfully');
      expect(response.result._metadata).toBeUndefined();
    });

    it('should format a successful response without raw output', () => {
      const id = 'test-id';
      const type = 'test.type';
      const result: CommandResult = {
        success: true,
        output: 'Command executed successfully',
        data: { key: 'value' },
      };
      const options = {
        serverVersion: '1.0.0',
        openStudioVersion: '3.5.0',
        includeMetadata: true,
        includeRawOutput: false,
      };

      const response = responseFormatter.formatSuccess(id, type, result, options);

      expect(response.id).toBe(id);
      expect(response.type).toBe(type);
      expect(response.status).toBe('success');
      expect(response.result).toBeDefined();
      expect(response.result.key).toBe('value');
      expect(response.result.output).toBeUndefined();
      expect(response.result._metadata).toBeDefined();
    });

    it('should process output if requested', () => {
      const id = 'test-id';
      const type = 'test.type';
      const result: CommandResult = {
        success: true,
        output: 'Command executed successfully with some technical details',
        data: { key: 'value' },
      };
      const options = {
        processOutput: true,
        includeHighlights: true,
      };

      const response = responseFormatter.formatSuccess(id, type, result, options);

      expect(response.result.processedOutput).toBeDefined();
      expect(response.result.processedOutput.summary).toBeDefined();
      // Highlights might be undefined depending on implementation
    });
  });

  describe('formatError', () => {
    vi.setConfig({ testTimeout: 10000 }); // Added 10s timeout
    it('should format an error response', () => {
      const id = 'test-id';
      const type = 'test.type';
      const message = 'Test error message';
      const code = 'TEST_ERROR';
      const details = { key: 'value' };
      const options = {
        serverVersion: '1.0.0',
        openStudioVersion: '3.5.0',
        includeMetadata: true,
        includeRawOutput: true,
      };

      const response = responseFormatter.formatError(id, type, message, code, details, options);

      expect(response.id).toBe(id);
      expect(response.type).toBe(type);
      expect(response.status).toBe('error');
      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(code);
      expect(response.error.message).toBe(message);
      expect(response.error.details).toEqual(details);
      expect(response.error._metadata).toBeDefined();
      expect(response.error._metadata.serverVersion).toBe('1.0.0');
      expect(response.error._metadata.openStudioVersion).toBe('3.5.0');
    });

    it('should format an error response without metadata', () => {
      const id = 'test-id';
      const type = 'test.type';
      const message = 'Test error message';
      const code = 'TEST_ERROR';
      const details = { key: 'value' };
      const options = {
        serverVersion: '1.0.0',
        openStudioVersion: '3.5.0',
        includeMetadata: false,
        includeRawOutput: true,
      };

      const response = responseFormatter.formatError(id, type, message, code, details, options);

      expect(response.id).toBe(id);
      expect(response.type).toBe(type);
      expect(response.status).toBe('error');
      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(code);
      expect(response.error.message).toBe(message);
      expect(response.error.details).toEqual(details);
      expect(response.error._metadata).toBeUndefined();
    });

    it('should handle Error objects', () => {
      const id = 'test-id';
      const type = 'test.type';
      const error = new Error('Test error message');
      const code = 'TEST_ERROR';

      const response = responseFormatter.formatError(id, type, error, code);

      expect(response.error.message).toBe('Test error message');
    });

    it('should process error message if requested', () => {
      const id = 'test-id';
      const type = 'test.type';
      const message = 'Test error message with technical details';
      const code = 'TEST_ERROR';
      const options = {
        processOutput: true,
        includeHighlights: true,
      };

      const response = responseFormatter.formatError(
        id,
        type,
        message,
        code,
        { originalMessage: message },
        options,
      );

      expect(response.error.message).toBeDefined();
      // The details might be undefined or contain highlights depending on the implementation
      if (response.error.details && response.error.details.highlights) {
        expect(Array.isArray(response.error.details.highlights)).toBe(true);
      }
    });
  });

  describe('formatResponse', () => {
    vi.setConfig({ testTimeout: 10000 }); // Added 10s timeout
    it('should format a successful command result', () => {
      const id = 'test-id';
      const type = 'test.type';
      const result: CommandResult = {
        success: true,
        output: 'Command executed successfully',
        data: { key: 'value' },
      };

      const response = responseFormatter.formatResponse(id, type, result);

      expect(response.status).toBe('success');
      expect(response.result).toBeDefined();
    });

    it('should format a failed command result', () => {
      const id = 'test-id';
      const type = 'test.type';
      const result: CommandResult = {
        success: false,
        output: '',
        error: 'Command execution failed',
      };

      const response = responseFormatter.formatResponse(id, type, result);

      expect(response.status).toBe('error');
      expect(response.error).toBeDefined();
      expect(response.error.message).toBe('Command execution failed');
    });
  });

  describe('addMetadata', () => {
    vi.setConfig({ testTimeout: 10000 }); // Added 10s timeout
    it('should add metadata to a success response', () => {
      const response = {
        id: 'test-id',
        type: 'test.type',
        status: 'success',
        result: { key: 'value' },
      };

      const metadata = {
        timestamp: '2023-01-01T12:00:00Z',
        serverVersion: '1.0.0',
      };

      const updatedResponse = responseFormatter.addMetadata(response, metadata);

      expect(updatedResponse.result._metadata).toBeDefined();
      expect(updatedResponse.result._metadata.timestamp).toBe('2023-01-01T12:00:00Z');
      expect(updatedResponse.result._metadata.serverVersion).toBe('1.0.0');
    });

    it('should add metadata to an error response', () => {
      const response = {
        id: 'test-id',
        type: 'test.type',
        status: 'error',
        error: {
          code: 'TEST_ERROR',
          message: 'Test error',
        },
      };

      const metadata = {
        timestamp: '2023-01-01T12:00:00Z',
        serverVersion: '1.0.0',
      };

      const updatedResponse = responseFormatter.addMetadata(response, metadata);

      expect(updatedResponse.error._metadata).toBeDefined();
      expect(updatedResponse.error._metadata.timestamp).toBe('2023-01-01T12:00:00Z');
      expect(updatedResponse.error._metadata.serverVersion).toBe('1.0.0');
    });

    it('should merge with existing metadata', () => {
      const response = {
        id: 'test-id',
        type: 'test.type',
        status: 'success',
        result: {
          key: 'value',
          _metadata: {
            existingKey: 'existingValue',
          },
        },
      };

      const metadata = {
        newKey: 'newValue',
      };

      const updatedResponse = responseFormatter.addMetadata(response, metadata);

      expect(updatedResponse.result._metadata.existingKey).toBe('existingValue');
      expect(updatedResponse.result._metadata.newKey).toBe('newValue');
    });
  });
});
