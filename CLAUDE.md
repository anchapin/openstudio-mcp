# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an OpenStudio Model Context Protocol (MCP) server that provides AI assistants with access to OpenStudio building energy modeling capabilities. The server exposes OpenStudio functionality through a standardized MCP interface, allowing users to perform building energy modeling tasks through natural language requests.

## Development Commands

### Package Management
- `npm install` - Install dependencies
- `npm ci` - Install dependencies for CI/CD

### Build Commands
- `npm run build` - Build the project for production (TypeScript compilation)
- `npm run dev` - Start development server with hot reloading
- `npm start` - Start the production server

### Testing Commands
- `npm test` - Run all unit tests
- `npm run test:all` - Run all tests including integration tests
- `npm run test:coverage` - Run tests with coverage report
- `npm run test:watch` - Run tests in watch mode
- `npm run test:unit` - Run unit tests only

### Code Quality Commands
- `npm run lint` - Run ESLint for code linting
- `npm run format` - Format code with Prettier

### Packaging Commands
- `npm run package` - Build and package the application
- `npm run package:win` - Package for Windows
- `npm run package:mac` - Package for macOS
- `npm run package:linux` - Package for Linux
- `npm run package:all` - Package for all platforms

## Technology Stack

### Core Technologies
- **TypeScript** - Primary programming language
- **Node.js** - Runtime environment (v18 or higher)
- **Express.js** - Web application framework
- **WebSocket** - Real-time communication protocol
- **OpenStudio CLI** - Building energy modeling engine

### Key Dependencies
- **express** - Web server framework
- **ws** - WebSocket library
- **axios** - HTTP client
- **ajv** - JSON schema validation
- **pino** - Logging library
- **adm-zip** - ZIP file handling
- **dotenv** - Environment variable management

### Development Tools
- **TypeScript** - Static type checking
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **Vitest** - Test framework
- **Husky** - Git hooks

## Project Structure Guidelines

### File Organization
```
src/
├── config/          # Configuration files
├── handlers/        # Request handlers and routing
├── interfaces/      # TypeScript interfaces and types
├── services/        # Business logic and services
├── utils/           # Utility functions and helpers
└── index.ts         # Application entry point
test/
├── handlers/        # Handler tests
├── services/        # Service tests
└── utils/           # Utility tests
scripts/             # Utility scripts
docs/                # Documentation files
```

### Naming Conventions
- **Files**: Use kebab-case for file names (`model-import-service.ts`)
- **Classes**: Use PascalCase for class names (`ModelImportService`)
- **Functions**: Use camelCase for function names (`createModel`)
- **Variables**: Use camelCase for variable names (`modelPath`)
- **Constants**: Use UPPER_SNAKE_CASE for constants (`MAX_FILE_SIZE`)
- **Interfaces**: Use PascalCase with descriptive names (`ModelImportRequest`)

## Architecture Overview

### Core Components

1. **MCP Server (`src/services/mcpServer.ts`)**
   - Main server implementation that handles WebSocket connections
   - Registers and manages server capabilities
   - Routes requests to appropriate handlers
   - Implements the Model Context Protocol specification

2. **Request Handler (`src/handlers/requestHandler.ts`)**
   - Central request processing component
   - Maintains registry of all available handlers
   - Validates incoming requests against JSON schemas
   - Routes requests to specific handler functions

3. **Request Router (`src/handlers/requestRouter.ts`)**
   - Simple routing layer that delegates to RequestHandler
   - Handles request/response flow

4. **Services Layer (`src/services/`)**
   - **commandProcessor.ts**: Executes OpenStudio CLI commands
   - **modelCreationService.ts**: Creates new OpenStudio models
   - **simulationService.ts**: Runs energy simulations
   - **bclApiClient.ts**: Interacts with Building Component Library
   - **measureApplicationService.ts**: Applies measures to models
   - **modelImportExportService.ts**: Imports/exports models in various formats
   - **workflowService.ts**: Executes OpenStudio Workflow (OSW) files
   - **enhancedMeasureService.ts**: Advanced measure management features

5. **Utilities (`src/utils/`)**
   - Helper functions for common operations
   - Configuration management
   - File operations
   - Logging
   - Validation

### Key Capabilities

The server exposes the following major capabilities through the MCP interface:

1. **Model Management**
   - `openstudio.model.create` - Create new OpenStudio models
   - `openstudio.model.open` - Open existing models
   - `openstudio.model.info` - Get model information

2. **Model Import/Export**
   - `openstudio.model.import` - Import models from IDF, gbXML, SDD formats
   - `openstudio.model.export` - Export models to various formats
   - `openstudio.model.batch_operations` - Batch import/export operations
   - `openstudio.model.convert_format` - Convert between formats
   - `openstudio.model.format_capabilities` - Get format capabilities

3. **Simulation**
   - `openstudio.simulation.run` - Run energy simulations
   - `openstudio.simulation.status` - Get simulation status
   - `openstudio.simulation.cancel` - Cancel running simulations

4. **Building Component Library (BCL)**
   - `openstudio.bcl.search` - Search for measures
   - `openstudio.bcl.download` - Download measures
   - `openstudio.bcl.recommend` - Get measure recommendations

5. **Measure Management**
   - `openstudio.measure.apply` - Apply measures to models
   - `openstudio.measure.update` - Update measure metadata
   - `openstudio.measure.arguments.compute` - Compute measure arguments
   - `openstudio.measure.test` - Run measure tests

6. **Workflow Management**
   - `openstudio.workflow.run` - Execute OSW workflow files
   - `openstudio.workflow.validate` - Validate workflow files
   - `openstudio.workflow.create` - Create new workflow files

### Data Flow

1. **WebSocket Connection**: Client connects to server via WebSocket
2. **Capability Exchange**: Server sends available capabilities to client
3. **Request Processing**: Client sends requests which are routed through:
   - RequestRouter → RequestHandler → Specific handler function → Service
4. **Response Formatting**: Results are formatted by ResponseFormatter and returned to client

### Key Interfaces

The system uses strongly-typed interfaces defined in `src/interfaces/` for:
- MCP requests/responses
- Command results
- Model import/export structures
- Workflow definitions
- Measure operations

## Development Workflow

### Before Starting
1. Ensure Node.js v18+ and OpenStudio CLI are installed
2. Install dependencies with `npm install`
3. Set up environment variables in `.env` file

### During Development
1. Use TypeScript for type safety
2. Follow existing code patterns and conventions
3. Write tests for new functionality
4. Run linter frequently: `npm run lint`

### Testing
1. Unit tests are located in `test/` directory
2. Use Vitest for testing framework
3. Run tests: `npm test`
4. Generate coverage: `npm run test:coverage`

### Building
1. Compile TypeScript: `npm run build`
2. Start server: `npm start`
3. Development mode: `npm run dev`

## API Endpoints

### HTTP Endpoints (for VS Code integration)
- `POST /mcp/` - Main MCP endpoint for handling requests
- `GET /mcp/tools/list` - List available tools
- `POST /mcp/tools/call` - Call specific tools
- `GET /capabilities` - Get server capabilities
- `GET /health` - Health check endpoint

### WebSocket Protocol
- Standard WebSocket connection for full MCP functionality
- JSON-RPC 2.0 message format
- Real-time communication for long-running operations

## Configuration

The server is configured through:
1. Environment variables (PORT, OPENSTUDIO_CLI_PATH, etc.)
2. Configuration files in `src/config/`
3. Command line arguments (--config, --generate-config)

## Error Handling

- All services return structured error responses
- Logging is handled through pino logger
- Validation errors are returned with detailed information
- OpenStudio command errors are captured and formatted

## Performance Considerations

- Long-running operations (simulations) are handled asynchronously
- Resource monitoring for memory and CPU usage
- Timeout handling for operations
- Caching mechanisms for repeated operations