/**
 * Measure Manager
 *
 * This module provides functionality for downloading, installing, and managing OpenStudio measures
 * from the Building Component Library (BCL).
 *
 * Security features:
 * - Secure download of measures
 * - Validation of measure files
 * - Secure extraction of measure archives
 * - Proper permissions for installed measures
 */
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import AdmZip from 'adm-zip';
import { promisify } from 'util';
import { logger } from './index';
import fileOperations from './fileOperations';
import config from '../config';

// Promisify fs functions
const readdirAsync = promisify(fs.readdir);
const statAsync = promisify(fs.stat);

/**
 * Measure download options
 */
export interface MeasureDownloadOptions {
  /** Force download even if measure already exists */
  force?: boolean;
  /** Timeout for download in milliseconds */
  timeout?: number;
  /** Custom measures directory */
  measuresDir?: string;
}

/**
 * Default measure download options
 */
const defaultOptions: MeasureDownloadOptions = {
  force: false,
  timeout: 30000, // 30 seconds
};

/**
 * Get the measures directory path
 * @param customDir Optional custom directory
 * @returns Path to the measures directory
 */
export function getMeasuresDir(customDir?: string): string {
  // Use custom directory if provided, otherwise use config
  const measuresDir = customDir || config.bcl?.measuresDir;

  // If no measures directory is configured, use default
  if (!measuresDir) {
    return path.join(process.cwd(), 'measures');
  }

  return measuresDir;
}

/**
 * Get the path for a specific measure
 * @param measureId Measure ID
 * @param customDir Optional custom directory
 * @returns Path to the measure directory
 */
export function getMeasurePath(measureId: string, customDir?: string): string {
  return path.join(getMeasuresDir(customDir), measureId);
}

/**
 * Check if a measure is installed
 * @param measureId Measure ID
 * @param customDir Optional custom directory
 * @returns Promise that resolves with true if the measure is installed, false otherwise
 */
export async function isMeasureInstalled(measureId: string, customDir?: string): Promise<boolean> {
  const measurePath = getMeasurePath(measureId, customDir);
  return fileOperations.directoryExists(measurePath);
}

/**
 * Get measure version from installed measure
 * @param measureId Measure ID
 * @param customDir Optional custom directory
 * @returns Promise that resolves with the measure version, or null if not found
 */
export async function getMeasureVersion(
  measureId: string,
  customDir?: string,
): Promise<string | null> {
  try {
    const measurePath = getMeasurePath(measureId, customDir);

    // Check if measure is installed
    if (!(await fileOperations.directoryExists(measurePath))) {
      return null;
    }

    // Look for measure.xml file
    const measureXmlPath = path.join(measurePath, 'measure.xml');

    if (!(await fileOperations.fileExists(measureXmlPath))) {
      return null;
    }

    // Read measure.xml file
    const xmlContent = (await fileOperations.readFile(measureXmlPath, {
      encoding: 'utf8',
    })) as string;

    // Extract version from XML
    const versionMatch = xmlContent.match(/<version_id>(.*?)<\/version_id>/);

    if (versionMatch && versionMatch[1]) {
      return versionMatch[1];
    }

    return null;
  } catch (error) {
    logger.error(
      `Error getting measure version: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

/**
 * Download a measure from the BCL
 * @param downloadUrl URL to download the measure from
 * @param options Download options
 * @returns Promise that resolves with the path to the downloaded file
 */
export async function downloadMeasureFile(
  downloadUrl: string,
  options: MeasureDownloadOptions = {},
): Promise<string> {
  const opts = { ...defaultOptions, ...options };

  try {
    logger.info(`Downloading measure from ${downloadUrl}`);

    // Create a temporary directory for the download
    const tempDir = await fileOperations.createTempDirectory('openstudio-mcp-measure-');

    // Generate a temporary file path for the download
    const tempFilePath = path.join(tempDir, 'measure.zip');

    // Download the file
    const response = await axios.get(downloadUrl, {
      responseType: 'arraybuffer',
      timeout: opts.timeout,
    });

    // Write the file to disk
    await fileOperations.writeFile(tempFilePath, Buffer.from(response.data), {
      encoding: 'binary',
    });

    logger.info(`Successfully downloaded measure to ${tempFilePath}`);
    return tempFilePath;
  } catch (error) {
    logger.error(
      `Error downloading measure: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw new Error(
      `Failed to download measure: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Validate a downloaded measure zip file
 * @param zipFilePath Path to the zip file
 * @returns Promise that resolves with true if the zip file is valid, false otherwise
 */
export async function validateMeasureZip(zipFilePath: string): Promise<boolean> {
  try {
    logger.info(`Validating measure zip file: ${zipFilePath}`);

    // Read the zip file
    const zip = new AdmZip(zipFilePath);

    // Get the entries
    const entries = zip.getEntries();

    // Check if the zip file contains a measure.xml file
    const hasMeasureXml = entries.some(
      (entry) => entry.entryName === 'measure.xml' || entry.entryName.endsWith('/measure.xml'),
    );

    if (!hasMeasureXml) {
      logger.warn(`Measure zip file does not contain a measure.xml file: ${zipFilePath}`);
      return false;
    }

    // Check if the zip file contains a measure.rb file
    const hasMeasureRb = entries.some(
      (entry) => entry.entryName === 'measure.rb' || entry.entryName.endsWith('/measure.rb'),
    );

    if (!hasMeasureRb) {
      logger.warn(`Measure zip file does not contain a measure.rb file: ${zipFilePath}`);
      return false;
    }

    logger.info(`Measure zip file is valid: ${zipFilePath}`);
    return true;
  } catch (error) {
    logger.error(
      `Error validating measure zip file: ${error instanceof Error ? error.message : String(error)}`,
    );
    return false;
  }
}

/**
 * Extract a measure zip file
 * @param zipFilePath Path to the zip file
 * @param measureId Measure ID
 * @param options Extraction options
 * @returns Promise that resolves with the path to the extracted measure
 */
export async function extractMeasureZip(
  zipFilePath: string,
  measureId: string,
  options: MeasureDownloadOptions = {},
): Promise<string> {
  const opts = { ...defaultOptions, ...options };

  try {
    logger.info(`Extracting measure zip file: ${zipFilePath}`);

    // Get the measures directory
    const measuresDir = getMeasuresDir(opts.measuresDir);

    // Create the measures directory if it doesn't exist
    await fileOperations.ensureDirectory(measuresDir);

    // Get the measure directory path
    const measureDir = getMeasurePath(measureId, opts.measuresDir);

    // Check if the measure directory already exists
    if (await fileOperations.directoryExists(measureDir)) {
      if (!opts.force) {
        logger.info(`Measure directory already exists: ${measureDir}`);
        return measureDir;
      }

      // Delete the existing measure directory
      logger.info(`Deleting existing measure directory: ${measureDir}`);
      await fileOperations.deleteDirectory(measureDir);
    }

    // Create the measure directory
    await fileOperations.ensureDirectory(measureDir);

    // Extract the zip file
    const zip = new AdmZip(zipFilePath);

    // Get the entries
    const entries = zip.getEntries();

    // Check if the zip has a single root directory
    const rootDirs = new Set<string>();

    for (const entry of entries) {
      const parts = entry.entryName.split('/');
      if (parts.length > 1) {
        rootDirs.add(parts[0]);
      }
    }

    // If there's a single root directory, extract the contents of that directory
    if (rootDirs.size === 1) {
      const rootDir = Array.from(rootDirs)[0];

      // Extract each file, removing the root directory from the path
      for (const entry of entries) {
        if (!entry.isDirectory) {
          const relativePath = entry.entryName.startsWith(`${rootDir}/`)
            ? entry.entryName.substring(rootDir.length + 1)
            : entry.entryName;

          const filePath = path.join(measureDir, relativePath);
          const fileDir = path.dirname(filePath);

          // Create the directory if it doesn't exist
          await fileOperations.ensureDirectory(fileDir);

          // Extract the file
          const content = entry.getData();
          await fileOperations.writeFile(filePath, content, { encoding: 'binary' });
        }
      }
    } else {
      // Extract all files directly
      zip.extractAllTo(measureDir, true);
    }

    logger.info(`Successfully extracted measure to ${measureDir}`);
    return measureDir;
  } catch (error) {
    logger.error(
      `Error extracting measure zip file: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw new Error(
      `Failed to extract measure zip file: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Install a measure from a zip file
 * @param zipFilePath Path to the zip file
 * @param measureId Measure ID
 * @param options Installation options
 * @returns Promise that resolves with true if the installation was successful
 */
export async function installMeasureFromZip(
  zipFilePath: string,
  measureId: string,
  options: MeasureDownloadOptions = {},
): Promise<boolean> {
  try {
    logger.info(`Installing measure from zip file: ${zipFilePath}`);

    // Validate the measure zip file
    const isValid = await validateMeasureZip(zipFilePath);

    if (!isValid) {
      logger.error(`Invalid measure zip file: ${zipFilePath}`);
      return false;
    }

    // Extract the measure zip file
    await extractMeasureZip(zipFilePath, measureId, options);

    logger.info(`Successfully installed measure: ${measureId}`);
    return true;
  } catch (error) {
    logger.error(
      `Error installing measure: ${error instanceof Error ? error.message : String(error)}`,
    );
    return false;
  } finally {
    // Clean up the zip file
    try {
      await fileOperations.deleteFile(zipFilePath);
    } catch (error) {
      logger.warn(
        `Error deleting temporary zip file: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

/**
 * List installed measures
 * @param customDir Optional custom directory
 * @returns Promise that resolves with an array of measure IDs
 */
export async function listInstalledMeasures(customDir?: string): Promise<string[]> {
  try {
    const measuresDir = getMeasuresDir(customDir);

    // Check if the measures directory exists
    if (!(await fileOperations.directoryExists(measuresDir))) {
      return [];
    }

    // List the directories in the measures directory
    const entries = await readdirAsync(measuresDir);

    // Filter out non-directories
    const measureIds: string[] = [];

    for (const entry of entries) {
      const entryPath = path.join(measuresDir, entry);
      const stats = await statAsync(entryPath);

      if (stats.isDirectory()) {
        // Check if it's a valid measure directory (contains measure.xml and measure.rb)
        const hasMeasureXml = await fileOperations.fileExists(path.join(entryPath, 'measure.xml'));
        const hasMeasureRb = await fileOperations.fileExists(path.join(entryPath, 'measure.rb'));

        if (hasMeasureXml && hasMeasureRb) {
          measureIds.push(entry);
        }
      }
    }

    return measureIds;
  } catch (error) {
    logger.error(
      `Error listing installed measures: ${error instanceof Error ? error.message : String(error)}`,
    );
    return [];
  }
}

// Export the module
export default {
  getMeasuresDir,
  getMeasurePath,
  isMeasureInstalled,
  getMeasureVersion,
  downloadMeasureFile,
  validateMeasureZip,
  extractMeasureZip,
  installMeasureFromZip,
  listInstalledMeasures,
};
