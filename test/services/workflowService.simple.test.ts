/**
 * Simple tests for WorkflowService - basic functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { WorkflowService, OpenStudioWorkflow } from '../../src/services/workflowService';

describe('WorkflowService - Basic Tests', () => {
  let workflowService: WorkflowService;

  beforeEach(() => {
    workflowService = new WorkflowService();
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
      expect(workflow.version).toBe('3.8.0');
      expect(workflow.created_at).toBeDefined();
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

  describe('validateWorkflow - basic structure validation', () => {
    it('should validate a valid workflow structure', async () => {
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

      const result = await workflowService.validateWorkflow(workflow);

      // Should not have structural errors even if files don't exist
      expect(result.errors.filter((e) => e.includes('measure_dir_name is required'))).toHaveLength(
        0,
      );
      expect(result.errors.filter((e) => e.includes('steps array'))).toHaveLength(0);
    });

    it('should detect missing steps array', async () => {
      const workflow = {
        version: '3.8.0',
        seed_file: 'model.osm',
        // No steps array
      } as Partial<OpenStudioWorkflow>;

      const result = await workflowService.validateWorkflow(workflow as OpenStudioWorkflow);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Workflow must have a steps array');
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
});
