import { describe, it, expect } from 'vitest';
import { 
  formatEnergyConsumptionByFuelType, 
  formatSimulationSummary, 
  generateSimulationDashboardHTML,
  formatSimulationResultForAPI,
  generateSimulationResultsCSV
} from '../src/utils/visualizationHelpers';
import { SimulationResult, SimulationStatus } from '../src/services/simulationService';

describe('Visualization Helpers', () => {
  // Create a mock simulation result for testing
  const mockSimulationResult: SimulationResult = {
    id: 'sim-123456',
    status: SimulationStatus.COMPLETE,
    parameters: {
      modelPath: '/path/to/model.osm',
      outputDirectory: '/path/to/output'
    },
    startTime: new Date('2023-01-01T10:00:00Z'),
    endTime: new Date('2023-01-01T10:05:00Z'),
    duration: 300000, // 5 minutes
    outputDirectory: '/path/to/output',
    errors: ['Error 1', 'Error 2'],
    warnings: ['Warning 1'],
    eui: 120.5,
    totalSiteEnergy: 500.3,
    totalSourceEnergy: 750.8,
    electricityConsumption: 45000,
    naturalGasConsumption: 200.5,
    districtHeatingConsumption: 100.2,
    districtCoolingConsumption: 80.7,
    cpuUsage: 50,
    memoryUsage: 2048,
    output: 'Simulation output text'
  };

  describe('formatEnergyConsumptionByFuelType', () => {
    it('should format energy consumption by fuel type correctly', () => {
      const result = formatEnergyConsumptionByFuelType(mockSimulationResult);
      
      expect(result.labels).toEqual(['Electricity', 'Natural Gas', 'District Heating', 'District Cooling']);
      expect(result.values).toEqual([45000, 200.5, 100.2, 80.7]);
      expect(result.units).toEqual(['kWh', 'GJ', 'GJ', 'GJ']);
      expect(result.colors.length).toBe(4);
    });

    it('should handle missing energy consumption values', () => {
      const partialResult: SimulationResult = {
        ...mockSimulationResult,
        electricityConsumption: undefined,
        naturalGasConsumption: undefined
      };

      const result = formatEnergyConsumptionByFuelType(partialResult);
      
      expect(result.labels).toEqual(['District Heating', 'District Cooling']);
      expect(result.values).toEqual([100.2, 80.7]);
      expect(result.units).toEqual(['GJ', 'GJ']);
      expect(result.colors.length).toBe(2);
    });
  });

  describe('formatSimulationSummary', () => {
    it('should format simulation summary correctly', () => {
      const result = formatSimulationSummary(mockSimulationResult);
      
      expect(result.eui).toBe(120.5);
      expect(result.totalSiteEnergy).toBe(500.3);
      expect(result.totalSourceEnergy).toBe(750.8);
      expect(result.electricityConsumption).toBe(45000);
      expect(result.naturalGasConsumption).toBe(200.5);
      expect(result.districtHeatingConsumption).toBe(100.2);
      expect(result.districtCoolingConsumption).toBe(80.7);
      expect(result.simulationDuration).toBe(300000);
      expect(result.warningCount).toBe(1);
      expect(result.errorCount).toBe(2);
    });
  });

  describe('generateSimulationDashboardHTML', () => {
    it('should generate HTML dashboard', () => {
      const html = generateSimulationDashboardHTML(mockSimulationResult);
      
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Simulation Results Dashboard');
      expect(html).toContain('Energy Use Intensity');
      expect(html).toContain('120.50');
      expect(html).toContain('Total Site Energy');
      expect(html).toContain('500.30');
      expect(html).toContain('Electricity Consumption');
      expect(html).toContain('45000.00');
      expect(html).toContain('Natural Gas Consumption');
      expect(html).toContain('200.50');
      expect(html).toContain('Warnings (1)');
      expect(html).toContain('Errors (2)');
      expect(html).toContain('Warning 1');
      expect(html).toContain('Error 1');
      expect(html).toContain('Error 2');
    });
  });

  describe('formatSimulationResultForAPI', () => {
    it('should format simulation result for API response', () => {
      const result = formatSimulationResultForAPI(mockSimulationResult);
      
      expect(result.id).toBe('sim-123456');
      expect(result.status).toBe(SimulationStatus.COMPLETE);
      expect(result.duration).toBe(300000);
      expect(result.summary.eui).toBe(120.5);
      expect(result.summary.totalSiteEnergy).toBe(500.3);
      expect(result.summary.electricityConsumption).toBe(45000);
      expect(result.energyByFuelType.labels).toEqual(['Electricity', 'Natural Gas', 'District Heating', 'District Cooling']);
      expect(result.warnings).toEqual(['Warning 1']);
      expect(result.errors).toEqual(['Error 1', 'Error 2']);
    });
  });

  describe('generateSimulationResultsCSV', () => {
    it('should generate CSV data for simulation results', () => {
      const csv = generateSimulationResultsCSV(mockSimulationResult);
      
      expect(csv).toContain('Metric,Value,Unit');
      expect(csv).toContain('Energy Use Intensity,120.5,kWh/m²/year');
      expect(csv).toContain('Total Site Energy,500.3,GJ');
      expect(csv).toContain('Total Source Energy,750.8,GJ');
      expect(csv).toContain('Electricity Consumption,45000,kWh');
      expect(csv).toContain('Natural Gas Consumption,200.5,GJ');
      expect(csv).toContain('District Heating Consumption,100.2,GJ');
      expect(csv).toContain('District Cooling Consumption,80.7,GJ');
    });

    it('should handle missing values in CSV generation', () => {
      const partialResult: SimulationResult = {
        ...mockSimulationResult,
        eui: undefined,
        totalSiteEnergy: undefined
      };

      const csv = generateSimulationResultsCSV(partialResult);
      
      expect(csv).not.toContain('Energy Use Intensity');
      expect(csv).not.toContain('Total Site Energy');
      expect(csv).toContain('Total Source Energy,750.8,GJ');
      expect(csv).toContain('Electricity Consumption,45000,kWh');
    });
  });
});