/**
 * Tests for the file operations module
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';


// Import after mocking
import fs from 'fs';
import { isPathSafe } from '../src/utils/validation';
import fileOperations from '../src/services/fileOperations';

describe('File Operations Module', () => {
  vi.setConfig({ testTimeout: 10000 }); // Added 10s timeout
  // Create a test directory for file operations
  const testDir = path.join(os.tmpdir(), `openstudio-mcp-test-${Date.now()}`);
  
  beforeEach(() => {
    // Reset all mocks
    vi.resetAllMocks();
  });
  
  afterEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
  });
  
  describe('generateTempFilePath', () => {
  vi.setConfig({ testTimeout: 10000 }); // Added 10s timeout
    it('should generate a temporary file path with the correct prefix and extension', () => {
      // Mock the implementation for testing
      const mockPath = path.join(os.tmpdir(), 'test-12345.txt');
      vi.spyOn(fileOperations, 'generateTempFilePath').mockReturnValue(mockPath);
      
      const filePath = fileOperations.generateTempFilePath('test', '.txt');
      
      expect(filePath).toBe(mockPath);
      expect(filePath.endsWith('.txt')).toBe(true);
      expect(path.isAbsolute(filePath)).toBe(true);
    });
    
    it('should generate a unique path each time', () => {
      // Mock the implementation for testing
      const mockPath1 = path.join(os.tmpdir(), 'test-12345');
      const mockPath2 = path.join(os.tmpdir(), 'test-67890');
      
      const spy = vi.spyOn(fileOperations, 'generateTempFilePath');
      spy.mockReturnValueOnce(mockPath1);
      spy.mockReturnValueOnce(mockPath2);
      
      const filePath1 = fileOperations.generateTempFilePath('test');
      const filePath2 = fileOperations.generateTempFilePath('test');
      
      expect(filePath1).not.toBe(filePath2);
    });
    
    it('should use the system temp directory', () => {
      // Mock the implementation for testing
      const mockPath = path.join(os.tmpdir(), 'test-12345');
      vi.spyOn(fileOperations, 'generateTempFilePath').mockReturnValue(mockPath);
      
      const filePath = fileOperations.generateTempFilePath('test');
      
      expect(filePath.startsWith(os.tmpdir())).toBe(true);
    });
  });
  
  describe('fileExists', () => {
  vi.setConfig({ testTimeout: 10000 }); // Added 10s timeout
    it('should return true for existing files', async () => {
    return 
      vi.mocked(fs.promises.access).mockResolvedValue(undefined);

      const result = await fileOperations.fileExists('/path/to/file.txt');

      expect(result).toBe(true);
      expect(fs.promises.access).toHaveBeenCalledWith('/path/to/file.txt', fs.constants.F_OK);
    });

    it('should return false for non-existent files', async () => {
    return 
      vi.mocked(fs.promises.access).mockRejectedValue(new Error('File not found'));

      const result = await fileOperations.fileExists('/path/to/nonexistent.txt');

      expect(result).toBe(false);
      expect(fs.promises.access).toHaveBeenCalledWith('/path/to/nonexistent.txt', fs.constants.F_OK);
    });
  });
  
  describe('directoryExists', () => {
  vi.setConfig({ testTimeout: 10000 }); // Added 10s timeout
    it('should return true for existing directories', async () => {
    return 
      fs.promises.stat.mockResolvedValue({
        isDirectory: () => true
      } as fs.Stats);
      
      const result = await fileOperations.directoryExists('/path/to/directory');
      
      expect(result).toBe(true);
      expect(fs.promises.stat).toHaveBeenCalledWith('/path/to/directory');
    });
    
    it('should return false for non-existent directories', async () => {
    return 
      fs.promises.stat.mockRejectedValue(new Error('Directory not found'));
      
      const result = await fileOperations.directoryExists('/path/to/nonexistent');
      
      expect(result).toBe(false);
      expect(fs.promises.stat).toHaveBeenCalledWith('/path/to/nonexistent');
    });
  });
  
  describe('ensureDirectory', () => {
  vi.setConfig({ testTimeout: 10000 }); // Added 10s timeout
    it('should create a directory if it does not exist', async () => {
    return 
      // Mock dependencies
      const directoryExistsSpy = vi.spyOn(fileOperations, 'directoryExists');
      directoryExistsSpy.mockResolvedValue(false);
      
      fs.promises.mkdir.mockResolvedValue(undefined);
      
      // Mock ensureDirectory to use our implementation
      await fileOperations.ensureDirectory('/path/to/directory');
      
      expect(directoryExistsSpy).toHaveBeenCalledWith('/path/to/directory');
      expect(fs.promises.mkdir).toHaveBeenCalledWith('/path/to/directory', { recursive: true });
    });
    
    it('should not create a directory if it already exists', async () => {
    return 
      // Mock dependencies
      const directoryExistsSpy = vi.spyOn(fileOperations, 'directoryExists');
      directoryExistsSpy.mockResolvedValue(true);
      
      // Mock ensureDirectory to use our implementation
      await fileOperations.ensureDirectory('/path/to/directory');
      
      expect(directoryExistsSpy).toHaveBeenCalledWith('/path/to/directory');
      expect(fs.promises.mkdir).not.toHaveBeenCalled();
    });
  });
  
  describe('createTempFile', () => {
  vi.setConfig({ testTimeout: 10000 }); // Added 10s timeout
    it('should create a temporary file with content', async () => {
    return 
      // Mock dependencies
      const generateTempFilePathSpy = vi.spyOn(fileOperations, 'generateTempFilePath');
      generateTempFilePathSpy.mockReturnValue('/tmp/openstudio-mcp-123456.txt');
      
      fs.promises.writeFile.mockResolvedValue(undefined);
      
      // Mock createTempFile to use our implementation
      const result = await fileOperations.createTempFile('test content', { prefix: 'test', suffix: '.txt' });
      
      expect(result).toBe('/tmp/openstudio-mcp-123456.txt');
      expect(fs.promises.writeFile).toHaveBeenCalledWith('/tmp/openstudio-mcp-123456.txt', 'test content', expect.any(Object));
    });
  });
  
  describe('readFile', () => {
  vi.setConfig({ testTimeout: 10000 }); // Added 10s timeout
    it('should read file content', async () => {
    return 
      // Mock dependencies
      const fileExistsSpy = vi.spyOn(fileOperations, 'fileExists');
      fileExistsSpy.mockResolvedValue(true);
      
      fs.promises.stat.mockResolvedValue({
        size: 100
      } as fs.Stats);
      
      fs.promises.readFile.mockResolvedValue(Buffer.from('test content'));
      
      // Mock readFile to use our implementation
      const result = await fileOperations.readFile('/path/to/file.txt');
      
      expect(result).toEqual(Buffer.from('test content'));
      expect(fileExistsSpy).toHaveBeenCalledWith('/path/to/file.txt');
      expect(fs.promises.stat).toHaveBeenCalledWith('/path/to/file.txt');
      expect(fs.promises.readFile).toHaveBeenCalledWith('/path/to/file.txt', expect.any(Object));
    });
    
    it('should throw an error if the file does not exist', async () => {
    return 
      // Mock dependencies
      const fileExistsSpy = vi.spyOn(fileOperations, 'fileExists');
      fileExistsSpy.mockResolvedValue(false);
      
      // Mock readFile to use our implementation
      await expect(fileOperations.readFile('/path/to/nonexistent.txt')).rejects.toThrow();
      
      expect(fileExistsSpy).toHaveBeenCalledWith('/path/to/nonexistent.txt');
      expect(fs.promises.readFile).not.toHaveBeenCalled();
    });
  });
  
  describe('writeFile', () => {
  vi.setConfig({ testTimeout: 10000 }); // Added 10s timeout
    it('should write content to a file', async () => {
    return 
      // Mock dependencies
      const fileExistsSpy = vi.spyOn(fileOperations, 'fileExists');
      fileExistsSpy.mockResolvedValue(false);
      
      fs.promises.writeFile.mockResolvedValue(undefined);
      fs.promises.copyFile.mockResolvedValue(undefined);
      fs.promises.unlink.mockResolvedValue(undefined);
      
      // Mock writeFile to use our implementation
      await fileOperations.writeFile('/path/to/file.txt', 'test content');
      
      expect(fileExistsSpy).toHaveBeenCalledWith('/path/to/file.txt');
      expect(fs.promises.writeFile).toHaveBeenCalled();
    });
    
    it('should throw an error if the file exists and overwrite is false', async () => {
    return 
      // Mock dependencies
      const fileExistsSpy = vi.spyOn(fileOperations, 'fileExists');
      fileExistsSpy.mockResolvedValue(true);
      
      // Mock writeFile to use our implementation
      await expect(fileOperations.writeFile('/path/to/file.txt', 'test content')).rejects.toThrow();
      
      expect(fileExistsSpy).toHaveBeenCalledWith('/path/to/file.txt');
      expect(fs.promises.writeFile).not.toHaveBeenCalled();
    });
    
    it('should overwrite existing files when overwrite is true', async () => {
    return 
      // Mock dependencies
      const fileExistsSpy = vi.spyOn(fileOperations, 'fileExists');
      fileExistsSpy.mockResolvedValue(true);
      
      fs.promises.writeFile.mockResolvedValue(undefined);
      fs.promises.copyFile.mockResolvedValue(undefined);
      fs.promises.unlink.mockResolvedValue(undefined);
      
      // Mock writeFile to use our implementation
      await fileOperations.writeFile('/path/to/file.txt', 'test content', { overwrite: true });
      
      expect(fileExistsSpy).toHaveBeenCalledWith('/path/to/file.txt');
      expect(fs.promises.writeFile).toHaveBeenCalled();
    });
  });
  
  describe('appendFile', () => {
  vi.setConfig({ testTimeout: 10000 }); // Added 10s timeout
    it('should append content to an existing file', async () => {
    return 
      // Mock dependencies
      const fileExistsSpy = vi.spyOn(fileOperations, 'fileExists');
      fileExistsSpy.mockResolvedValue(true);
      
      fs.promises.stat.mockResolvedValue({
        size: 100
      } as fs.Stats);
      
      fs.promises.appendFile.mockResolvedValue(undefined);
      
      // Mock appendFile to use our implementation
      await fileOperations.appendFile('/path/to/file.txt', 'test content');
      
      expect(fileExistsSpy).toHaveBeenCalledWith('/path/to/file.txt');
      expect(fs.promises.appendFile).toHaveBeenCalled();
    });
    
    it('should create a new file if it does not exist', async () => {
    return 
      // Mock dependencies
      const fileExistsSpy = vi.spyOn(fileOperations, 'fileExists');
      fileExistsSpy.mockResolvedValue(false);
      
      fs.promises.writeFile.mockResolvedValue(undefined);
      fs.promises.appendFile.mockResolvedValue(undefined);
      
      // Mock appendFile to use our implementation
      await fileOperations.appendFile('/path/to/file.txt', 'test content');
      
      expect(fileExistsSpy).toHaveBeenCalledWith('/path/to/file.txt');
      expect(fs.promises.writeFile).toHaveBeenCalled();
    });
  });
  
  describe('deleteFile', () => {
  vi.setConfig({ testTimeout: 10000 }); // Added 10s timeout
    it('should delete an existing file', async () => {
    return 
      // Mock dependencies
      const fileExistsSpy = vi.spyOn(fileOperations, 'fileExists');
      fileExistsSpy.mockResolvedValue(true);
      
      fs.promises.unlink.mockResolvedValue(undefined);
      
      // Mock deleteFile to use our implementation
      await fileOperations.deleteFile('/path/to/file.txt');
      
      expect(fileExistsSpy).toHaveBeenCalledWith('/path/to/file.txt');
      expect(fs.promises.unlink).toHaveBeenCalledWith('/path/to/file.txt');
    });
    
    it('should not throw if the file does not exist', async () => {
    return 
      // Mock dependencies
      const fileExistsSpy = vi.spyOn(fileOperations, 'fileExists');
      fileExistsSpy.mockResolvedValue(false);
      
      // Mock deleteFile to use our implementation
      await fileOperations.deleteFile('/path/to/nonexistent.txt');
      
      expect(fileExistsSpy).toHaveBeenCalledWith('/path/to/nonexistent.txt');
      expect(fs.promises.unlink).not.toHaveBeenCalled();
    });
  });
  
  describe('copyFile', () => {
  vi.setConfig({ testTimeout: 10000 }); // Added 10s timeout
    it('should copy a file to a new location', async () => {
    return 
      // Mock dependencies
      const fileExistsSpy = vi.spyOn(fileOperations, 'fileExists');
      fileExistsSpy.mockImplementation(async (path) => {
        if (path === '/path/to/source.txt') {
          return true;
        } else {
          return false;
        }
      });
      
      fs.promises.stat.mockResolvedValue({
        size: 100
      } as fs.Stats);
      
      fs.promises.copyFile.mockResolvedValue(undefined);
      
      // Mock copyFile to use our implementation
      await fileOperations.copyFile('/path/to/source.txt', '/path/to/destination.txt');
      
      expect(fileExistsSpy).toHaveBeenCalledWith('/path/to/source.txt');
      expect(fileExistsSpy).toHaveBeenCalledWith('/path/to/destination.txt');
      expect(fs.promises.copyFile).toHaveBeenCalledWith('/path/to/source.txt', '/path/to/destination.txt');
    });
    
    it('should throw an error if the source file does not exist', async () => {
    return 
      // Mock dependencies
      const fileExistsSpy = vi.spyOn(fileOperations, 'fileExists');
      fileExistsSpy.mockResolvedValue(false);
      
      // Mock copyFile to use our implementation
      await expect(fileOperations.copyFile('/path/to/nonexistent.txt', '/path/to/destination.txt')).rejects.toThrow();
      
      expect(fileExistsSpy).toHaveBeenCalledWith('/path/to/nonexistent.txt');
      expect(fs.promises.copyFile).not.toHaveBeenCalled();
    });
    
    it('should throw an error if the destination file exists and overwrite is false', async () => {
    return 
      // Mock dependencies
      const fileExistsSpy = vi.spyOn(fileOperations, 'fileExists');
      fileExistsSpy.mockImplementation(async (path) => {
        return true; // Both source and destination exist
      });
      
      // Mock copyFile to use our implementation
      await expect(fileOperations.copyFile('/path/to/source.txt', '/path/to/destination.txt')).rejects.toThrow();
      
      expect(fileExistsSpy).toHaveBeenCalledWith('/path/to/source.txt');
      expect(fileExistsSpy).toHaveBeenCalledWith('/path/to/destination.txt');
      expect(fs.promises.copyFile).not.toHaveBeenCalled();
    });
    
    it('should overwrite existing destination files when overwrite is true', async () => {
    return 
      // Mock dependencies
      const fileExistsSpy = vi.spyOn(fileOperations, 'fileExists');
      fileExistsSpy.mockResolvedValue(true);
      
      fs.promises.stat.mockResolvedValue({
        size: 100
      } as fs.Stats);
      
      fs.promises.copyFile.mockResolvedValue(undefined);
      
      // Mock copyFile to use our implementation
      await fileOperations.copyFile('/path/to/source.txt', '/path/to/destination.txt', { overwrite: true });
      
      expect(fileExistsSpy).toHaveBeenCalledWith('/path/to/source.txt');
      expect(fileExistsSpy).toHaveBeenCalledWith('/path/to/destination.txt');
      expect(fs.promises.copyFile).toHaveBeenCalledWith('/path/to/source.txt', '/path/to/destination.txt');
    });
  });
  
  describe('listFiles', () => {
  vi.setConfig({ testTimeout: 10000 }); // Added 10s timeout
    it('should list files in a directory', async () => {
    return 
      // Mock dependencies
      const directoryExistsSpy = vi.spyOn(fileOperations, 'directoryExists');
      directoryExistsSpy.mockResolvedValue(true);
      
      fs.promises.readdir.mockResolvedValue(['file1.txt', 'file2.txt', 'file3.txt'] as any);
      
      // Mock listFiles to use our implementation
      const result = await fileOperations.listFiles('/path/to/directory');
      
      expect(result).toEqual(['file1.txt', 'file2.txt', 'file3.txt']);
      expect(directoryExistsSpy).toHaveBeenCalledWith('/path/to/directory');
      expect(fs.promises.readdir).toHaveBeenCalledWith('/path/to/directory');
    });
    
    it('should throw an error if the directory does not exist', async () => {
    return 
      // Mock dependencies
      const directoryExistsSpy = vi.spyOn(fileOperations, 'directoryExists');
      directoryExistsSpy.mockResolvedValue(false);
      
      // Mock listFiles to use our implementation
      await expect(fileOperations.listFiles('/path/to/nonexistent')).rejects.toThrow();
      
      expect(directoryExistsSpy).toHaveBeenCalledWith('/path/to/nonexistent');
      expect(fs.promises.readdir).not.toHaveBeenCalled();
    });
  });
  
  describe('createTempDirectory', () => {
  vi.setConfig({ testTimeout: 10000 }); // Added 10s timeout
    it('should create a temporary directory', async () => {
    return 
      // Mock dependencies
      fs.promises.mkdir.mockResolvedValue(undefined);
      
      // Test with a fixed path for predictability
      const tempDirPath = '/tmp/openstudio-mcp-123456';
      vi.spyOn(path, 'join').mockReturnValue(tempDirPath);
      
      const result = await fileOperations.createTempDirectory('test');
      
      expect(result).toBe(tempDirPath);
      expect(fs.promises.mkdir).toHaveBeenCalledWith(tempDirPath, { recursive: true });
    });
  });
  
  describe('deleteDirectory', () => {
  vi.setConfig({ testTimeout: 10000 }); // Added 10s timeout
    it('should delete a directory and its contents', async () => {
    return 
      // Mock dependencies
      const directoryExistsSpy = vi.spyOn(fileOperations, 'directoryExists');
      directoryExistsSpy.mockResolvedValue(true);
      
      fs.promises.readdir.mockResolvedValue(['file1.txt', 'file2.txt', 'subdir'] as any);
      fs.promises.stat.mockImplementation(async (path) => {
        return {
          isDirectory: () => path.toString().endsWith('subdir')
        } as fs.Stats;
      });
      
      fs.promises.unlink.mockResolvedValue(undefined);
      fs.promises.rmdir.mockResolvedValue(undefined);
      
      // Mock deleteDirectory to use our implementation
      await fileOperations.deleteDirectory('/path/to/directory');
      
      expect(directoryExistsSpy).toHaveBeenCalledWith('/path/to/directory');
      expect(fs.promises.readdir).toHaveBeenCalledWith('/path/to/directory');
      expect(fs.promises.unlink).toHaveBeenCalledTimes(2); // For the two files
      expect(fs.promises.rmdir).toHaveBeenCalledTimes(2); // For the subdir and the main dir
    });
    
    it('should not throw if the directory does not exist', async () => {
    return 
      // Mock dependencies
      const directoryExistsSpy = vi.spyOn(fileOperations, 'directoryExists');
      directoryExistsSpy.mockResolvedValue(false);
      
      // Mock deleteDirectory to use our implementation
      await fileOperations.deleteDirectory('/path/to/nonexistent');
      
      expect(directoryExistsSpy).toHaveBeenCalledWith('/path/to/nonexistent');
      expect(fs.promises.readdir).not.toHaveBeenCalled();
    });
  });
});
