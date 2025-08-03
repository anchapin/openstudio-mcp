/**
 * Tests for Enhanced Measure Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EnhancedMeasureService } from '../../src/services/enhancedMeasureService';
import { existsSync } from 'fs';
import fs from 'fs/promises';

// Mock dependencies
vi.mock('fs', () => ({
  existsSync: vi.fn(),
}));

vi.mock('fs/promises', async () => {
  const actual = await vi.importActual('fs/promises');
  return {
    ...actual,
    readFile: vi.fn(),
    writeFile: vi.fn(),
  };
});

vi.mock('../../src/utils/commandExecutor', () => ({
  executeOpenStudioCommand: vi.fn(),
}));

vi.mock('../../src/utils', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../src/utils/measureManager', () => ({
  default: {
    getMeasuresDir: vi.fn().mockReturnValue('/mock/measures'),
    getMeasureVersion: vi.fn(),
    listInstalledMeasures: vi.fn(),
  },
}));

vi.mock('../../src/utils/fileOperations', () => ({
  default: {
    fileExists: vi.fn(),
    directoryExists: vi.fn(),
    copyFile: vi.fn(),
    deleteFile: vi.fn(),
    createTempDirectory: vi.fn(),
    ensureDirectory: vi.fn(),
  },
}));

vi.mock('../../src/utils/validation', () => ({
  isPathSafe: vi.fn().mockReturnValue(true),
}));

describe('EnhancedMeasureService', () => {
  let enhancedMeasureService: EnhancedMeasureService;

  beforeEach(() => {
    enhancedMeasureService = new EnhancedMeasureService();
    vi.clearAllMocks();
  });

  describe('updateMeasure', () => {
    it('should update a single measure successfully', async () => {
      const { executeOpenStudioCommand } = await import('../../src/utils/commandExecutor');
      const measureManager = (await import('../../src/utils/measureManager')).default;

      // Setup mocks
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(measureManager.getMeasureVersion)
        .mockResolvedValueOnce('1.0.0') // Previous version
        .mockResolvedValueOnce('1.1.0'); // New version

      vi.mocked(executeOpenStudioCommand).mockResolvedValue({
        success: true,
        stdout: 'Measure updated successfully',
        stderr: '',
        error: undefined,
      });

      const result = await enhancedMeasureService.updateMeasure('test-measure', {
        updateReadme: false,
        updateXml: false,
      });

      expect(result.success).toBe(true);
      expect(result.measureId).toBe('test-measure');
      expect(result.previousVersion).toBe('1.0.0');
      expect(result.newVersion).toBe('1.1.0');
      expect(result.message).toContain('Successfully updated measure');
    });

    it('should handle measure not found', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = await enhancedMeasureService.updateMeasure('nonexistent-measure');

      expect(result.success).toBe(false);
      expect(result.measureId).toBe('nonexistent-measure');
      expect(result.error).toContain('Measure directory does not exist');
    });

    it('should handle OpenStudio command failure', async () => {
      const { executeOpenStudioCommand } = await import('../../src/utils/commandExecutor');

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(executeOpenStudioCommand).mockResolvedValue({
        success: false,
        stdout: '',
        stderr: 'Command failed',
        error: 'Command execution failed',
      });

      const result = await enhancedMeasureService.updateMeasure('test-measure');

      expect(result.success).toBe(false);
      expect(result.measureId).toBe('test-measure');
      expect(result.error).toBe('Command execution failed');
    });
  });

  describe('updateAllMeasures', () => {
    it('should update all measures successfully', async () => {
      const measureManager = (await import('../../src/utils/measureManager')).default;
      const { executeOpenStudioCommand } = await import('../../src/utils/commandExecutor');

      // Setup mocks
      vi.mocked(measureManager.listInstalledMeasures).mockResolvedValue([
        'measure1',
        'measure2',
        'measure3',
      ]);
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(measureManager.getMeasureVersion).mockResolvedValue('1.0.0');
      vi.mocked(executeOpenStudioCommand).mockResolvedValue({
        success: true,
        stdout: 'Measure updated successfully',
        stderr: '',
        error: undefined,
      });

      const results = await enhancedMeasureService.updateAllMeasures({
        updateReadme: false,
        updateXml: false,
      });

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.success)).toBe(true);
      expect(results.map((r) => r.measureId)).toEqual(['measure1', 'measure2', 'measure3']);
    });

    it('should handle no measures found', async () => {
      const measureManager = (await import('../../src/utils/measureManager')).default;

      vi.mocked(measureManager.listInstalledMeasures).mockResolvedValue([]);

      const results = await enhancedMeasureService.updateAllMeasures();

      expect(results).toHaveLength(0);
    });
  });

  describe('computeMeasureArguments', () => {
    it('should compute measure arguments successfully', async () => {
      const { executeOpenStudioCommand } = await import('../../src/utils/commandExecutor');

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(executeOpenStudioCommand).mockResolvedValue({
        success: true,
        stdout: `Argument: window_to_wall_ratio
Display Name: Window to Wall Ratio
Description: Set the window to wall ratio
Type: Double
Required: true
Default Value: 0.4

Argument: facade
Display Name: Facade
Description: Choose facade orientation
Type: Choice
Required: false
Default Value: South`,
        stderr: '',
        error: undefined,
      });

      const result = await enhancedMeasureService.computeMeasureArguments('test-measure', {
        modelPath: '/path/to/model.osm',
      });

      expect(result.success).toBe(true);
      expect(result.measureId).toBe('test-measure');
      expect(result.arguments).toHaveLength(2);
      expect(result.arguments[0].name).toBe('window_to_wall_ratio');
      expect(result.arguments[0].type).toBe('Double');
      expect(result.arguments[0].required).toBe(true);
      expect(result.arguments[0].defaultValue).toBe(0.4);
    });

    it('should handle measure not found', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = await enhancedMeasureService.computeMeasureArguments('nonexistent-measure');

      expect(result.success).toBe(false);
      expect(result.measureId).toBe('nonexistent-measure');
      expect(result.error).toContain('Measure not found');
    });

    it('should handle model file not found', async () => {
      vi.mocked(existsSync)
        .mockReturnValueOnce(true) // Measure exists
        .mockReturnValueOnce(false); // Model doesn't exist

      const result = await enhancedMeasureService.computeMeasureArguments('test-measure', {
        modelPath: '/path/to/nonexistent.osm',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Model file not found');
    });
  });

  describe('runMeasureTests', () => {
    it('should run measure tests successfully', async () => {
      const { executeOpenStudioCommand } = await import('../../src/utils/commandExecutor');

      vi.mocked(existsSync)
        .mockReturnValueOnce(true) // Measure exists
        .mockReturnValueOnce(true); // Tests directory exists

      vi.mocked(executeOpenStudioCommand).mockResolvedValue({
        success: true,
        stdout: `Running tests for measure
test_initialize PASSED
test_run PASSED
test_validate PASSED

3 tests, 15 assertions, 0 failures, 0 errors`,
        stderr: '',
        error: undefined,
      });

      const result = await enhancedMeasureService.runMeasureTests('test-measure', {
        generateDashboard: false,
      });

      expect(result.success).toBe(true);
      expect(result.measureId).toBe('test-measure');
      expect(result.testsExecuted).toBe(3);
      expect(result.testsPassed).toBe(3);
      expect(result.testsFailed).toBe(0);
      expect(result.executionTime).toBeGreaterThan(0);
    });

    it('should handle measure not found', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = await enhancedMeasureService.runMeasureTests('nonexistent-measure');

      expect(result.success).toBe(false);
      expect(result.measureId).toBe('nonexistent-measure');
      expect(result.error).toContain('Measure not found');
    });

    it('should handle no tests directory', async () => {
      vi.mocked(existsSync)
        .mockReturnValueOnce(true) // Measure exists
        .mockReturnValueOnce(false); // Tests directory doesn't exist

      const result = await enhancedMeasureService.runMeasureTests('test-measure');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No tests directory found');
    });

    it('should handle test failures', async () => {
      const { executeOpenStudioCommand } = await import('../../src/utils/commandExecutor');

      vi.mocked(existsSync)
        .mockReturnValueOnce(true) // Measure exists
        .mockReturnValueOnce(true); // Tests directory exists

      vi.mocked(executeOpenStudioCommand).mockResolvedValue({
        success: true,
        stdout: `Running tests for measure
test_initialize PASSED
test_run FAILED
test_validate PASSED

3 tests, 12 assertions, 1 failures, 0 errors`,
        stderr: '',
        error: undefined,
      });

      const result = await enhancedMeasureService.runMeasureTests('test-measure');

      expect(result.success).toBe(false);
      expect(result.measureId).toBe('test-measure');
      expect(result.testsExecuted).toBe(3);
      expect(result.testsPassed).toBe(2);
      expect(result.testsFailed).toBe(1);
    });

    it('should generate test dashboard when requested', async () => {
      const { executeOpenStudioCommand } = await import('../../src/utils/commandExecutor');

      vi.mocked(existsSync)
        .mockReturnValueOnce(true) // Measure exists
        .mockReturnValueOnce(true); // Tests directory exists

      vi.mocked(executeOpenStudioCommand).mockResolvedValue({
        success: true,
        stdout: `Running tests for measure
test_initialize PASSED
3 tests, 15 assertions, 0 failures, 0 errors`,
        stderr: '',
        error: undefined,
      });

      vi.mocked(fs.writeFile as typeof fs.writeFile).mockResolvedValue(undefined);

      const result = await enhancedMeasureService.runMeasureTests('test-measure', {
        generateDashboard: true,
      });

      expect(result.success).toBe(true);
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('test_dashboard.html'),
        expect.stringContaining('Test Results Dashboard'),
        'utf-8',
      );
    });
  });

  describe('argument parsing', () => {
    it('should parse different argument types correctly', async () => {
      const { executeOpenStudioCommand } = await import('../../src/utils/commandExecutor');

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(executeOpenStudioCommand).mockResolvedValue({
        success: true,
        stdout: `Argument: num_stories
Display Name: Number of Stories
Type: Integer
Required: true
Default Value: 3

Argument: enable_feature
Display Name: Enable Feature
Type: Boolean
Required: false
Default Value: true

Argument: building_type
Display Name: Building Type
Type: String
Required: true
Default Value: Office`,
        stderr: '',
        error: undefined,
      });

      const result = await enhancedMeasureService.computeMeasureArguments('test-measure');

      expect(result.success).toBe(true);
      expect(result.arguments).toHaveLength(3);

      // Check integer argument
      const intArg = result.arguments.find((a) => a.name === 'num_stories');
      expect(intArg?.type).toBe('Integer');
      expect(intArg?.defaultValue).toBe(3);

      // Check boolean argument
      const boolArg = result.arguments.find((a) => a.name === 'enable_feature');
      expect(boolArg?.type).toBe('Boolean');
      expect(boolArg?.defaultValue).toBe(true);

      // Check string argument
      const stringArg = result.arguments.find((a) => a.name === 'building_type');
      expect(stringArg?.type).toBe('String');
      expect(stringArg?.defaultValue).toBe('Office');
    });
  });
});
