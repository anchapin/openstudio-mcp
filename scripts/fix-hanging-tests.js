#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { promisify } = require('util');
const glob = promisify(require('glob'));

const PROJECT_ROOT = path.join(__dirname, '..');
const VITEST_CONFIG_PATH = path.join(PROJECT_ROOT, 'vitest.unit.config.mts');

async function findTestFiles() {
  try {
    // Find all test files in the project
    const testFiles = await glob('**/*.{test,spec}.{js,ts,jsx,tsx}', { 
      cwd: PROJECT_ROOT,
      ignore: ['node_modules/**', 'dist/**', 'bin/**']
    });
    return testFiles.map(file => path.join(PROJECT_ROOT, file));
  } catch (error) {
    console.error('Error finding test files:', error);
    return [];
  }
}

function updateVitestConfig() {
  console.log('Checking Vitest configuration...');
  
  if (!fs.existsSync(VITEST_CONFIG_PATH)) {
    console.log('Vitest config not found at expected path. Checking for other config files...');
    
    // Look for other potential vitest config files
    try {
      const configFiles = execSync('find . -name "vitest*.config.*" -not -path "*/node_modules/*" -not -path "*/dist/*"', {
        cwd: PROJECT_ROOT
      }).toString().trim().split('\n');
      
      if (configFiles.length === 0) {
        console.log('No Vitest config files found.');
        return false;
      }
      
      console.log(`Found alternative Vitest config files: ${configFiles.join(', ')}`);
      
      // Update the first found config file
      const configPath = path.join(PROJECT_ROOT, configFiles[0].replace('./', ''));
      updateConfigFile(configPath);
      return true;
    } catch (error) {
      console.error('Error searching for Vitest config files:', error);
      return false;
    }
  } else {
    updateConfigFile(VITEST_CONFIG_PATH);
    return true;
  }
}

function updateConfigFile(configPath) {
  console.log(`Updating Vitest config at: ${configPath}`);
  
  try {
    let content = fs.readFileSync(configPath, 'utf8');
    
    // Check if it's a TypeScript or JavaScript file
    const isTypeScript = configPath.endsWith('.ts') || configPath.endsWith('.mts');
    
    // Add timeout configuration if not already present
    if (!content.includes('testTimeout')) {
      if (content.includes('export default')) {
        // For export default defineConfig({ ... }) pattern
        content = content.replace(
          /export default defineConfig\(\s*\{/,
          `export default defineConfig({\n  testTimeout: 30000, // 30 seconds timeout for tests`
        );
      } else if (content.includes('export default {')) {
        // For export default { ... } pattern
        content = content.replace(
          /export default \{/,
          `export default {\n  testTimeout: 30000, // 30 seconds timeout for tests`
        );
      } else if (content.includes('module.exports')) {
        // For module.exports = { ... } pattern
        content = content.replace(
          /module\.exports\s*=\s*\{/,
          `module.exports = {\n  testTimeout: 30000, // 30 seconds timeout for tests`
        );
      } else {
        // If we can't find a pattern to match, add it as a new config
        const configObject = isTypeScript 
          ? `import { defineConfig } from 'vitest/config';\n\nexport default defineConfig({\n  testTimeout: 30000, // 30 seconds timeout for tests\n});\n`
          : `module.exports = {\n  testTimeout: 30000, // 30 seconds timeout for tests\n};\n`;
        
        if (content.trim() === '') {
          content = configObject;
        } else {
          console.log('Could not automatically update config file. Please add testTimeout manually.');
          return false;
        }
      }
      
      fs.writeFileSync(configPath, content);
      console.log('✅ Added test timeout configuration to Vitest config');
    } else {
      console.log('✓ Test timeout already configured in Vitest config');
    }
    
    return true;
  } catch (error) {
    console.error('Error updating Vitest config:', error);
    return false;
  }
}

async function checkForCommonIssues(testFiles) {
  console.log('\nChecking for common issues in test files...');
  
  let issuesFound = false;
  let fixesApplied = false;
  
  for (const file of testFiles) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      let updatedContent = content;
      let fileIssuesFound = false;
      let fileFixesApplied = false;
      
      // Check for missing done() calls in callbacks
      const callbacksWithoutDone = (content.match(/it\(['"](.*?)['"]\s*,\s*\(\s*done\s*\)\s*=>\s*\{(?!.*done\(\))/g) || []).length;
      if (callbacksWithoutDone > 0) {
        console.log(`⚠️ ${path.relative(PROJECT_ROOT, file)}: Found ${callbacksWithoutDone} potential test(s) with missing done() calls`);
        fileIssuesFound = true;
      }
      
      // Check for unresolved promises
      const asyncTestsWithoutAwait = (content.match(/it\(['"](.*?)['"]\s*,\s*async\s*\(\)\s*=>\s*\{(?!.*await)/g) || []).length;
      if (asyncTestsWithoutAwait > 0) {
        console.log(`⚠️ ${path.relative(PROJECT_ROOT, file)}: Found ${asyncTestsWithoutAwait} potential async test(s) without await`);
        fileIssuesFound = true;
      }
      
      // Check for setTimeout without clearing
      const setTimeoutWithoutClear = (content.match(/setTimeout\(/g) || []).length - (content.match(/clearTimeout\(/g) || []).length;
      if (setTimeoutWithoutClear > 0) {
        console.log(`⚠️ ${path.relative(PROJECT_ROOT, file)}: Found ${setTimeoutWithoutClear} potential setTimeout(s) without clearTimeout`);
        fileIssuesFound = true;
      }
      
      // Add explicit timeouts to tests
      if (!content.includes('timeout(') && !content.includes('vi.setConfig')) {
        // Add timeout to describe blocks
        updatedContent = updatedContent.replace(
          /(describe\(['"](.*?)['"],\s*\(\)\s*=>\s*\{)/g,
          '$1\n  vi.setConfig({ testTimeout: 10000 }); // Added 10s timeout'
        );
        
        if (updatedContent !== content) {
          fileFixesApplied = true;
          console.log(`✅ ${path.relative(PROJECT_ROOT, file)}: Added test timeouts to describe blocks`);
        }
      }
      
      // Add afterEach hooks to clean up resources if not present
      if (!content.includes('afterEach') && (content.includes('setTimeout') || content.includes('setInterval'))) {
        const afterEachHook = `
  afterEach(() => {
    // Clean up timers
    vi.clearAllTimers();
    vi.clearAllMocks();
  });
`;
        
        // Add after the first describe or test block
        updatedContent = updatedContent.replace(
          /(describe\(['"](.*?)['"],\s*\(\)\s*=>\s*\{|test\(['"](.*?)['"],\s*\(\)\s*=>\s*\{)/,
          `$1\n${afterEachHook}`
        );
        
        if (updatedContent !== content) {
          fileFixesApplied = true;
          console.log(`✅ ${path.relative(PROJECT_ROOT, file)}: Added afterEach hook to clean up resources`);
        }
      }
      
      // Write changes if any fixes were applied
      if (fileFixesApplied) {
        fs.writeFileSync(file, updatedContent);
        fixesApplied = true;
      }
      
      issuesFound = issuesFound || fileIssuesFound;
    } catch (error) {
      console.error(`Error checking file ${file}:`, error);
    }
  }
  
  return { issuesFound, fixesApplied };
}

async function main() {
  console.log('🔧 Starting to fix hanging test issues...');
  
  // Update Vitest configuration
  const configUpdated = updateVitestConfig();
  
  // Find test files
  const testFiles = await findTestFiles();
  console.log(`Found ${testFiles.length} test files to check`);
  
  // Check for common issues
  const { issuesFound, fixesApplied } = await checkForCommonIssues(testFiles);
  
  console.log('\n📋 Summary:');
  console.log(`- Vitest config updated: ${configUpdated ? 'Yes' : 'No'}`);
  console.log(`- Test files checked: ${testFiles.length}`);
  console.log(`- Issues found: ${issuesFound ? 'Yes' : 'No'}`);
  console.log(`- Fixes applied: ${fixesApplied ? 'Yes' : 'No'}`);
  
  if (fixesApplied || configUpdated) {
    console.log('\n✅ Fixes have been applied. Please run tests again to check if the hanging issues are resolved.');
  } else if (issuesFound) {
    console.log('\n⚠️ Issues were found but could not be automatically fixed. Please review the warnings above.');
  } else {
    console.log('\n✓ No common issues found in test files.');
  }
  
  console.log('\n💡 Additional recommendations:');
  console.log('1. Make sure all async tests return promises or use await');
  console.log('2. Add explicit timeouts to long-running tests');
  console.log('3. Clean up resources in afterEach/afterAll hooks');
  console.log('4. Check for infinite loops or recursion');
  console.log('5. Ensure all network requests have timeouts');
  console.log('6. Mock external services that might be unreliable');
}

main().catch(error => {
  console.error('Error in fix script:', error);
  process.exit(1);
});
