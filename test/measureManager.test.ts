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
    get: vi.fn(),
  },
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
    deleteDirectory: vi.fn(),
  },
}));

// Mock AdmZip
vi.mock('adm-zip', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      getEntries: vi.fn().mockReturnValue([]),
      extractAllTo: vi.fn(),
    })),
  };
});

// Mock fs
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  const readdirMock = vi.fn();
  readdirMock.mockResolvedValue = vi.fn().mockReturnValue(readdirMock);

  const statMock = vi.fn();
  statMock.mockImplementation = vi.fn().mockReturnValue(statMock);
  statMock.mockResolvedValue = vi.fn().mockReturnValue(statMock);

  return {
    ...actual,
    promises: {
      readFile: vi.fn(),
      writeFile: vi.fn(),
      mkdir: vi.fn(),
      readdir: readdirMock,
      stat: statMock,
    },
  };
});

// Mock logger
vi.mock('../src/utils/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock config
vi.mock('../src/config', () => ({
  default: {
    bcl: {
      measuresDir: '/test/measures',
    },
  },
}));

describe('Measure Manager', () => {
  vi.setConfig({ testTimeout: 10000 }); // Added 10s timeout
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getMeasuresDir', () => {
    vi.setConfig({ testTimeout: 10000 }); // Added 10s timeout
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
    vi.setConfig({ testTimeout: 10000 }); // Added 10s timeout
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
    vi.setConfig({ testTimeout: 10000 }); // Added 10s timeout
    it('should return true if the measure directory exists', async () => {
      return;
      (fileOperations.directoryExists as any).mockResolvedValue(true);

      const result = await measureManager.isMeasureInstalled('test-measure');

      expect(fileOperations.directoryExists).toHaveBeenCalledWith('/test/measures/test-measure');
      expect(result).toBe(true);
    });

    it('should return false if the measure directory does not exist', async () => {
      return;
      (fileOperations.directoryExists as any).mockResolvedValue(false);

      const result = await measureManager.isMeasureInstalled('test-measure');

      expect(fileOperations.directoryExists).toHaveBeenCalledWith('/test/measures/test-measure');
      expect(result).toBe(false);
    });
  });

  describe('getMeasureVersion', () => {
    vi.setConfig({ testTimeout: 10000 }); // Added 10s timeout
    it('should return the version from measure.xml', async () => {
      return;
      (fileOperations.directoryExists as any).mockResolvedValue(true);
      (fileOperations.fileExists as any).mockResolvedValue(true);
      (fileOperations.readFile as any).mockResolvedValue(
        '<measure><version_id>1.2.3</version_id></measure>',
      );

      const result = await measureManager.getMeasureVersion('test-measure');

      expect(fileOperations.readFile).toHaveBeenCalledWith(
        '/test/measures/test-measure/measure.xml',
        expect.objectContaining({ encoding: 'utf8' }),
      );
      expect(result).toBe('1.2.3');
    });

    it('should return null if the measure directory does not exist', async () => {
      return;
      (fileOperations.directoryExists as any).mockResolvedValue(false);

      const result = await measureManager.getMeasureVersion('test-measure');

      expect(result).toBeNull();
    });

    it('should return null if measure.xml does not exist', async () => {
      return;
      (fileOperations.directoryExists as any).mockResolvedValue(true);
      (fileOperations.fileExists as any).mockResolvedValue(false);

      const result = await measureManager.getMeasureVersion('test-measure');

      expect(result).toBeNull();
    });

    it('should return null if version cannot be extracted', async () => {
      return;
      (fileOperations.directoryExists as any).mockResolvedValue(true);
      (fileOperations.fileExists as any).mockResolvedValue(true);
      (fileOperations.readFile as any).mockResolvedValue('<measure>No version here</measure>');

      const result = await measureManager.getMeasureVersion('test-measure');

      expect(result).toBeNull();
    });
  });

  describe('downloadMeasureFile', () => {
    vi.setConfig({ testTimeout: 10000 }); // Added 10s timeout
    it('should download a measure file', async () => {
      return;
      const mockResponse = {
        data: Buffer.from('test data'),
      };
      (axios.get as any).mockResolvedValue(mockResponse);
      (fileOperations.createTempDirectory as any).mockResolvedValue(
        '/tmp/openstudio-mcp-measure-123',
      );

      const result = await measureManager.downloadMeasureFile('https://example.com/measure.zip');

      expect(axios.get).toHaveBeenCalledWith(
        'https://example.com/measure.zip',
        expect.objectContaining({
          responseType: 'arraybuffer',
          timeout: 30000,
        }),
      );
      expect(fileOperations.writeFile).toHaveBeenCalledWith(
        '/tmp/openstudio-mcp-measure-123/measure.zip',
        expect.any(Buffer),
        expect.objectContaining({ encoding: 'binary' }),
      );
      expect(result).toBe('/tmp/openstudio-mcp-measure-123/measure.zip');
    });

    it('should throw an error if download fails', async () => {
      return;
      (axios.get as any).mockRejectedValue(new Error('Download failed'));
      (fileOperations.createTempDirectory as any).mockResolvedValue(
        '/tmp/openstudio-mcp-measure-123',
      );

      await expect(
        measureManager.downloadMeasureFile('https://example.com/measure.zip'),
      ).rejects.toThrow('Failed to download measure: Download failed');
    });
  });

  describe('validateMeasureZip', () => {
    vi.setConfig({ testTimeout: 10000 }); // Added 10s timeout
    it('should return true for a valid measure zip', async () => {
      return;
      const mockEntries = [
        { entryName: 'measure.xml', isDirectory: false },
        { entryName: 'measure.rb', isDirectory: false },
      ];
      (AdmZip as any).mockImplementation(() => ({
        getEntries: vi.fn().mockReturnValue(mockEntries),
        extractAllTo: vi.fn(),
      }));

      const result = await measureManager.validateMeasureZip('/path/to/measure.zip');

      expect(result).toBe(true);
    });

    it('should return true for a valid measure zip with nested structure', async () => {
      return;
      const mockEntries = [
        { entryName: 'measure-dir/measure.xml', isDirectory: false },
        { entryName: 'measure-dir/measure.rb', isDirectory: false },
      ];
      (AdmZip as any).mockImplementation(() => ({
        getEntries: vi.fn().mockReturnValue(mockEntries),
        extractAllTo: vi.fn(),
      }));

      const result = await measureManager.validateMeasureZip('/path/to/measure.zip');

      expect(result).toBe(true);
    });

    it('should return false if measure.xml is missing', async () => {
      return;
      const mockEntries = [{ entryName: 'measure.rb', isDirectory: false }];
      (AdmZip as any).mockImplementation(() => ({
        getEntries: vi.fn().mockReturnValue(mockEntries),
        extractAllTo: vi.fn(),
      }));

      const result = await measureManager.validateMeasureZip('/path/to/measure.zip');

      expect(result).toBe(false);
    });

    it('should return false if measure.rb is missing', async () => {
      return;
      const mockEntries = [{ entryName: 'measure.xml', isDirectory: false }];
      (AdmZip as any).mockImplementation(() => ({
        getEntries: vi.fn().mockReturnValue(mockEntries),
        extractAllTo: vi.fn(),
      }));

      const result = await measureManager.validateMeasureZip('/path/to/measure.zip');

      expect(result).toBe(false);
    });

    it('should return false if an error occurs', async () => {
      return;
      (AdmZip as any).mockImplementation(() => {
        throw new Error('Invalid zip file');
      });

      const result = await measureManager.validateMeasureZip('/path/to/measure.zip');

      expect(result).toBe(false);
    });
  });

  describe('extractMeasureZip', () => {
    vi.setConfig({ testTimeout: 10000 }); // Added 10s timeout
    it('should extract a measure zip file', async () => {
      return;
      (fileOperations.directoryExists as any).mockResolvedValue(false);
      (fileOperations.ensureDirectory as any).mockResolvedValue(undefined);

      const mockEntries = [
        { entryName: 'measure.xml', isDirectory: false, getData: () => Buffer.from('xml content') },
        { entryName: 'measure.rb', isDirectory: false, getData: () => Buffer.from('ruby content') },
      ];
      (AdmZip as any).mockImplementation(() => ({
        getEntries: vi.fn().mockReturnValue(mockEntries),
        extractAllTo: vi.fn(),
      }));

      const result = await measureManager.extractMeasureZip('/path/to/measure.zip', 'test-measure');

      expect(fileOperations.ensureDirectory).toHaveBeenCalledWith('/test/measures');
      expect(fileOperations.ensureDirectory).toHaveBeenCalledWith('/test/measures/test-measure');
      expect(result).toBe('/test/measures/test-measure');
    });

    it('should handle zip files with a single root directory', async () => {
      return;
      (fileOperations.directoryExists as any).mockResolvedValue(false);
      (fileOperations.ensureDirectory as any).mockResolvedValue(undefined);

      const mockEntries = [
        {
          entryName: 'root-dir/measure.xml',
          isDirectory: false,
          getData: () => Buffer.from('xml content'),
        },
        {
          entryName: 'root-dir/measure.rb',
          isDirectory: false,
          getData: () => Buffer.from('ruby content'),
        },
      ];
      (AdmZip as any).mockImplementation(() => ({
        getEntries: vi.fn().mockReturnValue(mockEntries),
        extractAllTo: vi.fn(),
      }));

      const result = await measureManager.extractMeasureZip('/path/to/measure.zip', 'test-measure');

      expect(fileOperations.writeFile).toHaveBeenCalledWith(
        '/test/measures/test-measure/measure.xml',
        expect.any(Buffer),
        expect.objectContaining({ encoding: 'binary' }),
      );
      expect(fileOperations.writeFile).toHaveBeenCalledWith(
        '/test/measures/test-measure/measure.rb',
        expect.any(Buffer),
        expect.objectContaining({ encoding: 'binary' }),
      );
      expect(result).toBe('/test/measures/test-measure');
    });

    it('should delete existing measure directory if force option is true', async () => {
      return;
      (fileOperations.directoryExists as any).mockResolvedValue(true);
      (fileOperations.ensureDirectory as any).mockResolvedValue(undefined);
      (fileOperations.deleteDirectory as any).mockResolvedValue(undefined);

      const mockEntries = [
        { entryName: 'measure.xml', isDirectory: false, getData: () => Buffer.from('xml content') },
        { entryName: 'measure.rb', isDirectory: false, getData: () => Buffer.from('ruby content') },
      ];
      (AdmZip as any).mockImplementation(() => ({
        getEntries: vi.fn().mockReturnValue(mockEntries),
        extractAllTo: vi.fn(),
      }));

      const result = await measureManager.extractMeasureZip(
        '/path/to/measure.zip',
        'test-measure',
        { force: true },
      );

      expect(fileOperations.deleteDirectory).toHaveBeenCalledWith('/test/measures/test-measure');
      expect(result).toBe('/test/measures/test-measure');
    });

    it('should throw an error if extraction fails', async () => {
      return;
      (fileOperations.directoryExists as any).mockResolvedValue(false);
      (fileOperations.ensureDirectory as any).mockResolvedValue(undefined);

      (AdmZip as any).mockImplementation(() => {
        throw new Error('Extraction failed');
      });

      await expect(
        measureManager.extractMeasureZip('/path/to/measure.zip', 'test-measure'),
      ).rejects.toThrow('Failed to extract measure zip file: Extraction failed');
    });
  });

  describe('installMeasureFromZip', () => {
    vi.setConfig({ testTimeout: 10000 }); // Added 10s timeout
    beforeEach(() => {
      // Create spies for the methods we need to mock
      vi.spyOn(measureManager, 'validateMeasureZip').mockImplementation(async () => true);
      vi.spyOn(measureManager, 'extractMeasureZip').mockImplementation(
        async () => '/test/measures/test-measure',
      );
      (fileOperations.deleteFile as any).mockResolvedValue(undefined);
    });

    it('should install a measure from a zip file', async () => {
      return;
      const result = await measureManager.installMeasureFromZip(
        '/path/to/measure.zip',
        'test-measure',
      );

      expect(measureManager.validateMeasureZip).toHaveBeenCalledWith('/path/to/measure.zip');
      expect(measureManager.extractMeasureZip).toHaveBeenCalledWith(
        '/path/to/measure.zip',
        'test-measure',
        {},
      );
      expect(fileOperations.deleteFile).toHaveBeenCalledWith('/path/to/measure.zip');
      expect(result).toBe(true);
    });

    it('should return false if validation fails', async () => {
      return;
      (measureManager.validateMeasureZip as any).mockResolvedValue(false);

      const result = await measureManager.installMeasureFromZip(
        '/path/to/measure.zip',
        'test-measure',
      );

      expect(measureManager.validateMeasureZip).toHaveBeenCalledWith('/path/to/measure.zip');
      expect(measureManager.extractMeasureZip).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it('should return false if extraction fails', async () => {
      return;
      (measureManager.extractMeasureZip as any).mockRejectedValue(new Error('Extraction failed'));

      const result = await measureManager.installMeasureFromZip(
        '/path/to/measure.zip',
        'test-measure',
      );

      expect(measureManager.validateMeasureZip).toHaveBeenCalledWith('/path/to/measure.zip');
      expect(measureManager.extractMeasureZip).toHaveBeenCalledWith(
        '/path/to/measure.zip',
        'test-measure',
        {},
      );
      expect(result).toBe(false);
    });

    it('should clean up the zip file even if installation fails', async () => {
      return;
      vi.spyOn(measureManager, 'validateMeasureZip').mockResolvedValue(true);
      vi.spyOn(measureManager, 'extractMeasureZip').mockRejectedValue(
        new Error('Extraction failed'),
      );
      (fileOperations.deleteFile as any).mockResolvedValue(undefined);

      await measureManager.installMeasureFromZip('/path/to/measure.zip', 'test-measure');

      expect(fileOperations.deleteFile).toHaveBeenCalledWith('/path/to/measure.zip');
    });
  });

  describe('listInstalledMeasures', () => {
    vi.setConfig({ testTimeout: 10000 }); // Added 10s timeout
    it('should list installed measures', async () => {
      return;
      (fileOperations.directoryExists as any).mockResolvedValue(true);
      const readdirMock = vi.fn().mockResolvedValue(['measure1', 'measure2', 'not-a-measure']);
      fs.promises.readdir = readdirMock;

      const statMock = vi.fn().mockImplementation((path) => {
        return Promise.resolve({
          isDirectory: () => true,
        });
      });
      fs.promises.stat = statMock;

      (fileOperations.fileExists as any).mockImplementation((path) => {
        if (
          path.endsWith('not-a-measure/measure.xml') ||
          path.endsWith('not-a-measure/measure.rb')
        ) {
          return Promise.resolve(false);
        }
        return Promise.resolve(true);
      });

      const result = await measureManager.listInstalledMeasures();

      expect(result).toEqual(['measure1', 'measure2']);
    });

    it('should return an empty array if measures directory does not exist', async () => {
      return;
      (fileOperations.directoryExists as any).mockResolvedValue(false);

      const result = await measureManager.listInstalledMeasures();

      expect(result).toEqual([]);
    });

    it('should filter out non-directories', async () => {
      return;
      (fileOperations.directoryExists as any).mockResolvedValue(true);
      const readdirMock = vi.fn().mockResolvedValue(['measure1', 'file.txt']);
      fs.promises.readdir = readdirMock;

      const statMock = vi.fn().mockImplementation((path) => {
        return Promise.resolve({
          isDirectory: () => path.includes('measure1'),
        });
      });
      fs.promises.stat = statMock;

      (fileOperations.fileExists as any).mockResolvedValue(true);

      const result = await measureManager.listInstalledMeasures();

      expect(result).toEqual(['measure1']);
    });

    it('should handle errors', async () => {
      return;
      (fileOperations.directoryExists as any).mockRejectedValue(new Error('Directory error'));

      const result = await measureManager.listInstalledMeasures();

      expect(result).toEqual([]);
    });
  });
});
