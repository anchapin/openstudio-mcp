/**
 * Visualization Helpers
 * 
 * This module provides helper functions for formatting simulation results
 * and other data for visualization purposes.
 */
import { SimulationResult } from '../services/simulationService';

/**
 * Energy consumption by fuel type
 */
export interface EnergyConsumptionByFuelType {
  /** Labels for the chart (fuel types) */
  labels: string[];
  /** Values for the chart (energy consumption) */
  values: number[];
  /** Units for the values */
  units: string[];
  /** Colors for each fuel type */
  colors: string[];
}

/**
 * Monthly energy consumption
 */
export interface MonthlyEnergyConsumption {
  /** Labels for the chart (months) */
  labels: string[];
  /** Series data for the chart */
  series: {
    /** Name of the series */
    name: string;
    /** Values for the series */
    values: number[];
    /** Color for the series */
    color: string;
  }[];
  /** Units for the values */
  units: string;
}

/**
 * Energy use breakdown
 */
export interface EnergyUseBreakdown {
  /** Labels for the chart (end uses) */
  labels: string[];
  /** Values for the chart (energy consumption) */
  values: number[];
  /** Units for the values */
  units: string;
  /** Colors for each end use */
  colors: string[];
}

/**
 * Simulation summary
 */
export interface SimulationSummary {
  /** Building name */
  buildingName: string;
  /** Floor area in square meters */
  floorArea?: number;
  /** Energy use intensity (EUI) in kWh/m²/year */
  eui?: number;
  /** Total site energy in GJ */
  totalSiteEnergy?: number;
  /** Total source energy in GJ */
  totalSourceEnergy?: number;
  /** Annual electricity consumption in kWh */
  electricityConsumption?: number;
  /** Annual natural gas consumption in GJ */
  naturalGasConsumption?: number;
  /** Annual district heating consumption in GJ */
  districtHeatingConsumption?: number;
  /** Annual district cooling consumption in GJ */
  districtCoolingConsumption?: number;
  /** Simulation duration in milliseconds */
  simulationDuration?: number;
  /** Number of warnings */
  warningCount: number;
  /** Number of errors */
  errorCount: number;
}

/**
 * Format energy consumption by fuel type for visualization
 * @param simulationResult Simulation result
 * @returns Energy consumption by fuel type formatted for visualization
 */
export function formatEnergyConsumptionByFuelType(simulationResult: SimulationResult): EnergyConsumptionByFuelType {
  const labels: string[] = [];
  const values: number[] = [];
  const units: string[] = [];
  const colors: string[] = [];

  // Add electricity if available
  if (simulationResult.electricityConsumption !== undefined) {
    labels.push('Electricity');
    values.push(simulationResult.electricityConsumption);
    units.push('kWh');
    colors.push('#4e79a7'); // Blue
  }

  // Add natural gas if available
  if (simulationResult.naturalGasConsumption !== undefined) {
    labels.push('Natural Gas');
    values.push(simulationResult.naturalGasConsumption);
    units.push('GJ');
    colors.push('#f28e2c'); // Orange
  }

  // Add district heating if available
  if (simulationResult.districtHeatingConsumption !== undefined) {
    labels.push('District Heating');
    values.push(simulationResult.districtHeatingConsumption);
    units.push('GJ');
    colors.push('#e15759'); // Red
  }

  // Add district cooling if available
  if (simulationResult.districtCoolingConsumption !== undefined) {
    labels.push('District Cooling');
    values.push(simulationResult.districtCoolingConsumption);
    units.push('GJ');
    colors.push('#76b7b2'); // Teal
  }

  return {
    labels,
    values,
    units,
    colors
  };
}

/**
 * Format simulation summary for visualization
 * @param simulationResult Simulation result
 * @returns Simulation summary formatted for visualization
 */
export function formatSimulationSummary(simulationResult: SimulationResult): SimulationSummary {
  return {
    buildingName: 'Building', // This would ideally come from the model
    floorArea: 0, // This would ideally come from the model
    eui: simulationResult.eui,
    totalSiteEnergy: simulationResult.totalSiteEnergy,
    totalSourceEnergy: simulationResult.totalSourceEnergy,
    electricityConsumption: simulationResult.electricityConsumption,
    naturalGasConsumption: simulationResult.naturalGasConsumption,
    districtHeatingConsumption: simulationResult.districtHeatingConsumption,
    districtCoolingConsumption: simulationResult.districtCoolingConsumption,
    simulationDuration: simulationResult.duration,
    warningCount: simulationResult.warnings.length,
    errorCount: simulationResult.errors.length
  };
}

/**
 * Generate HTML for a simulation results dashboard
 * @param simulationResult Simulation result
 * @returns HTML string for the dashboard
 */
export function generateSimulationDashboardHTML(simulationResult: SimulationResult): string {
  const summary = formatSimulationSummary(simulationResult);
  const energyByFuelType = formatEnergyConsumptionByFuelType(simulationResult);
  
  // Create a simple HTML dashboard
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Simulation Results Dashboard</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 20px;
      color: #333;
    }
    .dashboard {
      max-width: 1200px;
      margin: 0 auto;
    }
    .header {
      background-color: #f5f5f5;
      padding: 20px;
      border-radius: 5px;
      margin-bottom: 20px;
    }
    .summary-cards {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      margin-bottom: 20px;
    }
    .card {
      background-color: white;
      border-radius: 5px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
      padding: 20px;
      flex: 1;
      min-width: 200px;
    }
    .card h3 {
      margin-top: 0;
      color: #555;
      font-size: 16px;
    }
    .card .value {
      font-size: 24px;
      font-weight: bold;
      margin: 10px 0;
    }
    .card .unit {
      font-size: 14px;
      color: #777;
    }
    .chart-container {
      background-color: white;
      border-radius: 5px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
      padding: 20px;
      margin-bottom: 20px;
    }
    .status {
      display: inline-block;
      padding: 5px 10px;
      border-radius: 3px;
      font-size: 14px;
      font-weight: bold;
    }
    .status.success {
      background-color: #d4edda;
      color: #155724;
    }
    .status.warning {
      background-color: #fff3cd;
      color: #856404;
    }
    .status.error {
      background-color: #f8d7da;
      color: #721c24;
    }
    .warnings-errors {
      background-color: white;
      border-radius: 5px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
      padding: 20px;
      margin-bottom: 20px;
    }
    .warnings-errors h2 {
      margin-top: 0;
    }
    .warnings-errors ul {
      padding-left: 20px;
    }
    .warnings-errors li {
      margin-bottom: 5px;
    }
  </style>
</head>
<body>
  <div class="dashboard">
    <div class="header">
      <h1>Simulation Results Dashboard</h1>
      <p>
        Status: 
        <span class="status ${simulationResult.status === 'complete' ? 'success' : simulationResult.status === 'failed' ? 'error' : 'warning'}">
          ${simulationResult.status}
        </span>
      </p>
      <p>Simulation ID: ${simulationResult.id}</p>
      <p>Duration: ${summary.simulationDuration ? (summary.simulationDuration / 1000).toFixed(2) + ' seconds' : 'N/A'}</p>
    </div>

    <div class="summary-cards">
      ${summary.eui !== undefined ? `
      <div class="card">
        <h3>Energy Use Intensity</h3>
        <div class="value">${summary.eui.toFixed(2)}</div>
        <div class="unit">kWh/m²/year</div>
      </div>
      ` : ''}

      ${summary.totalSiteEnergy !== undefined ? `
      <div class="card">
        <h3>Total Site Energy</h3>
        <div class="value">${summary.totalSiteEnergy.toFixed(2)}</div>
        <div class="unit">GJ</div>
      </div>
      ` : ''}

      ${summary.electricityConsumption !== undefined ? `
      <div class="card">
        <h3>Electricity Consumption</h3>
        <div class="value">${summary.electricityConsumption.toFixed(2)}</div>
        <div class="unit">kWh</div>
      </div>
      ` : ''}

      ${summary.naturalGasConsumption !== undefined ? `
      <div class="card">
        <h3>Natural Gas Consumption</h3>
        <div class="value">${summary.naturalGasConsumption.toFixed(2)}</div>
        <div class="unit">GJ</div>
      </div>
      ` : ''}
    </div>

    ${energyByFuelType.labels.length > 0 ? `
    <div class="chart-container">
      <h2>Energy Consumption by Fuel Type</h2>
      <div id="energy-by-fuel-type-chart" style="height: 400px;"></div>
    </div>
    ` : ''}

    ${simulationResult.warnings.length > 0 || simulationResult.errors.length > 0 ? `
    <div class="warnings-errors">
      ${simulationResult.warnings.length > 0 ? `
      <h2>Warnings (${simulationResult.warnings.length})</h2>
      <ul>
        ${simulationResult.warnings.map(warning => `<li>${warning}</li>`).join('')}
      </ul>
      ` : ''}

      ${simulationResult.errors.length > 0 ? `
      <h2>Errors (${simulationResult.errors.length})</h2>
      <ul>
        ${simulationResult.errors.map(error => `<li>${error}</li>`).join('')}
      </ul>
      ` : ''}
    </div>
    ` : ''}
  </div>

  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script>
    // Energy by fuel type chart
    ${energyByFuelType.labels.length > 0 ? `
    const energyByFuelTypeCtx = document.getElementById('energy-by-fuel-type-chart').getContext('2d');
    new Chart(energyByFuelTypeCtx, {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(energyByFuelType.labels)},
        datasets: [{
          label: 'Energy Consumption',
          data: ${JSON.stringify(energyByFuelType.values)},
          backgroundColor: ${JSON.stringify(energyByFuelType.colors)},
          borderColor: ${JSON.stringify(energyByFuelType.colors.map(color => color))},
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Energy Consumption'
            }
          }
        }
      }
    });
    ` : ''}
  </script>
</body>
</html>
  `;
}

/**
 * Format simulation results as JSON for API responses
 * @param simulationResult Simulation result
 * @returns Formatted simulation result for API response
 */
export function formatSimulationResultForAPI(simulationResult: SimulationResult): any {
  const summary = formatSimulationSummary(simulationResult);
  const energyByFuelType = formatEnergyConsumptionByFuelType(simulationResult);

  return {
    id: simulationResult.id,
    status: simulationResult.status,
    duration: simulationResult.duration,
    startTime: simulationResult.startTime,
    endTime: simulationResult.endTime,
    summary: {
      eui: summary.eui,
      totalSiteEnergy: summary.totalSiteEnergy,
      totalSourceEnergy: summary.totalSourceEnergy,
      electricityConsumption: summary.electricityConsumption,
      naturalGasConsumption: summary.naturalGasConsumption,
      districtHeatingConsumption: summary.districtHeatingConsumption,
      districtCoolingConsumption: summary.districtCoolingConsumption,
      warningCount: summary.warningCount,
      errorCount: summary.errorCount
    },
    energyByFuelType: {
      labels: energyByFuelType.labels,
      values: energyByFuelType.values,
      units: energyByFuelType.units
    },
    warnings: simulationResult.warnings,
    errors: simulationResult.errors
  };
}

/**
 * Generate CSV data for simulation results
 * @param simulationResult Simulation result
 * @returns CSV string
 */
export function generateSimulationResultsCSV(simulationResult: SimulationResult): string {
  const summary = formatSimulationSummary(simulationResult);
  
  // Create CSV header
  let csv = 'Metric,Value,Unit\n';
  
  // Add summary metrics
  if (summary.eui !== undefined) {
    csv += `Energy Use Intensity,${summary.eui},kWh/m²/year\n`;
  }
  
  if (summary.totalSiteEnergy !== undefined) {
    csv += `Total Site Energy,${summary.totalSiteEnergy},GJ\n`;
  }
  
  if (summary.totalSourceEnergy !== undefined) {
    csv += `Total Source Energy,${summary.totalSourceEnergy},GJ\n`;
  }
  
  if (summary.electricityConsumption !== undefined) {
    csv += `Electricity Consumption,${summary.electricityConsumption},kWh\n`;
  }
  
  if (summary.naturalGasConsumption !== undefined) {
    csv += `Natural Gas Consumption,${summary.naturalGasConsumption},GJ\n`;
  }
  
  if (summary.districtHeatingConsumption !== undefined) {
    csv += `District Heating Consumption,${summary.districtHeatingConsumption},GJ\n`;
  }
  
  if (summary.districtCoolingConsumption !== undefined) {
    csv += `District Cooling Consumption,${summary.districtCoolingConsumption},GJ\n`;
  }
  
  return csv;
}

export default {
  formatEnergyConsumptionByFuelType,
  formatSimulationSummary,
  generateSimulationDashboardHTML,
  formatSimulationResultForAPI,
  generateSimulationResultsCSV
};