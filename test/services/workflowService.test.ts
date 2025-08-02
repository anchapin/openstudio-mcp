/**
 * Tests for WorkflowService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkflowService } from '../../src/services/workflowService';
import fs from 'fs/promises';
import { existsSync } from 'fs';

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
    mkdir: vi.fn(),
    unlink: vi.fn(),
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

vi.mock('../../src/utils/validation', () => ({
  isPathSafe: vi.fn().mockReturnValue(true),
}));

// Mock the async fs functions properly
const mockFs = {
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  unlink: vi.fn(),
};

describe('WorkflowService', () => {
  let workflowService: WorkflowService;

  beforeEach(() => {
    workflowService = new WorkflowService();
    vi.clearAllMocks();
  });

  describe('parseWorkflowFile', () => {
    it('should parse a valid OSW file', async () => {
      const mockWorkflow = {
        version: '3.8.0',
        seed_file: 'model.osm',
        weather_file: 'weather.epw',
        steps: [
          {
            measure_dir_name: 'TestMeasure',
            arguments: { arg1: 'value1' },
          },
        ],
      };

      vi.mocked(existsSync).mockReturnValue(true);
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockWorkflow));

      const result = await workflowService.parseWorkflowFile('/path/to/workflow.osw');

      expect(result).toEqual(mockWorkflow);
      expect(fs.readFile).toHaveBeenCalledWith('/path/to/workflow.osw', 'utf-8');
    });

    it('should throw error for non-existent file', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      await expect(workflowService.parseWorkflowFile('/path/to/nonexistent.osw')).rejects.toThrow(
        'OSW file not found',
      );
    });

    it('should throw error for invalid JSON', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(fs.readFile).mockResolvedValue('invalid json');

      await expect(workflowService.parseWorkflowFile('/path/to/invalid.osw')).rejects.toThrow(
        'Failed to parse OSW file',
      );
    });
  });

  describe('validateWorkflow', () => {
    it('should validate a valid workflow', async () => {
      const workflow = {
        version: '3.8.0',
        seed_file: 'model.osm',
        weather_file: 'weather.epw',
        steps: [
          {
            measure_dir_name: 'TestMeasure',
            arguments: { arg1: 'value1' },
          },
        ],
      };

      vi.mocked(existsSync).mockReturnValue(true);

      const result = await workflowService.validateWorkflow(workflow);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing steps', async () => {
      const workflow = {
        version: '3.8.0',
        seed_file: 'model.osm',
        steps: [],
      };

      const result = await workflowService.validateWorkflow(workflow);

      expect(result.valid).toBe(true); // Still valid, just a warning
      expect(result.warnings).toContain('Workflow has no steps defined');
    });

    it('should detect missing seed file', async () => {
      const workflow = {
        version: '3.8.0',
        seed_file: 'nonexistent.osm',
        steps: [
          {
            measure_dir_name: 'TestMeasure',
          },
        ],
      };

      vi.mocked(existsSync).mockReturnValue(false);

      const result = await workflowService.validateWorkflow(workflow);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Seed file not found: nonexistent.osm');
    });

    it('should detect invalid steps', async () => {
      const workflow = {
        version: '3.8.0',
        steps: [
          {
            // Missing measure_dir_name
            arguments: { arg1: 'value1' },
          },
        ],
      };

      const result = await workflowService.validateWorkflow(workflow);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Step 1: measure_dir_name is required');
    });
  });

  describe('createWorkflowFromTemplate', () => {
    it('should create basic_analysis template', () => {
      const workflow = workflowService.createWorkflowFromTemplate(
        'basic_analysis',
        'model.osm',
        'weather.epw',
      );

      expect(workflow.seed_file).toBe('model.osm');
      expect(workflow.weather_file).toBe('weather.epw');
      expect(workflow.steps).toHaveLength(1);
      expect(workflow.steps[0].measure_dir_name).toBe('SetWindowToWallRatioByFacade');
    });

    it('should create calibration template', () => {
      const workflow = workflowService.createWorkflowFromTemplate('calibration', 'model.osm');

      expect(workflow.seed_file).toBe('model.osm');
      expect(workflow.steps).toHaveLength(1);
      expect(workflow.steps[0].measure_dir_name).toBe('CalibrationReports');
    });

    it('should create hvac_analysis template', () => {
      const workflow = workflowService.createWorkflowFromTemplate('hvac_analysis', 'model.osm');

      expect(workflow.seed_file).toBe('model.osm');
      expect(workflow.steps).toHaveLength(1);
      expect(workflow.steps[0].measure_dir_name).toBe('replace_hvac_with_gshp_and_doas');
    });

    it('should create empty workflow for unknown template', () => {
      const workflow = workflowService.createWorkflowFromTemplate('unknown_template', 'model.osm');

      expect(workflow.seed_file).toBe('model.osm');
      expect(workflow.steps).toHaveLength(0);
    });
  });

  describe('saveWorkflow', () => {
    it('should save workflow to file', async () => {
      const workflow = {
        version: '3.8.0',
        seed_file: 'model.osm',
        steps: [],
      };

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await workflowService.saveWorkflow(workflow, '/path/to/workflow.osw');

      expect(fs.mkdir).toHaveBeenCalledWith('/path/to', { recursive: true });
      expect(fs.writeFile).toHaveBeenCalledWith(
        '/path/to/workflow.osw',
        expect.stringContaining('"version": "3.8.0"'),
        'utf-8',
      );
    });

    it('should update timestamp when saving', async () => {
      const workflow = {
        version: '3.8.0',
        seed_file: 'model.osm',
        steps: [],
      };

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await workflowService.saveWorkflow(workflow, '/path/to/workflow.osw');

      expect(workflow.updated_at).toBeDefined();
    });
  });

  describe('executeWorkflowFile', () => {
    it('should execute workflow file with OpenStudio CLI', async () => {
      const { executeOpenStudioCommand } = await import('../../src/utils/commandExecutor');

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(executeOpenStudioCommand).mockResolvedValue({
        success: true,
        stdout: 'Workflow completed successfully',
        stderr: '',
        error: undefined,
      });

      const result = await workflowService.executeWorkflowFile('/path/to/workflow.osw');

      expect(result.success).toBe(true);
      expect(result.output).toBe('Workflow completed successfully');
      expect(executeOpenStudioCommand).toHaveBeenCalledWith(
        '',
        ['run', '--workflow', '/path/to/workflow.osw'],
        expect.objectContaining({
          timeout: 1800000,
          memoryLimit: 8192,
        }),
      );
    });

    it('should handle workflow execution failure', async () => {
      const { executeOpenStudioCommand } = await import('../../src/utils/commandExecutor');

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(executeOpenStudioCommand).mockResolvedValue({
        success: false,
        stdout: '',
        stderr: 'Execution failed',
        error: 'Command failed',
      });

      const result = await workflowService.executeWorkflowFile('/path/to/workflow.osw');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Command failed');
    });

    it('should include debug option in CLI args', async () => {
      const { executeOpenStudioCommand } = await import('../../src/utils/commandExecutor');

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(executeOpenStudioCommand).mockResolvedValue({
        success: true,
        stdout: 'Workflow completed',
        stderr: '',
        error: undefined,
      });

      await workflowService.executeWorkflowFile('/path/to/workflow.osw', { debug: true });

      expect(executeOpenStudioCommand).toHaveBeenCalledWith(
        '',
        ['run', '--workflow', '/path/to/workflow.osw', '--debug'],
        expect.any(Object),
      );
    });

    it('should include measures_only option in CLI args', async () => {
      const { executeOpenStudioCommand } = await import('../../src/utils/commandExecutor');

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(executeOpenStudioCommand).mockResolvedValue({
        success: true,
        stdout: 'Measures completed',
        stderr: '',
        error: undefined,
      });

      await workflowService.executeWorkflowFile('/path/to/workflow.osw', { measuresOnly: true });

      expect(executeOpenStudioCommand).toHaveBeenCalledWith(
        '',
        ['run', '--workflow', '/path/to/workflow.osw', '--measures_only'],
        expect.any(Object),
      );
    });
  });
});
