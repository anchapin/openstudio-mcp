/**
 * Test utilities
 */
import fs from 'fs';
import path from 'path';
import testConfig from './testConfig';

/**
 * Ensure test directories exist
 */
export function ensureTestDirectories(): void {
  // Create test temp directory if it doesn't exist
  if (!fs.existsSync(testConfig.bcl.tempDir)) {
    fs.mkdirSync(testConfig.bcl.tempDir, { recursive: true });
  }
  
  // Create test measures directory if it doesn't exist
  if (!fs.existsSync(testConfig.bcl.measuresDir)) {
    fs.mkdirSync(testConfig.bcl.measuresDir, { recursive: true });
  }
}

/**
 * Recursively delete a directory's contents
 */
function deleteDirectoryContents(dirPath: string, excludeDirs: string[] = []): void {
  if (!fs.existsSync(dirPath)) {
    return;
  }

  const files = fs.readdirSync(dirPath);
  
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    
    // Skip excluded directories
    if (excludeDirs.includes(file)) {
      continue;
    }
    
    try {
      if (fs.lstatSync(filePath).isDirectory()) {
        // Recursively delete directory contents
        deleteDirectoryContents(filePath);
        // Then remove the directory itself
        fs.rmdirSync(filePath);
      } else {
        // Delete file
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.error(`Error cleaning up ${filePath}:`, err);
    }
  }
}

/**
 * Clean up test directories
 */
export function cleanupTestDirectories(): void {
  try {
    // Clean up temp directory but preserve measures directory
    if (fs.existsSync(testConfig.bcl.tempDir)) {
      deleteDirectoryContents(testConfig.bcl.tempDir, ['measures']);
    }
    
    console.log('Test directories cleaned up successfully');
  } catch (err) {
    console.error('Error during test directory cleanup:', err);
  }
}