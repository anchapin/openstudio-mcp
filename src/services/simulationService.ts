/**
 * Simulation service
 *
 * This service is responsible for configuring, executing, monitoring, and processing
 * OpenStudio simulations.
 */
import { logger, openStudioCommands, visualizationHelpers } from '../utils';
import { OpenStudioSimulationResults, OpenStudioModelInfo } from '../utils/openStudioCommands';
import path from 'path';
import fs from 'fs';

/**
 * Simulation parameters
 */
export interface SimulationParameters {
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

    // Prepare simulation arguments
    const args = ['--run'];

    // Add weather file if specified
    if (parameters.weatherFile) {
      args.push('--weather', parameters.weatherFile);
    }

    // Add output directory if specified
    if (parameters.outputDirectory) {
      args.push('--output', parameters.outputDirectory);

      // Ensure the output directory exists
      if (!fs.existsSync(parameters.outputDirectory)) {
        fs.mkdirSync(parameters.outputDirectory, { recursive: true });
      }
    }

    // Add design days only flag if specified
    if (parameters.options?.designDaysOnly) {
      args.push('--design-days-only');
    }

    // Add annual simulation flag if specified
    if (parameters.options?.annualSimulation) {
      args.push('--annual');
    }

    // Add fast run flag if specified
    if (parameters.options?.fastRun) {
      args.push('--fast');
    }

    // Add radiative calculations flag if specified
    if (parameters.options?.includeRadiance) {
      args.push('--include-radiance');
    }

    // Add parallel flag and jobs if specified
    if (parameters.options?.parallel) {
      args.push('--parallel');

      if (parameters.options?.jobs && parameters.options.jobs > 0) {
        args.push('--jobs', parameters.options.jobs.toString());
      }
    }

    // Add the model path
    args.push(parameters.modelPath);

    // Set up execution options - currently unused but kept for future extension

    // Run the simulation
    const result = await openStudioCommands.runSimulation(
      parameters.modelPath,
      parameters.weatherFile,
      parameters.outputDirectory,
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
        const errorMatches = eplusErr.match(/\\*\\* Severe {2}\\*\\* ([^\\n]+)/g);
        if (errorMatches) {
          simulationResult.errors = [
            ...simulationResult.errors,
            ...errorMatches.map((match) => match.replace(/\\*\\* Severe {2}\\*\\* /, '').trim()),
          ];
        }

        const warningMatches = eplusErr.match(/\\*\\* Warning \\*\\* ([^\\n]+)/g);
        if (warningMatches) {
          simulationResult.warnings = [
            ...simulationResult.warnings,
            ...warningMatches.map((match) => match.replace(/\\*\\* Warning \\*\\* /, '').trim()),
          ];
        }
      } catch (error) {
        logger.warn({ outputDirectory, error }, 'Error reading EnergyPlus error file');
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
