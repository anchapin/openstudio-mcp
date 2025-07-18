/**
 * Tests for the file operations module
 */
import { expect } from 'chai';
import * as sinon from 'sinon';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileOperations } from '../src/utils';

describe('File Operations Module', () => {
  // Create a test directory for file operations
  const testDir = path.join(os.tmpdir(), `openstudio-mcp-test-${Date.now()}`);
  
  before(async () => {
    // Create test directory
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });
  
  after(async () => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    
    // Clean up any temporary files
    await fileOperations.cleanupTemporaryFiles();
  });
  
  afterEach(() => {
    // Restore all sinon stubs
    sinon.restore();
  });
  
  describe('validatePath', () => {
    it('should validate a safe path', () => {
      const result = fileOperations.validatePath('test/file.txt');
      expect(result.valid).to.be.true;
    });
    
    it('should reject a path with directory traversal', () => {
      const result = fileOperations.validatePath('../../../etc/passwd');
      expect(result.valid).to.be.false;
      expect(result.error).to.include('directory traversal');
    });
    
    it('should reject a path with unsafe characters', () => {
      const result = fileOperations.validatePath('test/file.txt; rm -rf /');
      expect(result.valid).to.be.false;
      expect(result.error).to.include('unsafe characters');
    });
  });
  
  describe('fileExists', () => {
    it('should return true for existing files', async () => {
      // Create a test file
      const testFile = path.join(testDir, 'exists.txt');
      fs.writeFileSync(testFile, 'test content');
      
      const result = await fileOperations.fileExists(testFile);
      expect(result).to.be.true;
    });
    
    it('should return false for non-existent files', async () => {
      const result = await fileOperations.fileExists(path.join(testDir, 'nonexistent.txt'));
      expect(result).to.be.false;
    });
  });
  
  describe('directoryExists', () => {
    it('should return true for existing directories', async () => {
      const result = await fileOperations.directoryExists(testDir);
      expect(result).to.be.true;
    });
    
    it('should return false for non-existent directories', async () => {
      const result = await fileOperations.directoryExists(path.join(testDir, 'nonexistent'));
      expect(result).to.be.false;
    });
  });
  
  describe('ensureDirectory', () => {
    it('should create a directory if it does not exist', async () => {
      const newDir = path.join(testDir, 'new-dir');
      
      await fileOperations.ensureDirectory(newDir);
      
      const exists = await fileOperations.directoryExists(newDir);
      expect(exists).to.be.true;
    });
    
    it('should not throw if directory already exists', async () => {
      await fileOperations.ensureDirectory(testDir);
      const exists = await fileOperations.directoryExists(testDir);
      expect(exists).to.be.true;
    });
    
    it('should throw on invalid path', async () => {
      try {
        await fileOperations.ensureDirectory('../../../etc/passwd');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Invalid directory path');
      }
    });
  });
  
  describe('generateTempFilePath', () => {
    it('should generate a unique temporary file path', () => {
      const tempPath1 = fileOperations.generateTempFilePath();
      const tempPath2 = fileOperations.generateTempFilePath();
      
      expect(tempPath1).to.not.equal(tempPath2);
      expect(tempPath1).to.include('openstudio-mcp-');
    });
    
    it('should use custom prefix and suffix', () => {
      const tempPath = fileOperations.generateTempFilePath('custom-', '.txt');
      
      expect(tempPath).to.include('custom-');
      expect(tempPath).to.include('.txt');
    });
    
    it('should use custom temp directory', () => {
      const tempPath = fileOperations.generateTempFilePath('test-', '', testDir);
      
      expect(tempPath).to.include(testDir);
    });
  });
  
  describe('createTempFile', () => {
    it('should create a temporary file with content', async () => {
      const content = 'test content';
      const tempFilePath = await fileOperations.createTempFile(content, { tempDir: testDir });
      
      expect(await fileOperations.fileExists(tempFilePath)).to.be.true;
      
      const fileContent = fs.readFileSync(tempFilePath, 'utf8');
      expect(fileContent).to.equal(content);
    });
  });
  
  describe('readFile', () => {
    it('should read file content', async () => {
      const testFile = path.join(testDir, 'read.txt');
      const content = 'test content for reading';
      
      fs.writeFileSync(testFile, content);
      
      const result = await fileOperations.readFile(testFile);
      expect(result).to.equal(content);
    });
    
    it('should throw for non-existent files', async () => {
      try {
        await fileOperations.readFile(path.join(testDir, 'nonexistent.txt'));
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('File not found');
      }
    });
    
    it('should throw for files exceeding max size', async () => {
      const testFile = path.join(testDir, 'large.txt');
      const content = 'x'.repeat(1000);
      
      fs.writeFileSync(testFile, content);
      
      try {
        await fileOperations.readFile(testFile, { maxSize: 500 });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('exceeds maximum allowed size');
      }
    });
  });
  
  describe('writeFile', () => {
    it('should write content to a file', async () => {
      const testFile = path.join(testDir, 'write.txt');
      const content = 'test content for writing';
      
      await fileOperations.writeFile(testFile, content);
      
      expect(fs.existsSync(testFile)).to.be.true;
      expect(fs.readFileSync(testFile, 'utf8')).to.equal(content);
    });
    
    it('should not overwrite existing files by default', async () => {
      const testFile = path.join(testDir, 'no-overwrite.txt');
      const originalContent = 'original content';
      const newContent = 'new content';
      
      fs.writeFileSync(testFile, originalContent);
      
      try {
        await fileOperations.writeFile(testFile, newContent);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('File already exists');
        expect(fs.readFileSync(testFile, 'utf8')).to.equal(originalContent);
      }
    });
    
    it('should overwrite existing files when overwrite is true', async () => {
      const testFile = path.join(testDir, 'overwrite.txt');
      const originalContent = 'original content';
      const newContent = 'new content';
      
      fs.writeFileSync(testFile, originalContent);
      
      await fileOperations.writeFile(testFile, newContent, { overwrite: true });
      
      expect(fs.readFileSync(testFile, 'utf8')).to.equal(newContent);
    });
    
    it('should create parent directories when createDirectories is true', async () => {
      const nestedDir = path.join(testDir, 'nested', 'dir');
      const testFile = path.join(nestedDir, 'nested.txt');
      const content = 'nested content';
      
      await fileOperations.writeFile(testFile, content);
      
      expect(fs.existsSync(testFile)).to.be.true;
      expect(fs.readFileSync(testFile, 'utf8')).to.equal(content);
    });
  });
  
  describe('appendFile', () => {
    it('should append content to an existing file', async () => {
      const testFile = path.join(testDir, 'append.txt');
      const initialContent = 'initial content';
      const appendContent = ' appended content';
      
      fs.writeFileSync(testFile, initialContent);
      
      await fileOperations.appendFile(testFile, appendContent);
      
      expect(fs.readFileSync(testFile, 'utf8')).to.equal(initialContent + appendContent);
    });
    
    it('should create a new file if it does not exist', async () => {
      const testFile = path.join(testDir, 'append-new.txt');
      const content = 'new content';
      
      await fileOperations.appendFile(testFile, content);
      
      expect(fs.existsSync(testFile)).to.be.true;
      expect(fs.readFileSync(testFile, 'utf8')).to.equal(content);
    });
  });
  
  describe('deleteFile', () => {
    it('should delete an existing file', async () => {
      const testFile = path.join(testDir, 'delete.txt');
      
      fs.writeFileSync(testFile, 'content to delete');
      
      await fileOperations.deleteFile(testFile);
      
      expect(fs.existsSync(testFile)).to.be.false;
    });
    
    it('should not throw for non-existent files', async () => {
      const testFile = path.join(testDir, 'nonexistent-delete.txt');
      
      await fileOperations.deleteFile(testFile);
      // Should not throw
    });
  });
  
  describe('copyFile', () => {
    it('should copy a file to a new location', async () => {
      const sourceFile = path.join(testDir, 'source.txt');
      const destFile = path.join(testDir, 'dest.txt');
      const content = 'content to copy';
      
      fs.writeFileSync(sourceFile, content);
      
      await fileOperations.copyFile(sourceFile, destFile);
      
      expect(fs.existsSync(destFile)).to.be.true;
      expect(fs.readFileSync(destFile, 'utf8')).to.equal(content);
      expect(fs.existsSync(sourceFile)).to.be.true; // Source should still exist
    });
    
    it('should not overwrite existing destination files by default', async () => {
      const sourceFile = path.join(testDir, 'source-no-overwrite.txt');
      const destFile = path.join(testDir, 'dest-no-overwrite.txt');
      
      fs.writeFileSync(sourceFile, 'source content');
      fs.writeFileSync(destFile, 'destination content');
      
      try {
        await fileOperations.copyFile(sourceFile, destFile);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Destination file already exists');
        expect(fs.readFileSync(destFile, 'utf8')).to.equal('destination content');
      }
    });
    
    it('should overwrite existing destination files when overwrite is true', async () => {
      const sourceFile = path.join(testDir, 'source-overwrite.txt');
      const destFile = path.join(testDir, 'dest-overwrite.txt');
      
      fs.writeFileSync(sourceFile, 'source content');
      fs.writeFileSync(destFile, 'destination content');
      
      await fileOperations.copyFile(sourceFile, destFile, { overwrite: true });
      
      expect(fs.readFileSync(destFile, 'utf8')).to.equal('source content');
    });
  });
  
  describe('moveFile', () => {
    it('should move a file to a new location', async () => {
      const sourceFile = path.join(testDir, 'source-move.txt');
      const destFile = path.join(testDir, 'dest-move.txt');
      const content = 'content to move';
      
      fs.writeFileSync(sourceFile, content);
      
      await fileOperations.moveFile(sourceFile, destFile, { preserveOriginal: false });
      
      expect(fs.existsSync(destFile)).to.be.true;
      expect(fs.readFileSync(destFile, 'utf8')).to.equal(content);
      expect(fs.existsSync(sourceFile)).to.be.false; // Source should be deleted
    });
    
    it('should preserve the original file when preserveOriginal is true', async () => {
      const sourceFile = path.join(testDir, 'source-preserve.txt');
      const destFile = path.join(testDir, 'dest-preserve.txt');
      const content = 'content to preserve';
      
      fs.writeFileSync(sourceFile, content);
      
      await fileOperations.moveFile(sourceFile, destFile, { preserveOriginal: true });
      
      expect(fs.existsSync(destFile)).to.be.true;
      expect(fs.readFileSync(destFile, 'utf8')).to.equal(content);
      expect(fs.existsSync(sourceFile)).to.be.true; // Source should still exist
    });
  });
  
  describe('listFiles', () => {
    it('should list files in a directory', async () => {
      const listDir = path.join(testDir, 'list-dir');
      
      fs.mkdirSync(listDir, { recursive: true });
      fs.writeFileSync(path.join(listDir, 'file1.txt'), 'content 1');
      fs.writeFileSync(path.join(listDir, 'file2.txt'), 'content 2');
      
      const files = await fileOperations.listFiles(listDir);
      
      expect(files).to.include('file1.txt');
      expect(files).to.include('file2.txt');
    });
    
    it('should throw for non-existent directories', async () => {
      try {
        await fileOperations.listFiles(path.join(testDir, 'nonexistent-dir'));
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Directory not found');
      }
    });
  });
  
  describe('createTempDirectory', () => {
    it('should create a temporary directory', async () => {
      const tempDir = await fileOperations.createTempDirectory('test-dir-', testDir);
      
      expect(await fileOperations.directoryExists(tempDir)).to.be.true;
      
      // Clean up
      fs.rmdirSync(tempDir);
    });
  });
  
  describe('deleteDirectory', () => {
    it('should delete a directory and its contents', async () => {
      const deleteDir = path.join(testDir, 'delete-dir');
      
      fs.mkdirSync(deleteDir, { recursive: true });
      fs.writeFileSync(path.join(deleteDir, 'file1.txt'), 'content 1');
      fs.writeFileSync(path.join(deleteDir, 'file2.txt'), 'content 2');
      
      await fileOperations.deleteDirectory(deleteDir);
      
      expect(await fileOperations.directoryExists(deleteDir)).to.be.false;
    });
    
    it('should not throw for non-existent directories', async () => {
      await fileOperations.deleteDirectory(path.join(testDir, 'nonexistent-delete-dir'));
      // Should not throw
    });
  });
});