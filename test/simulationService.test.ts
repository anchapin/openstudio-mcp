/**
 * Simulation service tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';

// Mock dependencies before importing the module
vi.mock('../src/utils/openStudioCommands', () => ({
  runSimulation: vi.fn(),
  getModelInfo: vi.fn()
}));

vi.mock('../src/utils/resourceMonitor', () => ({
  resourceMonitor: {
    getProcessResourceUsage: vi.fn()
  },
  createResourceMonitor: vi.fn()
}));

vi.mock('../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('fs');

// Now import the module under test
import simulationService, { SimulationStatus } from '../src/services/simulationService';
import { openStudioCommands } from '../src/utils';

// Import fs after mocking
const fs = require('fs');

describe('Simulation Service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    
    // Default mock implementations
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue('');
    
    (openStudioCommands.runSimulation as any).mockResolvedValue({
      success: true,
      output: 'Simulation completed successfully',
      data: {
        errors: [],
        warnings: [],
        eui: 120.5,
        totalSiteEnergy: 500.2,
        electricityConsumption: 45000
      }
    });
    
    (openStudioCommands.getModelInfo as any).mockResolvedValue({
      success: true,
      data: {
        spaces: 10,
        thermalZones: 5,
        weatherFile: '/path/to/weather.epw'
      }
    });
  });
  
  describe('runSimulation', () => {
    it('should run a simulation with minimal parameters', async () => {
      const result = await simulationService.runSimulation({
        modelPath: '/path/to/model.osm'
      });
      
      expect(result.status).toBe(SimulationStatus.COMPLETE);
      expect(result.parameters.modelPath).toBe('/path/to/model.osm');
      expect(result.eui).toBe(120.5);
      expect(result.totalSiteEnergy).toBe(500.2);
      expect(result.electricityConsumption).toBe(45000);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
      
      expect(openStudioCommands.runSimulation).toHaveBeenCalledWith(
        '/path/to/model.osm',
        undefined,
        undefined
      );
    });
    
    it('should handle simulation failure', async () => {
      (openStudioCommands.runSimulation as any).mockResolvedValue({
        success: false,
        output: 'Simulation failed',
        error: 'Error running simulation'
      });
      
      const result = await simulationService.runSimulation({
        modelPath: '/path/to/model.osm'
      });
      
      expect(result.status).toBe(SimulationStatus.FAILED);
      expect(result.error).toBe('Error running simulation');
    });
    
    it('should handle exceptions during simulation', async () => {
      (openStudioCommands.runSimulation as any).mockRejectedValue(new Error('Unexpected error'));
      
      const result = await simulationService.runSimulation({
        modelPath: '/path/to/model.osm'
      });
      
      expect(result.status).toBe(SimulationStatus.FAILED);
      expect(result.error).toBe('Unexpected error');
    });
  });
  
  describe('configureSimulationParameters', () => {
    it('should configure parameters for a simple model', async () => {
      const parameters = await simulationService.configureSimulationParameters('/path/to/model.osm');
      
      expect(parameters.modelPath).toBe('/path/to/model.osm');
      expect(parameters.weatherFile).toBe('/path/to/weather.epw');
      expect(parameters.outputDirectory).toBe(path.join(path.dirname('/path/to/model.osm'), 'run'));
      expect(parameters.options?.timeout).toBe(600000);
      expect(parameters.options?.memoryLimit).toBe(4096);
      expect(parameters.options?.parallel).toBeUndefined();
    });
    
    it('should configure parameters for a complex model', async () => {
      (openStudioCommands.getModelInfo as any).mockResolvedValue({
        success: true,
        data: {
          spaces: 100,
          thermalZones: 50,
          weatherFile: '/path/to/weather.epw'
        }
      });
      
      const parameters = await simulationService.configureSimulationParameters('/path/to/model.osm');
      
      expect(parameters.modelPath).toBe('/path/to/model.osm');
      expect(parameters.weatherFile).toBe('/path/to/weather.epw');
      expect(parameters.options?.parallel).toBe(true);
      expect(parameters.options?.timeout).toBe(1800000);
      expect(parameters.options?.memoryLimit).toBe(8192);
      expect(typeof parameters.options?.jobs).toBe('number');
    });
    
    it('should handle errors and return default parameters', async () => {
      (openStudioCommands.getModelInfo as any).mockRejectedValue(new Error('Failed to get model info'));
      
      const parameters = await simulationService.configureSimulationParameters('/path/to/model.osm');
      
      expect(parameters.modelPath).toBe('/path/to/model.osm');
      expect(parameters.options?.timeout).toBe(600000);
      expect(parameters.options?.memoryLimit).toBe(4096);
    });
  });
});