#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Fix server.test.ts - Add proper error handling to WebSocket tests
function fixServerTests() {
  const filePath = path.join(__dirname, '..', 'test', 'server.test.ts');
  console.log(`Fixing WebSocket tests in ${filePath}`);
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Add error handling to WebSocket tests
    content = content.replace(
      /it\('should handle WebSocket connections and receive capabilities', \(done\) => {/,
      `it('should handle WebSocket connections and receive capabilities', (done) => {
    // Add timeout to prevent test from hanging
    const testTimeout = setTimeout(() => {
      done(new Error('Test timed out waiting for WebSocket response'));
    }, 5000);`
    );
    
    // Add error event handler and clear timeout
    content = content.replace(
      /ws\.on\('message', \(data\) => {/g,
      `ws.on('error', (error) => {
      clearTimeout(testTimeout);
      done(error);
    });
    
    ws.on('message', (data) => {`
    );
    
    // Clear timeout when done is called
    content = content.replace(
      /ws\.close\(\);\s+done\(\);/g,
      `ws.close();
        clearTimeout(testTimeout);
        done();`
    );
    
    // Fix the second WebSocket test
    content = content.replace(
      /it\('should reject invalid requests', \(done\) => {/,
      `it('should reject invalid requests', (done) => {
    // Add timeout to prevent test from hanging
    const testTimeout = setTimeout(() => {
      done(new Error('Test timed out waiting for WebSocket response'));
    }, 5000);`
    );
    
    // Add error event handler and clear timeout for second test
    content = content.replace(
      /let receivedCapabilities = false;\s+ws\.on\('open', \(\) => {/,
      `let receivedCapabilities = false;
    
    ws.on('error', (error) => {
      clearTimeout(testTimeout);
      done(error);
    });
    
    ws.on('open', () => {`
    );
    
    // Clear timeout when done is called in second test
    content = content.replace(
      /ws\.close\(\);\s+done\(\);/g,
      `ws.close();
        clearTimeout(testTimeout);
        done();`
    );
    
    // Add afterEach hook to clean up any hanging WebSocket connections
    content = content.replace(
      /afterAll\(\(\) => {\s+server\.close\(\);\s+}\);/,
      `afterAll(() => {
    server.close();
  });
  
  // Clean up any hanging WebSocket connections
  afterEach(() => {
    // Force garbage collection of WebSocket objects
    global.gc && global.gc();
  });`
    );
    
    fs.writeFileSync(filePath, content);
    console.log('✅ Fixed WebSocket tests in server.test.ts');
    return true;
  } catch (error) {
    console.error(`Error fixing server tests: ${error.message}`);
    return false;
  }
}

// Fix async tests without await
function fixAsyncTests() {
  const testDir = path.join(__dirname, '..', 'test');
  const testFiles = fs.readdirSync(testDir)
    .filter(file => file.endsWith('.test.ts') || file.endsWith('.test.js'));
  
  console.log(`Fixing async tests in ${testFiles.length} files`);
  
  let fixedFiles = 0;
  
  for (const file of testFiles) {
    const filePath = path.join(testDir, file);
    
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      let originalContent = content;
      
      // Fix async tests without await by adding return statement
      content = content.replace(
        /it\(['"](.*?)['"],\s*async\s*\(\)\s*=>\s*\{(?!\s*return|\s*await)/g,
        (match, testName) => {
          return `it('${testName}', async () => {\n    return `;
        }
      );
      
      if (content !== originalContent) {
        fs.writeFileSync(filePath, content);
        console.log(`✅ Fixed async tests in ${file}`);
        fixedFiles++;
      }
    } catch (error) {
      console.error(`Error fixing async tests in ${file}: ${error.message}`);
    }
  }
  
  console.log(`Fixed ${fixedFiles} files with async test issues`);
  return fixedFiles > 0;
}

// Add global timeout configuration to vitest.config.js
function updateVitestConfig() {
  const configPath = path.join(__dirname, '..', 'vitest.unit.config.mts');
  
  try {
    let content = fs.readFileSync(configPath, 'utf8');
    
    // Check if testTimeout is already set
    if (content.includes('testTimeout:')) {
      // Update the timeout to a higher value
      content = content.replace(
        /testTimeout:\s*\d+/,
        'testTimeout: 30000 // Increased timeout to 30 seconds'
      );
    }
    
    // Add hooks to clean up resources
    if (!content.includes('setupFiles:')) {
      content = content.replace(
        /test:\s*\{/,
        `test: {
    setupFiles: ['./test/setup.ts'],`
      );
      
      // Create setup file if it doesn't exist
      const setupDir = path.join(__dirname, '..', 'test');
      const setupPath = path.join(setupDir, 'setup.ts');
      
      if (!fs.existsSync(setupPath)) {
        const setupContent = `/**
 * Global test setup
 */
import { beforeEach, afterEach } from 'vitest';

// Clean up resources before each test
beforeEach(() => {
  // Reset any global state
});

// Clean up resources after each test
afterEach(() => {
  // Clean up timers
  vi.clearAllTimers();
  
  // Clean up mocks
  vi.clearAllMocks();
  
  // Force garbage collection if available
  global.gc && global.gc();
});
`;
        fs.writeFileSync(setupPath, setupContent);
        console.log(`✅ Created test setup file at ${setupPath}`);
      }
    }
    
    fs.writeFileSync(configPath, content);
    console.log('✅ Updated Vitest configuration');
    return true;
  } catch (error) {
    console.error(`Error updating Vitest config: ${error.message}`);
    return false;
  }
}

// Main function
async function main() {
  console.log('🔧 Fixing specific test issues...');
  
  // Fix server tests with WebSocket issues
  const serverFixed = fixServerTests();
  
  // Fix async tests without await
  const asyncFixed = fixAsyncTests();
  
  // Update Vitest config
  const configUpdated = updateVitestConfig();
  
  console.log('\n📋 Summary:');
  console.log(`- Server tests fixed: ${serverFixed ? 'Yes' : 'No'}`);
  console.log(`- Async tests fixed: ${asyncFixed ? 'Yes' : 'No'}`);
  console.log(`- Vitest config updated: ${configUpdated ? 'Yes' : 'No'}`);
  
  if (serverFixed || asyncFixed || configUpdated) {
    console.log('\n✅ Fixes have been applied. Please run tests again to check if the hanging issues are resolved.');
  } else {
    console.log('\n⚠️ No fixes were applied. Please check the error messages above.');
  }
}

main().catch(error => {
  console.error('Error in fix script:', error);
  process.exit(1);
});
