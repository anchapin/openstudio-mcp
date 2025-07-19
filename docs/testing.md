# Testing Guide for OpenStudio MCP

This guide outlines the testing approach and patterns used in the OpenStudio MCP project.

## Testing Framework

OpenStudio MCP uses [Vitest](https://vitest.dev/) as its testing framework. Vitest provides a Jest-compatible API with improved performance and TypeScript support.

## Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Test Structure

Tests are organized in the `test` directory, mirroring the structure of the `src` directory. Each test file should be named after the module it tests, with a `.test.ts` suffix.

```
src/
  utils/
    fileOperations.ts
test/
  utils/
    fileOperations.test.ts
```

## Mocking Patterns

### Basic Mocking

For simple mocks, use `vi.fn()`:

```typescript
const mockFunction = vi.fn();
mockFunction.mockReturnValue('mocked value');
```

### Module Mocking

Use `vi.mock()` with the `importActual` pattern to preserve original functionality while selectively overriding specific methods:

```typescript
vi.mock('../src/utils/logger', async () => {
  const actual = await vi.importActual('../src/utils/logger');
  return {
    ...actual,
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    }
  };
});
```

### Mocking Class Methods

Use `vi.spyOn()` to mock class methods:

```typescript
const myMethodSpy = vi.spyOn(myInstance, 'myMethod');
myMethodSpy.mockReturnValue('mocked value');
```

### Mocking fs.promises

When mocking `fs.promises`, create a complete mock of the fs module:

```typescript
vi.mock('fs', () => {
  const mockFs = {
    promises: {
      access: vi.fn(),
      stat: vi.fn(),
      mkdir: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn(),
      // Add other methods as needed
    },
    constants: { F_OK: 0 }
  };
  
  return mockFs;
});
```

### Mocking Axios

When mocking Axios, mock the create method and the returned instance:

```typescript
vi.mock('axios', async () => {
  const actual = await vi.importActual('axios');
  const mockAxiosInstance = {
    get: vi.fn(),
    post: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() }
    }
  };
  
  return {
    ...actual,
    default: {
      create: vi.fn(() => mockAxiosInstance),
      isAxiosError: vi.fn()
    }
  };
});
```

### Mocking WebSocket

When mocking WebSocket, create a mock implementation:

```typescript
vi.mock('ws', () => {
  const MockWebSocket = vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    send: vi.fn(),
    close: vi.fn()
  }));
  
  MockWebSocket.OPEN = 1;
  MockWebSocket.CLOSING = 2;
  MockWebSocket.CLOSED = 3;
  
  return {
    default: MockWebSocket
  };
});
```

## Test Setup and Teardown

Use `beforeEach` and `afterEach` to set up and tear down test state:

```typescript
beforeEach(() => {
  // Reset all mocks
  vi.resetAllMocks();
});

afterEach(() => {
  // Clear all mocks
  vi.clearAllMocks();
});
```

## Testing Async Code

Use `async/await` for testing asynchronous code:

```typescript
it('should handle async operations', async () => {
  const result = await myAsyncFunction();
  expect(result).toBe('expected value');
});
```

## Mocking Conditional Behavior

Use `mockImplementation` to create conditional behavior in mocks:

```typescript
mockFunction.mockImplementation((arg) => {
  if (arg === 'condition1') {
    return 'result1';
  } else {
    return 'result2';
  }
});
```

## Integration Tests

Integration tests are located in the `test/integration` directory. These tests verify the interaction between multiple components.

Integration tests may require a running server or external dependencies. Use the `.skip` modifier to skip these tests in the CI pipeline if necessary.

## Best Practices

1. **Test in isolation**: Mock dependencies to isolate the unit under test.
2. **Use descriptive test names**: Test names should describe the expected behavior.
3. **One assertion per test**: Each test should verify one specific behavior.
4. **Reset mocks between tests**: Use `vi.resetAllMocks()` to ensure tests don't affect each other.
5. **Test edge cases**: Include tests for error conditions and edge cases.
6. **Avoid testing implementation details**: Test the public API, not internal implementation.
7. **Use the importActual pattern**: Preserve original functionality while mocking specific methods.
8. **Mock at the appropriate level**: Mock at the module boundary, not internal functions.
9. **Test both success and failure paths**: Ensure error handling works correctly.
10. **Keep tests fast**: Tests should run quickly to provide fast feedback.

## Common Issues and Solutions

### Issue: Cannot read properties of undefined

This often occurs when mocking a module with nested properties. Ensure you're mocking the entire object structure:

```typescript
// Incorrect
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn()
  }
}));

// Correct
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    // Include all methods used in the code
  },
  constants: { F_OK: 0 }
}));
```

### Issue: Mock not being called

Check that you're mocking at the correct level. If you're mocking a method on an imported object, you need to mock the entire module:

```typescript
// Incorrect
const myModule = require('../src/myModule');
myModule.myMethod = vi.fn();

// Correct
vi.mock('../src/myModule', () => ({
  myMethod: vi.fn()
}));
```

### Issue: Mock not returning expected value

Ensure you're setting up the mock before calling the function under test:

```typescript
// Incorrect
it('should return mocked value', async () => {
  const result = await myFunction();
  mockDependency.mockReturnValue('mocked value');
  expect(result).toBe('mocked value');
});

// Correct
it('should return mocked value', async () => {
  mockDependency.mockReturnValue('mocked value');
  const result = await myFunction();
  expect(result).toBe('mocked value');
});
```
