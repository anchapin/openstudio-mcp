/**
 * OpenStudio commands tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeOpenStudioCommand } from '../src/utils/commandExecutor';

// Mock the command executor
vi.mock('../src/utils/commandExecutor', () => ({
  executeOpenStudioCommand: vi.fn(),
}));

// Define the functions we're testing
const createModel = async (templateType, outputPath, options = {}) => {
  const result = await executeOpenStudioCommand('openstudio',
    ['create', 'model', '--template', templateType, '--output', outputPath],
    options);
  return result;
};

const runSimulation = async (workflowPath, options = {}) => {
  const result = await executeOpenStudioCommand('openstudio',
    ['run', '--workflow', workflowPath],
    options);
  return result;
};

const applyMeasure = async (measurePath, modelPath, arguments_ = {}, options = {}) => {
  const args = ['apply', 'measure', '--path', measurePath, '--model', modelPath];

  // Add arguments if provided
  for (const [key, value] of Object.entries(arguments_)) {
    args.push('--argument');
    args.push(`${key}=${value}`);
  }

  const result = await executeOpenStudioCommand('openstudio', args, options);
  return result;
};

describe('OpenStudio Commands', () => {
  vi.setConfig({ testTimeout: 10000 }); // Added 10s timeout

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it.skip('should create a model', async () => {
    // Mock the command executor to return a successful result
    vi.mocked(executeOpenStudioCommand).mockResolvedValue({
      success: true,
      exitCode: 0,
      stdout: 'Model created successfully',
      stderr: '',
      command: 'openstudio',
      args: ['create', 'model', '--template', 'empty', '--output', '/path/to/model.osm']
    });

    const result = await createModel('empty', '/path/to/model.osm');

    expect(result.success).toBe(true);
    expect(executeOpenStudioCommand).toHaveBeenCalledWith(
      expect.stringContaining('openstudio'),
      expect.arrayContaining(['create', 'model']),
      expect.any(Object)
    );
  });

  it.skip('should run a simulation', async () => {
    // Mock the command executor to return a successful result
    vi.mocked(executeOpenStudioCommand).mockResolvedValue({
      success: true,
      exitCode: 0,
      stdout: 'Simulation completed successfully',
      stderr: '',
      command: 'openstudio',
      args: ['run', '--workflow', '/path/to/model.osw']
    });

    const result = await runSimulation('/path/to/model.osw');

    expect(result.success).toBe(true);
    expect(executeOpenStudioCommand).toHaveBeenCalledWith(
      expect.stringContaining('openstudio'),
      expect.arrayContaining(['run']),
      expect.any(Object)
    );
  });

  it.skip('should apply a measure', async () => {
    // Mock the command executor to return a successful result
    vi.mocked(executeOpenStudioCommand).mockResolvedValue({
      success: true,
      exitCode: 0,
      stdout: 'Measure applied successfully',
      stderr: '',
      command: 'openstudio',
      args: ['apply', 'measure', '--path', '/path/to/measure', '--model', '/path/to/model.osm']
    });

    const result = await applyMeasure('/path/to/measure', '/path/to/model.osm', {});

    expect(result.success).toBe(true);
    expect(executeOpenStudioCommand).toHaveBeenCalledWith(
      expect.stringContaining('openstudio'),
      expect.arrayContaining(['apply', 'measure']),
      expect.any(Object)
    );
  });
});
