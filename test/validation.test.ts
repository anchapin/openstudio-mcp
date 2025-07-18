/**
 * Validation utility tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  validateRequest, 
  getValidationSchema, 
  isPathSafe, 
  isCommandSafe,
  getRegisteredRequestTypes
} from '../src/utils/validation';
import { MCPRequest } from '../src/interfaces';

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

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Validation Utilities', () => {
  describe('validateRequest', () => {
    it('should validate a valid request', () => {
      const request: MCPRequest = {
        id: 'test-id',
        type: 'openstudio.model.create',
        params: {
          templateType: 'empty',
          path: '/path/to/model.osm'
        }
      };

      const result = validateRequest(request);
      expect(result.valid).toBe(true);
    });

    it('should reject a request with missing required fields', () => {
      const request: MCPRequest = {
        id: 'test-id',
        type: 'openstudio.model.create',
        params: {
          // Missing templateType
          path: '/path/to/model.osm'
        }
      };

      const result = validateRequest(request);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.some(e => e.includes('templateType'))).toBe(true);
    });

    it('should reject a request with an unknown type', () => {
      const request: MCPRequest = {
        id: 'test-id',
        type: 'unknown.type',
        params: {}
      };

      const result = validateRequest(request);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('UNKNOWN_REQUEST_TYPE');
    });

    it('should reject a request with unsafe path parameters', () => {
      const request: MCPRequest = {
        id: 'test-id',
        type: 'openstudio.model.open',
        params: {
          path: '/path/to/model.osm; rm -rf /'
        }
      };

      const result = validateRequest(request);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('SECURITY_VALIDATION_FAILED');
    });

    it('should reject a request with unsafe command parameters', () => {
      const request: MCPRequest = {
        id: 'test-id',
        type: 'openstudio.model.create',
        params: {
          templateType: 'empty',
          path: '/path/to/model.osm',
          command: 'rm -rf /'
        }
      };

      const result = validateRequest(request);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('SECURITY_VALIDATION_FAILED');
    });

    it('should validate a simulation run request with all parameters', () => {
      const request: MCPRequest = {
        id: 'test-id',
        type: 'openstudio.simulation.run',
        params: {
          modelPath: '/path/to/model.osm',
          weatherFile: '/path/to/weather.epw',
          outputDirectory: '/path/to/output',
          autoConfig: true,
          options: {
            designDaysOnly: true,
            annualSimulation: false,
            fastRun: true,
            includeRadiance: false,
            parallel: true,
            jobs: 4,
            timeout: 3600000,
            memoryLimit: 4096
          }
        }
      };

      const result = validateRequest(request);
      expect(result.valid).toBe(true);
    });

    it('should validate a BCL search request', () => {
      const request: MCPRequest = {
        id: 'test-id',
        type: 'openstudio.bcl.search',
        params: {
          query: 'energy efficiency',
          limit: 20
        }
      };

      const result = validateRequest(request);
      expect(result.valid).toBe(true);
    });

    it('should validate a measure application request', () => {
      const request: MCPRequest = {
        id: 'test-id',
        type: 'openstudio.measure.apply',
        params: {
          modelPath: '/path/to/model.osm',
          measureId: 'measure-123',
          arguments: {
            param1: 'value1',
            param2: 42
          },
          mapParameters: true,
          downloadIfNeeded: true,
          createBackup: true,
          validateModel: true,
          validateMeasure: true,
          inPlace: false,
          outputPath: '/path/to/output.osm'
        }
      };

      const result = validateRequest(request);
      expect(result.valid).toBe(true);
    });

    it('should validate measure workflow create request', () => {
      const request: MCPRequest = {
        id: 'test-id',
        type: 'openstudio.measure.workflow.create',
        params: {
          templateName: 'energy_efficiency',
          modelPath: '/path/to/model.osm'
        }
      };

      const result = validateRequest(request);
      expect(result.valid).toBe(true);
    });

    it('should validate measure workflow execute request', () => {
      const request: MCPRequest = {
        id: 'test-id',
        type: 'openstudio.measure.workflow.execute',
        params: {
          workflow: {
            name: 'Test Workflow',
            inputModelPath: '/path/to/model.osm',
            steps: [
              {
                name: 'Test Step',
                measureId: 'test-measure',
                arguments: { arg1: 'value1' }
              }
            ]
          },
          downloadMeasures: true,
          generateReport: true
        }
      };

      const result = validateRequest(request);
      expect(result.valid).toBe(true);
    });

    it('should validate measure workflow validate request', () => {
      const request: MCPRequest = {
        id: 'test-id',
        type: 'openstudio.measure.workflow.validate',
        params: {
          workflow: {
            name: 'Test Workflow',
            inputModelPath: '/path/to/model.osm',
            steps: [
              {
                name: 'Test Step',
                measureId: 'test-measure',
                arguments: { arg1: 'value1' }
              }
            ]
          }
        }
      };

      const result = validateRequest(request);
      expect(result.valid).toBe(true);
    });
  });

  describe('getValidationSchema', () => {
    it('should return schema for known request types', () => {
      const modelCreateSchema = getValidationSchema('openstudio.model.create');
      const modelOpenSchema = getValidationSchema('openstudio.model.open');
      const simulationRunSchema = getValidationSchema('openstudio.simulation.run');
      const bclSearchSchema = getValidationSchema('openstudio.bcl.search');
      const measureApplySchema = getValidationSchema('openstudio.measure.apply');
      
      expect(modelCreateSchema).toBeDefined();
      expect(modelOpenSchema).toBeDefined();
      expect(simulationRunSchema).toBeDefined();
      expect(bclSearchSchema).toBeDefined();
      expect(measureApplySchema).toBeDefined();
    });

    it('should return undefined for unknown request types', () => {
      const schema = getValidationSchema('unknown.type');
      expect(schema).toBeUndefined();
    });

    it('should return schema for measure workflow requests', () => {
      const createSchema = getValidationSchema('openstudio.measure.workflow.create');
      const executeSchema = getValidationSchema('openstudio.measure.workflow.execute');
      const validateSchema = getValidationSchema('openstudio.measure.workflow.validate');

      expect(createSchema).toBeDefined();
      expect(executeSchema).toBeDefined();
      expect(validateSchema).toBeDefined();
    });
  });

  describe('isPathSafe', () => {
    it('should return true for safe paths', () => {
      expect(isPathSafe('/path/to/file.txt')).toBe(true);
      expect(isPathSafe('C:\\Users\\user\\file.txt')).toBe(true);
      expect(isPathSafe('./relative/path.txt')).toBe(true);
      expect(isPathSafe('../parent/path.txt')).toBe(false); // Contains ..
      expect(isPathSafe('file with spaces.txt')).toBe(true);
    });

    it('should return false for paths with command injection attempts', () => {
      expect(isPathSafe('/path/to/file.txt; rm -rf /')).toBe(false);
      expect(isPathSafe('/path/to/file.txt && echo "hacked"')).toBe(false);
      expect(isPathSafe('/path/to/file.txt || echo "hacked"')).toBe(false);
      expect(isPathSafe('/path/to/file.txt | grep secret')).toBe(false);
      expect(isPathSafe('/path/to/file.txt > /etc/passwd')).toBe(false);
      expect(isPathSafe('/path/to/file.txt < /etc/passwd')).toBe(false);
      expect(isPathSafe('/path/to/file.txt `rm -rf /`')).toBe(false);
      expect(isPathSafe('/path/to/file.txt $(rm -rf /)')).toBe(false);
    });
  });

  describe('isCommandSafe', () => {
    it('should return true for safe OpenStudio commands', () => {
      expect(isCommandSafe('openstudio')).toBe(true);
      expect(isCommandSafe('openstudio run')).toBe(true);
      expect(isCommandSafe('openstudio measure apply')).toBe(true);
      expect(isCommandSafe('/path/to/openstudio')).toBe(true);
      expect(isCommandSafe('/path/to/openstudio run')).toBe(true);
    });

    it('should return false for unsafe commands', () => {
      expect(isCommandSafe('rm -rf /')).toBe(false);
      expect(isCommandSafe('openstudio; rm -rf /')).toBe(false);
      expect(isCommandSafe('openstudio && echo "hacked"')).toBe(false);
      expect(isCommandSafe('openstudio || echo "hacked"')).toBe(false);
      expect(isCommandSafe('openstudio | grep secret')).toBe(false);
      expect(isCommandSafe('openstudio > /etc/passwd')).toBe(false);
      expect(isCommandSafe('openstudio < /etc/passwd')).toBe(false);
      expect(isCommandSafe('openstudio `rm -rf /`')).toBe(false);
      expect(isCommandSafe('openstudio $(rm -rf /)')).toBe(false);
      expect(isCommandSafe('/bin/sh -c "echo hacked"')).toBe(false);
      expect(isCommandSafe('eval "alert(\'hacked\')"')).toBe(false);
    });
  });

  describe('getRegisteredRequestTypes', () => {
    it('should return a list of registered request types', () => {
      const types = getRegisteredRequestTypes();
      expect(Array.isArray(types)).toBe(true);
      expect(types.length).toBeGreaterThan(0);
      expect(types).toContain('openstudio.model.create');
      expect(types).toContain('openstudio.simulation.run');
      expect(types).toContain('openstudio.bcl.search');
      expect(types).toContain('openstudio.measure.apply');
    });
  });
});