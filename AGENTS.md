# Agent Configuration for OpenStudio MCP

## Build/Lint/Test Commands

```bash
# Build the project
npm run build

# Start development server with hot reloading
npm run dev

# Run all tests
npm test

# Run a single test file
npx vitest run path/to/test-file.test.ts --config vitest.unit.config.mts

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Lint the code
npm run lint

# Format the code
npm run format

# Fix linting issues
npm run lint -- --fix
```

## Code Style Guidelines

### Imports

- Use ES6 import/export syntax
- Group imports in order: built-in modules, external packages, internal modules
- Use absolute imports when possible for internal modules
- Import types with `import type { Type } from './module'`

### Formatting

- Single quotes for strings
- Semicolons required
- Trailing commas in multi-line objects/arrays
- 2-space indentation
- Line width: 100 characters
- Unix line endings (LF)

### Types

- Use TypeScript for all source files
- Explicitly type function parameters and return values
- Use interfaces for object structures
- Prefer `const` over `let`, avoid `var`
- Use strict null checks (tsconfig has `strictNullChecks: true`)

### Naming Conventions

- Use camelCase for variables and functions
- Use PascalCase for classes and interfaces
- Use UPPER_SNAKE_CASE for constants
- Use descriptive names that convey purpose
- Prefix private class members with underscore (\_privateMethod)

### Error Handling

- Always handle errors with try/catch blocks
- Log errors with appropriate context using the logger utility
- Return structured error responses with error codes
- Use specific error types rather than generic errors
- Include error details in responses for debugging

### Testing

- Use Vitest for unit and integration tests
- Mock external dependencies using vi.mock()
- Test both success and error cases
- Use descriptive test names that explain the expected behavior
- Use beforeEach/afterEach for test setup/teardown
- Mock file system operations and external APIs
