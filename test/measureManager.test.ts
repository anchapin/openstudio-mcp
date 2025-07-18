import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';
import axios from 'axios';
import * as measureManager from '../src/utils/measureManager';
import fileOperations from '../src/utils/fileOperations';

// Mock axios
vi.mock('axios', () => ({
  default: {
    get: vi.fn()
  }
}));

// Mock file operations
vi.mock('../src/utils/fileOperations', () => ({
  default: {
    directoryExists: vi.fn(),
    fileExists: vi.fn(),
    ensureDirectory: vi.fn(),
    createTempDirectory: vi.fn(),
    writeFile: vi.fn(),
    readFile: vi.fn(),
    deleteFile: vi.fn(),
    deleteDirectory: vi.fn()
  }
}));

// Mock AdmZip
vi.mock('adm-zip', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      getEntries: vi.fn().mockReturnValue([]),
      extractAllTo: vi.fn()
    }))
  };
});

// Mock fs
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    promises: {
      readFile: vi.fn(),
      writeFile: vi.fn(),
      mkdir: vi.fn(),
      readdir: vi.fn(),
      stat: vi.fn()
    }
  };
});

// Mock logger
vi.mock('../src/utils/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock config
vi.mock('../src/config', () => ({
  default: {
    bcl: {
      measuresDir: '/test/measures'
    }
  }
}));

describe('Measure Manager', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getMeasuresDir', () => {
    it('should return the configured measures directory', () => {
      const result = measureManager.getMeasuresDir();
      expect(result).toBe('/test/measures');
    });

    it('should return the custom directory if provided', () => {
      const result = measureManager.getMeasuresDir('/custom/measures');
      expect(result).toBe('/custom/measures');
    });
  });

  describe('getMeasurePath', () => {
    it('should return the path for a specific measure', () => {
      const result = measureManager.getMeasurePath('test-measure');
      expect(result).toBe('/test/measures/test-measure');
    });

    it('should use the custom directory if provided', () => {
      const result = measureManager.getMeasurePath('test-measure', '/custom/measures');
      expect(result).toBe('/custom/measures/test-measure');
    });
  });

  describe('isMeasureInstalled', () => {
    it('should return true if the measure directory exists', async () => {
      (fileOperations.directoryExists as any).mockResolvedValue(true);
      
      const result = await measureManager.isMeasureInstalled('test-measure');
      
      expect(fileOperations.directoryExists).toHaveBeenCalledWith('/test/measures/test-measure');
      expect(result).toBe(true);
    });

    it('should return false if the measure directory does not exist', async () => {
      (fileOperations.directoryExists as any).mockResolvedValue(false);
      
      const result = await measureManager.isMeasureInstalled('test-measure');
      
      expect(fileOperations.directoryExists).toHaveBeenCalledWith('/test/measures/test-measure');
      expect(result).toBe(false);
    });
  });

  describe('getMeasureVersion', () => {
    it('should return the version from measure.xml', async () => {
      (fileOperations.directoryExists as any).mockResolvedValue(true);
      (fileOperations.fileExists as any).mockResolvedValue(true);
      (fileOperations.readFile as any).mockResolvedValue('<measure><version_id>1.2.3</version_id></measure>');
      
      const result = await measureManager.getMeasureVersion('test-measure');
      
      expect(fileOperations.readFile).toHaveBeenCalledWith(
        '/test/measures/test-measure/measure.xml',
        expect.objectContaining({ encoding: 'utf8' })
      );
      expect(result).toBe('1.2.3');
    });

    it('should return null if the measure directory does not exist', async () => {
      (fileOperations.directoryExists as any).mockResolvedValue(false);
      
      const result = await measureManager.getMeasureVersion('test-measure');
      
      expect(result).toBeNull();
    });

    it('should return null if measure.xml does not exist', async () => {
      (fileOperations.directoryExists as any).mockResolvedValue(true);
      (fileOperations.fileExists as any).mockResolvedValue(false);
      
      const result = await measureManager.getMeasureVersion('test-measure');
      
      expect(result).toBeNull();
    });

    it('should return null if version cannot be extracted', async () => {
      (fileOperations.directoryExists as any).mockResolvedValue(true);
      (fileOperations.fileExists as any).mockResolvedValue(true);
      (fileOperations.readFile as any).mockResolvedValue('<measure>No version here</measure>');
      
      const result = await measureManager.getMeasureVersion('test-measure');
      
      expect(result).toBeNull();
    });
  });

  describe('downloadMeasureFile', () => {
    it('should download a measure file', async () => {
      const mockResponse = {
        data: Buffer.from('test data')
      };
      (axios.get as any).mockResolvedValue(mockResponse);
      (fileOperations.createTempDirectory as any).mockResolvedValue('/tmp/openstudio-mcp-measure-123');
      
      const result = await measureManager.downloadMeasureFile('https://example.com/measure.zip');
      
      expect(axios.get).toHaveBeenCalledWith(
        'https://example.com/measure.zip',
        expect.objectContaining({
          responseType: 'arraybuffer',
          timeout: 30000
        })
      );
      expect(fileOperations.writeFile).toHaveBeenCalledWith(
        '/tmp/openstudio-mcp-measure-123/measure.zip',
        expect.any(Buffer),
        expect.objectContaining({ encoding: 'binary' })
      );
      expect(result).toBe('/tmp/openstudio-mcp-measure-123/measure.zip');
    });

    it('should throw an error if download fails', async () => {
      (axios.get as any).mockRejectedValue(new Error('Download failed'));
      
      await expect(measureManager.downloadMeasureFile('https://example.com/measure.zip'))
        .rejects.toThrow('Failed to download measure: Download failed');
    });
  });

  describe('validateMeasureZip', () => {
    it('should return true for a valid measure zip', async () => {
      const mockEntries = [
        { entryName: 'measure.xml', isDirectory: false },
        { entryName: 'measure.rb', isDirectory: false }
      ];
      (AdmZip as any).mockImplementation(() => ({
        getEntries: vi.fn().mockReturnValue(mockEntries),
        extractAllTo: vi.fn()
      }));
      
      const result = await measureManager.validateMeasureZip('/path/to/measure.zip');
      
      expect(result).toBe(true);
    });

    it('should return true for a valid measure zip with nested structure', async () => {
      const mockEntries = [
        { entryName: 'measure-dir/measure.xml', isDirectory: false },
        { entryName: 'measure-dir/measure.rb', isDirectory: false }
      ];
      (AdmZip as any).mockImplementation(() => ({
        getEntries: vi.fn().mockReturnValue(mockEntries),
        extractAllTo: vi.fn()
      }));
      
      const result = await measureManager.validateMeasureZip('/path/to/measure.zip');
      
      expect(result).toBe(true);
    });

    it('should return false if measure.xml is missing', async () => {
      const mockEntries = [
        { entryName: 'measure.rb', isDirectory: false }
      ];
      (AdmZip as any).mockImplementation(() => ({
        getEntries: vi.fn().mockReturnValue(mockEntries),
        extractAllTo: vi.fn()
      }));
      
      const result = await measureManager.validateMeasureZip('/path/to/measure.zip');
      
      expect(result).toBe(false);
    });

    it('should return false if measure.rb is missing', async () => {
      const mockEntries = [
        { entryName: 'measure.xml', isDirectory: false }
      ];
      (AdmZip as any).mockImplementation(() => ({
        getEntries: vi.fn().mockReturnValue(mockEntries),
        extractAllTo: vi.fn()
      }));
      
      const result = await measureManager.validateMeasureZip('/path/to/measure.zip');
      
      expect(result).toBe(false);
    });

    it('should return false if an error occurs', async () => {
      (AdmZip as any).mockImplementation(() => {
        throw new Error('Invalid zip file');
      });
      
      const result = await measureManager.validateMeasureZip('/path/to/measure.zip');
      
      expect(result).toBe(false);
    });
  });

  describe('extractMeasureZip', () => {
    it('should extract a measure zip file', async () => {
      (fileOperations.directoryExists as any).mockResolvedValue(false);
      (fileOperations.ensureDirectory as any).mockResolvedValue(undefined);
      
      const mockEntries = [
        { entryName: 'measure.xml', isDirectory: false, getData: () => Buffer.from('xml content') },
        { entryName: 'measure.rb', isDirectory: false, getData: () => Buffer.from('ruby content') }
      ];
      (AdmZip as any).mockImplementation(() => ({
        getEntries: vi.fn().mockReturnValue(mockEntries),
        extractAllTo: vi.fn()
      }));
      
      const result = await measureManager.extractMeasureZip('/path/to/measure.zip', 'test-measure');
      
      expect(fileOperations.ensureDirectory).toHaveBeenCalledWith('/test/measures');
      expect(fileOperations.ensureDirectory).toHaveBeenCalledWith('/test/measures/test-measure');
      expect(result).toBe('/test/measures/test-measure');
    });

    it('should handle zip files with a single root directory', async () => {
      (fileOperations.directoryExists as any).mockResolvedValue(false);
      (fileOperations.ensureDirectory as any).mockResolvedValue(undefined);
      
      const mockEntries = [
        { entryName: 'root-dir/measure.xml', isDirectory: false, getData: () => Buffer.from('xml content') },
        { entryName: 'root-dir/measure.rb', isDirectory: false, getData: () => Buffer.from('ruby content') }
      ];
      (AdmZip as any).mockImplementation(() => ({
        getEntries: vi.fn().mockReturnValue(mockEntries),
        extractAllTo: vi.fn()
      }));
      
      const result = await measureManager.extractMeasureZip('/path/to/measure.zip', 'test-measure');
      
      expect(fileOperations.writeFile).toHaveBeenCalledWith(
        '/test/measures/test-measure/measure.xml',
        expect.any(Buffer),
        expect.objectContaining({ encoding: 'binary' })
      );
      expect(fileOperations.writeFile).toHaveBeenCalledWith(
        '/test/measures/test-measure/measure.rb',
        expect.any(Buffer),
        expect.objectContaining({ encoding: 'binary' })
      );
      expect(result).toBe('/test/measures/test-measure');
    });

    it('should delete existing measure directory if force option is true', async () => {
      (fileOperations.directoryExists as any).mockResolvedValue(true);
      (fileOperations.ensureDirectory as any).mockResolvedValue(undefined);
      (fileOperations.deleteDirectory as any).mockResolvedValue(undefined);
      
      const mockEntries = [
        { entryName: 'measure.xml', isDirectory: false, getData: () => Buffer.from('xml content') },
        { entryName: 'measure.rb', isDirectory: false, getData: () => Buffer.from('ruby content') }
      ];
      (AdmZip as any).mockImplementation(() => ({
        getEntries: vi.fn().mockReturnValue(mockEntries),
        extractAllTo: vi.fn()
      }));
      
      const result = await measureManager.extractMeasureZip('/path/to/measure.zip', 'test-measure', { force: true });
      
      expect(fileOperations.deleteDirectory).toHaveBeenCalledWith('/test/measures/test-measure');
      expect(result).toBe('/test/measures/test-measure');
    });

    it('should throw an error if extraction fails', async () => {
      (fileOperations.directoryExists as any).mockResolvedValue(false);
      (fileOperations.ensureDirectory as any).mockResolvedValue(undefined);
      
      (AdmZip as any).mockImplementation(() => {
        throw new Error('Extraction failed');
      });
      
      await expect(measureManager.extractMeasureZip('/path/to/measure.zip', 'test-measure'))
        .rejects.toThrow('Failed to extract measure zip file: Extraction failed');
    });
  });

  describe('installMeasureFromZip', () => {
    it('should install a measure from a zip file', async () => {
      vi.spyOn(measureManager, 'validateMeasureZip').mockResolvedValue(true);
      vi.spyOn(measureManager, 'extractMeasureZip').mockResolvedValue('/test/measures/test-measure');
      (fileOperations.deleteFile as any).mockResolvedValue(undefined);
      
      const result = await measureManager.installMeasureFromZip('/path/to/measure.zip', 'test-measure');
      
      expect(measureManager.validateMeasureZip).toHaveBeenCalledWith('/path/to/measure.zip');
      expect(measureManager.extractMeasureZip).toHaveBeenCalledWith('/path/to/measure.zip', 'test-measure', {});
      expect(fileOperations.deleteFile).toHaveBeenCalledWith('/path/to/measure.zip');
      expect(result).toBe(true);
    });

    it('should return false if validation fails', async () => {
      vi.spyOn(measureManager, 'validateMeasureZip').mockResolvedValue(false);
      
      const result = await measureManager.installMeasureFromZip('/path/to/measure.zip', 'test-measure');
      
      expect(measureManager.validateMeasureZip).toHaveBeenCalledWith('/path/to/measure.zip');
      expect(measureManager.extractMeasureZip).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it('should return false if extraction fails', async () => {
      vi.spyOn(measureManager, 'validateMeasureZip').mockResolvedValue(true);
      vi.spyOn(measureManager, 'extractMeasureZip').mockRejectedValue(new Error('Extraction failed'));
      
      const result = await measureManager.installMeasureFromZip('/path/to/measure.zip', 'test-measure');
      
      expect(measureManager.validateMeasureZip).toHaveBeenCalledWith('/path/to/measure.zip');
      expect(measureManager.extractMeasureZip).toHaveBeenCalledWith('/path/to/measure.zip', 'test-measure', {});
      expect(result).toBe(false);
    });

    it('should clean up the zip file even if installation fails', async () => {
      vi.spyOn(measureManager, 'validateMeasureZip').mockResolvedValue(true);
      vi.spyOn(measureManager, 'extractMeasureZip').mockRejectedValue(new Error('Extraction failed'));
      (fileOperations.deleteFile as any).mockResolvedValue(undefined);
      
      await measureManager.installMeasureFromZip('/path/to/measure.zip', 'test-measure');
      
      expect(fileOperations.deleteFile).toHaveBeenCalledWith('/path/to/measure.zip');
    });
  });

  describe('listInstalledMeasures', () => {
    it('should list installed measures', async () => {
      (fileOperations.directoryExists as any).mockResolvedValue(true);
      (fs.promises.readdir as any).mockResolvedValue(['measure1', 'measure2', 'not-a-measure']);
      (fs.promises.stat as any).mockImplementation((path) => {
        return Promise.resolve({
          isDirectory: () => true
        });
      });
      (fileOperations.fileExists as any).mockImplementation((path) => {
        if (path.endsWith('not-a-measure/measure.xml') || path.endsWith('not-a-measure/measure.rb')) {
          return Promise.resolve(false);
        }
        return Promise.resolve(true);
      });
      
      const result = await measureManager.listInstalledMeasures();
      
      expect(result).toEqual(['measure1', 'measure2']);
    });

    it('should return an empty array if measures directory does not exist', async () => {
      (fileOperations.directoryExists as any).mockResolvedValue(false);
      
      const result = await measureManager.listInstalledMeasures();
      
      expect(result).toEqual([]);
    });

    it('should filter out non-directories', async () => {
      (fileOperations.directoryExists as any).mockResolvedValue(true);
      (fs.promises.readdir as any).mockResolvedValue(['measure1', 'file.txt']);
      (fs.promises.stat as any).mockImplementation((path) => {
        return Promise.resolve({
          isDirectory: () => path.includes('measure1')
        });
      });
      (fileOperations.fileExists as any).mockResolvedValue(true);
      
      const result = await measureManager.listInstalledMeasures();
      
      expect(result).toEqual(['measure1']);
    });

    it('should handle errors', async () => {
      (fileOperations.directoryExists as any).mockRejectedValue(new Error('Directory error'));
      
      const result = await measureManager.listInstalledMeasures();
      
      expect(result).toEqual([]);
    });
  });
});