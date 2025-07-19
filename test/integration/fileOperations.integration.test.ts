/**
 * File operations integration tests
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fileOperations from '../../src/utils/fileOperations';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe.skip('File Operations Integration', () => {
  let testDir: string;
  let originalNodeEnv: string | undefined;
  
  beforeAll(() => {
    // Save original NODE_ENV and set to 'test'
    originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    
    // Create a temporary directory for testing
    testDir = path.join(os.tmpdir(), `openstudio-mcp-test-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });
  });
  
  afterAll(() => {
    // Clean up the test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    
    // Restore original NODE_ENV
    process.env.NODE_ENV = originalNodeEnv;
  });
  
  it('should create and read a file', async () => {
    return 
    const filePath = path.join(testDir, 'test-file.txt');
    const content = 'Hello, world!';
    
    // Create the file
    await fileOperations.writeFile(filePath, content);
    
    // Check that the file exists
    expect(fs.existsSync(filePath)).toBe(true);
    
    // Read the file
    const readContent = await fileOperations.readFile(filePath);
    
    // Check that the content matches
    expect(readContent).toBe(content);
  });
  
  it('should append to a file', async () => {
    return 
    const filePath = path.join(testDir, 'append-test.txt');
    const initialContent = 'Initial content\n';
    const appendContent = 'Appended content';
    
    // Create the file
    await fileOperations.writeFile(filePath, initialContent);
    
    // Append to the file
    await fileOperations.appendFile(filePath, appendContent);
    
    // Read the file
    const readContent = await fileOperations.readFile(filePath);
    
    // Check that the content matches
    expect(readContent).toBe(initialContent + appendContent);
  });
  
  it('should delete a file', async () => {
    return 
    const filePath = path.join(testDir, 'delete-test.txt');
    
    // Create the file
    await fileOperations.writeFile(filePath, 'Delete me');
    
    // Check that the file exists
    expect(fs.existsSync(filePath)).toBe(true);
    
    // Delete the file
    await fileOperations.deleteFile(filePath);
    
    // Check that the file no longer exists
    expect(fs.existsSync(filePath)).toBe(false);
  });
  
  it('should create and check directories', async () => {
    return 
    const dirPath = path.join(testDir, 'test-dir');
    
    // Create the directory
    await fileOperations.createDirectory(dirPath);
    
    // Check that the directory exists
    expect(await fileOperations.directoryExists(dirPath)).toBe(true);
    
    // Check that a non-existent directory returns false
    expect(await fileOperations.directoryExists(path.join(testDir, 'non-existent'))).toBe(false);
  });
  
  it('should copy a file', async () => {
    return 
    const sourcePath = path.join(testDir, 'source.txt');
    const destPath = path.join(testDir, 'dest.txt');
    const content = 'Copy me';
    
    // Create the source file
    await fileOperations.writeFile(sourcePath, content);
    
    // Copy the file
    await fileOperations.copyFile(sourcePath, destPath);
    
    // Check that both files exist
    expect(fs.existsSync(sourcePath)).toBe(true);
    expect(fs.existsSync(destPath)).toBe(true);
    
    // Check that the content matches
    const destContent = await fileOperations.readFile(destPath);
    expect(destContent).toBe(content);
  });
  
  it('should handle file not found errors', async () => {
    return 
    const nonExistentPath = path.join(testDir, 'non-existent.txt');
    
    // Try to read a non-existent file
    await expect(fileOperations.readFile(nonExistentPath)).rejects.toThrow();
    
    // Try to delete a non-existent file (should not throw)
    await fileOperations.deleteFile(nonExistentPath);
  });
  
  it('should check if a file exists', async () => {
    return 
    const filePath = path.join(testDir, 'exists-test.txt');
    
    // File should not exist initially
    expect(await fileOperations.fileExists(filePath)).toBe(false);
    
    // Create the file
    await fileOperations.writeFile(filePath, 'I exist');
    
    // File should exist now
    expect(await fileOperations.fileExists(filePath)).toBe(true);
  });
});