#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuration
const TEST_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes timeout
const DEBUG_LOG_PATH = path.join(__dirname, '..', 'test-debug.log');
const NPM_TEST_COMMAND = 'npm';
const NPM_TEST_ARGS = ['test'];

// Clear previous debug log if it exists
if (fs.existsSync(DEBUG_LOG_PATH)) {
  fs.unlinkSync(DEBUG_LOG_PATH);
}

console.log(`Starting tests with ${TEST_TIMEOUT_MS / 1000} seconds timeout...`);
console.log(`Debug logs will be written to: ${DEBUG_LOG_PATH}`);

// Start the test process
const testProcess = spawn(NPM_TEST_COMMAND, NPM_TEST_ARGS, {
  stdio: 'pipe',
  shell: true
});

let testOutput = '';
let testError = '';

// Capture stdout
testProcess.stdout.on('data', (data) => {
  const output = data.toString();
  testOutput += output;
  process.stdout.write(output);
});

// Capture stderr
testProcess.stderr.on('data', (data) => {
  const output = data.toString();
  testError += output;
  process.stderr.write(output);
});

// Set timeout
const timeoutId = setTimeout(() => {
  console.error('\n\n⚠️ TESTS TIMED OUT ⚠️');
  console.error(`Tests have been running for ${TEST_TIMEOUT_MS / 1000} seconds and appear to be hanging.`);
  
  // Write debug information to log file
  const debugInfo = {
    timestamp: new Date().toISOString(),
    testOutput,
    testError,
    runningProcesses: 'See below'
  };
  
  // Get list of running Node processes to help debug
  const debugProcess = spawn('ps', ['aux', '|', 'grep', 'node'], { shell: true });
  let processList = '';
  
  debugProcess.stdout.on('data', (data) => {
    processList += data.toString();
  });
  
  debugProcess.on('close', () => {
    fs.writeFileSync(DEBUG_LOG_PATH, 
      `TEST TIMEOUT DEBUG INFORMATION\n` +
      `============================\n` +
      `Timestamp: ${debugInfo.timestamp}\n\n` +
      `RUNNING NODE PROCESSES:\n` +
      `${processList}\n\n` +
      `TEST STDOUT:\n` +
      `${testOutput}\n\n` +
      `TEST STDERR:\n` +
      `${testError}\n`
    );
    
    console.error(`Debug information written to: ${DEBUG_LOG_PATH}`);
    console.error('Running debug script to identify hanging tests...');
    
    // Run the debug script
    const debugTestProcess = spawn('node', [path.join(__dirname, 'debug-hanging-tests.js')], {
      stdio: 'inherit',
      shell: true
    });
    
    debugTestProcess.on('close', (code) => {
      console.log(`Debug process exited with code ${code}`);
      // Kill the main test process
      testProcess.kill('SIGKILL');
    });
  });
}, TEST_TIMEOUT_MS);

// Handle test process completion
testProcess.on('close', (code) => {
  // Clear the timeout since the process completed
  clearTimeout(timeoutId);
  
  if (code === 0) {
    console.log('\n✅ Tests completed successfully!');
  } else {
    console.error(`\n❌ Tests failed with exit code: ${code}`);
  }
  
  process.exit(code);
});
