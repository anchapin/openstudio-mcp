/**
 * Tests for Enhanced Measure Management Handlers
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RequestHandler } from '../../src/handlers/requestHandler';

// Mock dependencies
vi.mock('../../src/services/enhancedMeasureService', () => ({
  default: {
    updateMeasure: vi.fn(),
    updateAllMeasures: vi.fn(),
    computeMeasureArguments: vi.fn(),
    runMeasureTests: vi.fn(),
  },
}));

vi.mock('../../src/utils', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  openStudioCommands: {},
}));

vi.mock('../../src/utils/validation', () => ({
  validateRequest: vi.fn().mockReturnValue({ valid: true, errors: [] }),
  getValidationSchema: vi.fn().mockReturnValue({}),
}));

vi.mock('../../src/services/commandProcessor', () => ({
  OpenStudioCommandProcessor: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../../src/services/bclApiClient', () => ({
  BCLApiClient: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../../src/config', () => ({
  default: {
    bcl: {
      apiUrl: 'https://bcl.nrel.gov/api',
    },
  },
}));

describe('Enhanced Measure Management Handlers', () => {
  let requestHandler: RequestHandler;

  beforeEach(() => {
    requestHandler = new RequestHandler();
    vi.clearAllMocks();
  });

  describe('handleMeasureUpdate', () => {
    it('should handle single measure update successfully', async () => {
      const enhancedMeasureService = (await import('../../src/services/enhancedMeasureService'))
        .default;

      vi.mocked(enhancedMeasureService.updateMeasure).mockResolvedValue({
        success: true,
        measureId: 'test-measure',
        message: 'Successfully updated measure: test-measure',
        previousVersion: '1.0.0',
        newVersion: '1.1.0',
      });

      const result = await requestHandler.handleMeasureUpdate({
        measureId: 'test-measure',
        options: {
          force: true,
        },
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('Successfully updated measure: test-measure');
      expect(result.data).toMatchObject({
        success: true,
        measureId: 'test-measure',
        previousVersion: '1.0.0',
        newVersion: '1.1.0',
      });

      expect(enhancedMeasureService.updateMeasure).toHaveBeenCalledWith('test-measure', {
        force: true,
      });
    });

    it('should handle update all measures successfully', async () => {
      const enhancedMeasureService = (await import('../../src/services/enhancedMeasureService'))
        .default;

      vi.mocked(enhancedMeasureService.updateAllMeasures).mockResolvedValue([
        {
          success: true,
          measureId: 'measure1',
          message: 'Updated successfully',
        },
        {
          success: true,
          measureId: 'measure2',
          message: 'Updated successfully',
        },
        {
          success: false,
          measureId: 'measure3',
          message: 'Update failed',
          error: 'Some error',
        },
      ]);

      const result = await requestHandler.handleMeasureUpdate({
        updateAll: true,
        options: {
          updateReadme: true,
        },
      });

      expect(result.success).toBe(false); // Because one measure failed
      expect(result.output).toContain('Updated 2 measures successfully, 1 failed');
      expect(result.data.summary).toMatchObject({
        total: 3,
        successful: 2,
        failed: 1,
      });

      expect(enhancedMeasureService.updateAllMeasures).toHaveBeenCalledWith({
        updateReadme: true,
      });
    });

    it('should handle missing measureId and updateAll parameters', async () => {
      const result = await requestHandler.handleMeasureUpdate({
        options: {
          force: true,
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Either measureId or updateAll must be specified');
    });

    it('should handle service error', async () => {
      const enhancedMeasureService = (await import('../../src/services/enhancedMeasureService'))
        .default;

      vi.mocked(enhancedMeasureService.updateMeasure).mockRejectedValue(
        new Error('Service unavailable'),
      );

      const result = await requestHandler.handleMeasureUpdate({
        measureId: 'test-measure',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Service unavailable');
    });
  });

  describe('handleMeasureArgumentsCompute', () => {
    it('should compute measure arguments successfully', async () => {
      const enhancedMeasureService = (await import('../../src/services/enhancedMeasureService'))
        .default;

      vi.mocked(enhancedMeasureService.computeMeasureArguments).mockResolvedValue({
        success: true,
        measureId: 'test-measure',
        arguments: [
          {
            name: 'window_ratio',
            displayName: 'Window to Wall Ratio',
            description: 'Set the window to wall ratio',
            type: 'Double',
            required: true,
            defaultValue: 0.4,
          },
          {
            name: 'orientation',
            displayName: 'Building Orientation',
            description: 'Set the building orientation',
            type: 'Choice',
            required: false,
            defaultValue: 'South',
          },
        ],
        modelPath: '/path/to/model.osm',
      });

      const result = await requestHandler.handleMeasureArgumentsCompute({
        measureId: 'test-measure',
        options: {
          modelPath: '/path/to/model.osm',
          includeEnergyPlusMeasures: true,
        },
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain(
        'Successfully computed 2 arguments for measure: test-measure',
      );
      expect(result.data).toMatchObject({
        success: true,
        measureId: 'test-measure',
        arguments: expect.arrayContaining([
          expect.objectContaining({
            name: 'window_ratio',
            type: 'Double',
            required: true,
          }),
        ]),
      });

      expect(enhancedMeasureService.computeMeasureArguments).toHaveBeenCalledWith('test-measure', {
        modelPath: '/path/to/model.osm',
        includeEnergyPlusMeasures: true,
      });
    });

    it('should handle missing measureId', async () => {
      const result = await requestHandler.handleMeasureArgumentsCompute({
        options: {
          modelPath: '/path/to/model.osm',
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('measureId is required');
    });

    it('should handle computation failure', async () => {
      const enhancedMeasureService = (await import('../../src/services/enhancedMeasureService'))
        .default;

      vi.mocked(enhancedMeasureService.computeMeasureArguments).mockResolvedValue({
        success: false,
        measureId: 'test-measure',
        arguments: [],
        error: 'Measure not found',
      });

      const result = await requestHandler.handleMeasureArgumentsCompute({
        measureId: 'test-measure',
      });

      expect(result.success).toBe(false);
      expect(result.output).toContain('Failed to compute arguments for measure: test-measure');
      expect(result.error).toBe('Measure not found');
    });

    it('should handle service error', async () => {
      const enhancedMeasureService = (await import('../../src/services/enhancedMeasureService'))
        .default;

      vi.mocked(enhancedMeasureService.computeMeasureArguments).mockRejectedValue(
        new Error('OpenStudio CLI not found'),
      );

      const result = await requestHandler.handleMeasureArgumentsCompute({
        measureId: 'test-measure',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('OpenStudio CLI not found');
    });
  });

  describe('handleMeasureTest', () => {
    it('should run measure tests successfully', async () => {
      const enhancedMeasureService = (await import('../../src/services/enhancedMeasureService'))
        .default;

      vi.mocked(enhancedMeasureService.runMeasureTests).mockResolvedValue({
        success: true,
        measureId: 'test-measure',
        testsExecuted: 5,
        testsPassed: 5,
        testsFailed: 0,
        executionTime: 12.5,
        testDetails: [
          {
            name: 'test_initialize',
            passed: true,
            executionTime: 2.1,
          },
          {
            name: 'test_run',
            passed: true,
            executionTime: 8.2,
          },
        ],
      });

      const result = await requestHandler.handleMeasureTest({
        measureId: 'test-measure',
        options: {
          generateDashboard: true,
          timeout: 300,
        },
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('All tests passed for measure: test-measure (5/5 tests)');
      expect(result.data).toMatchObject({
        success: true,
        measureId: 'test-measure',
        testsExecuted: 5,
        testsPassed: 5,
        testsFailed: 0,
        executionTime: 12.5,
      });

      expect(enhancedMeasureService.runMeasureTests).toHaveBeenCalledWith('test-measure', {
        generateDashboard: true,
        timeout: 300,
      });
    });

    it('should handle test failures', async () => {
      const enhancedMeasureService = (await import('../../src/services/enhancedMeasureService'))
        .default;

      vi.mocked(enhancedMeasureService.runMeasureTests).mockResolvedValue({
        success: false,
        measureId: 'test-measure',
        testsExecuted: 3,
        testsPassed: 2,
        testsFailed: 1,
        executionTime: 8.3,
        testDetails: [
          {
            name: 'test_initialize',
            passed: true,
            executionTime: 1.5,
          },
          {
            name: 'test_run',
            passed: false,
            executionTime: 4.2,
            error: 'Assertion failed',
          },
          {
            name: 'test_validate',
            passed: true,
            executionTime: 2.6,
          },
        ],
      });

      const result = await requestHandler.handleMeasureTest({
        measureId: 'test-measure',
      });

      expect(result.success).toBe(false);
      expect(result.output).toContain(
        'Tests failed for measure: test-measure (2/3 tests, 1 failed)',
      );
      expect(result.data.testDetails).toHaveLength(3);
      expect(result.data.testDetails[1]).toMatchObject({
        name: 'test_run',
        passed: false,
        error: 'Assertion failed',
      });
    });

    it('should handle missing measureId', async () => {
      const result = await requestHandler.handleMeasureTest({
        options: {
          generateDashboard: true,
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('measureId is required');
    });

    it('should handle service error', async () => {
      const enhancedMeasureService = (await import('../../src/services/enhancedMeasureService'))
        .default;

      vi.mocked(enhancedMeasureService.runMeasureTests).mockRejectedValue(
        new Error('Tests directory not found'),
      );

      const result = await requestHandler.handleMeasureTest({
        measureId: 'test-measure',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Tests directory not found');
    });

    it('should handle measure not found', async () => {
      const enhancedMeasureService = (await import('../../src/services/enhancedMeasureService'))
        .default;

      vi.mocked(enhancedMeasureService.runMeasureTests).mockResolvedValue({
        success: false,
        measureId: 'nonexistent-measure',
        testsExecuted: 0,
        testsPassed: 0,
        testsFailed: 0,
        executionTime: 0,
        error: 'Measure not found: nonexistent-measure',
      });

      const result = await requestHandler.handleMeasureTest({
        measureId: 'nonexistent-measure',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Measure not found: nonexistent-measure');
    });
  });
});
