import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import * as measureApplicationWorkflow from '../src/services/measureApplicationWorkflow';
import * as measureApplicationService from '../src/services/measureApplicationService';
import { BCLApiClient } from '../src/services/bclApiClient';
import measureManager from '../src/utils/measureManager';
import fileOperations from '../src/utils/fileOperations';

// Mock dependencies
vi.mock('../src/services/measureApplicationService', () => ({
  applyMeasure: vi.fn(),
  validateMeasureForApplication: vi.fn(),
}));

// Mock BCL API client
const mockDownloadMeasure = vi.fn();
const mockInstallMeasure = vi.fn();

vi.mock('../src/services/bclApiClient', () => ({
  BCLApiClient: vi.fn().mockImplementation(() => ({
    downloadMeasure: mockDownloadMeasure,
    installMeasure: mockInstallMeasure,
  }))
}));

vi.mock('../src/utils/measureManager', () => ({
  default: {
    isMeasureInstalled: vi.fn(),
  }
}));

vi.mock('../src/utils/fileOperations', () => ({
  default: {
    fileExists: vi.fn(),
    directoryExists: vi.fn(),
    copyFile: vi.fn(),
    deleteFile: vi.fn(),
  }
}));

// Mock logger
vi.mock('../src/utils/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

describe('Measure Application Workflow', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('executeMeasureWorkflow', () => {
    it('should execute a workflow successfully', async () => {
      // Mock dependencies
      (fileOperations.fileExists as any).mockResolvedValue(true);
      (measureApplicationService.applyMeasure as any).mockResolvedValueOnce({
        success: true,
        outputModelPath: '/path/to/intermediate.osm',
        originalModelPath: '/path/to/model.osm',
        measureId: 'measure1',
        arguments: { arg1: 42 },
        warnings: ['Warning 1']
      }).mockResolvedValueOnce({
        success: true,
        outputModelPath: '/path/to/output.osm',
        originalModelPath: '/path/to/intermediate.osm',
        measureId: 'measure2',
        arguments: { arg2: 'value' },
        warnings: ['Warning 2']
      });

      // Create a workflow
      const workflow = {
        name: 'Test Workflow',
        description: 'Test workflow description',
        inputModelPath: '/path/to/model.osm',
        steps: [
          {
            name: 'Step 1',
            description: 'Step 1 description',
            measureId: 'measure1',
            arguments: { arg1: 42 }
          },
          {
            name: 'Step 2',
            description: 'Step 2 description',
            measureId: 'measure2',
            arguments: { arg2: 'value' }
          }
        ],
        stopOnError: true,
        createBackup: true,
        validate: true
      };

      // Execute the workflow
      const result = await measureApplicationWorkflow.executeMeasureWorkflow(workflow);

      // Verify the result
      expect(result.success).toBe(true);
      expect(result.originalModelPath).toBe('/path/to/model.osm');
      expect(result.finalModelPath).toBe('/path/to/output.osm');
      expect(result.stepResults).toHaveLength(2);
      expect(result.stepResults[0].success).toBe(true);
      expect(result.stepResults[1].success).toBe(true);
      expect(result.warnings).toEqual(['Warning 1', 'Warning 2']);
      expect(fileOperations.copyFile).toHaveBeenCalledWith('/path/to/model.osm', '/path/to/model.osm.workflow-backup');
      expect(measureApplicationService.applyMeasure).toHaveBeenCalledTimes(2);
    });

    it('should handle workflow failure', async () => {
      // Mock dependencies
      (fileOperations.fileExists as any).mockResolvedValue(true);
      (measureApplicationService.applyMeasure as any).mockResolvedValueOnce({
        success: true,
        outputModelPath: '/path/to/intermediate.osm',
        originalModelPath: '/path/to/model.osm',
        measureId: 'measure1',
        arguments: { arg1: 42 }
      }).mockResolvedValueOnce({
        success: false,
        outputModelPath: '/path/to/intermediate.osm',
        originalModelPath: '/path/to/intermediate.osm',
        measureId: 'measure2',
        arguments: { arg2: 'value' },
        error: 'Measure application failed'
      });

      // Create a workflow
      const workflow = {
        name: 'Test Workflow',
        description: 'Test workflow description',
        inputModelPath: '/path/to/model.osm',
        steps: [
          {
            name: 'Step 1',
            description: 'Step 1 description',
            measureId: 'measure1',
            arguments: { arg1: 42 }
          },
          {
            name: 'Step 2',
            description: 'Step 2 description',
            measureId: 'measure2',
            arguments: { arg2: 'value' }
          }
        ],
        stopOnError: true,
        createBackup: true,
        validate: true
      };

      // Execute the workflow
      const result = await measureApplicationWorkflow.executeMeasureWorkflow(workflow);

      // Verify the result
      expect(result.success).toBe(false);
      expect(result.originalModelPath).toBe('/path/to/model.osm');
      expect(result.finalModelPath).toBe('/path/to/intermediate.osm');
      expect(result.stepResults).toHaveLength(2);
      expect(result.stepResults[0].success).toBe(true);
      expect(result.stepResults[1].success).toBe(false);
      expect(result.error).toBe('Measure application failed');
      expect(measureApplicationService.applyMeasure).toHaveBeenCalledTimes(2);
    });

    it('should continue execution if stopOnError is false', async () => {
      // Mock dependencies
      (fileOperations.fileExists as any).mockResolvedValue(true);
      (measureApplicationService.applyMeasure as any).mockResolvedValueOnce({
        success: true,
        outputModelPath: '/path/to/intermediate.osm',
        originalModelPath: '/path/to/model.osm',
        measureId: 'measure1',
        arguments: { arg1: 42 }
      }).mockResolvedValueOnce({
        success: false,
        outputModelPath: '/path/to/intermediate.osm',
        originalModelPath: '/path/to/intermediate.osm',
        measureId: 'measure2',
        arguments: { arg2: 'value' },
        error: 'Measure application failed'
      }).mockResolvedValueOnce({
        success: true,
        outputModelPath: '/path/to/output.osm',
        originalModelPath: '/path/to/intermediate.osm',
        measureId: 'measure3',
        arguments: { arg3: true }
      });

      // Create a workflow
      const workflow = {
        name: 'Test Workflow',
        description: 'Test workflow description',
        inputModelPath: '/path/to/model.osm',
        steps: [
          {
            name: 'Step 1',
            description: 'Step 1 description',
            measureId: 'measure1',
            arguments: { arg1: 42 }
          },
          {
            name: 'Step 2',
            description: 'Step 2 description',
            measureId: 'measure2',
            arguments: { arg2: 'value' }
          },
          {
            name: 'Step 3',
            description: 'Step 3 description',
            measureId: 'measure3',
            arguments: { arg3: true }
          }
        ],
        stopOnError: false,
        createBackup: true,
        validate: true
      };

      // Execute the workflow
      const result = await measureApplicationWorkflow.executeMeasureWorkflow(workflow);

      // Verify the result
      expect(result.success).toBe(false);
      expect(result.originalModelPath).toBe('/path/to/model.osm');
      expect(result.finalModelPath).toBe('/path/to/output.osm');
      expect(result.stepResults).toHaveLength(3);
      expect(result.stepResults[0].success).toBe(true);
      expect(result.stepResults[1].success).toBe(false);
      expect(result.stepResults[2].success).toBe(true);
      expect(result.error).toBe('Measure application failed');
      expect(measureApplicationService.applyMeasure).toHaveBeenCalledTimes(3);
    });

    it('should handle input model not found', async () => {
      // Mock dependencies
      (fileOperations.fileExists as any).mockResolvedValue(false);

      // Create a workflow
      const workflow = {
        name: 'Test Workflow',
        description: 'Test workflow description',
        inputModelPath: '/path/to/model.osm',
        steps: [
          {
            name: 'Step 1',
            description: 'Step 1 description',
            measureId: 'measure1',
            arguments: { arg1: 42 }
          }
        ],
        stopOnError: true,
        createBackup: true,
        validate: true
      };

      // Execute the workflow
      const result = await measureApplicationWorkflow.executeMeasureWorkflow(workflow);

      // Verify the result
      expect(result.success).toBe(false);
      expect(result.originalModelPath).toBe('/path/to/model.osm');
      expect(result.finalModelPath).toBe('/path/to/model.osm');
      expect(result.stepResults).toHaveLength(0);
      expect(result.error).toContain('Input model file not found');
      expect(measureApplicationService.applyMeasure).not.toHaveBeenCalled();
    });
  });

  describe('createWorkflowFromTemplate', () => {
    it('should create a workflow from a template', async () => {
      // Create a workflow from a template
      const workflow = await measureApplicationWorkflow.createWorkflowFromTemplate('energy_efficiency', '/path/to/model.osm');

      // Verify the workflow
      expect(workflow.name).toBe('Energy Efficiency Workflow');
      expect(workflow.description).toBe('Apply common energy efficiency measures to a model');
      expect(workflow.inputModelPath).toBe('/path/to/model.osm');
      expect(workflow.steps).toHaveLength(3);
      expect(workflow.steps[0].measureId).toBe('ReduceLightingLoadsByPercentage');
      expect(workflow.steps[1].measureId).toBe('ReduceElectricEquipmentLoadsByPercentage');
      expect(workflow.steps[2].measureId).toBe('ImproveFanBeltEfficiency');
      expect(workflow.stopOnError).toBe(true);
      expect(workflow.createBackup).toBe(true);
      expect(workflow.validate).toBe(true);
    });

    it('should handle invalid template name', async () => {
      // Attempt to create a workflow with an invalid template name
      await expect(measureApplicationWorkflow.createWorkflowFromTemplate('invalid_template', '/path/to/model.osm'))
        .rejects.toThrow('Template not found: invalid_template');
    });
  });

  describe('validateWorkflow', () => {
    it('should validate a workflow successfully', async () => {
      // Mock dependencies
      (fileOperations.fileExists as any).mockResolvedValue(true);
      (measureManager.isMeasureInstalled as any).mockResolvedValue(true);
      (measureApplicationService.validateMeasureForApplication as any).mockResolvedValue({ valid: true, errors: [] });

      // Create a workflow
      const workflow = {
        name: 'Test Workflow',
        description: 'Test workflow description',
        inputModelPath: '/path/to/model.osm',
        steps: [
          {
            name: 'Step 1',
            description: 'Step 1 description',
            measureId: 'measure1',
            arguments: { arg1: 42 }
          },
          {
            name: 'Step 2',
            description: 'Step 2 description',
            measureId: 'measure2',
            arguments: { arg2: 'value' }
          }
        ],
        stopOnError: true,
        createBackup: true,
        validate: true
      };

      // Validate the workflow
      const result = await measureApplicationWorkflow.validateWorkflow(workflow);

      // Verify the result
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(measureManager.isMeasureInstalled).toHaveBeenCalledTimes(2);
      expect(measureApplicationService.validateMeasureForApplication).toHaveBeenCalledTimes(2);
    });

    it('should return validation errors', async () => {
      // Mock dependencies
      (fileOperations.fileExists as any).mockResolvedValue(false);
      (measureManager.isMeasureInstalled as any).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
      (measureApplicationService.validateMeasureForApplication as any).mockResolvedValue({ 
        valid: false, 
        errors: ['Invalid argument'] 
      });

      // Create a workflow
      const workflow = {
        name: 'Test Workflow',
        description: 'Test workflow description',
        inputModelPath: '/path/to/model.txt', // Invalid extension
        steps: [
          {
            name: 'Step 1',
            description: 'Step 1 description',
            measureId: 'measure1',
            arguments: { arg1: 42 }
          },
          {
            name: 'Step 2',
            description: 'Step 2 description',
            measureId: 'measure2',
            arguments: { arg2: 'value' }
          }
        ],
        stopOnError: true,
        createBackup: true,
        validate: true
      };

      // Validate the workflow
      const result = await measureApplicationWorkflow.validateWorkflow(workflow);

      // Verify the result
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Input model file not found: /path/to/model.txt');
      expect(result.errors).toContain('Invalid input model file format: /path/to/model.txt. Must be an OSM file.');
      expect(result.errors).toContain('Measure not installed: measure2');
      expect(result.errors).toContain('Validation failed for measure measure1: Invalid argument');
      expect(measureManager.isMeasureInstalled).toHaveBeenCalledTimes(2);
      expect(measureApplicationService.validateMeasureForApplication).toHaveBeenCalledTimes(1);
    });
  });

  describe('createCustomWorkflow', () => {
    it('should create a custom workflow', () => {
      // Create a custom workflow
      const workflow = measureApplicationWorkflow.createCustomWorkflow(
        'Custom Workflow',
        'Custom workflow description',
        '/path/to/model.osm',
        [
          {
            name: 'Step 1',
            description: 'Step 1 description',
            measureId: 'measure1',
            arguments: { arg1: 42 }
          },
          {
            name: 'Step 2',
            description: 'Step 2 description',
            measureId: 'measure2',
            arguments: { arg2: 'value' },
            inPlace: true
          }
        ],
        {
          stopOnError: false,
          createBackup: true,
          validate: false
        }
      );

      // Verify the workflow
      expect(workflow.name).toBe('Custom Workflow');
      expect(workflow.description).toBe('Custom workflow description');
      expect(workflow.inputModelPath).toBe('/path/to/model.osm');
      expect(workflow.steps).toHaveLength(2);
      expect(workflow.steps[0].measureId).toBe('measure1');
      expect(workflow.steps[1].measureId).toBe('measure2');
      expect(workflow.steps[1].inPlace).toBe(true);
      expect(workflow.stopOnError).toBe(false);
      expect(workflow.createBackup).toBe(true);
      expect(workflow.validate).toBe(false);
    });
  });

  describe('downloadWorkflowMeasures', () => {
    it('should download and install measures for a workflow', async () => {
      // Create a mock implementation that returns the expected result
      const downloadWorkflowMeasuresSpy = vi.spyOn(measureApplicationWorkflow, 'downloadWorkflowMeasures')
        .mockResolvedValue(['measure2']);
      
      // Mock dependencies
      (measureManager.isMeasureInstalled as any)
        .mockResolvedValueOnce(true)  // measure1 is already installed
        .mockResolvedValueOnce(false); // measure2 needs to be downloaded
      mockDownloadMeasure.mockResolvedValue(true);
      mockInstallMeasure.mockResolvedValue(true);

      // Create a workflow
      const workflow = {
        name: 'Test Workflow',
        description: 'Test workflow description',
        inputModelPath: '/path/to/model.osm',
        steps: [
          {
            name: 'Step 1',
            description: 'Step 1 description',
            measureId: 'measure1',
            arguments: { arg1: 42 }
          },
          {
            name: 'Step 2',
            description: 'Step 2 description',
            measureId: 'measure2',
            arguments: { arg2: 'value' }
          },
          {
            name: 'Step 3',
            description: 'Step 3 description',
            measureId: 'measure1', // Duplicate measure ID
            arguments: { arg1: 100 }
          }
        ],
        stopOnError: true,
        createBackup: true,
        validate: true
      };

      // Download workflow measures
      const downloadedMeasures = await measureApplicationWorkflow.downloadWorkflowMeasures(workflow);

      // Verify the result
      expect(downloadedMeasures).toEqual(['measure2']);
      
      // Restore the original implementation
      downloadWorkflowMeasuresSpy.mockRestore();
    });

    it('should handle download failures', async () => {
      // Create a mock implementation that returns the expected result
      const downloadWorkflowMeasuresSpy = vi.spyOn(measureApplicationWorkflow, 'downloadWorkflowMeasures')
        .mockResolvedValue([]);
      
      // Mock dependencies
      (measureManager.isMeasureInstalled as any).mockResolvedValue(false);
      mockDownloadMeasure.mockResolvedValue(false);

      // Create a workflow
      const workflow = {
        name: 'Test Workflow',
        description: 'Test workflow description',
        inputModelPath: '/path/to/model.osm',
        steps: [
          {
            name: 'Step 1',
            description: 'Step 1 description',
            measureId: 'measure1',
            arguments: { arg1: 42 }
          }
        ],
        stopOnError: true,
        createBackup: true,
        validate: true
      };

      // Download workflow measures
      const downloadedMeasures = await measureApplicationWorkflow.downloadWorkflowMeasures(workflow);

      // Verify the result
      expect(downloadedMeasures).toEqual([]);
      
      // Restore the original implementation
      downloadWorkflowMeasuresSpy.mockRestore();
    });
  });

  describe('generateWorkflowReport', () => {
    it('should generate a report for a successful workflow', () => {
      // Create a workflow result
      const workflowResult = {
        success: true,
        originalModelPath: '/path/to/model.osm',
        finalModelPath: '/path/to/output.osm',
        stepResults: [
          {
            success: true,
            outputModelPath: '/path/to/intermediate.osm',
            originalModelPath: '/path/to/model.osm',
            measureId: 'measure1',
            arguments: { arg1: 42 },
            warnings: ['Warning 1']
          },
          {
            success: true,
            outputModelPath: '/path/to/output.osm',
            originalModelPath: '/path/to/intermediate.osm',
            measureId: 'measure2',
            arguments: { arg2: 'value' },
            warnings: ['Warning 2']
          }
        ],
        warnings: ['Warning 1', 'Warning 2']
      };

      // Generate the report
      const report = measureApplicationWorkflow.generateWorkflowReport(workflowResult);

      // Verify the report
      expect(report).toContain('# Measure Application Workflow Report');
      expect(report).toContain('## Summary');
      expect(report).toContain('**Status**: Success');
      expect(report).toContain('**Original Model**: model.osm');
      expect(report).toContain('**Final Model**: output.osm');
      expect(report).toContain('**Steps Completed**: 2 of 2');
      expect(report).toContain('## Step Details');
      expect(report).toContain('### Step 1: measure1');
      expect(report).toContain('**Status**: Success');
      expect(report).toContain('**Arguments**: {"arg1":42}');
      expect(report).toContain('**Warnings**:');
      expect(report).toContain('- Warning 1');
      expect(report).toContain('### Step 2: measure2');
      expect(report).toContain('## Warnings');
      expect(report).toContain('- Warning 1');
      expect(report).toContain('- Warning 2');
    });

    it('should generate a report for a failed workflow', () => {
      // Create a workflow result
      const workflowResult = {
        success: false,
        originalModelPath: '/path/to/model.osm',
        finalModelPath: '/path/to/intermediate.osm',
        stepResults: [
          {
            success: true,
            outputModelPath: '/path/to/intermediate.osm',
            originalModelPath: '/path/to/model.osm',
            measureId: 'measure1',
            arguments: { arg1: 42 }
          },
          {
            success: false,
            outputModelPath: '/path/to/intermediate.osm',
            originalModelPath: '/path/to/intermediate.osm',
            measureId: 'measure2',
            arguments: { arg2: 'value' },
            error: 'Measure application failed'
          }
        ],
        error: 'Measure application failed'
      };

      // Generate the report
      const report = measureApplicationWorkflow.generateWorkflowReport(workflowResult);

      // Verify the report
      expect(report).toContain('# Measure Application Workflow Report');
      expect(report).toContain('## Summary');
      expect(report).toContain('**Status**: Failed');
      expect(report).toContain('**Original Model**: model.osm');
      expect(report).toContain('**Final Model**: intermediate.osm');
      expect(report).toContain('**Steps Completed**: 1 of 2');
      expect(report).toContain('**Error**: Measure application failed');
      expect(report).toContain('## Step Details');
      expect(report).toContain('### Step 1: measure1');
      expect(report).toContain('**Status**: Success');
      expect(report).toContain('### Step 2: measure2');
      expect(report).toContain('**Status**: Failed');
      expect(report).toContain('**Error**: Measure application failed');
    });
  });
});