# OpenStudio MCP Server API Documentation

This document provides comprehensive documentation for the OpenStudio MCP Server API, including available endpoints, request/response formats, and examples.

## Table of Contents

- [Introduction](#introduction)
- [API Overview](#api-overview)
- [Connection Methods](#connection-methods)
  - [HTTP API](#http-api)
  - [WebSocket API](#websocket-api)
- [Authentication](#authentication)
- [Capabilities](#capabilities)
- [Request Format](#request-format)
- [Response Format](#response-format)
- [Error Handling](#error-handling)
- [API Endpoints](#api-endpoints)
  - [Model Operations](#model-operations)
  - [Simulation Operations](#simulation-operations)
  - [BCL Operations](#bcl-operations)
  - [Measure Operations](#measure-operations)
- [Examples](#examples)

## Introduction

The OpenStudio MCP Server provides a standardized interface to OpenStudio's capabilities through the Model Context Protocol (MCP). This API allows AI assistants and other clients to interact with OpenStudio through a well-defined interface, enabling building energy modeling tasks through natural language requests.

## API Overview

The OpenStudio MCP Server API is organized around the following core functionalities:

1. **Model Operations**: Create, open, save, and query OpenStudio models
2. **Simulation Operations**: Run and manage energy simulations
3. **BCL Operations**: Search, download, and manage measures from the Building Component Library
4. **Measure Operations**: Apply measures to OpenStudio models

## Connection Methods

The OpenStudio MCP Server supports two connection methods:

### HTTP API

The HTTP API provides RESTful endpoints for basic operations and health checks.

**Base URL**: `http://{host}:{port}`

### WebSocket API

The WebSocket API provides a bidirectional communication channel for MCP requests and responses.

**WebSocket URL**: `ws://{host}:{port}`

## Authentication

Currently, the OpenStudio MCP Server does not implement authentication. It is designed to be used in a trusted environment.

## Capabilities

The server provides a list of capabilities that describe the available operations. These capabilities can be retrieved through the `/capabilities` endpoint.

**Example Request**:
```http
GET /capabilities
```

**Example Response**:
```json
{
  "capabilities": [
    {
      "name": "openstudio.model.create",
      "description": "Create a new OpenStudio model",
      "parameters": {
        "templateType": {
          "type": "string",
          "description": "Type of template to use",
          "enum": ["empty", "office", "residential", "retail", "warehouse", "school", "hospital"],
          "required": true
        },
        "path": {
          "type": "string",
          "description": "Path to save the model",
          "required": true
        },
        "options": {
          "type": "object",
          "description": "Template options",
          "required": false,
          "properties": {
            "buildingType": {
              "type": "string",
              "description": "Building type (e.g., MediumOffice, MidriseApartment)",
              "required": false
            },
            "buildingVintage": {
              "type": "string",
              "description": "Building vintage (e.g., 90.1-2013)",
              "required": false
            },
            "climateZone": {
              "type": "string",
              "description": "Climate zone (e.g., ASHRAE 169-2013-5A)",
              "required": false
            },
            "weatherFilePath": {
              "type": "string",
              "description": "Path to weather file",
              "required": false
            },
            "floorArea": {
              "type": "number",
              "description": "Floor area in square meters",
              "required": false
            },
            "numStories": {
              "type": "number",
              "description": "Number of stories",
              "required": false
            },
            "aspectRatio": {
              "type": "number",
              "description": "Aspect ratio (length/width)",
              "required": false
            },
            "floorToFloorHeight": {
              "type": "number",
              "description": "Floor to floor height in meters",
              "required": false
            },
            "includeHVAC": {
              "type": "boolean",
              "description": "Whether to include HVAC systems",
              "required": false
            }
          }
        },
        "includeDefaultMeasures": {
          "type": "boolean",
          "description": "Whether to include default measures for the template type",
          "required": false
        }
      }
    },
    // Additional capabilities...
  ]
}
```

## Request Format

MCP requests follow a standard format:

```json
{
  "id": "string",
  "type": "string",
  "params": {
    "key1": "value1",
    "key2": "value2",
    // Additional parameters...
  }
}
```

- `id`: A unique identifier for the request
- `type`: The type of request, corresponding to a capability name
- `params`: Parameters for the request, specific to the capability

## Response Format

MCP responses follow a standard format:

```json
{
  "id": "string",
  "type": "string",
  "status": "success | error",
  "result": {
    // Result data...
  },
  "error": {
    "code": "string",
    "message": "string",
    "details": {
      // Error details...
    }
  }
}
```

- `id`: The identifier from the request
- `type`: The type from the request
- `status`: Either "success" or "error"
- `result`: Present only for successful responses
- `error`: Present only for error responses

## Error Handling

The OpenStudio MCP Server uses standard error codes and messages:

| Error Code | Description |
|------------|-------------|
| `INVALID_REQUEST` | The request format or parameters are invalid |
| `UNKNOWN_REQUEST_TYPE` | The request type is not recognized |
| `COMMAND_FAILED` | The OpenStudio command failed to execute |
| `INTERNAL_ERROR` | An internal server error occurred |

## API Endpoints

### Model Operations

#### Create a Model

Creates a new OpenStudio model from a template.

**Request Type**: `openstudio.model.create`

**Parameters**:
- `templateType` (string, required): Type of template to use
- `path` (string, required): Path to save the model
- `options` (object, optional): Template options
- `includeDefaultMeasures` (boolean, optional): Whether to include default measures

**Example Request**:
```json
{
  "id": "request-1",
  "type": "openstudio.model.create",
  "params": {
    "templateType": "office",
    "path": "/path/to/model.osm",
    "options": {
      "buildingType": "MediumOffice",
      "buildingVintage": "90.1-2013",
      "climateZone": "ASHRAE 169-2013-5A",
      "floorArea": 5000,
      "numStories": 3
    },
    "includeDefaultMeasures": true
  }
}
```

**Example Response**:
```json
{
  "id": "request-1",
  "type": "openstudio.model.create",
  "status": "success",
  "result": {
    "output": "Successfully created model at /path/to/model.osm",
    "data": {
      "modelPath": "/path/to/model.osm",
      "templateType": "office",
      "options": {
        "buildingType": "MediumOffice",
        "buildingVintage": "90.1-2013",
        "climateZone": "ASHRAE 169-2013-5A",
        "floorArea": 5000,
        "numStories": 3
      },
      "floorArea": 5000,
      "numStories": 3,
      "numZones": 15,
      "numSpaces": 15
    }
  }
}
```

#### Open a Model

Opens an existing OpenStudio model.

**Request Type**: `openstudio.model.open`

**Parameters**:
- `path` (string, required): Path to the model file

**Example Request**:
```json
{
  "id": "request-2",
  "type": "openstudio.model.open",
  "params": {
    "path": "/path/to/model.osm"
  }
}
```

**Example Response**:
```json
{
  "id": "request-2",
  "type": "openstudio.model.open",
  "status": "success",
  "result": {
    "output": "Successfully opened model at /path/to/model.osm",
    "data": {
      "modelPath": "/path/to/model.osm",
      "modelInfo": {
        "name": "Medium Office",
        "floorArea": 5000,
        "numStories": 3,
        "numZones": 15,
        "numSpaces": 15
      }
    }
  }
}
```

#### Get Model Information

Gets information about an OpenStudio model.

**Request Type**: `openstudio.model.info`

**Parameters**:
- `modelPath` (string, required): Path to the model file
- `detailLevel` (string, optional): Level of detail to include in the model information

**Example Request**:
```json
{
  "id": "request-3",
  "type": "openstudio.model.info",
  "params": {
    "modelPath": "/path/to/model.osm",
    "detailLevel": "detailed"
  }
}
```

**Example Response**:
```json
{
  "id": "request-3",
  "type": "openstudio.model.info",
  "status": "success",
  "result": {
    "output": "Model information retrieved successfully",
    "data": {
      "name": "Medium Office",
      "floorArea": 5000,
      "numStories": 3,
      "numZones": 15,
      "numSpaces": 15,
      "spaces": [
        {
          "name": "Office 1",
          "area": 100,
          "volume": 300
        },
        // Additional spaces...
      ],
      "zones": [
        {
          "name": "Zone 1",
          "area": 100,
          "volume": 300
        },
        // Additional zones...
      ],
      "surfaces": [
        {
          "name": "Surface 1",
          "surfaceType": "Wall",
          "area": 30
        },
        // Additional surfaces...
      ],
      "hvacSystems": [
        {
          "name": "HVAC System 1",
          "type": "PackagedRooftopVAV"
        },
        // Additional HVAC systems...
      ]
    }
  }
}
```

### Simulation Operations

#### Run a Simulation

Runs an OpenStudio simulation.

**Request Type**: `openstudio.simulation.run`

**Parameters**:
- `modelPath` (string, required): Path to the model file
- `weatherFile` (string, optional): Path to the weather file
- `outputDirectory` (string, optional): Directory to save simulation results
- `autoConfig` (boolean, optional): Whether to auto-configure simulation parameters
- `options` (object, optional): Simulation options

**Example Request**:
```json
{
  "id": "request-4",
  "type": "openstudio.simulation.run",
  "params": {
    "modelPath": "/path/to/model.osm",
    "weatherFile": "/path/to/weather.epw",
    "outputDirectory": "/path/to/output",
    "autoConfig": true,
    "options": {
      "runPeriod": "annual",
      "timestep": 6
    }
  }
}
```

**Example Response**:
```json
{
  "id": "request-4",
  "type": "openstudio.simulation.run",
  "status": "success",
  "result": {
    "output": "Simulation completed successfully",
    "data": {
      "simulationId": "sim-12345",
      "status": "complete",
      "duration": 120,
      "outputDirectory": "/path/to/output",
      "errors": [],
      "warnings": [
        "Warning: Surface 'Surface 1' has a high aspect ratio"
      ],
      "results": {
        "eui": 120.5,
        "totalSiteEnergy": 500000,
        "totalSourceEnergy": 1500000,
        "electricityConsumption": 400000,
        "naturalGasConsumption": 100000,
        "districtHeatingConsumption": 0,
        "districtCoolingConsumption": 0
      },
      "resourceUsage": {
        "cpuUsage": 80,
        "memoryUsage": 500
      }
    }
  }
}
```

#### Get Simulation Status

Gets the status of a simulation.

**Request Type**: `openstudio.simulation.status`

**Parameters**:
- `simulationId` (string, required): ID of the simulation

**Example Request**:
```json
{
  "id": "request-5",
  "type": "openstudio.simulation.status",
  "params": {
    "simulationId": "sim-12345"
  }
}
```

**Example Response**:
```json
{
  "id": "request-5",
  "type": "openstudio.simulation.status",
  "status": "success",
  "result": {
    "output": "Simulation status: complete",
    "data": {
      "simulationId": "sim-12345",
      "status": "complete",
      "startTime": "2025-07-17T12:00:00Z",
      "endTime": "2025-07-17T12:02:00Z",
      "duration": 120,
      "outputDirectory": "/path/to/output",
      "errors": [],
      "warnings": [
        "Warning: Surface 'Surface 1' has a high aspect ratio"
      ],
      "results": {
        "eui": 120.5,
        "totalSiteEnergy": 500000,
        "totalSourceEnergy": 1500000,
        "electricityConsumption": 400000,
        "naturalGasConsumption": 100000,
        "districtHeatingConsumption": 0,
        "districtCoolingConsumption": 0
      },
      "resourceUsage": {
        "cpuUsage": 80,
        "memoryUsage": 500
      }
    }
  }
}
```

#### Cancel a Simulation

Cancels a running simulation.

**Request Type**: `openstudio.simulation.cancel`

**Parameters**:
- `simulationId` (string, required): ID of the simulation

**Example Request**:
```json
{
  "id": "request-6",
  "type": "openstudio.simulation.cancel",
  "params": {
    "simulationId": "sim-12345"
  }
}
```

**Example Response**:
```json
{
  "id": "request-6",
  "type": "openstudio.simulation.cancel",
  "status": "success",
  "result": {
    "output": "Successfully cancelled simulation with ID sim-12345",
    "data": {
      "simulationId": "sim-12345",
      "cancelled": true
    }
  }
}
```

### BCL Operations

#### Search for Measures

Searches for measures in the Building Component Library.

**Request Type**: `openstudio.bcl.search`

**Parameters**:
- `query` (string, required): Search query
- `limit` (number, optional): Maximum number of results to return

**Example Request**:
```json
{
  "id": "request-7",
  "type": "openstudio.bcl.search",
  "params": {
    "query": "lighting",
    "limit": 5
  }
}
```

**Example Response**:
```json
{
  "id": "request-7",
  "type": "openstudio.bcl.search",
  "status": "success",
  "result": {
    "output": "Found 5 measures matching query: lighting",
    "data": {
      "measures": [
        {
          "id": "measure-1",
          "name": "Replace Lighting with LED",
          "description": "Replaces existing lighting with LED fixtures",
          "version": "1.0.0",
          "modelerDescription": "This measure replaces existing lighting with LED fixtures",
          "tags": ["lighting", "energy efficiency", "LED"],
          "arguments": [
            {
              "name": "lpd_reduction_percent",
              "displayName": "LPD Reduction Percentage",
              "description": "Percentage reduction in lighting power density",
              "type": "Double",
              "required": true,
              "defaultValue": 30
            }
          ]
        },
        // Additional measures...
      ],
      "totalFound": 20,
      "query": "lighting"
    }
  }
}
```

#### Download a Measure

Downloads a measure from the Building Component Library.

**Request Type**: `openstudio.bcl.download`

**Parameters**:
- `measureId` (string, required): ID of the measure to download

**Example Request**:
```json
{
  "id": "request-8",
  "type": "openstudio.bcl.download",
  "params": {
    "measureId": "measure-1"
  }
}
```

**Example Response**:
```json
{
  "id": "request-8",
  "type": "openstudio.bcl.download",
  "status": "success",
  "result": {
    "output": "Successfully downloaded and installed measure with ID: measure-1",
    "data": {
      "measureId": "measure-1",
      "installed": true,
      "location": "./measures/measure-1"
    }
  }
}
```

#### Get Measure Recommendations

Gets measure recommendations based on context.

**Request Type**: `openstudio.bcl.recommend`

**Parameters**:
- `context` (string, required): Context description for measure recommendation
- `modelPath` (string, optional): Path to a model file for context-aware recommendations
- `limit` (number, optional): Maximum number of recommendations to return

**Example Request**:
```json
{
  "id": "request-9",
  "type": "openstudio.bcl.recommend",
  "params": {
    "context": "I want to reduce energy use in my office building",
    "modelPath": "/path/to/model.osm",
    "limit": 3
  }
}
```

**Example Response**:
```json
{
  "id": "request-9",
  "type": "openstudio.bcl.recommend",
  "status": "success",
  "result": {
    "output": "Found 3 recommended measures based on context and model analysis",
    "data": {
      "measures": [
        {
          "id": "measure-1",
          "name": "Replace Lighting with LED",
          "description": "Replaces existing lighting with LED fixtures",
          "version": "1.0.0",
          "modelerDescription": "This measure replaces existing lighting with LED fixtures",
          "tags": ["lighting", "energy efficiency", "LED"],
          "arguments": [
            {
              "name": "lpd_reduction_percent",
              "displayName": "LPD Reduction Percentage",
              "description": "Percentage reduction in lighting power density",
              "type": "Double",
              "required": true,
              "defaultValue": 30
            }
          ],
          "relevanceScore": 0.95
        },
        // Additional measures...
      ],
      "totalFound": 10,
      "context": "I want to reduce energy use in my office building",
      "modelPath": "/path/to/model.osm",
      "modelBasedRecommendation": true,
      "downloadedMeasures": [
        {
          "id": "measure-1",
          "name": "Replace Lighting with LED"
        },
        {
          "id": "measure-2",
          "name": "Add Roof Insulation"
        },
        {
          "id": "measure-3",
          "name": "Reduce Equipment Loads"
        }
      ]
    }
  }
}
```

### Measure Operations

#### Apply a Measure

Applies a measure to an OpenStudio model.

**Request Type**: `openstudio.measure.apply`

**Parameters**:
- `modelPath` (string, required): Path to the model file
- `measureId` (string, required): ID of the measure to apply
- `arguments` (object, optional): Measure arguments
- `createBackup` (boolean, optional): Whether to create a backup of the model
- `validateModel` (boolean, optional): Whether to validate the model before applying the measure
- `validateMeasure` (boolean, optional): Whether to validate the measure before applying it
- `inPlace` (boolean, optional): Whether to modify the model in place
- `outputPath` (string, optional): Path to save the modified model
- `downloadIfNeeded` (boolean, optional): Whether to download the measure if not installed
- `mapParameters` (boolean, optional): Whether to map user parameters to measure arguments

**Example Request**:
```json
{
  "id": "request-10",
  "type": "openstudio.measure.apply",
  "params": {
    "modelPath": "/path/to/model.osm",
    "measureId": "measure-1",
    "arguments": {
      "lpd_reduction_percent": 40
    },
    "createBackup": true,
    "validateModel": true,
    "validateMeasure": true,
    "inPlace": false,
    "outputPath": "/path/to/modified_model.osm",
    "downloadIfNeeded": true,
    "mapParameters": true
  }
}
```

**Example Response**:
```json
{
  "id": "request-10",
  "type": "openstudio.measure.apply",
  "status": "success",
  "result": {
    "output": "Successfully applied measure measure-1 to model /path/to/model.osm",
    "data": {
      "modelPath": "/path/to/modified_model.osm",
      "originalModelPath": "/path/to/model.osm",
      "measureId": "measure-1",
      "arguments": {
        "lpd_reduction_percent": 40
      },
      "warnings": [],
      "output": "Reduced lighting power density by 40%"
    }
  }
}
```

## Examples

### Example 1: Create a Model and Run a Simulation

This example demonstrates creating a new model and running a simulation.

**Step 1: Create a Model**

```json
{
  "id": "example-1-step-1",
  "type": "openstudio.model.create",
  "params": {
    "templateType": "office",
    "path": "/path/to/model.osm",
    "options": {
      "buildingType": "MediumOffice",
      "buildingVintage": "90.1-2013",
      "climateZone": "ASHRAE 169-2013-5A",
      "floorArea": 5000,
      "numStories": 3
    }
  }
}
```

**Step 2: Run a Simulation**

```json
{
  "id": "example-1-step-2",
  "type": "openstudio.simulation.run",
  "params": {
    "modelPath": "/path/to/model.osm",
    "weatherFile": "/path/to/weather.epw",
    "outputDirectory": "/path/to/output",
    "autoConfig": true
  }
}
```

### Example 2: Find and Apply Energy Efficiency Measures

This example demonstrates finding and applying energy efficiency measures.

**Step 1: Get Measure Recommendations**

```json
{
  "id": "example-2-step-1",
  "type": "openstudio.bcl.recommend",
  "params": {
    "context": "I want to reduce energy use in my office building",
    "modelPath": "/path/to/model.osm",
    "limit": 3
  }
}
```

**Step 2: Apply a Recommended Measure**

```json
{
  "id": "example-2-step-2",
  "type": "openstudio.measure.apply",
  "params": {
    "modelPath": "/path/to/model.osm",
    "measureId": "measure-1",
    "arguments": {
      "lpd_reduction_percent": 40
    },
    "createBackup": true,
    "downloadIfNeeded": true
  }
}
```

**Step 3: Run a Simulation with the Modified Model**

```json
{
  "id": "example-2-step-3",
  "type": "openstudio.simulation.run",
  "params": {
    "modelPath": "/path/to/model.osm",
    "weatherFile": "/path/to/weather.epw",
    "outputDirectory": "/path/to/output",
    "autoConfig": true
  }
}
```

### Example 3: Search for Specific Measures

This example demonstrates searching for specific measures.

**Step 1: Search for Measures**

```json
{
  "id": "example-3-step-1",
  "type": "openstudio.bcl.search",
  "params": {
    "query": "window replacement",
    "limit": 5
  }
}
```

**Step 2: Download a Measure**

```json
{
  "id": "example-3-step-2",
  "type": "openstudio.bcl.download",
  "params": {
    "measureId": "measure-2"
  }
}
```

**Step 3: Apply the Measure**

```json
{
  "id": "example-3-step-3",
  "type": "openstudio.measure.apply",
  "params": {
    "modelPath": "/path/to/model.osm",
    "measureId": "measure-2",
    "arguments": {
      "window_u_value": 1.8,
      "window_shgc": 0.4
    },
    "createBackup": true
  }
}
```