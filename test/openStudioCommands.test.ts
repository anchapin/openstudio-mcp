/**\n * OpenStudio commands tests\n */
import { describe, it, expect } from 'vitest';

describe('OpenStudio Commands', () => {
  it('should export createModel function', async () => {
    const module = await import('../src/utils/openStudioCommands');
    expect(typeof module.createModel).toBe('function');
  });

  it('should export runSimulation function', async () => {
    const module = await import('../src/utils/openStudioCommands');
    expect(typeof module.runSimulation).toBe('function');
  });

  it('should export applyMeasure function', async () => {
    const module = await import('../src/utils/openStudioCommands');
    expect(typeof module.applyMeasure).toBe('function');
  });
});
