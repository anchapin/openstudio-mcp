/**
 * Request validation utilities
 */
import Ajv, { JSONSchemaType } from 'ajv';
import addFormats from 'ajv-formats';
import { MCPRequest } from '../interfaces';
import { logger } from './index';

// Initialize Ajv with formats
const ajv = new Ajv({
  allErrors: true,
  strict: false,
  strictSchema: false,
  coerceTypes: true, // Automatically coerce types when possible
});

// Add formats like uri, email, etc.
addFormats(ajv);

// Add custom formats
ajv.addFormat('file-path', {
  type: 'string',
  validate: (path: string) => {
    // Basic path validation - could be enhanced for platform-specific rules
    return !path.includes('..') && isPathSafe(path);
  },
});

/**
 * Base schema for all MCP requests
 */
const baseRequestSchema: JSONSchemaType<MCPRequest> = {
  type: 'object',
  required: ['id', 'type', 'params'],
  properties: {
    id: {
      type: 'string',
      description: 'Unique identifier for the request',
    },
    type: {
      type: 'string',
      description: 'Type of request to execute',
    },
    params: {
      type: 'object',
      required: [],
      properties: {
        command: {
          type: 'string',
          nullable: true,
          description: 'Command to execute',
        },
        modelPath: {
          type: 'string',
          nullable: true,
          description: 'Path to the OpenStudio model file',
        },
        measureId: {
          type: 'string',
          nullable: true,
          description: 'ID of the measure to use',
        },
        measureParams: {
          type: 'object',
          nullable: true,
          additionalProperties: true,
          description: 'Parameters for the measure',
        },
        query: {
          type: 'string',
          nullable: true,
          description: 'Search query',
        },
      },
      additionalProperties: true,
    },
  },
  additionalProperties: false,
};

// Compile the base schema
const validateBaseRequest = ajv.compile(baseRequestSchema);

/**
 * Schema for openstudio.model.create request
 */
const modelCreateSchema = {
  type: 'object',
  required: ['templateType', 'path'],
  properties: {
    templateType: {
      type: 'string',
      enum: ['empty', 'office', 'residential'],
      description: 'Type of template to use for model creation',
    },
    path: {
      type: 'string',
      format: 'file-path',
      description: 'Path where the model should be saved',
    },
  },
  additionalProperties: false,
};

/**
 * Schema for openstudio.model.open request
 */
const modelOpenSchema = {
  type: 'object',
  required: ['path'],
  properties: {
    path: {
      type: 'string',
      format: 'file-path',
      description: 'Path to the model file to open',
    },
  },
  additionalProperties: false,
};

/**
 * Schema for openstudio.model.save request
 */
const modelSaveSchema = {
  type: 'object',
  required: ['path'],
  properties: {
    path: {
      type: 'string',
      format: 'file-path',
      description: 'Path where the model should be saved',
    },
  },
  additionalProperties: false,
};

/**
 * Schema for openstudio.simulation.run request
 */
const simulationRunSchema = {
  type: 'object',
  required: ['modelPath'],
  properties: {
    modelPath: {
      type: 'string',
      format: 'file-path',
      description: 'Path to the model file to simulate',
    },
    weatherFile: {
      type: 'string',
      nullable: true,
      format: 'file-path',
      description: 'Path to the weather file to use for simulation',
    },
    outputDirectory: {
      type: 'string',
      nullable: true,
      format: 'file-path',
      description: 'Directory where simulation results should be saved',
    },
    autoConfig: {
      type: 'boolean',
      nullable: true,
      default: false,
      description:
        'Whether to automatically configure simulation parameters based on model analysis',
    },
    options: {
      type: 'object',
      nullable: true,
      properties: {
        designDaysOnly: {
          type: 'boolean',
          nullable: true,
          description: 'Whether to run design days only',
        },
        annualSimulation: {
          type: 'boolean',
          nullable: true,
          description: 'Whether to run annual simulation',
        },
        fastRun: {
          type: 'boolean',
          nullable: true,
          description: 'Whether to run in fast mode (less accurate)',
        },
        includeRadiance: {
          type: 'boolean',
          nullable: true,
          description: 'Whether to include radiative calculations',
        },
        parallel: {
          type: 'boolean',
          nullable: true,
          description: 'Whether to run in parallel',
        },
        jobs: {
          type: 'number',
          nullable: true,
          minimum: 1,
          description: 'Number of parallel jobs',
        },
        timeout: {
          type: 'number',
          nullable: true,
          minimum: 1000,
          description: 'Timeout in milliseconds',
        },
        memoryLimit: {
          type: 'number',
          nullable: true,
          minimum: 1024,
          description: 'Memory limit in MB',
        },
      },
      additionalProperties: false,
      description: 'Simulation options',
    },
  },
  additionalProperties: false,
};

/**
 * Schema for openstudio.bcl.search request
 */
const bclSearchSchema = {
  type: 'object',
  required: ['query'],
  properties: {
    query: {
      type: 'string',
      description: 'Search query for BCL measures',
    },
    limit: {
      type: 'number',
      nullable: true,
      minimum: 1,
      maximum: 100,
      default: 20,
      description: 'Maximum number of results to return (1-100)',
    },
  },
  additionalProperties: false,
};

/**
 * Schema for openstudio.bcl.download request
 */
const bclDownloadSchema = {
  type: 'object',
  required: ['measureId'],
  properties: {
    measureId: {
      type: 'string',
      description: 'ID of the measure to download from BCL',
    },
  },
  additionalProperties: false,
};

/**
 * Schema for openstudio.measure.apply request
 */
const measureApplySchema = {
  type: 'object',
  required: ['modelPath', 'measureId'],
  properties: {
    modelPath: {
      type: 'string',
      format: 'file-path',
      description: 'Path to the model file to apply the measure to',
    },
    measureId: {
      type: 'string',
      description: 'ID of the measure to apply',
    },
    arguments: {
      type: 'object',
      nullable: true,
      additionalProperties: true,
      description: 'Arguments to pass to the measure',
    },
    mapParameters: {
      type: 'boolean',
      nullable: true,
      default: false,
      description: 'Whether to map user parameters to measure arguments',
    },
    downloadIfNeeded: {
      type: 'boolean',
      nullable: true,
      default: false,
      description: 'Whether to download the measure from BCL if not installed',
    },
    createBackup: {
      type: 'boolean',
      nullable: true,
      default: true,
      description: 'Whether to create a backup of the original model',
    },
    validateModel: {
      type: 'boolean',
      nullable: true,
      default: true,
      description: 'Whether to validate the model before applying the measure',
    },
    validateMeasure: {
      type: 'boolean',
      nullable: true,
      default: true,
      description: 'Whether to validate the measure before applying',
    },
    inPlace: {
      type: 'boolean',
      nullable: true,
      default: false,
      description: 'Whether to apply the measure in-place (modify the original model)',
    },
    outputPath: {
      type: 'string',
      nullable: true,
      format: 'file-path',
      description: 'Custom output path for the modified model',
    },
  },
  additionalProperties: false,
};

// Compile all parameter schemas
const validateModelCreate = ajv.compile(modelCreateSchema);
const validateModelOpen = ajv.compile(modelOpenSchema);
const validateModelSave = ajv.compile(modelSaveSchema);
const validateSimulationRun = ajv.compile(simulationRunSchema);
const validateBclSearch = ajv.compile(bclSearchSchema);
const validateBclDownload = ajv.compile(bclDownloadSchema);
const validateMeasureApply = ajv.compile(measureApplySchema);

/**
 * Schema for openstudio.model.info request
 */
const modelInfoSchema = {
  type: 'object',
  required: ['modelPath'],
  properties: {
    modelPath: {
      type: 'string',
      format: 'file-path',
      description: 'Path to the model file to get information about',
    },
    detailLevel: {
      type: 'string',
      enum: ['basic', 'detailed', 'complete'],
      default: 'basic',
      description: 'Level of detail to include in the model information',
    },
  },
  additionalProperties: false,
};

/**
 * Schema for openstudio.bcl.recommend request
 */
const bclRecommendSchema = {
  type: 'object',
  required: ['context'],
  properties: {
    context: {
      type: 'string',
      description: 'Context description for measure recommendation',
    },
    modelPath: {
      type: 'string',
      nullable: true,
      format: 'file-path',
      description: 'Optional path to a model file for context-aware recommendations',
    },
    limit: {
      type: 'number',
      nullable: true,
      minimum: 1,
      maximum: 20,
      default: 5,
      description: 'Maximum number of recommendations to return (1-20)',
    },
  },
  additionalProperties: false,
};

// Compile additional schemas
const validateModelInfo = ajv.compile(modelInfoSchema);
const validateBclRecommend = ajv.compile(bclRecommendSchema);

/**
 * Schema for openstudio.simulation.status request
 */
const simulationStatusSchema = {
  type: 'object',
  required: ['simulationId'],
  properties: {
    simulationId: {
      type: 'string',
      description: 'ID of the simulation to check',
    },
  },
  additionalProperties: false,
};

/**
 * Schema for openstudio.simulation.cancel request
 */
const simulationCancelSchema = {
  type: 'object',
  required: ['simulationId'],
  properties: {
    simulationId: {
      type: 'string',
      description: 'ID of the simulation to cancel',
    },
  },
  additionalProperties: false,
};

// Compile additional schemas
const validateSimulationStatus = ajv.compile(simulationStatusSchema);
const validateSimulationCancel = ajv.compile(simulationCancelSchema);

/**
 * Schema for openstudio.measure.workflow.create request
 */
const measureWorkflowCreateSchema = {
  type: 'object',
  properties: {
    templateName: {
      type: 'string',
      nullable: true,
      enum: ['energy_efficiency', 'hvac_upgrade', 'lighting_upgrade', 'envelope_upgrade'],
      description: 'Name of the workflow template to use',
    },
    modelPath: {
      type: 'string',
      nullable: true,
      format: 'file-path',
      description: 'Path to the model file for the workflow',
    },
    workflow: {
      type: 'object',
      nullable: true,
      properties: {
        name: {
          type: 'string',
          description: 'Name of the workflow',
        },
        description: {
          type: 'string',
          nullable: true,
          description: 'Description of the workflow',
        },
        inputModelPath: {
          type: 'string',
          format: 'file-path',
          description: 'Path to the input model file',
        },
        steps: {
          type: 'array',
          items: {
            type: 'object',
            required: ['name', 'measureId', 'arguments'],
            properties: {
              name: {
                type: 'string',
                description: 'Name of the step',
              },
              description: {
                type: 'string',
                nullable: true,
                description: 'Description of the step',
              },
              measureId: {
                type: 'string',
                description: 'ID of the measure to apply',
              },
              arguments: {
                type: 'object',
                additionalProperties: true,
                description: 'Arguments for the measure',
              },
              inPlace: {
                type: 'boolean',
                nullable: true,
                description: 'Whether to apply the measure in-place',
              },
              outputPath: {
                type: 'string',
                nullable: true,
                format: 'file-path',
                description: 'Custom output path for the step',
              },
            },
            additionalProperties: false,
          },
          description: 'Steps in the workflow',
        },
        stopOnError: {
          type: 'boolean',
          nullable: true,
          default: true,
          description: 'Whether to stop the workflow if a step fails',
        },
        createBackup: {
          type: 'boolean',
          nullable: true,
          default: true,
          description: 'Whether to create a backup of the original model',
        },
        validate: {
          type: 'boolean',
          nullable: true,
          default: true,
          description: 'Whether to validate models and measures',
        },
      },
      additionalProperties: false,
      description: 'Custom workflow definition',
    },
  },
  oneOf: [{ required: ['templateName', 'modelPath'] }, { required: ['workflow'] }],
  additionalProperties: false,
};

/**
 * Schema for openstudio.measure.workflow.execute request
 */
const measureWorkflowExecuteSchema = {
  type: 'object',
  required: ['workflow'],
  properties: {
    workflow: {
      type: 'object',
      required: ['name', 'inputModelPath', 'steps'],
      properties: {
        name: {
          type: 'string',
          description: 'Name of the workflow',
        },
        description: {
          type: 'string',
          nullable: true,
          description: 'Description of the workflow',
        },
        inputModelPath: {
          type: 'string',
          format: 'file-path',
          description: 'Path to the input model file',
        },
        steps: {
          type: 'array',
          items: {
            type: 'object',
            required: ['name', 'measureId', 'arguments'],
            properties: {
              name: {
                type: 'string',
                description: 'Name of the step',
              },
              description: {
                type: 'string',
                nullable: true,
                description: 'Description of the step',
              },
              measureId: {
                type: 'string',
                description: 'ID of the measure to apply',
              },
              arguments: {
                type: 'object',
                additionalProperties: true,
                description: 'Arguments for the measure',
              },
              inPlace: {
                type: 'boolean',
                nullable: true,
                description: 'Whether to apply the measure in-place',
              },
              outputPath: {
                type: 'string',
                nullable: true,
                format: 'file-path',
                description: 'Custom output path for the step',
              },
            },
            additionalProperties: false,
          },
          description: 'Steps in the workflow',
        },
        stopOnError: {
          type: 'boolean',
          nullable: true,
          default: true,
          description: 'Whether to stop the workflow if a step fails',
        },
        createBackup: {
          type: 'boolean',
          nullable: true,
          default: true,
          description: 'Whether to create a backup of the original model',
        },
        validate: {
          type: 'boolean',
          nullable: true,
          default: true,
          description: 'Whether to validate models and measures',
        },
      },
      additionalProperties: false,
      description: 'Workflow to execute',
    },
    downloadMeasures: {
      type: 'boolean',
      nullable: true,
      default: false,
      description: 'Whether to download measures from BCL if not installed',
    },
    validateBeforeExecution: {
      type: 'boolean',
      nullable: true,
      default: true,
      description: 'Whether to validate the workflow before execution',
    },
    generateReport: {
      type: 'boolean',
      nullable: true,
      default: false,
      description: 'Whether to generate a report after execution',
    },
  },
  additionalProperties: false,
};

/**
 * Schema for openstudio.measure.workflow.validate request
 */
const measureWorkflowValidateSchema = {
  type: 'object',
  required: ['workflow'],
  properties: {
    workflow: {
      type: 'object',
      required: ['name', 'inputModelPath', 'steps'],
      properties: {
        name: {
          type: 'string',
          description: 'Name of the workflow',
        },
        description: {
          type: 'string',
          nullable: true,
          description: 'Description of the workflow',
        },
        inputModelPath: {
          type: 'string',
          format: 'file-path',
          description: 'Path to the input model file',
        },
        steps: {
          type: 'array',
          items: {
            type: 'object',
            required: ['name', 'measureId', 'arguments'],
            properties: {
              name: {
                type: 'string',
                description: 'Name of the step',
              },
              description: {
                type: 'string',
                nullable: true,
                description: 'Description of the step',
              },
              measureId: {
                type: 'string',
                description: 'ID of the measure to apply',
              },
              arguments: {
                type: 'object',
                additionalProperties: true,
                description: 'Arguments for the measure',
              },
              inPlace: {
                type: 'boolean',
                nullable: true,
                description: 'Whether to apply the measure in-place',
              },
              outputPath: {
                type: 'string',
                nullable: true,
                format: 'file-path',
                description: 'Custom output path for the step',
              },
            },
            additionalProperties: false,
          },
          description: 'Steps in the workflow',
        },
        stopOnError: {
          type: 'boolean',
          nullable: true,
          default: true,
          description: 'Whether to stop the workflow if a step fails',
        },
        createBackup: {
          type: 'boolean',
          nullable: true,
          default: true,
          description: 'Whether to create a backup of the original model',
        },
        validate: {
          type: 'boolean',
          nullable: true,
          default: true,
          description: 'Whether to validate models and measures',
        },
      },
      additionalProperties: false,
      description: 'Workflow to validate',
    },
  },
  additionalProperties: false,
};

// Compile the new schemas
const validateMeasureWorkflowCreate = ajv.compile(measureWorkflowCreateSchema);
const validateMeasureWorkflowExecute = ajv.compile(measureWorkflowExecuteSchema);
const validateMeasureWorkflowValidate = ajv.compile(measureWorkflowValidateSchema);

// Map of request types to their parameter validators
const requestValidators: Record<string, any> = {
  'openstudio.model.create': validateModelCreate,
  'openstudio.model.open': validateModelOpen,
  'openstudio.model.save': validateModelSave,
  'openstudio.model.info': validateModelInfo,
  'openstudio.simulation.run': validateSimulationRun,
  'openstudio.simulation.status': validateSimulationStatus,
  'openstudio.simulation.cancel': validateSimulationCancel,
  'openstudio.bcl.search': validateBclSearch,
  'openstudio.bcl.download': validateBclDownload,
  'openstudio.bcl.recommend': validateBclRecommend,
  'openstudio.measure.apply': validateMeasureApply,
  'openstudio.measure.workflow.create': validateMeasureWorkflowCreate,
  'openstudio.measure.workflow.execute': validateMeasureWorkflowExecute,
  'openstudio.measure.workflow.validate': validateMeasureWorkflowValidate,
};

/**
 * Check if a path is safe (no command injection)
 * @param path Path to check
 * @returns True if the path is safe, false otherwise
 */
export function isPathSafe(path: string): boolean {
  // Check for common command injection patterns
  const dangerousPatterns = [
    ';',
    '&&',
    '||',
    '|',
    '>',
    '<',
    '`',
    '$(',
    'rm -rf',
    'rm -r',
    'rmdir',
    'del /s',
    'del /q',
    'format',
    'mkfs',
    'dd if=',
    'wget',
    'curl',
  ];

  // Check for directory traversal
  if (path.includes('../') || path.includes('..\\')) {
    return false;
  }

  return !dangerousPatterns.some((pattern) => path.includes(pattern));
}

/**
 * Check if a command is safe to execute
 * @param command Command to check
 * @returns True if the command is safe, false otherwise
 */
export function isCommandSafe(command: string): boolean {
  // Check for common command injection patterns
  const dangerousPatterns = [
    ';',
    '&&',
    '||',
    '|',
    '>',
    '<',
    '`',
    '$(',
    'rm -rf',
    'rm -r',
    'rmdir',
    'del /s',
    'del /q',
    'format',
    'mkfs',
    'dd if=',
    '/bin/sh',
    '/bin/bash',
    'eval',
    'exec',
    'system',
    'chmod',
    'chown',
  ];

  // Check for attempts to execute shell commands
  if (dangerousPatterns.some((pattern) => command.includes(pattern))) {
    return false;
  }

  // Only allow specific OpenStudio CLI commands
  const allowedCommands = [
    'openstudio',
    'run',
    'measure',
    'apply',
    'convert',
    'analyze',
    'version',
    'help',
    'list',
    'info',
  ];

  // Split the command by spaces and check if the first part is allowed
  const commandParts = command.trim().split(/\s+/);
  if (commandParts.length === 0) {
    return false;
  }

  // Check if the command starts with an allowed command
  return allowedCommands.some(
    (allowed) =>
      commandParts[0].toLowerCase() === allowed ||
      commandParts[0].toLowerCase().endsWith(`/${allowed}`),
  );
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  errorCode?: string;
  details?: Record<string, any>;
}

/**
 * Validate an MCP request
 * @param request MCP request to validate
 * @returns Validation result with success flag and optional error message
 */
export function validateRequest(request: MCPRequest): ValidationResult {
  // Check if request is defined and has the correct structure
  if (!request || typeof request !== 'object') {
    logger.warn('Request is not an object');
    return {
      valid: false,
      errors: ['Request must be a valid JSON object'],
      errorCode: 'INVALID_REQUEST_FORMAT',
    };
  }

  // First validate the base request structure
  if (!validateBaseRequest(request)) {
    const errors = validateBaseRequest.errors?.map(
      (err: any) => `${err.instancePath} ${err.message}`,
    ) || ['Invalid request format'];

    logger.warn({ request, errors }, 'Invalid request format');
    return {
      valid: false,
      errors,
      errorCode: 'INVALID_REQUEST_FORMAT',
      details: {
        ajvErrors: validateBaseRequest.errors,
        requiredFields: ['id', 'type', 'params'],
      },
    };
  }

  // Then validate the parameters based on the request type
  const validator = requestValidators[request.type];
  if (!validator) {
    logger.warn({ request }, `Unknown request type: ${request.type}`);
    return {
      valid: false,
      errors: [`Unknown request type: ${request.type}`],
      errorCode: 'UNKNOWN_REQUEST_TYPE',
      details: {
        availableTypes: Object.keys(requestValidators),
        requestedType: request.type,
      },
    };
  }

  if (!validator(request.params)) {
    const errors = validator.errors?.map(
      (err: any) => `params${err.instancePath} ${err.message}`,
    ) || ['Invalid parameters'];

    logger.warn({ request, errors }, 'Invalid request parameters');
    return {
      valid: false,
      errors,
      errorCode: 'INVALID_PARAMETERS',
      details: {
        ajvErrors: validator.errors,
        schema: getValidationSchema(request.type),
        providedParams: request.params,
      },
    };
  }

  // Additional security validations
  const errors: string[] = [];
  const securityDetails: Record<string, any> = {};

  // Check all path parameters for safety to prevent command injection
  const pathParams = [
    { key: 'path', label: 'Path' },
    { key: 'modelPath', label: 'Model path' },
    { key: 'measurePath', label: 'Measure path' },
    { key: 'outputDirectory', label: 'Output directory' },
    { key: 'weatherFile', label: 'Weather file path' },
    { key: 'outputPath', label: 'Output path' },
    { key: 'inputModelPath', label: 'Input model path' },
  ];

  const unsafePaths: Record<string, string> = {};

  for (const { key, label } of pathParams) {
    const value = request.params[key];
    if (value && typeof value === 'string') {
      if (!isPathSafe(value)) {
        errors.push(`${label} contains potentially unsafe characters or commands`);
        unsafePaths[key] = value;
      }
    }
  }

  if (Object.keys(unsafePaths).length > 0) {
    securityDetails.unsafePaths = unsafePaths;
  }

  // Validate command parameter if present
  if (request.params.command && typeof request.params.command === 'string') {
    if (!isCommandSafe(request.params.command)) {
      errors.push('Command contains potentially unsafe characters or operations');
      securityDetails.unsafeCommand = request.params.command;
    }
  }

  // If there are security validation errors, return them
  if (errors.length > 0) {
    logger.warn({ request, errors }, 'Security validation failed');
    return {
      valid: false,
      errors,
      errorCode: 'SECURITY_VALIDATION_FAILED',
      details: securityDetails,
    };
  }

  // All validations passed
  return { valid: true };
}

/**
 * Get validation schema for a request type
 * @param requestType Request type
 * @returns JSON schema for the request type or undefined if not found
 */
export function getValidationSchema(requestType: string): object | undefined {
  switch (requestType) {
    case 'openstudio.model.create':
      return modelCreateSchema;
    case 'openstudio.model.open':
      return modelOpenSchema;
    case 'openstudio.model.save':
      return modelSaveSchema;
    case 'openstudio.model.info':
      return modelInfoSchema;
    case 'openstudio.simulation.run':
      return simulationRunSchema;
    case 'openstudio.simulation.status':
      return simulationStatusSchema;
    case 'openstudio.simulation.cancel':
      return simulationCancelSchema;
    case 'openstudio.bcl.search':
      return bclSearchSchema;
    case 'openstudio.bcl.download':
      return bclDownloadSchema;
    case 'openstudio.bcl.recommend':
      return bclRecommendSchema;
    case 'openstudio.measure.apply':
      return measureApplySchema;
    case 'openstudio.measure.workflow.create':
      return measureWorkflowCreateSchema;
    case 'openstudio.measure.workflow.execute':
      return measureWorkflowExecuteSchema;
    case 'openstudio.measure.workflow.validate':
      return measureWorkflowValidateSchema;
    default:
      return undefined;
  }
}

/**
 * Get all registered request types
 * @returns Array of registered request types
 */
export function getRegisteredRequestTypes(): string[] {
  return Object.keys(requestValidators);
}
