/**
 * CI Test Setup Script
 * 
 * This script helps prepare the environment for CI testing
 * by ensuring all necessary directories exist and cleaning up
 * any leftover test artifacts.
 */

const fs = require('fs');
const path = require('path');

// Ensure test directories exist
const testDirs = [
  'tmp',
  'test/tmp',
  'test-results'
];

testDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    console.log(`Creating directory: ${dir}`);
    fs.mkdirSync(dir, { recursive: true });
  } else {
    console.log(`Directory already exists: ${dir}`);
    
    // Clean up any files in the directory
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const filePath = path.join(dir, file);
      try {
        if (fs.lstatSync(filePath).isDirectory()) {
          // Skip directories
          return;
        }
        fs.unlinkSync(filePath);
        console.log(`Removed file: ${filePath}`);
      } catch (err) {
        console.error(`Error removing file ${filePath}:`, err);
      }
    });
  }
});

console.log('CI test setup complete');