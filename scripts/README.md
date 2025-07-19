# Test Scripts

This directory contains scripts to help run and debug tests in the OpenStudio MCP project.

## Available Scripts

### `run-tests.sh`

Runs the tests with a timeout to prevent hanging tests from blocking the process indefinitely.

```bash
npm run test:timeout
```

### `fix-hanging-tests.js`

Analyzes and fixes common issues that can cause tests to hang:

- Adds explicit timeouts to test configurations
- Adds cleanup hooks for timers and mocks
- Identifies potential issues like missing `done()` calls or unresolved promises

```bash
npm run test:fix
```

### `debug-hanging-tests.js`

Runs individual test files to identify which specific tests are hanging:

- Executes each test file with a short timeout
- Generates detailed logs for hanging tests
- Provides recommendations for fixing the issues

This script is automatically called when tests timeout, but you can also run it manually:

```bash
node scripts/debug-hanging-tests.js
```

## Common Issues and Solutions

### 1. Missing `done()` Calls

If you're using callback-style tests with `done`, make sure to call `done()` in all code paths:

```javascript
it('should complete async operation', (done) => {
  someAsyncOperation()
    .then(() => {
      expect(result).toBe(expected);
      done(); // Don't forget this!
    })
    .catch((err) => {
      done(err); // Handle errors too
    });
});
```

### 2. Unresolved Promises

Make sure to return promises or use `async/await` in tests:

```javascript
it('should complete async operation', async () => {
  await someAsyncOperation();
  expect(result).toBe(expected);
});
```

### 3. Uncleaned Timers

Always clear timers in your tests:

```javascript
let timerId;

beforeEach(() => {
  timerId = setTimeout(() => {
    // some operation
  }, 1000);
});

afterEach(() => {
  clearTimeout(timerId);
});
```

### 4. External Resources

Mock external resources or ensure they have timeouts:

```javascript
vi.mock('axios');

// Or set timeouts on real requests
axios.get('/api/data', { timeout: 5000 });
```

## Configuring Test Timeouts

The default timeout for tests is set to 30 seconds. You can adjust this in the Vitest configuration files:

```javascript
// vitest.config.js
export default defineConfig({
  testTimeout: 30000, // 30 seconds
});
```

Or for individual tests:

```javascript
it('should complete long operation', () => {
  vi.setConfig({ testTimeout: 10000 }); // 10 seconds
  // test code
});
```
