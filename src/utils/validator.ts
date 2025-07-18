/**
 * Request validation utilities
 */
import Ajv, { JSONSchemaType } from 'ajv';
import addFormats from 'ajv-formats';
import { MCPRequest } from '../interfaces';
import { logger } from './index';
import { isPathSafe, isCommandSafe } from './validation';

// Create Ajv instance
const ajv = new Ajv({
  allErrors: true,
  removeAdditional: false,
  useDefaults: true,
  coerceTypes: true,
});

// Add formats like uri, email, etc.
addFormats(ajv);

// Add custom formats
ajv.addFormat('file-path', {
  type: 'string',
  validate: (path: string) => {
    // Basic path validation - could be enhanced for platform-specific rules
    return !path.includes('..') && isPathSafe(path);
  }
});

ajv.addFormat('command', {
  type: 'string',
  validate: (command: string) => {
    return isCommandSafe(command);
  }
});

// Base schema for all MCP requests
const baseRequestSchema: JSONSchemaType<MCPRequest> = {
  type: 'object',
  required: ['id', 'type', 'params'],
  properties: {
    id: { type: 'string' },
    type: { type: 'string' },
    params: {
      type: 'object',
      required: [],
      properties: {},
      additionalProperties: true,
    },
  },
  additionalProperties: false,
};

// Compile the base schema
const validateBaseRequest = ajv.compile(baseRequestSchema);

/**
 * Validate an MCP request against the base schema
 * @param request MCP request to validate
 * @returns True if the request is valid, false otherwise
 */
export function validateMCPRequest(request: unknown): request is MCPRequest {
  const valid = validateBaseRequest(request);
  if (!valid) {
    logger.warn({ errors: validateBaseRequest.errors }, 'Invalid MCP request');
  }
  return valid;
}

/**
 * Generate a schema for a specific request type
 * @param type Request type
 * @param requiredParams Required parameters
 * @param optionalParams Optional parameters
 * @returns JSON schema for the request type
 */
export function generateRequestSchema(
  type: string,
  requiredParams: Record<string, { type: string; description: string }>,
  optionalParams: Record<string, { type: string; description: string }> = {}
): JSONSchemaType<MCPRequest> {
  // Clone the base schema
  const schema = JSON.parse(JSON.stringify(baseRequestSchema)) as JSONSchemaType<MCPRequest>;
  
  // Set the type
  schema.properties.type = { type: 'string', enum: [type] };
  
  // Add required parameters
  schema.properties.params.required = Object.keys(requiredParams);
  
  // Add parameter properties
  for (const [name, config] of Object.entries(requiredParams)) {
    schema.properties.params.properties[name] = {
      type: config.type as any,
      description: config.description,
    };
  }
  
  // Add optional parameters
  for (const [name, config] of Object.entries(optionalParams)) {
    schema.properties.params.properties[name] = {
      type: config.type as any,
      description: config.description,
      nullable: true,
    };
  }
  
  return schema;
}

/**
 * Create a validator function for a specific request type
 * @param type Request type
 * @param requiredParams Required parameters
 * @param optionalParams Optional parameters
 * @returns Validator function
 */
export function createRequestValidator(
  type: string,
  requiredParams: Record<string, { type: string; description: string }>,
  optionalParams: Record<string, { type: string; description: string }> = {}
): (request: unknown) => request is MCPRequest {
  const schema = generateRequestSchema(type, requiredParams, optionalParams);
  const validate = ajv.compile(schema);
  
  return (request: unknown): request is MCPRequest => {
    const valid = validate(request);
    if (!valid) {
      logger.warn({ errors: validate.errors, type }, `Invalid ${type} request`);
    }
    return valid;
  };
}