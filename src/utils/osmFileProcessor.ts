/**
 * OSM file processing module
 * 
 * This module provides functions to parse, validate, and modify OpenStudio Model (OSM) files.
 * 
 * Features:
 * - OSM file parsing and validation
 * - Model information extraction
 * - Model modification operations
 * - Integration with OpenStudio CLI commands
 */
import { fileOperations } from './index';
import { executeOpenStudioCommand } from './commandExecutor';
import { logger } from './index';
import { isPathSafe } from './validation';
import path from 'path';
import fs from 'fs';
import { OpenStudioCommandResult, OpenStudioModelInfo } from './openStudioCommands';

/**
 * OSM file processing options
 */
export interface OSMProcessingOptions {
  /** Maximum file size in bytes */
  maxFileSize?: number;
  /** Whether to validate the OSM file */
  validate?: boolean;
  /** Whether to use a temporary file for processing */
  useTemporary?: boolean;
  /** Custom temporary directory */
  tempDir?: string;
  /** Timeout for OpenStudio CLI commands in milliseconds */
  timeout?: number;
}

/**
 * OSM file validation result
 */
export interface OSMValidationResult {
  /** Whether the file is valid */
  valid: boolean;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
}

/**
 * OSM model space information
 */
export interface OSMSpace {
  /** Space name */
  name: string;
  /** Space type */
  type?: string;
  /** Space area in square meters */
  area?: number;
  /** Space volume in cubic meters */
  volume?: number;
  /** Thermal zone name */
  thermalZone?: string;
}

/**
 * OSM model thermal zone information
 */
export interface OSMThermalZone {
  /** Zone name */
  name: string;
  /** Zone type */
  type?: string;
  /** Zone area in square meters */
  area?: number;
  /** Zone volume in cubic meters */
  volume?: number;
  /** Spaces in the zone */
  spaces: string[];
}

/**
 * OSM model construction information
 */
export interface OSMConstruction {
  /** Construction name */
  name: string;
  /** Construction type */
  type?: string;
  /** Construction layers */
  layers: string[];
}

/**
 * OSM model material information
 */
export interface OSMMaterial {
  /** Material name */
  name: string;
  /** Material type */
  type: string;
  /** Material thickness in meters */
  thickness?: number;
  /** Material conductivity in W/m-K */
  conductivity?: number;
  /** Material density in kg/m³ */
  density?: number;
  /** Material specific heat in J/kg-K */
  specificHeat?: number;
}

/**
 * OSM model surface information
 */
export interface OSMSurface {
  /** Surface name */
  name: string;
  /** Surface type */
  type: string;
  /** Surface area in square meters */
  area?: number;
  /** Construction name */
  construction?: string;
  /** Space name */
  space?: string;
  /** Outside boundary condition */
  outsideBoundaryCondition?: string;
}

/**
 * OSM model subsurface information
 */
export interface OSMSubSurface {
  /** Subsurface name */
  name: string;
  /** Subsurface type */
  type: string;
  /** Subsurface area in square meters */
  area?: number;
  /** Construction name */
  construction?: string;
  /** Parent surface name */
  parentSurface?: string;
}

/**
 * OSM model detailed information
 */
export interface OSMModelDetails {
  /** Model information */
  modelInfo: OpenStudioModelInfo;
  /** Spaces in the model */
  spaces?: OSMSpace[];
  /** Thermal zones in the model */
  thermalZones?: OSMThermalZone[];
  /** Constructions in the model */
  constructions?: OSMConstruction[];
  /** Materials in the model */
  materials?: OSMMaterial[];
  /** Surfaces in the model */
  surfaces?: OSMSurface[];
  /** Subsurfaces in the model */
  subSurfaces?: OSMSubSurface[];
}

/**
 * Default OSM processing options
 */
const defaultOptions: OSMProcessingOptions = {
  maxFileSize: 50 * 1024 * 1024, // 50MB
  validate: true,
  useTemporary: true,
  timeout: 300000, // 5 minutes
};

/**
 * Validate an OSM file
 * @param osmFilePath Path to the OSM file
 * @param options Processing options
 * @returns Promise that resolves with the validation result
 */
export async function validateOSMFile(
  osmFilePath: string,
  options: OSMProcessingOptions = {}
): Promise<OSMValidationResult> {
  const opts = { ...defaultOptions, ...options };
  
  // Validate path
  if (!osmFilePath || !isPathSafe(osmFilePath)) {
    return {
      valid: false,
      errors: [`Invalid OSM file path: ${osmFilePath}`],
      warnings: [],
    };
  }

  try {
    // Check if file exists
    if (!await fileOperations.fileExists(osmFilePath)) {
      return {
        valid: false,
        errors: [`OSM file not found: ${osmFilePath}`],
        warnings: [],
      };
    }

    // Check file size
    const stats = await fs.promises.stat(osmFilePath);
    if (opts.maxFileSize && stats.size > opts.maxFileSize) {
      return {
        valid: false,
        errors: [`OSM file size exceeds maximum allowed size (${stats.size} > ${opts.maxFileSize} bytes)`],
        warnings: [],
      };
    }

    // Validate using OpenStudio CLI
    const result = await executeOpenStudioCommand('model', ['--validate', osmFilePath], {
      timeout: opts.timeout,
    });

    // Parse validation results
    const validationResult: OSMValidationResult = {
      valid: result.success,
      errors: [],
      warnings: [],
    };

    if (result.stdout) {
      // Extract errors
      const errorMatches = result.stdout.match(/Error: ([^\n]+)/g);
      if (errorMatches) {
        validationResult.errors = errorMatches.map(match => match.replace('Error: ', '').trim());
      }

      // Extract warnings
      const warningMatches = result.stdout.match(/Warning: ([^\n]+)/g);
      if (warningMatches) {
        validationResult.warnings = warningMatches.map(match => match.replace('Warning: ', '').trim());
      }
    }

    // If there are errors, mark as invalid
    if (validationResult.errors.length > 0) {
      validationResult.valid = false;
    }

    return validationResult;
  } catch (error) {
    logger.error({ osmFilePath, error }, 'Failed to validate OSM file');
    
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: [],
    };
  }
}

/**
 * Extract information from an OSM file
 * @param osmFilePath Path to the OSM file
 * @param detailLevel Level of detail to extract ('basic', 'detailed', 'complete')
 * @param options Processing options
 * @returns Promise that resolves with the model information
 */
export async function extractOSMInformation(
  osmFilePath: string,
  detailLevel: 'basic' | 'detailed' | 'complete' = 'basic',
  options: OSMProcessingOptions = {}
): Promise<OpenStudioCommandResult> {
  const opts = { ...defaultOptions, ...options };
  
  // Validate path
  if (!osmFilePath || !isPathSafe(osmFilePath)) {
    return {
      success: false,
      output: '',
      error: `Invalid OSM file path: ${osmFilePath}`,
    };
  }

  try {
    // Check if file exists
    if (!await fileOperations.fileExists(osmFilePath)) {
      return {
        success: false,
        output: '',
        error: `OSM file not found: ${osmFilePath}`,
      };
    }

    // Check file size
    const stats = await fs.promises.stat(osmFilePath);
    if (opts.maxFileSize && stats.size > opts.maxFileSize) {
      return {
        success: false,
        output: '',
        error: `OSM file size exceeds maximum allowed size (${stats.size} > ${opts.maxFileSize} bytes)`,
      };
    }

    // Validate if requested
    if (opts.validate) {
      const validationResult = await validateOSMFile(osmFilePath, opts);
      if (!validationResult.valid) {
        return {
          success: false,
          output: '',
          error: `OSM file validation failed: ${validationResult.errors.join(', ')}`,
          data: validationResult,
        };
      }
    }

    // Get model information
    const args = ['--info'];
    
    if (detailLevel === 'detailed' || detailLevel === 'complete') {
      args.push('--detailed');
    }
    
    if (detailLevel === 'complete') {
      args.push('--complete');
    }
    
    args.push(osmFilePath);
    
    const result = await executeOpenStudioCommand('model', args, {
      timeout: opts.timeout,
    });
    
    // Parse the model information
    const modelInfo: OpenStudioModelInfo = {
      version: '',
      spaces: 0,
      thermalZones: 0,
      constructions: 0,
      materials: 0,
    };
    
    if (result.success && result.stdout) {
      // Extract version
      const versionMatch = result.stdout.match(/OpenStudio Version: ([^\n]+)/);
      if (versionMatch) {
        modelInfo.version = versionMatch[1].trim();
      }
      
      // Extract spaces
      const spacesMatch = result.stdout.match(/Spaces: (\d+)/);
      if (spacesMatch) {
        modelInfo.spaces = parseInt(spacesMatch[1], 10);
      }
      
      // Extract thermal zones
      const thermalZonesMatch = result.stdout.match(/Thermal Zones: (\d+)/);
      if (thermalZonesMatch) {
        modelInfo.thermalZones = parseInt(thermalZonesMatch[1], 10);
      }
      
      // Extract constructions
      const constructionsMatch = result.stdout.match(/Constructions: (\d+)/);
      if (constructionsMatch) {
        modelInfo.constructions = parseInt(constructionsMatch[1], 10);
      }
      
      // Extract materials
      const materialsMatch = result.stdout.match(/Materials: (\d+)/);
      if (materialsMatch) {
        modelInfo.materials = parseInt(materialsMatch[1], 10);
      }
      
      // Extract weather file
      const weatherFileMatch = result.stdout.match(/Weather File: ([^\n]+)/);
      if (weatherFileMatch) {
        modelInfo.weatherFile = weatherFileMatch[1].trim();
      }
      
      // Extract building type
      const buildingTypeMatch = result.stdout.match(/Building Type: ([^\n]+)/);
      if (buildingTypeMatch) {
        modelInfo.buildingType = buildingTypeMatch[1].trim();
      }
      
      // Extract floor area
      const floorAreaMatch = result.stdout.match(/Floor Area: ([\d.]+) m²/);
      if (floorAreaMatch) {
        modelInfo.floorArea = parseFloat(floorAreaMatch[1]);
      }
      
      // Extract stories
      const storiesMatch = result.stdout.match(/Stories: (\d+)/);
      if (storiesMatch) {
        modelInfo.stories = parseInt(storiesMatch[1], 10);
      }
    }
    
    return {
      success: result.success,
      output: result.stdout,
      error: result.error,
      data: modelInfo,
    };
  } catch (error) {
    logger.error({ osmFilePath, detailLevel, error }, 'Failed to extract OSM information');
    
    return {
      success: false,
      output: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Extract detailed information from an OSM file
 * @param osmFilePath Path to the OSM file
 * @param options Processing options
 * @returns Promise that resolves with the detailed model information
 */
export async function extractDetailedOSMInformation(
  osmFilePath: string,
  options: OSMProcessingOptions = {}
): Promise<OSMModelDetails | null> {
  try {
    // Get basic model information first
    const basicInfoResult = await extractOSMInformation(osmFilePath, 'basic', options);
    
    if (!basicInfoResult.success || !basicInfoResult.data) {
      logger.error({ osmFilePath, error: basicInfoResult.error }, 'Failed to extract basic OSM information');
      return null;
    }
    
    // Now get detailed information using OpenStudio CLI
    const detailedResult = await executeOpenStudioCommand('model', ['--detailed', '--complete', osmFilePath], {
      timeout: options.timeout || defaultOptions.timeout,
    });
    
    if (!detailedResult.success) {
      logger.error({ osmFilePath, error: detailedResult.error }, 'Failed to extract detailed OSM information');
      return null;
    }
    
    // Parse the detailed output
    const modelDetails: OSMModelDetails = {
      modelInfo: basicInfoResult.data as OpenStudioModelInfo,
      spaces: [],
      thermalZones: [],
      constructions: [],
      materials: [],
      surfaces: [],
      subSurfaces: [],
    };
    
    // Parse spaces
    const spacesSection = detailedResult.stdout.match(/Spaces:([\s\S]*?)(?=Thermal Zones:|$)/);
    if (spacesSection && spacesSection[1]) {
      const spaceLines = spacesSection[1].trim().split('\n');
      
      for (const line of spaceLines) {
        const spaceMatch = line.match(/\s*(.+?):\s*Type\s*=\s*(.+?),\s*Area\s*=\s*([\d.]+)\s*m²,\s*Volume\s*=\s*([\d.]+)\s*m³(?:,\s*Thermal Zone\s*=\s*(.+))?/);
        
        if (spaceMatch) {
          modelDetails.spaces?.push({
            name: spaceMatch[1].trim(),
            type: spaceMatch[2].trim(),
            area: parseFloat(spaceMatch[3]),
            volume: parseFloat(spaceMatch[4]),
            thermalZone: spaceMatch[5]?.trim(),
          });
        }
      }
    }
    
    // Parse thermal zones
    const zonesSection = detailedResult.stdout.match(/Thermal Zones:([\s\S]*?)(?=Constructions:|$)/);
    if (zonesSection && zonesSection[1]) {
      const zoneLines = zonesSection[1].trim().split('\n');
      
      for (const line of zoneLines) {
        const zoneMatch = line.match(/\s*(.+?):\s*Type\s*=\s*(.+?),\s*Area\s*=\s*([\d.]+)\s*m²,\s*Volume\s*=\s*([\d.]+)\s*m³,\s*Spaces\s*=\s*(.+)/);
        
        if (zoneMatch) {
          modelDetails.thermalZones?.push({
            name: zoneMatch[1].trim(),
            type: zoneMatch[2].trim(),
            area: parseFloat(zoneMatch[3]),
            volume: parseFloat(zoneMatch[4]),
            spaces: zoneMatch[5].split(',').map(s => s.trim()),
          });
        }
      }
    }
    
    // Parse constructions
    const constructionsSection = detailedResult.stdout.match(/Constructions:([\s\S]*?)(?=Materials:|$)/);
    if (constructionsSection && constructionsSection[1]) {
      const constructionLines = constructionsSection[1].trim().split('\n');
      
      for (const line of constructionLines) {
        const constructionMatch = line.match(/\s*(.+?):\s*Type\s*=\s*(.+?),\s*Layers\s*=\s*(.+)/);
        
        if (constructionMatch) {
          modelDetails.constructions?.push({
            name: constructionMatch[1].trim(),
            type: constructionMatch[2].trim(),
            layers: constructionMatch[3].split(',').map(l => l.trim()),
          });
        }
      }
    }
    
    // Parse materials
    const materialsSection = detailedResult.stdout.match(/Materials:([\s\S]*?)(?=Surfaces:|$)/);
    if (materialsSection && materialsSection[1]) {
      const materialLines = materialsSection[1].trim().split('\n');
      
      for (const line of materialLines) {
        const materialMatch = line.match(/\s*(.+?):\s*Type\s*=\s*(.+?)(?:,\s*Thickness\s*=\s*([\d.]+)\s*m)?(?:,\s*Conductivity\s*=\s*([\d.]+)\s*W\/m-K)?(?:,\s*Density\s*=\s*([\d.]+)\s*kg\/m³)?(?:,\s*Specific Heat\s*=\s*([\d.]+)\s*J\/kg-K)?/);
        
        if (materialMatch) {
          modelDetails.materials?.push({
            name: materialMatch[1].trim(),
            type: materialMatch[2].trim(),
            thickness: materialMatch[3] ? parseFloat(materialMatch[3]) : undefined,
            conductivity: materialMatch[4] ? parseFloat(materialMatch[4]) : undefined,
            density: materialMatch[5] ? parseFloat(materialMatch[5]) : undefined,
            specificHeat: materialMatch[6] ? parseFloat(materialMatch[6]) : undefined,
          });
        }
      }
    }
    
    // Parse surfaces
    const surfacesSection = detailedResult.stdout.match(/Surfaces:([\s\S]*?)(?=SubSurfaces:|$)/);
    if (surfacesSection && surfacesSection[1]) {
      const surfaceLines = surfacesSection[1].trim().split('\n');
      
      for (const line of surfaceLines) {
        const surfaceMatch = line.match(/\s*(.+?):\s*Type\s*=\s*(.+?)(?:,\s*Area\s*=\s*([\d.]+)\s*m²)?(?:,\s*Construction\s*=\s*(.+?))?(?:,\s*Space\s*=\s*(.+?))?(?:,\s*Outside Boundary Condition\s*=\s*(.+))?/);
        
        if (surfaceMatch) {
          modelDetails.surfaces?.push({
            name: surfaceMatch[1].trim(),
            type: surfaceMatch[2].trim(),
            area: surfaceMatch[3] ? parseFloat(surfaceMatch[3]) : undefined,
            construction: surfaceMatch[4]?.trim(),
            space: surfaceMatch[5]?.trim(),
            outsideBoundaryCondition: surfaceMatch[6]?.trim(),
          });
        }
      }
    }
    
    // Parse subsurfaces
    const subSurfacesSection = detailedResult.stdout.match(/SubSurfaces:([\s\S]*?)(?=$)/);
    if (subSurfacesSection && subSurfacesSection[1]) {
      const subSurfaceLines = subSurfacesSection[1].trim().split('\n');
      
      for (const line of subSurfaceLines) {
        const subSurfaceMatch = line.match(/\s*(.+?):\s*Type\s*=\s*(.+?)(?:,\s*Area\s*=\s*([\d.]+)\s*m²)?(?:,\s*Construction\s*=\s*(.+?))?(?:,\s*Parent Surface\s*=\s*(.+))?/);
        
        if (subSurfaceMatch) {
          modelDetails.subSurfaces?.push({
            name: subSurfaceMatch[1].trim(),
            type: subSurfaceMatch[2].trim(),
            area: subSurfaceMatch[3] ? parseFloat(subSurfaceMatch[3]) : undefined,
            construction: subSurfaceMatch[4]?.trim(),
            parentSurface: subSurfaceMatch[5]?.trim(),
          });
        }
      }
    }
    
    return modelDetails;
  } catch (error) {
    logger.error({ osmFilePath, error }, 'Failed to extract detailed OSM information');
    return null;
  }
}

/**
 * Modify an OSM file by applying a measure
 * @param osmFilePath Path to the OSM file
 * @param measurePath Path to the measure directory
 * @param measureArgs Measure arguments
 * @param outputPath Path to save the modified model (optional)
 * @param options Processing options
 * @returns Promise that resolves with the command result
 */
export async function modifyOSMWithMeasure(
  osmFilePath: string,
  measurePath: string,
  measureArgs: Record<string, any>,
  outputPath?: string,
  options: OSMProcessingOptions = {}
): Promise<OpenStudioCommandResult> {
  const opts = { ...defaultOptions, ...options };
  
  // Validate paths
  if (!osmFilePath || !isPathSafe(osmFilePath)) {
    return {
      success: false,
      output: '',
      error: `Invalid OSM file path: ${osmFilePath}`,
    };
  }
  
  if (!measurePath || !isPathSafe(measurePath)) {
    return {
      success: false,
      output: '',
      error: `Invalid measure path: ${measurePath}`,
    };
  }
  
  if (outputPath && !isPathSafe(outputPath)) {
    return {
      success: false,
      output: '',
      error: `Invalid output path: ${outputPath}`,
    };
  }

  try {
    // Check if files exist
    if (!await fileOperations.fileExists(osmFilePath)) {
      return {
        success: false,
        output: '',
        error: `OSM file not found: ${osmFilePath}`,
      };
    }
    
    if (!await fileOperations.directoryExists(measurePath)) {
      return {
        success: false,
        output: '',
        error: `Measure directory not found: ${measurePath}`,
      };
    }

    // Validate if requested
    if (opts.validate) {
      const validationResult = await validateOSMFile(osmFilePath, opts);
      if (!validationResult.valid) {
        return {
          success: false,
          output: '',
          error: `OSM file validation failed: ${validationResult.errors.join(', ')}`,
          data: validationResult,
        };
      }
    }

    // Create a temporary file if requested
    let tempFilePath: string | undefined;
    let actualOutputPath = outputPath;
    
    if (opts.useTemporary && !outputPath) {
      tempFilePath = await fileOperations.createTempFile('', {
        tempDir: opts.tempDir,
      });
      actualOutputPath = tempFilePath;
    }

    // Prepare measure arguments
    const args = ['--apply', measurePath, osmFilePath];
    
    // Add measure arguments
    for (const [key, value] of Object.entries(measureArgs)) {
      args.push('--argument', `${key}=${value}`);
    }
    
    // Add output path if specified
    if (actualOutputPath) {
      args.push('--output', actualOutputPath);
    }
    
    // Apply the measure
    const result = await executeOpenStudioCommand('measure', args, {
      timeout: opts.timeout,
    });
    
    // If using a temporary file and the command was successful, copy to the original file
    if (tempFilePath && result.success) {
      await fileOperations.copyFile(tempFilePath, osmFilePath, { overwrite: true });
      await fileOperations.deleteFile(tempFilePath);
    }
    
    return {
      success: result.success,
      output: result.stdout,
      error: result.error,
      data: {
        modelPath: outputPath || osmFilePath,
        measurePath,
        arguments: measureArgs,
      },
    };
  } catch (error) {
    logger.error({ osmFilePath, measurePath, measureArgs, outputPath, error }, 'Failed to modify OSM with measure');
    
    return {
      success: false,
      output: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Convert an OSM file to a different format
 * @param osmFilePath Path to the OSM file
 * @param outputPath Path to save the converted file
 * @param options Processing options
 * @returns Promise that resolves with the command result
 */
export async function convertOSMFile(
  osmFilePath: string,
  outputPath: string,
  options: OSMProcessingOptions = {}
): Promise<OpenStudioCommandResult> {
  const opts = { ...defaultOptions, ...options };
  
  // Validate paths
  if (!osmFilePath || !isPathSafe(osmFilePath)) {
    return {
      success: false,
      output: '',
      error: `Invalid OSM file path: ${osmFilePath}`,
    };
  }
  
  if (!outputPath || !isPathSafe(outputPath)) {
    return {
      success: false,
      output: '',
      error: `Invalid output path: ${outputPath}`,
    };
  }

  try {
    // Check if file exists
    if (!await fileOperations.fileExists(osmFilePath)) {
      return {
        success: false,
        output: '',
        error: `OSM file not found: ${osmFilePath}`,
      };
    }

    // Validate if requested
    if (opts.validate) {
      const validationResult = await validateOSMFile(osmFilePath, opts);
      if (!validationResult.valid) {
        return {
          success: false,
          output: '',
          error: `OSM file validation failed: ${validationResult.errors.join(', ')}`,
          data: validationResult,
        };
      }
    }

    // Ensure the output directory exists
    const directory = path.dirname(outputPath);
    await fileOperations.ensureDirectory(directory);
    
    // Determine the conversion type based on file extensions
    const inputExt = path.extname(osmFilePath).toLowerCase();
    const outputExt = path.extname(outputPath).toLowerCase();
    
    // Prepare conversion arguments
    const args = ['--convert', osmFilePath, outputPath];
    
    // Convert the model
    const result = await executeOpenStudioCommand('model', args, {
      timeout: opts.timeout,
    });
    
    return {
      success: result.success,
      output: result.stdout,
      error: result.error,
      data: {
        inputPath: osmFilePath,
        outputPath,
        inputFormat: inputExt,
        outputFormat: outputExt,
      },
    };
  } catch (error) {
    logger.error({ osmFilePath, outputPath, error }, 'Failed to convert OSM file');
    
    return {
      success: false,
      output: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Merge two OSM files
 * @param primaryOSMPath Path to the primary OSM file
 * @param secondaryOSMPath Path to the secondary OSM file
 * @param outputPath Path to save the merged model
 * @param options Processing options
 * @returns Promise that resolves with the command result
 */
export async function mergeOSMFiles(
  primaryOSMPath: string,
  secondaryOSMPath: string,
  outputPath: string,
  options: OSMProcessingOptions = {}
): Promise<OpenStudioCommandResult> {
  const opts = { ...defaultOptions, ...options };
  
  // Validate paths
  if (!primaryOSMPath || !isPathSafe(primaryOSMPath)) {
    return {
      success: false,
      output: '',
      error: `Invalid primary OSM file path: ${primaryOSMPath}`,
    };
  }
  
  if (!secondaryOSMPath || !isPathSafe(secondaryOSMPath)) {
    return {
      success: false,
      output: '',
      error: `Invalid secondary OSM file path: ${secondaryOSMPath}`,
    };
  }
  
  if (!outputPath || !isPathSafe(outputPath)) {
    return {
      success: false,
      output: '',
      error: `Invalid output path: ${outputPath}`,
    };
  }

  try {
    // Check if files exist
    if (!await fileOperations.fileExists(primaryOSMPath)) {
      return {
        success: false,
        output: '',
        error: `Primary OSM file not found: ${primaryOSMPath}`,
      };
    }
    
    if (!await fileOperations.fileExists(secondaryOSMPath)) {
      return {
        success: false,
        output: '',
        error: `Secondary OSM file not found: ${secondaryOSMPath}`,
      };
    }

    // Validate if requested
    if (opts.validate) {
      const primaryValidation = await validateOSMFile(primaryOSMPath, opts);
      if (!primaryValidation.valid) {
        return {
          success: false,
          output: '',
          error: `Primary OSM file validation failed: ${primaryValidation.errors.join(', ')}`,
          data: primaryValidation,
        };
      }
      
      const secondaryValidation = await validateOSMFile(secondaryOSMPath, opts);
      if (!secondaryValidation.valid) {
        return {
          success: false,
          output: '',
          error: `Secondary OSM file validation failed: ${secondaryValidation.errors.join(', ')}`,
          data: secondaryValidation,
        };
      }
    }

    // Ensure the output directory exists
    const directory = path.dirname(outputPath);
    await fileOperations.ensureDirectory(directory);
    
    // Prepare merge arguments
    const args = ['--merge', primaryOSMPath, secondaryOSMPath, outputPath];
    
    // Merge the models
    const result = await executeOpenStudioCommand('model', args, {
      timeout: opts.timeout,
    });
    
    return {
      success: result.success,
      output: result.stdout,
      error: result.error,
      data: {
        primaryModelPath: primaryOSMPath,
        secondaryModelPath: secondaryOSMPath,
        outputPath,
      },
    };
  } catch (error) {
    logger.error({ primaryOSMPath, secondaryOSMPath, outputPath, error }, 'Failed to merge OSM files');
    
    return {
      success: false,
      output: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Export the module
export default {
  validateOSMFile,
  extractOSMInformation,
  extractDetailedOSMInformation,
  modifyOSMWithMeasure,
  convertOSMFile,
  mergeOSMFiles,
};