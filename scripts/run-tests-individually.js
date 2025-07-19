#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const glob = promisify(require('glob'));

// Configuration
const TEST_TIMEOUT_MS = 10000; // 10 seconds timeout per test file
const PROJECT_ROOT = path.join(__dirname, '..');
const TEST_DIR = path.join(PROJECT_ROOT, 'test');
const RESULTS_LOG_PATH = path.join(PROJECT_ROOT, 'test-results.log');

// Clear previous results log if it exists
if (fs.existsSync(RESULTS_LOG_PATH)) {
  fs.unlinkSync(RESULTS_LOG_PATH);
}

// Find all test files
async function findTestFiles() {
  try {
    // Find all test files in the test directory and subdirectories
    const testFiles = await glob('**/*.{test,spec}.{js,ts,jsx,tsx}', { 
      cwd: TEST_DIR,
      ignore: ['node_modules/**', 'dist/**']
    });
    return testFiles.map(file => path.join(TEST_DIR, file));
  } catch (error) {
    console.error('Error finding test files:', error);
    return [];
  }
}

// Run a single test file with timeout
async function runTestFile(testFile) {
  return new Promise((resolve) => {
    const relativePath = path.relative(PROJECT_ROOT, testFile);
    console.log(`\n🧪 Running test file: ${relativePath}`);
    
    const startTime = Date.now();
    
    // Use vitest to run a single test file
    const testProcess = spawn('npx', ['vitest', 'run', relativePath, '--config', 'vitest.unit.config.mts'], {
      cwd: PROJECT_ROOT,
      stdio: 'pipe',
      shell: true
    });
    
    let output = '';
    let error = '';
    
    testProcess.stdout.on('data', (data) => {
      const chunk = data.toString();
      output += chunk;
      process.stdout.write(chunk);
    });
    
    testProcess.stderr.on('data', (data) => {
      const chunk = data.toString();
      error += chunk;
      process.stderr.write(chunk);
    });
    
    // Set timeout for the test
    const timeoutId = setTimeout(() => {
      console.log(`\n⏱️ TIMEOUT: Test file ${relativePath} took longer than ${TEST_TIMEOUT_MS/1000} seconds`);
      testProcess.kill('SIGKILL');
      
      resolve({
        file: relativePath,
        status: 'timeout',
        duration: Date.now() - startTime,
        output,
        error
      });
    }, TEST_TIMEOUT_MS);
    
    testProcess.on('close', (code) => {
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;
      
      const result = {
        file: relativePath,
        status: code === 0 ? 'passed' : 'failed',
        exitCode: code,
        duration,
        output,
        error
      };
      
      console.log(`✅ Completed in ${duration}ms with exit code ${code}`);
      resolve(result);
    });
  });
}

// Main function
async function main() {
  console.log('🔍 Running tests individually to identify hanging tests...');
  
  // Find all test files
  const testFiles = await findTestFiles();
  console.log(`Found ${testFiles.length} test files to run`);
  
  // Results arrays
  const results = [];
  const passedTests = [];
  const failedTests = [];
  const timeoutTests = [];
  
  // Run each test file sequentially
  for (const testFile of testFiles) {
    const result = await runTestFile(testFile);
    results.push(result);
    
    if (result.status === 'passed') {
      passedTests.push(result);
    } else if (result.status === 'timeout') {
      timeoutTests.push(result);
    } else {
      failedTests.push(result);
    }
  }
  
  // Write results to log file
  const logContent = `
TEST RESULTS SUMMARY
===================
Date: ${new Date().toISOString()}

Total test files: ${results.length}
Passed: ${passedTests.length}
Failed: ${failedTests.length}
Timeout: ${timeoutTests.length}

TIMEOUT TESTS
============
${timeoutTests.map(test => `${test.file} (${test.duration}ms)`).join('\n')}

FAILED TESTS
===========
${failedTests.map(test => `${test.file} (${test.duration}ms) - Exit code: ${test.exitCode}`).join('\n')}

PASSED TESTS
===========
${passedTests.map(test => `${test.file} (${test.duration}ms)`).join('\n')}

DETAILED RESULTS
===============
${results.map(test => `
FILE: ${test.file}
STATUS: ${test.status}
DURATION: ${test.duration}ms
${test.status !== 'passed' ? `\nSTDOUT:\n${test.output}\n\nSTDERR:\n${test.error}` : ''}
-------------------`).join('\n')}
`;

  fs.writeFileSync(RESULTS_LOG_PATH, logContent);
  
  // Print summary
  console.log('\n📊 TEST RESULTS SUMMARY:');
  console.log(`Total test files: ${results.length}`);
  console.log(`Passed: ${passedTests.length}`);
  console.log(`Failed: ${failedTests.length}`);
  console.log(`Timeout: ${timeoutTests.length}`);
  
  if (timeoutTests.length > 0) {
    console.log('\n⚠️ TIMEOUT TESTS:');
    timeoutTests.forEach(test => {
      console.log(`- ${test.file}`);
    });
    
    console.log('\n💡 These tests are likely causing the hanging issues.');
  }
  
  console.log(`\nDetailed results written to: ${RESULTS_LOG_PATH}`);
  
  // Exit with error code if any tests failed or timed out
  if (failedTests.length > 0 || timeoutTests.length > 0) {
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Error running tests:', error);
  process.exit(1);
});
