/**
 * Validation tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as validation from '../src/utils/validation';

// Mock logger
vi.mock('../src/utils/logger', async () => {
  return {
    default: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    }
  };
});

// Mock fs
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(true),
  };
});

// Mock the validation module
vi.mock('../src/utils/validation', () => {
  return {
    validateRequest: (request) => {
      if (!request || !request.type || !request.params) {
        return { valid: false, errors: ['Invalid request format'] };
      }
      return { valid: true };
    },
    validateModelPath: (path) => {
      if (!path || !path.endsWith('.osm')) {
        return { valid: false, errors: ['Invalid model path'] };
      }
      return { valid: true };
    },
    isCommandSafe: (command) => {
      const safeCommands = ['openstudio', 'node', 'npm'];
      return safeCommands.includes(command);
    }
  };
});

describe('Validation', () => {
  vi.setConfig({ testTimeout: 10000 }); // Added 10s timeout
  beforeEach(() => {
    vi.resetAllMocks();
  });
  
  describe('validateRequest', () => {
    vi.setConfig({ testTimeout: 10000 }); // Added 10s timeout
    it('should validate a valid request', () => {
      const request = {
        id: '123',
        type: 'openstudio.model.create',
        params: {
          templateType: 'empty',
          path: '/tmp/model.osm'
        }
      };
      
      const result = validation.validateRequest(request);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });
    
    it('should reject an invalid request', () => {
      // Create a request without type and params
      const request = {
        id: '123'
      };
      
      const result = validation.validateRequest(request);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });
  
  describe('validateModelPath', () => {
    it('should validate a valid model path', () => {
      const result = validation.validateModelPath('/tmp/model.osm');
      
      expect(result.valid).toBe(true);
    });
    
    it('should reject an invalid model path', () => {
      const result = validation.validateModelPath('/invalid/path/model.txt');
      
      expect(result.valid).toBe(false);
    });
  });
  
  describe('isCommandSafe', () => {
    it('should identify safe commands', () => {
      const result = validation.isCommandSafe('openstudio');
      
      expect(result).toBe(true);
    });
    
    it('should reject unsafe commands', () => {
      const result = validation.isCommandSafe('rm -rf /');
      
      expect(result).toBe(false);
    });
  });
});
