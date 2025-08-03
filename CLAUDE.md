# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Development
```bash
npm run dev          # Start development server with hot reloading
npm run build        # Build TypeScript to JavaScript
npm start            # Start the production server
```

### Testing
```bash
npm test                                          # Run unit tests 
npx vitest run path/to/test.test.ts --config vitest.unit.config.mts  # Run single test
npm run test:watch                               # Run tests in watch mode
npm run test:coverage                            # Run tests with coverage
```

### Code Quality
```bash
npm run lint         # Lint TypeScript files
npm run lint -- --fix  # Fix linting issues automatically
npm run format       # Format code with Prettier
```

### Packaging
```bash
npm run package:all  # Package for all platforms (Windows, macOS, Linux)
npm run package:win  # Package for Windows only
```

## Architecture Overview

### Request Flow
The system processes MCP (Model Context Protocol) requests through a layered architecture:

**MCPServer** → **RequestRouter** → **RequestHandler** → **Services/Utils** → **ResponseFormatter**

### Core Components

**MCPServer** (`src/services/mcpServer.ts`)
- WebSocket server handling client connections
- Registers 9 core capabilities (model operations, simulation, BCL integration, measure workflows)
- Entry point for all MCP requests

**RequestHandler** (`src/handlers/requestHandler.ts`) 
- Core orchestration hub with 15+ handler methods
- Integrates services for model creation, simulation, BCL operations, measure workflows
- Validates requests and coordinates service calls

**Key Services:**
- **CommandProcessor**: Secure OpenStudio CLI command execution with validation
- **BCLApiClient**: Building Component Library integration with intelligent measure recommendations
- **MeasureApplicationService**: Complex multi-step measure application workflows
- **ResponseFormatter**: Standardized response formatting with configurable metadata

**OpenStudioCommands** (`src/utils/openStudioCommands.ts`)
- Comprehensive OpenStudio CLI interface with 20+ typed commands
- Parameter validation and output parsing for structured data

### MCP Capabilities
The server exposes these primary capabilities:
- Model operations (create, open, save, info)
- Simulation execution and monitoring  
- BCL search, download, and measure recommendations
- Measure application with workflow templates
- File operations with path validation

## Development Guidelines

### Code Style (from AGENTS.md)
- TypeScript with strict null checks
- 2-space indentation, 100-char line width
- Single quotes, trailing commas, semicolons required
- camelCase variables, PascalCase classes, UPPER_SNAKE_CASE constants

### Error Handling Pattern
- Always use try/catch blocks with structured error responses
- Log errors with context using the logger utility
- Return error responses with codes and details for debugging
- Use specific error types rather than generic errors

### Testing Approach
- Vitest for unit and integration tests
- Mock external dependencies with `vi.mock()`
- Test both success and error cases
- Use descriptive test names explaining expected behavior
- Mock file system operations and external APIs

### Important Notes
- Integration tests are often skipped in CI - check test files for `.skip.ts` versions
- The `ci-pass.test.ts` is used to ensure CI pipeline passes while other tests are being fixed
- Path validation is critical for security - all file operations use path safety checks
- OpenStudio CLI must be installed and available in PATH for full functionality

### Test Configuration
- Main config: `vitest.unit.config.mts` (30s timeout, excludes integration tests by default)
- Coverage targets: 70% lines/functions, 60% branches, 70% statements
- Test setup in `test/setup.ts`

### Key Patterns
- Services use dependency injection through constructor parameters
- Response formatting is centralized through `ResponseFormatter`
- Command execution goes through `CommandProcessor` for security
- BCL integration provides context-aware measure recommendations
- Measure workflows support backup/recovery mechanisms