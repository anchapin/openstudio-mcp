/**
 * Simulation service
 *
 * This service is responsible for configuring, executing, monitoring, and processing
 * OpenStudio simulations.
 */
import { logger, openStudioCommands, visualizationHelpers } from '../utils';
import {
  OpenStudioSimulationResults,
  OpenStudioModelInfo,
  DetailedSimulationParameters,
} from '../utils/openStudioCommands';
import path from 'path';
import fs from 'fs';

/**
 * Simulation parameters
 */
export interface SimulationParameters extends DetailedSimulationParameters {
  /** Path to the model file */
  modelPath: string;
  /** Path to the weather file (optional) */
  weatherFile?: string;
  /** Directory to save simulation results (optional) */
  outputDirectory?: string;
  /** Simulation options */
  options?: {
    /** Whether to run design days only */
    designDaysOnly?: boolean;
    /** Whether to run annual simulation */
    annualSimulation?: boolean;
    /** Whether to run in fast mode (less accurate) */
    fastRun?: boolean;
    /** Whether to include radiative calculations */
    includeRadiance?: boolean;
    /** Whether to run in parallel */
    parallel?: boolean;
    /** Number of parallel jobs */
    jobs?: number;
    /** Timeout in milliseconds */
    timeout?: number;
    /** Memory limit in MB */
    memoryLimit?: number;
  };
}

/**
 * Simulation status
 */
export enum SimulationStatus {
  /** Simulation is pending */
  PENDING = 'pending',
  /** Simulation is running */
  RUNNING = 'running',
  /** Simulation is complete */
  COMPLETE = 'complete',
  /** Simulation failed */
  FAILED = 'failed',
  /** Simulation was cancelled */
  CANCELLED = 'cancelled',
}

/**
 * Energy end use breakdown
 */
export interface EnergyEndUseBreakdown {
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
 * Time series data
 */
export interface TimeSeriesData {
  /** Timestamps */
  timestamps: string[];
  /** Series data */
  series: {
    /** Name of the series */
    name: string;
    /** Values for the series */
    values: number[];
  }[];
}

/**
 * Simulation result
 */
export interface SimulationResult {
  /** Simulation ID */
  id: string;
  /** Simulation status */
  status: SimulationStatus;
  /** Simulation parameters */
  parameters: SimulationParameters;
  /** Simulation start time */
  startTime: Date;
  /** Simulation end time */
  endTime?: Date;
  /** Simulation duration in milliseconds */
  duration?: number;
  /** Simulation output directory */
  outputDirectory: string;
  /** Simulation errors */
  errors: string[];
  /** Simulation warnings */
  warnings: string[];
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
  /** Energy end use breakdown */
  endUseBreakdown?: EnergyEndUseBreakdown;
  /** Time series data */
  timeSeriesData?: TimeSeriesData;
  /** CPU usage percentage */
  cpuUsage?: number;
  /** Memory usage in MB */
  memoryUsage?: number;
  /** Raw simulation output */
  output?: string;
  /** Error message if the simulation failed */
  error?: string;
}

/**
 * Active simulations
 */
const activeSimulations = new Map<
  string,
  {
    result: SimulationResult;
    processId?: number;
    monitorInterval?: NodeJS.Timeout;
  }
>();

/**
 * Generate a unique simulation ID
 * @returns Unique simulation ID
 */
function generateSimulationId(): string {
  return `sim-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Configure and run a simulation
 * @param parameters Simulation parameters
 * @returns Promise that resolves with the simulation result
 */
export async function runSimulation(parameters: SimulationParameters): Promise<SimulationResult> {
  // Generate a unique simulation ID
  const simulationId = generateSimulationId();

  // Create the initial simulation result
  const simulationResult: SimulationResult = {
    id: simulationId,
    status: SimulationStatus.PENDING,
    parameters,
    startTime: new Date(),
    outputDirectory: parameters.outputDirectory || path.dirname(parameters.modelPath),
    errors: [],
    warnings: [],
  };

  // Store the simulation in the active simulations map
  activeSimulations.set(simulationId, {
    result: simulationResult,
  });

  try {
    logger.info({ simulationId, parameters }, 'Starting simulation');

    // Update simulation status
    simulationResult.status = SimulationStatus.RUNNING;

    // Ensure the output directory exists
    if (parameters.outputDirectory && !fs.existsSync(parameters.outputDirectory)) {
      fs.mkdirSync(parameters.outputDirectory, { recursive: true });
    }

    // Run the simulation with detailed parameters
    const result = await openStudioCommands.runSimulation(
      parameters.modelPath,
      parameters.weatherFile,
      parameters.outputDirectory,
      parameters,
    );

    // Update the simulation result
    simulationResult.endTime = new Date();
    simulationResult.duration =
      simulationResult.endTime.getTime() - simulationResult.startTime.getTime();
    simulationResult.output = result.output;

    if (result.success) {
      simulationResult.status = SimulationStatus.COMPLETE;

      // Copy data from the command result
      if (result.data) {
        const simulationData = result.data as OpenStudioSimulationResults;
        simulationResult.errors = simulationData.errors || [];
        simulationResult.warnings = simulationData.warnings || [];
        simulationResult.eui = simulationData.eui;
        simulationResult.totalSiteEnergy = simulationData.totalSiteEnergy;
        simulationResult.totalSourceEnergy = simulationData.totalSourceEnergy;
        simulationResult.electricityConsumption = simulationData.electricityConsumption;
        simulationResult.naturalGasConsumption = simulationData.naturalGasConsumption;
        simulationResult.districtHeatingConsumption = simulationData.districtHeatingConsumption;
        simulationResult.districtCoolingConsumption = simulationData.districtCoolingConsumption;
      }

      logger.info(
        { simulationId, duration: simulationResult.duration },
        'Simulation completed successfully',
      );
    } else {
      simulationResult.status = SimulationStatus.FAILED;
      simulationResult.error = result.error;

      logger.warn({ simulationId, error: result.error }, 'Simulation failed');
    }

    // Remove the simulation from the active simulations map
    activeSimulations.delete(simulationId);

    return simulationResult;
  } catch (error) {
    // Update the simulation result
    simulationResult.status = SimulationStatus.FAILED;
    simulationResult.endTime = new Date();
    simulationResult.duration =
      simulationResult.endTime.getTime() - simulationResult.startTime.getTime();
    simulationResult.error = error instanceof Error ? error.message : String(error);

    logger.error({ simulationId, error }, 'Error running simulation');

    // Remove the simulation from the active simulations map
    activeSimulations.delete(simulationId);

    return simulationResult;
  }
}

/**
 * Get the status of a simulation
 * @param simulationId Simulation ID
 * @returns Simulation result or undefined if not found
 */
export function getSimulationStatus(simulationId: string): SimulationResult | undefined {
  const simulation = activeSimulations.get(simulationId);
  return simulation?.result;
}

/**
 * Get all active simulations
 * @returns Array of active simulation results
 */
export function getActiveSimulations(): SimulationResult[] {
  return Array.from(activeSimulations.values()).map((simulation) => simulation.result);
}

/**
 * Cancel a simulation
 * @param simulationId Simulation ID
 * @returns True if the simulation was cancelled, false otherwise
 */
export function cancelSimulation(simulationId: string): boolean {
  const simulation = activeSimulations.get(simulationId);

  if (!simulation) {
    return false;
  }

  try {
    // Stop monitoring
    if (simulation.monitorInterval) {
      clearInterval(simulation.monitorInterval);
    }

    // Kill the process if it exists
    if (simulation.processId) {
      process.kill(simulation.processId);
    }

    // Update the simulation result
    simulation.result.status = SimulationStatus.CANCELLED;
    simulation.result.endTime = new Date();
    simulation.result.duration =
      simulation.result.endTime.getTime() - simulation.result.startTime.getTime();

    logger.info({ simulationId }, 'Simulation cancelled');

    // Remove the simulation from the active simulations map
    activeSimulations.delete(simulationId);

    return true;
  } catch (error) {
    logger.error({ simulationId, error }, 'Error cancelling simulation');
    return false;
  }
}

/**
 * Process simulation results
 * @param simulationResult Simulation result
 * @returns Processed simulation result with additional information
 */
export function processSimulationResults(simulationResult: SimulationResult): SimulationResult {
  // If the simulation is not complete, return as is
  if (simulationResult.status !== SimulationStatus.COMPLETE) {
    return simulationResult;
  }

  try {
    // Check if the output directory exists
    if (!simulationResult.outputDirectory || !fs.existsSync(simulationResult.outputDirectory)) {
      return simulationResult;
    }

    // Look for additional result files
    const outputDirectory = simulationResult.outputDirectory;

    // Check for EnergyPlus output files
    const eplusOutPath = path.join(outputDirectory, 'eplusout.err');
    if (fs.existsSync(eplusOutPath)) {
      try {
        const eplusErr = fs.readFileSync(eplusOutPath, 'utf8');

        // Extract additional warnings and errors
        const errorMatches = eplusErr.match(/\*\* Severe {2}\* ([^\n]+)/g);
        if (errorMatches) {
          simulationResult.errors = [
            ...simulationResult.errors,
            ...errorMatches.map((match) => match.replace(/\*\* Severe {2}\* /, '').trim()),
          ];
        }

        const warningMatches = eplusErr.match(/\*\* Warning \*\* ([^\n]+)/g);
        if (warningMatches) {
          simulationResult.warnings = [
            ...simulationResult.warnings,
            ...warningMatches.map((match) => match.replace(/\*\* Warning \*\* /, '').trim()),
          ];
        }
      } catch (error) {
        logger.warn({ outputDirectory, error }, 'Error reading EnergyPlus error file');
      }
    }

    // Check for EnergyPlus meter output file for detailed energy consumption data
    const meterOutputPath = path.join(outputDirectory, 'eplusout.mtr');
    if (fs.existsSync(meterOutputPath)) {
      try {
        const meterData = fs.readFileSync(meterOutputPath, 'utf8');
        const meterResults = extractEnergyConsumptionFromMeters(meterData);

        // Update simulation results with meter data if available
        if (meterResults.electricityConsumption !== undefined) {
          simulationResult.electricityConsumption = meterResults.electricityConsumption;
        }
        if (meterResults.naturalGasConsumption !== undefined) {
          simulationResult.naturalGasConsumption = meterResults.naturalGasConsumption;
        }
        if (meterResults.districtHeatingConsumption !== undefined) {
          simulationResult.districtHeatingConsumption = meterResults.districtHeatingConsumption;
        }
        if (meterResults.districtCoolingConsumption !== undefined) {
          simulationResult.districtCoolingConsumption = meterResults.districtCoolingConsumption;
        }
      } catch (error) {
        logger.warn({ outputDirectory, error }, 'Error reading EnergyPlus meter file');
      }
    }

    // Check for tabular output file for detailed results
    const tabularOutputPath = path.join(outputDirectory, 'eplustbl.htm');
    if (fs.existsSync(tabularOutputPath)) {
      try {
        const tabularData = fs.readFileSync(tabularOutputPath, 'utf8');
        const tabularResults = extractResultsFromTabularOutput(tabularData);

        // Update simulation results with tabular data
        if (tabularResults.eui !== undefined) {
          simulationResult.eui = tabularResults.eui;
        }
        if (tabularResults.totalSiteEnergy !== undefined) {
          simulationResult.totalSiteEnergy = tabularResults.totalSiteEnergy;
        }
        if (tabularResults.totalSourceEnergy !== undefined) {
          simulationResult.totalSourceEnergy = tabularResults.totalSourceEnergy;
        }
        if (tabularResults.endUseBreakdown) {
          simulationResult.endUseBreakdown = tabularResults.endUseBreakdown;
        }
      } catch (error) {
        logger.warn({ outputDirectory, error }, 'Error reading tabular output file');
      }
    }

    // Check for CSV output files for time series data
    const csvFiles = fs.readdirSync(outputDirectory).filter((file) => file.endsWith('.csv'));
    if (csvFiles.length > 0) {
      try {
        const timeSeriesData = extractTimeSeriesData(outputDirectory, csvFiles);
        if (Object.keys(timeSeriesData).length > 0) {
          simulationResult.timeSeriesData = timeSeriesData;
        }
      } catch (error) {
        logger.warn({ outputDirectory, error }, 'Error processing CSV files for time series data');
      }
    }

    // Check for SQL output file for more detailed results
    const sqlPath = path.join(outputDirectory, 'eplusout.sql');
    if (fs.existsSync(sqlPath)) {
      // In a real implementation, we would use the OpenStudio API to read the SQL file
      // and extract more detailed results. For now, we'll just note that it exists.
      logger.debug(
        { outputDirectory },
        'SQL output file found, but detailed parsing not implemented',
      );
    }

    return simulationResult;
  } catch (error) {
    logger.error({ simulationResult, error }, 'Error processing simulation results');
    return simulationResult;
  }
}

/**
 * Configure simulation parameters based on model analysis
 * @param modelPath Path to the model file
 * @returns Promise that resolves with the recommended simulation parameters
 */
export async function configureSimulationParameters(
  modelPath: string,
): Promise<SimulationParameters> {
  try {
    // Get model information
    const modelInfo = await openStudioCommands.getModelInfo(modelPath, 'detailed');

    // Configure parameters based on model complexity
    const parameters: SimulationParameters = {
      modelPath,
      outputDirectory: path.join(path.dirname(modelPath), 'run'),
    };

    // Use the model's weather file if available
    const modelData = modelInfo.data as OpenStudioModelInfo;
    if (modelData?.weatherFile) {
      parameters.weatherFile = modelData.weatherFile;
    }

    // Configure options based on model complexity
    const options: SimulationParameters['options'] = {};

    // Determine if the model is complex
    const isComplex = (modelData?.spaces || 0) > 50 || (modelData?.thermalZones || 0) > 20;

    if (isComplex) {
      // For complex models, use parallel processing and higher resource limits
      options.parallel = true;
      const os = await import('os');
      options.jobs = Math.max(1, Math.floor(os.cpus().length / 2)); // Use half of available CPUs
      options.timeout = 1800000; // 30 minutes
      options.memoryLimit = 8192; // 8GB
    } else {
      // For simpler models, use standard settings
      options.timeout = 600000; // 10 minutes
      options.memoryLimit = 4096; // 4GB
    }

    parameters.options = options;

    return parameters;
  } catch (error) {
    logger.error({ modelPath, error }, 'Error configuring simulation parameters');

    // Return default parameters
    return {
      modelPath,
      outputDirectory: path.join(path.dirname(modelPath), 'run'),
      options: {
        timeout: 600000, // 10 minutes
        memoryLimit: 4096, // 4GB
      },
    };
  }
}

/**
 * Generate visualization data for a simulation result
 * @param simulationResult Simulation result
 * @returns Visualization data for the simulation result
 */
export function generateVisualizationData(simulationResult: SimulationResult): unknown {
  return visualizationHelpers.formatSimulationResultForAPI(simulationResult);
}

/**
 * Generate HTML dashboard for a simulation result
 * @param simulationResult Simulation result
 * @returns HTML dashboard for the simulation result
 */
export function generateHTMLDashboard(simulationResult: SimulationResult): string {
  return visualizationHelpers.generateSimulationDashboardHTML(simulationResult);
}

/**
 * Export simulation results as CSV
 * @param simulationResult Simulation result
 * @returns CSV data for the simulation result
 */
export function exportResultsAsCSV(simulationResult: SimulationResult): string {
  return visualizationHelpers.generateSimulationResultsCSV(simulationResult);
}

/**
 * Save simulation results dashboard to a file
 * @param simulationResult Simulation result
 * @param outputPath Path to save the dashboard HTML file (optional, defaults to outputDirectory/dashboard.html)
 * @returns Path to the saved dashboard file
 */
export function saveResultsDashboard(
  simulationResult: SimulationResult,
  outputPath?: string,
): string {
  const dashboardPath = outputPath || path.join(simulationResult.outputDirectory, 'dashboard.html');

  try {
    // Generate the dashboard HTML
    const dashboardHTML = generateHTMLDashboard(simulationResult);

    // Ensure the directory exists
    const directory = path.dirname(dashboardPath);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }

    // Write the dashboard to a file
    fs.writeFileSync(dashboardPath, dashboardHTML);

    logger.info(
      { simulationId: simulationResult.id, dashboardPath },
      'Saved simulation results dashboard',
    );

    return dashboardPath;
  } catch (error) {
    logger.error(
      { simulationId: simulationResult.id, error },
      'Error saving simulation results dashboard',
    );
    throw error;
  }
}

/**
 * Save simulation results as CSV
 * @param simulationResult Simulation result
 * @param outputPath Path to save the CSV file (optional, defaults to outputDirectory/results.csv)
 * @returns Path to the saved CSV file
 */
export function saveResultsAsCSV(simulationResult: SimulationResult, outputPath?: string): string {
  const csvPath = outputPath || path.join(simulationResult.outputDirectory, 'results.csv');

  try {
    // Generate the CSV data
    const csvData = exportResultsAsCSV(simulationResult);

    // Ensure the directory exists
    const directory = path.dirname(csvPath);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }

    // Write the CSV to a file
    fs.writeFileSync(csvPath, csvData);

    logger.info({ simulationId: simulationResult.id, csvPath }, 'Saved simulation results as CSV');

    return csvPath;
  } catch (error) {
    logger.error(
      { simulationId: simulationResult.id, error },
      'Error saving simulation results as CSV',
    );
    throw error;
  }
}

/**
 * Extract energy consumption data from EnergyPlus meter output
 * @param meterData EnergyPlus meter data
 * @returns Energy consumption results
 */
function extractEnergyConsumptionFromMeters(meterData: string): Partial<SimulationResult> {
  const results: Partial<SimulationResult> = {};

  try {
    // Look for electricity consumption (in kWh)
    const electricityMatch = meterData.match(/Electricity:Facility,\s*Sum\s*([\d.]+)/i);
    if (electricityMatch) {
      results.electricityConsumption = parseFloat(electricityMatch[1]);
    }

    // Look for gas consumption (in GJ)
    const gasMatch = meterData.match(/Gas:Facility,\s*Sum\s*([\d.]+)/i);
    if (gasMatch) {
      results.naturalGasConsumption = parseFloat(gasMatch[1]);
    }

    // Look for district heating (in GJ)
    const districtHeatingMatch = meterData.match(/DistrictHeating:Facility,\s*Sum\s*([\d.]+)/i);
    if (districtHeatingMatch) {
      results.districtHeatingConsumption = parseFloat(districtHeatingMatch[1]);
    }

    // Look for district cooling (in GJ)
    const districtCoolingMatch = meterData.match(/DistrictCooling:Facility,\s*Sum\s*([\d.]+)/i);
    if (districtCoolingMatch) {
      results.districtCoolingConsumption = parseFloat(districtCoolingMatch[1]);
    }
  } catch (error) {
    logger.warn({ error }, 'Error extracting energy consumption from meters');
  }

  return results;
}

/**
 * Extract results from tabular output (eplustbl.htm)
 * @param tabularData Tabular HTML data
 * @returns Extracted results
 */
function extractResultsFromTabularOutput(tabularData: string): Partial<SimulationResult> {
  const results: Partial<SimulationResult> = {};

  try {
    // Extract EUI (kWh/m²/year)
    const euiMatch = tabularData.match(/EUI\s*([\d.]+)\s*kWh\/m2\/yr/i);
    if (euiMatch) {
      results.eui = parseFloat(euiMatch[1]);
    }

    // Extract total site energy (GJ)
    const siteEnergyMatch = tabularData.match(/Total Site Energy\s*([\d.]+)\s*GJ/i);
    if (siteEnergyMatch) {
      results.totalSiteEnergy = parseFloat(siteEnergyMatch[1]);
    }

    // Extract total source energy (GJ)
    const sourceEnergyMatch = tabularData.match(/Total Source Energy\s*([\d.]+)\s*GJ/i);
    if (sourceEnergyMatch) {
      results.totalSourceEnergy = parseFloat(sourceEnergyMatch[1]);
    }

    // Extract end use breakdown
    const endUseData = extractEndUseBreakdown(tabularData);
    if (endUseData) {
      results.endUseBreakdown = endUseData;
    }
  } catch (error) {
    logger.warn({ error }, 'Error extracting results from tabular output');
  }

  return results;
}

/**
 * Extract end use breakdown from tabular output
 * @param tabularData Tabular HTML data
 * @returns Energy end use breakdown
 */
function extractEndUseBreakdown(tabularData: string): EnergyEndUseBreakdown | null {
  try {
    // This is a simplified implementation - in a real implementation,
    // you would parse the HTML table structure to extract the data
    const endUseSections = tabularData.match(/End Uses\s*.*?table/gis);
    if (!endUseSections || endUseSections.length === 0) {
      return null;
    }

    // For now, return a basic structure
    return {
      labels: ['Heating', 'Cooling', 'Lighting', 'Equipment', 'Fans', 'Pumps'],
      values: [100, 80, 60, 40, 20, 10], // Placeholder values
      units: 'GJ',
      colors: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3'],
    };
  } catch (error) {
    logger.warn({ error }, 'Error extracting end use breakdown');
    return null;
  }
}

/**
 * Extract time series data from CSV files
 * @param outputDirectory Output directory path
 * @param csvFiles List of CSV files
 * @returns Time series data
 */
function extractTimeSeriesData(outputDirectory: string, csvFiles: string[]): TimeSeriesData {
  const timeSeriesData: TimeSeriesData = {
    timestamps: [],
    series: [],
  };

  try {
    // Process each CSV file
    for (const csvFile of csvFiles) {
      const csvPath = path.join(outputDirectory, csvFile);
      const csvContent = fs.readFileSync(csvPath, 'utf8');

      // Parse CSV content (simplified implementation)
      const lines = csvContent.split('\n').filter((line) => line.trim().length > 0);
      if (lines.length < 2) continue;

      // Get headers
      const headers = lines[0].split(',').map((header) => header.trim());

      // Process data rows
      const seriesData: Record<string, number[]> = {};
      const timestamps: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map((value) => value.trim());
        if (values.length !== headers.length) continue;

        // Assume first column is timestamp
        timestamps.push(values[0]);

        // Process other columns as data series
        for (let j = 1; j < headers.length; j++) {
          if (!seriesData[headers[j]]) {
            seriesData[headers[j]] = [];
          }
          seriesData[headers[j]].push(parseFloat(values[j]) || 0);
        }
      }

      // Update time series data
      if (timeSeriesData.timestamps.length === 0) {
        timeSeriesData.timestamps = timestamps;
      }

      // Add series data
      Object.entries(seriesData).forEach(([name, values]) => {
        timeSeriesData.series.push({
          name: `${csvFile.replace('.csv', '')} - ${name}`,
          values,
        });
      });
    }
  } catch (error) {
    logger.warn({ outputDirectory, error }, 'Error extracting time series data');
  }

  return timeSeriesData;
}

// Export the module
export default {
  runSimulation,
  getSimulationStatus,
  getActiveSimulations,
  cancelSimulation,
  processSimulationResults,
  configureSimulationParameters,
  generateVisualizationData,
  generateHTMLDashboard,
  exportResultsAsCSV,
  saveResultsDashboard,
  saveResultsAsCSV,
};
