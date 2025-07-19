import { vi, beforeAll, afterAll, afterEach } from 'vitest';
import { ensureTestDirectories, cleanupTestDirectories } from './testUtils';

// Ensure test directories exist before all tests
beforeAll(() => {
  process.env.NODE_ENV = 'test';
  ensureTestDirectories();
});

// Clean up test directories after all tests
afterAll(() => {
  cleanupTestDirectories();
  
  // Make sure all mocks are restored
  vi.restoreAllMocks();
  
  // Force garbage collection if possible
  if (global.gc) {
    global.gc();
  }
});

// Mock fs module
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  const readdirMock = vi.fn();
  readdirMock.mockResolvedValue = vi.fn().mockReturnValue(readdirMock);
  
  const statMock = vi.fn();
  statMock.mockImplementation = vi.fn().mockReturnValue(statMock);
  statMock.mockResolvedValue = vi.fn().mockReturnValue(statMock);
  
  const existsSyncMock = vi.fn();
  const readFileSyncMock = vi.fn();
  const writeFileSyncMock = vi.fn();
  
  return {
    ...actual,
    existsSync: existsSyncMock,
    mkdirSync: vi.fn(),
    readFileSync: readFileSyncMock,
    writeFileSync: writeFileSyncMock,
    appendFileSync: vi.fn(),
    unlinkSync: vi.fn(),
    statSync: vi.fn(),
    readdirSync: vi.fn(),
    promises: {
      ...actual.promises,
      readFile: vi.fn(),
      writeFile: vi.fn(),
      appendFile: vi.fn(),
      unlink: vi.fn(),
      mkdir: vi.fn(),
      access: vi.fn(),
      readdir: readdirMock,
      stat: statMock,
    },
  };
});

// Import test config first
import testConfig from './testConfig';

// Mock config before logger
vi.mock('../src/config', () => ({
  default: testConfig
}));

// Mock pino first to prevent logger initialization issues
vi.mock('pino', () => {
  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn().mockReturnThis(),
    level: 'info'
  };
  return {
    default: vi.fn(() => mockLogger),
    __esModule: true
  };
});

// Mock logger
vi.mock('../src/utils/logger', () => {
  const loggerMock = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn().mockReturnThis(),
    level: 'info'
  };

  return {
    default: loggerMock,
    __esModule: true
  };
});

// Mock utils index to ensure logger export works
vi.mock('../src/utils/index', () => {
  const loggerMock = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn().mockReturnThis(),
    level: 'info'
  };

  return {
    logger: loggerMock,
    commandExecutor: {
      executeCommand: vi.fn(),
      executeOpenStudioCommand: vi.fn(),
      validateCommand: vi.fn(() => ({ valid: true })),
      killAllProcesses: vi.fn(),
      getActiveProcessCount: vi.fn(() => 0),
      getActiveProcesses: vi.fn(() => []),
      checkOpenStudioAvailability: vi.fn(() => Promise.resolve(true)),
      getOpenStudioVersion: vi.fn(() => Promise.resolve('3.5.0')),
    },
    openStudioCommands: {
      getOpenStudioVersion: vi.fn(),
      listMeasures: vi.fn(),
      applyMeasure: vi.fn(),
      runSimulation: vi.fn(),
      getSimulationStatus: vi.fn(),
      stopSimulation: vi.fn(),
    },
    outputProcessor: {
      processOutput: vi.fn((output) => ({
        summary: 'Processed output summary',
        details: output,
        warnings: [],
        errors: []
      })),
      extractWarnings: vi.fn(() => []),
      extractErrors: vi.fn(() => []),
      formatOutput: vi.fn((output) => output)
    },
    modelTemplates: {
      createModelFromTemplate: vi.fn(() => Promise.resolve({
        success: true,
        output: 'Model created successfully',
        data: { modelPath: '/path/to/model.osm' }
      })),
      getAvailableTemplates: vi.fn(() => ['office', 'residential']),
      getTemplateOptions: vi.fn(() => ({})),
      validateTemplateOptions: vi.fn(() => ({ valid: true })),
      getAvailableTemplateTypes: vi.fn(() => ['empty', 'office', 'residential', 'retail', 'warehouse', 'school']),
      getAvailableBuildingTypes: vi.fn((templateType) => {
        if (templateType === 'office') return ['SmallOffice', 'MediumOffice', 'LargeOffice'];
        if (templateType === 'residential') return ['SingleFamily', 'Apartment'];
        return [];
      }),
      getAvailableBuildingVintages: vi.fn(() => ['Pre1980', '1980-2004', 'Post2004']),
      getAvailableClimateZones: vi.fn(() => ['1A', '2A', '3A', '4A', '5A'])
    },
    validation: {
      validateRequest: vi.fn((request) => {
        if (!request || !request.method) {
          return { valid: false, errors: ['Invalid request format'] };
        }
        return { valid: true, errors: [] };
      }),
      validateModelPath: vi.fn(() => ({ valid: true })),
      validateMeasurePath: vi.fn(() => ({ valid: true })),
      validateOutputPath: vi.fn(() => ({ valid: true })),
      validateSimulationOptions: vi.fn(() => ({ valid: true })),
      isPathSafe: vi.fn(() => true),
      getValidationSchema: vi.fn(() => ({}))
    }
  };
});

// Mock fileOperations
vi.mock('../src/utils/fileOperations', async () => {
  const fileOperationsMock = {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    appendFile: vi.fn(),
    deleteFile: vi.fn(),
    fileExists: vi.fn(),
    directoryExists: vi.fn(),
    createDirectory: vi.fn(),
    ensureDirectory: vi.fn(),
    ensureDirectoryExists: vi.fn(),
    copyFile: vi.fn(),
    moveFile: vi.fn(),
    isPathInAllowedDirectories: vi.fn(() => true),
    getAbsolutePath: vi.fn(path => path),
    listFiles: vi.fn(),
    listDirectories: vi.fn(),
    validatePath: vi.fn(() => ({ valid: true })),
    generateTempFilePath: vi.fn(),
    createTempFile: vi.fn(),
    createTempDirectory: vi.fn(),
    deleteDirectory: vi.fn()
  };
  
  return {
    default: fileOperationsMock,
    ...fileOperationsMock
  };
});

// Mock WebSocket
vi.mock('ws', () => {
  const MockWebSocket = function() {
    return {
      on: vi.fn(),
      send: vi.fn(),
      close: vi.fn(),
      terminate: vi.fn(),
      readyState: 1
    };
  };
  
  MockWebSocket.CONNECTING = 0;
  MockWebSocket.OPEN = 1;
  MockWebSocket.CLOSING = 2;
  MockWebSocket.CLOSED = 3;
  
  return {
    default: MockWebSocket,
    WebSocket: MockWebSocket,
    Server: vi.fn(() => ({
      on: vi.fn(),
      close: vi.fn()
    }))
  };
});

// Mock axios
vi.mock('axios', async () => {
  const mockAxiosInstance = {
    get: vi.fn(),
    post: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() }
    }
  };
  
  const mockAxios = {
    get: vi.fn(),
    post: vi.fn(),
    create: vi.fn(() => mockAxiosInstance),
    isAxiosError: vi.fn((error) => error && error.isAxiosError === true)
  };
  
  return {
    default: mockAxios,
    ...mockAxios
  };
});

// Mock openStudioCommands
vi.mock('../src/utils/openStudioCommands', async () => {
  const commandsMock = {
    getOpenStudioVersion: vi.fn(),
    listMeasures: vi.fn(),
    applyMeasure: vi.fn(),
    runSimulation: vi.fn(),
    getSimulationStatus: vi.fn(),
    stopSimulation: vi.fn(),
  };
  
  return {
    default: commandsMock,
    ...commandsMock
  };
});

// Mock commandExecutor
vi.mock('../src/utils/commandExecutor', async () => {
  const executeCommandMock = vi.fn();
  const executeOpenStudioCommandMock = vi.fn();
  const validateCommandMock = vi.fn(() => ({ valid: false, error: 'Command validation failed' }));
  const killAllProcessesMock = vi.fn();
  const getActiveProcessCountMock = vi.fn(() => 2);
  const getActiveProcessesMock = vi.fn(() => []);
  const checkOpenStudioAvailabilityMock = vi.fn(() => Promise.resolve(true));
  const getOpenStudioVersionMock = vi.fn(() => Promise.resolve('3.5.0'));
  
  return {
    default: {
      executeCommand: executeCommandMock,
      executeOpenStudioCommand: executeOpenStudioCommandMock,
      validateCommand: validateCommandMock,
      killAllProcesses: killAllProcessesMock,
      getActiveProcessCount: getActiveProcessCountMock,
      getActiveProcesses: getActiveProcessesMock,
      checkOpenStudioAvailability: checkOpenStudioAvailabilityMock,
      getOpenStudioVersion: getOpenStudioVersionMock,
    },
    executeCommand: executeCommandMock,
    executeOpenStudioCommand: executeOpenStudioCommandMock,
    validateCommand: validateCommandMock,
    killAllProcesses: killAllProcessesMock,
    getActiveProcessCount: getActiveProcessCountMock,
    getActiveProcesses: getActiveProcessesMock,
    checkOpenStudioAvailability: checkOpenStudioAvailabilityMock,
    getOpenStudioVersion: getOpenStudioVersionMock,
  };
});

// Mock validation with explicit exports
vi.mock('../src/utils/validation', () => {
  const validateRequestMock = vi.fn((request) => {
    // Return proper validation result based on request
    if (!request || !request.method) {
      return { valid: false, errors: ['Invalid request format'] };
    }
    return { valid: true, errors: [] };
  });

  const validationMock = {
    validateRequest: validateRequestMock,
    validateModelPath: vi.fn(() => ({ valid: true })),
    validateMeasurePath: vi.fn(() => ({ valid: true })),
    validateOutputPath: vi.fn(() => ({ valid: true })),
    validateSimulationOptions: vi.fn(() => ({ valid: true })),
    isPathSafe: vi.fn(() => true),
    getValidationSchema: vi.fn(() => ({}))
  };

  return {
    validateRequest: validateRequestMock,
    getValidationSchema: validationMock.getValidationSchema,
    validateModelPath: validationMock.validateModelPath,
    validateMeasurePath: validationMock.validateMeasurePath,
    validateOutputPath: validationMock.validateOutputPath,
    validateSimulationOptions: validationMock.validateSimulationOptions,
    isPathSafe: validationMock.isPathSafe,
    default: validationMock
  };
});

// Mock measureManager service
vi.mock('../src/services/measureManager', async () => {
  const measureManagerMock = {
    getMeasuresDirectory: vi.fn(() => '/mock/measures'),
    isMeasureInstalled: vi.fn(() => Promise.resolve(true)),
    installMeasure: vi.fn(() => Promise.resolve()),
    uninstallMeasure: vi.fn(() => Promise.resolve()),
    listInstalledMeasures: vi.fn(() => Promise.resolve([])),
    getMeasureInfo: vi.fn(() => Promise.resolve({})),
    validateMeasure: vi.fn(() => Promise.resolve({ valid: true })),
    downloadMeasure: vi.fn(() => Promise.resolve()),
    updateMeasure: vi.fn(() => Promise.resolve())
  };

  return {
    default: measureManagerMock,
    ...measureManagerMock
  };
});

// Mock fileOperations service
vi.mock('../src/services/fileOperations', async () => {
  const fileOpsMock = {
    fileExists: vi.fn(() => Promise.resolve(true)),
    directoryExists: vi.fn(() => Promise.resolve(true)),
    ensureDirectory: vi.fn(() => Promise.resolve()),
    createDirectory: vi.fn(() => Promise.resolve()),
    copyFile: vi.fn(() => Promise.resolve()),
    moveFile: vi.fn(() => Promise.resolve()),
    deleteFile: vi.fn(() => Promise.resolve()),
    deleteDirectory: vi.fn(() => Promise.resolve()),
    readFile: vi.fn(() => Promise.resolve('mock file content')),
    writeFile: vi.fn(() => Promise.resolve()),
    appendFile: vi.fn(() => Promise.resolve()),
    listFiles: vi.fn(() => Promise.resolve([])),
    getFileStats: vi.fn(() => Promise.resolve({ size: 1024, mtime: new Date() })),
    generateTempFilePath: vi.fn((prefix = 'temp', extension = '.tmp') => `/tmp/${prefix}-${Date.now()}${extension}`),
    createTempFile: vi.fn(() => Promise.resolve('/tmp/temp-file.tmp')),
    createTempDirectory: vi.fn(() => Promise.resolve('/tmp/temp-dir'))
  };

  return {
    default: fileOpsMock,
    ...fileOpsMock
  };
});

// Mock BCLApiClient
vi.mock('../src/services/bclApiClient', async () => {
  const BCLApiClientMock = vi.fn().mockImplementation(() => ({
    searchMeasures: vi.fn(() => Promise.resolve([])),
    downloadMeasure: vi.fn(() => Promise.resolve(true)),
    installMeasure: vi.fn(() => Promise.resolve(true)),
    getMeasureInfo: vi.fn(() => Promise.resolve({})),
    authenticate: vi.fn(() => Promise.resolve()),
    isAuthenticated: vi.fn(() => true),
    recommendMeasures: vi.fn(() => Promise.resolve([])),
    updateMeasure: vi.fn(() => Promise.resolve(true))
  }));

  return {
    default: BCLApiClientMock,
    BCLApiClient: BCLApiClientMock
  };
});

// Mock command processor
vi.mock('../src/services/commandProcessor', async () => {
  const CommandProcessorMock = vi.fn().mockImplementation(() => ({
    processCommand: vi.fn((command, args) => Promise.resolve({
      success: true,
      output: 'Command processed successfully',
      data: { result: 'success' }
    }))
  }));

  return {
    default: CommandProcessorMock,
    OpenStudioCommandProcessor: CommandProcessorMock
  };
});

// Global beforeEach hook
beforeEach(() => {
  vi.clearAllMocks();
});

// Global afterEach hook
afterEach(() => {
  vi.restoreAllMocks();
  
  // Clear all timers to prevent hanging tests
  vi.clearAllTimers();
  
  // Force garbage collection if possible to clean up WebSocket connections
  if (global.gc) {
    global.gc();
  }
});