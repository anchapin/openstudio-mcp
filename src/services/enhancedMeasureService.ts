/**
 * Enhanced Measure Management Service
 *
 * This service provides advanced measure management capabilities including:
 * - Measure updates (single and batch)
 * - Dynamic argument computation based on model context
 * - Measure testing framework
 * - README.md.erb processing
 * - Measure.xml validation and updates
 */

import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { logger } from '../utils';
import { executeOpenStudioCommand } from '../utils/commandExecutor';
import measureManager from '../utils/measureManager';
import { isPathSafe } from '../utils/validation';
import {
  MeasureUpdateResult,
  MeasureUpdateOptions,
  MeasureArgumentComputationResult,
  MeasureArgumentComputationOptions,
  MeasureTestResult,
  MeasureTestOptions,
  MeasureArgument,
  MeasureIndividualTestResult,
} from '../interfaces/measure';

/**
 * Enhanced Measure Management Service
 */
export class EnhancedMeasureService {
  /**
   * Update a single measure
   * @param measureId Measure ID to update
   * @param options Update options
   * @returns Promise that resolves with the update result
   */
  async updateMeasure(
    measureId: string,
    options: MeasureUpdateOptions = {},
  ): Promise<MeasureUpdateResult> {
    try {
      logger.info({ measureId, options }, 'Updating measure');

      // Validate measure ID
      if (!measureId || typeof measureId !== 'string') {
        throw new Error('Valid measure ID is required');
      }

      // Get measures directory
      const measuresDir = options.measuresDir || measureManager.getMeasuresDir();
      const measurePath = path.join(measuresDir, measureId);

      // Validate paths
      if (!isPathSafe(measurePath)) {
        throw new Error('Invalid measure path');
      }

      // Check if measure exists
      if (!existsSync(measurePath)) {
        return {
          success: false,
          measureId,
          message: `Measure not found: ${measureId}`,
          error: `Measure directory does not exist: ${measurePath}`,
        };
      }

      // Get current version
      const previousVersion = await measureManager.getMeasureVersion(
        measureId,
        options.measuresDir,
      );

      // Run OpenStudio measure update command
      const result = await executeOpenStudioCommand('', ['measure', '--update', measurePath], {
        timeout: 60000, // 1 minute timeout
        memoryLimit: 2048,
      });

      if (!result.success) {
        return {
          success: false,
          measureId,
          message: 'Failed to update measure',
          error: result.error || result.stderr,
          previousVersion: previousVersion || undefined,
        };
      }

      // Get new version
      const newVersion = await measureManager.getMeasureVersion(measureId, options.measuresDir);

      // Process README.md.erb if requested
      const updatedFiles: string[] = [];
      if (options.updateReadme !== false) {
        const readmeResult = await this.processReadmeErb(measurePath);
        if (readmeResult.success && readmeResult.updatedFiles) {
          updatedFiles.push(...readmeResult.updatedFiles);
        }
      }

      // Validate measure.xml if requested
      if (options.updateXml !== false) {
        const xmlResult = await this.validateMeasureXml(measurePath);
        if (xmlResult.success && xmlResult.updatedFiles) {
          updatedFiles.push(...xmlResult.updatedFiles);
        }
      }

      return {
        success: true,
        measureId,
        previousVersion: previousVersion || undefined,
        newVersion: newVersion || undefined,
        message: `Successfully updated measure: ${measureId}`,
        updatedFiles: updatedFiles.length > 0 ? updatedFiles : undefined,
      };
    } catch (error) {
      logger.error(
        { measureId, error: error instanceof Error ? error.message : String(error) },
        'Error updating measure',
      );

      return {
        success: false,
        measureId,
        message: 'Error updating measure',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Update all measures in the measures directory
   * @param options Update options
   * @returns Promise that resolves with array of update results
   */
  async updateAllMeasures(options: MeasureUpdateOptions = {}): Promise<MeasureUpdateResult[]> {
    try {
      logger.info({ options }, 'Updating all measures');

      // Get list of installed measures
      const installedMeasures = await measureManager.listInstalledMeasures(options.measuresDir);

      if (installedMeasures.length === 0) {
        logger.info('No measures found to update');
        return [];
      }

      logger.info({ measureCount: installedMeasures.length }, 'Found measures to update');

      // Update each measure
      const results: MeasureUpdateResult[] = [];
      for (const measureId of installedMeasures) {
        try {
          const result = await this.updateMeasure(measureId, options);
          results.push(result);
        } catch (error) {
          results.push({
            success: false,
            measureId,
            message: 'Failed to update measure',
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const successCount = results.filter((r) => r.success).length;
      logger.info(
        {
          totalMeasures: results.length,
          successCount,
          failureCount: results.length - successCount,
        },
        'Completed updating all measures',
      );

      return results;
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Error updating all measures',
      );
      throw error;
    }
  }

  /**
   * Compute measure arguments based on model context
   * @param measureId Measure ID
   * @param options Computation options
   * @returns Promise that resolves with computed arguments
   */
  async computeMeasureArguments(
    measureId: string,
    options: MeasureArgumentComputationOptions = {},
  ): Promise<MeasureArgumentComputationResult> {
    try {
      logger.info({ measureId, options }, 'Computing measure arguments');

      // Validate measure ID
      if (!measureId || typeof measureId !== 'string') {
        throw new Error('Valid measure ID is required');
      }

      // Get measures directory
      const measuresDir = options.measuresDir || measureManager.getMeasuresDir();
      const measurePath = path.join(measuresDir, measureId);

      // Validate paths
      if (!isPathSafe(measurePath)) {
        throw new Error('Invalid measure path');
      }

      // Check if measure exists
      if (!existsSync(measurePath)) {
        return {
          success: false,
          measureId,
          arguments: [],
          error: `Measure not found: ${measureId}`,
        };
      }

      // Build command arguments
      const commandArgs = ['measure', '--compute_arguments', measurePath];

      // Add model path if provided
      if (options.modelPath) {
        if (!isPathSafe(options.modelPath)) {
          throw new Error('Invalid model path');
        }

        if (!existsSync(options.modelPath)) {
          return {
            success: false,
            measureId,
            arguments: [],
            error: `Model file not found: ${options.modelPath}`,
          };
        }

        commandArgs.push('--model_path', options.modelPath);
      }

      // Run OpenStudio command
      const result = await executeOpenStudioCommand('', commandArgs, {
        timeout: 120000, // 2 minute timeout
        memoryLimit: 4096,
      });

      if (!result.success) {
        return {
          success: false,
          measureId,
          arguments: [],
          error: result.error || result.stderr,
          modelPath: options.modelPath,
        };
      }

      // Parse the output to extract arguments
      const computedArguments = this.parseComputedArguments(result.stdout);

      return {
        success: true,
        measureId,
        arguments: computedArguments,
        modelPath: options.modelPath,
      };
    } catch (error) {
      logger.error(
        { measureId, error: error instanceof Error ? error.message : String(error) },
        'Error computing measure arguments',
      );

      return {
        success: false,
        measureId,
        arguments: [],
        error: error instanceof Error ? error.message : String(error),
        modelPath: options.modelPath,
      };
    }
  }

  /**
   * Run tests for a measure
   * @param measureId Measure ID
   * @param options Test options
   * @returns Promise that resolves with test results
   */
  async runMeasureTests(
    measureId: string,
    options: MeasureTestOptions = {},
  ): Promise<MeasureTestResult> {
    try {
      logger.info({ measureId, options }, 'Running measure tests');

      // Validate measure ID
      if (!measureId || typeof measureId !== 'string') {
        throw new Error('Valid measure ID is required');
      }

      // Get measures directory
      const measuresDir = options.measuresDir || measureManager.getMeasuresDir();
      const measurePath = path.join(measuresDir, measureId);

      // Validate paths
      if (!isPathSafe(measurePath)) {
        throw new Error('Invalid measure path');
      }

      // Check if measure exists
      if (!existsSync(measurePath)) {
        return {
          success: false,
          measureId,
          testsExecuted: 0,
          testsPassed: 0,
          testsFailed: 0,
          executionTime: 0,
          error: `Measure not found: ${measureId}`,
        };
      }

      // Check if test files exist
      const testsDir = path.join(measurePath, 'tests');
      if (!existsSync(testsDir)) {
        return {
          success: false,
          measureId,
          testsExecuted: 0,
          testsPassed: 0,
          testsFailed: 0,
          executionTime: 0,
          error: `No tests directory found for measure: ${measureId}`,
        };
      }

      // Build command arguments
      const commandArgs = ['measure', '--run_tests', measurePath];

      // Add specific test files if requested
      if (options.testFiles && options.testFiles.length > 0) {
        for (const testFile of options.testFiles) {
          if (isPathSafe(testFile)) {
            commandArgs.push('--test_file', testFile);
          }
        }
      }

      // Record start time
      const startTime = Date.now();

      // Run OpenStudio command
      const timeout = (options.timeout || 300) * 1000; // Convert to milliseconds
      const result = await executeOpenStudioCommand('', commandArgs, {
        timeout,
        memoryLimit: 4096,
      });

      // Calculate execution time
      const executionTime = (Date.now() - startTime) / 1000;

      if (!result.success) {
        return {
          success: false,
          measureId,
          testsExecuted: 0,
          testsPassed: 0,
          testsFailed: 0,
          executionTime,
          error: result.error || result.stderr,
        };
      }

      // Parse test results
      const testResults = this.parseTestResults(result.stdout);

      // Generate test dashboard if requested
      if (options.generateDashboard) {
        await this.generateTestDashboard(measurePath, testResults, result.stdout);
      }

      return {
        success: testResults.testsFailed === 0,
        measureId,
        testsExecuted: testResults.testsExecuted,
        testsPassed: testResults.testsPassed,
        testsFailed: testResults.testsFailed,
        executionTime,
        testDetails: testResults.testDetails,
      };
    } catch (error) {
      logger.error(
        { measureId, error: error instanceof Error ? error.message : String(error) },
        'Error running measure tests',
      );

      return {
        success: false,
        measureId,
        testsExecuted: 0,
        testsPassed: 0,
        testsFailed: 0,
        executionTime: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Process README.md.erb files in a measure
   * @param measurePath Path to measure directory
   * @returns Processing result
   */
  private async processReadmeErb(
    measurePath: string,
  ): Promise<{ success: boolean; updatedFiles?: string[] }> {
    try {
      const readmeErbPath = path.join(measurePath, 'README.md.erb');
      const readmePath = path.join(measurePath, 'README.md');

      if (!existsSync(readmeErbPath)) {
        return { success: true }; // No ERB file to process
      }

      // Run ERB processing
      const result = await executeOpenStudioCommand(
        '',
        ['measure', '--update_readme', measurePath],
        {
          timeout: 30000,
          memoryLimit: 1024,
        },
      );

      if (result.success && existsSync(readmePath)) {
        return { success: true, updatedFiles: ['README.md'] };
      }

      return { success: false };
    } catch (error) {
      logger.warn(
        { measurePath, error: error instanceof Error ? error.message : String(error) },
        'Error processing README.md.erb',
      );
      return { success: false };
    }
  }

  /**
   * Validate and update measure.xml file
   * @param measurePath Path to measure directory
   * @returns Validation result
   */
  private async validateMeasureXml(
    measurePath: string,
  ): Promise<{ success: boolean; updatedFiles?: string[] }> {
    try {
      const measureXmlPath = path.join(measurePath, 'measure.xml');

      if (!existsSync(measureXmlPath)) {
        return { success: false };
      }

      // Read and validate XML content
      const xmlContent = await fs.readFile(measureXmlPath, 'utf-8');

      // Basic XML validation
      if (!xmlContent.includes('<measure>') || !xmlContent.includes('</measure>')) {
        logger.warn({ measurePath }, 'Invalid measure.xml structure');
        return { success: false };
      }

      // Update timestamps if needed
      const updatedXml = this.updateMeasureXmlTimestamp(xmlContent);

      if (updatedXml !== xmlContent) {
        await fs.writeFile(measureXmlPath, updatedXml, 'utf-8');
        return { success: true, updatedFiles: ['measure.xml'] };
      }

      return { success: true };
    } catch (error) {
      logger.warn(
        { measurePath, error: error instanceof Error ? error.message : String(error) },
        'Error validating measure.xml',
      );
      return { success: false };
    }
  }

  /**
   * Update measure.xml timestamp
   * @param xmlContent XML content
   * @returns Updated XML content
   */
  protected updateMeasureXmlTimestamp(xmlContent: string): string {
    const timestamp = new Date().toISOString();
    return xmlContent.replace(
      /<date_modified>.*?<\/date_modified>/,
      `<date_modified>${timestamp}</date_modified>`,
    );
  }

  /**
   * Parse computed arguments from command output
   * @param output Command output
   * @returns Array of computed arguments
   */
  protected parseComputedArguments(output: string): MeasureArgument[] {
    const parsedArguments: MeasureArgument[] = [];

    try {
      // Look for argument definitions in the output
      const lines = output.split('\n');
      let currentArg: Partial<MeasureArgument> | null = null;

      for (const line of lines) {
        const trimmedLine = line.trim();

        // Look for argument start
        if (trimmedLine.startsWith('Argument:')) {
          if (currentArg) {
            parsedArguments.push(currentArg as MeasureArgument);
          }
          currentArg = {
            name: trimmedLine.replace('Argument:', '').trim(),
            displayName: '',
            description: '',
            type: 'String',
            required: false,
          };
        } else if (currentArg) {
          // Parse argument properties
          if (trimmedLine.startsWith('Display Name:')) {
            currentArg.displayName = trimmedLine.replace('Display Name:', '').trim();
          } else if (trimmedLine.startsWith('Description:')) {
            currentArg.description = trimmedLine.replace('Description:', '').trim();
          } else if (trimmedLine.startsWith('Type:')) {
            currentArg.type = trimmedLine.replace('Type:', '').trim();
          } else if (trimmedLine.startsWith('Required:')) {
            currentArg.required =
              trimmedLine.replace('Required:', '').trim().toLowerCase() === 'true';
          } else if (trimmedLine.startsWith('Default Value:')) {
            const defaultValue = trimmedLine.replace('Default Value:', '').trim();
            if (defaultValue && defaultValue !== 'nil') {
              currentArg.defaultValue = this.parseDefaultValue(defaultValue, currentArg.type);
            }
          }
        }
      }

      // Add the last argument
      if (currentArg) {
        parsedArguments.push(currentArg as MeasureArgument);
      }
    } catch (error) {
      logger.warn(
        { error: error instanceof Error ? error.message : String(error) },
        'Error parsing computed arguments',
      );
    }

    return parsedArguments;
  }

  /**
   * Parse default value based on type
   * @param value String value
   * @param type Argument type
   * @returns Parsed value
   */
  protected parseDefaultValue(value: string, type?: string): string | number | boolean {
    switch (type) {
      case 'Double':
        return parseFloat(value);
      case 'Integer':
        return parseInt(value, 10);
      case 'Boolean':
        return value.toLowerCase() === 'true';
      default:
        return value;
    }
  }

  /**
   * Parse test results from command output
   * @param output Command output
   * @returns Parsed test results
   */
  protected parseTestResults(output: string): {
    testsExecuted: number;
    testsPassed: number;
    testsFailed: number;
    testDetails: MeasureIndividualTestResult[];
  } {
    const testDetails: MeasureIndividualTestResult[] = [];
    let testsExecuted = 0;
    let testsPassed = 0;
    let testsFailed = 0;

    try {
      const lines = output.split('\n');

      for (const line of lines) {
        const trimmedLine = line.trim();

        // Look for test execution summary
        if (trimmedLine.includes('tests,')) {
          const match = trimmedLine.match(
            /(\d+)\s+tests?,\s+(\d+)\s+assertions?,\s+(\d+)\s+failures?/,
          );
          if (match) {
            testsExecuted = parseInt(match[1], 10);
            testsFailed = parseInt(match[3], 10);
            testsPassed = testsExecuted - testsFailed;
          }
        }

        // Look for individual test results
        if (trimmedLine.includes('Test:') || trimmedLine.includes('test_')) {
          const testName = this.extractTestName(trimmedLine);
          const passed = !trimmedLine.includes('FAIL') && !trimmedLine.includes('ERROR');

          testDetails.push({
            name: testName,
            passed,
            executionTime: 0, // Would need more detailed parsing to get actual time
            error: passed ? undefined : 'Test failed',
          });
        }
      }
    } catch (error) {
      logger.warn(
        { error: error instanceof Error ? error.message : String(error) },
        'Error parsing test results',
      );
    }

    return { testsExecuted, testsPassed, testsFailed, testDetails };
  }

  /**
   * Extract test name from output line
   * @param line Output line
   * @returns Test name
   */
  protected extractTestName(line: string): string {
    // Try to extract test name from various formats
    let match = line.match(/test_(\w+)/);
    if (match) {
      return match[0];
    }

    match = line.match(/Test:\s*([^,\n]+)/);
    if (match) {
      return match[1].trim();
    }

    return line.trim();
  }

  /**
   * Generate test dashboard
   * @param measurePath Path to measure directory
   * @param testResults Test results
   * @param rawOutput Raw test output
   */
  private async generateTestDashboard(
    measurePath: string,
    testResults: { testsExecuted: number; testsPassed: number; testsFailed: number },
    rawOutput: string,
  ): Promise<void> {
    try {
      const dashboardPath = path.join(measurePath, 'test_dashboard.html');
      const timestamp = new Date().toISOString();

      const dashboardContent = `<!DOCTYPE html>
<html>
<head>
    <title>Test Results Dashboard</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .passed { color: green; }
        .failed { color: red; }
        .output { background: #f0f0f0; padding: 10px; border-radius: 3px; font-family: monospace; white-space: pre-wrap; }
    </style>
</head>
<body>
    <h1>Measure Test Results</h1>
    <div class="summary">
        <h2>Summary</h2>
        <p>Generated: ${timestamp}</p>
        <p>Tests Executed: ${testResults.testsExecuted}</p>
        <p class="passed">Tests Passed: ${testResults.testsPassed}</p>
        <p class="failed">Tests Failed: ${testResults.testsFailed}</p>
    </div>
    <h2>Raw Output</h2>
    <div class="output">${rawOutput.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
</body>
</html>`;

      await fs.writeFile(dashboardPath, dashboardContent, 'utf-8');
      logger.info({ dashboardPath }, 'Generated test dashboard');
    } catch (error) {
      logger.warn(
        { measurePath, error: error instanceof Error ? error.message : String(error) },
        'Error generating test dashboard',
      );
    }
  }
}

// Export default instance
export default new EnhancedMeasureService();
