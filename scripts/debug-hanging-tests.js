#!/usr/bin/env node

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const glob = promisify(require('glob'));

// Configuration
const TEST_TIMEOUT_MS = 30 * 1000; // 30 seconds timeout for individual test files
const PROJECT_ROOT = path.join(__dirname, '..');
const TEST_DIR = path.join(PROJECT_ROOT, 'test');

async function findTestFiles() {
  try {
    // Find all test files in the test directory
    const testFiles = await glob('**/*.test.{js,ts,jsx,tsx}', { cwd: TEST_DIR });
    return testFiles.map(file => path.join(TEST_DIR, file));
  } catch (error) {
    console.error('Error finding test files:', error);
    return [];
  }
}

async function runSingleTest(testFile) {
  return new Promise((resolve) => {
    console.log(`Running test file: ${path.relative(PROJECT_ROOT, testFile)}`);
    
    const testProcess = spawn('npx', ['mocha', testFile], {
      cwd: PROJECT_ROOT,
      stdio: 'pipe',
      shell: true
    });
    
    let output = '';
    let error = '';
    
    testProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    testProcess.stderr.on('data', (data) => {
      error += data.toString();
    });
    
    const timeoutId = setTimeout(() => {
      console.log(`⚠️ Test file is hanging: ${path.relative(PROJECT_ROOT, testFile)}`);
      testProcess.kill('SIGKILL');
      resolve({
        file: testFile,
        status: 'hanging',
        output,
        error
      });
    }, TEST_TIMEOUT_MS);
    
    testProcess.on('close', (code) => {
      clearTimeout(timeoutId);
      resolve({
        file: testFile,
        status: code === 0 ? 'passed' : 'failed',
        exitCode: code,
        output,
        error
      });
    });
  });
}

async function analyzePackageJson() {
  const packageJsonPath = path.join(PROJECT_ROOT, 'package.json');
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    console.log('\nTest script configuration:');
    console.log(`npm test command: ${packageJson.scripts?.test || 'Not defined'}`);
    
    // Check test dependencies
    const dependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };
    
    console.log('\nTest-related dependencies:');
    ['mocha', 'jest', 'ava', 'tape', 'karma'].forEach(testFramework => {
      if (dependencies[testFramework]) {
        console.log(`- ${testFramework}: ${dependencies[testFramework]}`);
      }
    });
    
    return packageJson.scripts?.test || '';
  } catch (error) {
    console.error('Error analyzing package.json:', error);
    return '';
  }
}

async function checkNodeProcesses() {
  try {
    console.log('\nRunning Node processes:');
    const processes = execSync('ps aux | grep node | grep -v grep').toString();
    console.log(processes);
    return processes;
  } catch (error) {
    console.log('No relevant Node processes found');
    return '';
  }
}

async function main() {
  console.log('🔍 Starting test debugging process...');
  
  // Analyze package.json
  const testCommand = await analyzePackageJson();
  
  // Check running processes
  await checkNodeProcesses();
  
  // Find all test files
  const testFiles = await findTestFiles();
  console.log(`\nFound ${testFiles.length} test files`);
  
  if (testFiles.length === 0) {
    console.log('No test files found. Check if tests are in a different location.');
    return;
  }
  
  // Run each test file individually with a timeout
  console.log('\nRunning individual test files to identify hanging tests:');
  const results = await Promise.all(testFiles.map(runSingleTest));
  
  // Analyze results
  const hangingTests = results.filter(r => r.status === 'hanging');
  const failedTests = results.filter(r => r.status === 'failed');
  const passedTests = results.filter(r => r.status === 'passed');
  
  console.log('\n📊 Test Results Summary:');
  console.log(`- Total test files: ${results.length}`);
  console.log(`- Passed: ${passedTests.length}`);
  console.log(`- Failed: ${failedTests.length}`);
  console.log(`- Hanging: ${hangingTests.length}`);
  
  if (hangingTests.length > 0) {
    console.log('\n⚠️ Hanging Test Files:');
    hangingTests.forEach(test => {
      console.log(`- ${path.relative(PROJECT_ROOT, test.file)}`);
    });
    
    console.log('\n💡 Recommendations for fixing hanging tests:');
    console.log('1. Check for infinite loops or unresolved promises');
    console.log('2. Look for missing test teardown (database connections, servers, etc.)');
    console.log('3. Examine tests that use timers or long-running operations');
    console.log('4. Check for tests waiting on external resources that may be unavailable');
    console.log('5. Consider adding explicit timeouts to async tests');
    
    // Write detailed debug info for hanging tests
    const debugDir = path.join(PROJECT_ROOT, 'test-debug');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir);
    }
    
    hangingTests.forEach(test => {
      const fileName = path.basename(test.file, path.extname(test.file));
      fs.writeFileSync(
        path.join(debugDir, `${fileName}-debug.log`),
        `Test File: ${test.file}\n` +
        `Status: ${test.status}\n\n` +
        `STDOUT:\n${test.output}\n\n` +
        `STDERR:\n${test.error}\n`
      );
    });
    
    console.log(`\nDetailed debug logs written to: ${debugDir}`);
  }
}

main().catch(error => {
  console.error('Error in debug script:', error);
  process.exit(1);
});
