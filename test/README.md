# OpenStudio MCP Test Suite

This directory contains the test suite for the OpenStudio MCP project. The tests are written using Vitest.

## Running Tests

```bash
# Run all tests
npm test

# Run tests with timeout protection
npm run test:timeout

# Run tests individually to identify hanging tests
npm run test:individual

# Run tests with coverage
npm run test:coverage
```

## Test Debugging Tools

Several scripts are available to help debug and fix test issues:

### 1. `test:individual`

Runs each test file individually with a short timeout to identify which tests are hanging:

```bash
npm run test:individual
```

### 2. `test:timeout`

Runs tests with a global timeout to prevent the test suite from hanging indefinitely:

```bash
npm run test:timeout
```

### 3. `test:fix`

Automatically fixes common issues that can cause tests to hang:

```bash
npm run test:fix
```

### 4. `test:fix-specific`

Fixes specific issues in problematic test files:

```bash
npm run test:fix-specific
```

### 5. `test:debug-all`

Comprehensive debugging tool that analyzes all test files, identifies issues, and applies fixes:

```bash
npm run test:debug-all
```

## Common Issues and Solutions

### 1. Hanging Tests

Tests can hang for several reasons:

- **Async tests without await or return**: Always use `await` or `return` in async tests.
- **Missing done() calls**: When using callback-style tests with `done`, ensure it's called in all code paths.
- **Uncleaned timers**: Always clear timers in afterEach hooks.
- **WebSocket connections**: Close WebSocket connections after tests.
- **Infinite loops**: Avoid while loops without proper exit conditions.

### 2. Mock Issues

- **Missing exports in mocks**: Ensure all required exports are provided in mocks.
- **Async mocks**: Use `async () => ({...})` syntax for mocks that need to import actual modules.
- **Cleanup**: Reset mocks in afterEach hooks.

### 3. Resource Cleanup

Always clean up resources in afterEach hooks:

```javascript
afterEach(() => {
  vi.clearAllMocks();
  vi.clearAllTimers();
  vi.useRealTimers();
});
```

## Test Structure

Tests are organized by module, with each module having its own test file. Integration tests are in the `integration` subdirectory.

## Skipped Tests

Some tests are currently skipped to prevent hanging issues. These tests should be revisited and fixed in the future.

## Test Configuration

The test configuration is in `vitest.unit.config.mts`. Key settings include:

- **testTimeout**: 30000ms (30 seconds)
- **exclude**: Integration tests are excluded from the default test run

## Future Improvements

1. Fix skipped tests
2. Improve test coverage
3. Add more integration tests
4. Implement proper mocking for external dependencies
