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

// Mock logger
vi.mock('../src/utils/logger', async () => {
  return {
    default: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
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

// Import test config
import testConfig from './testConfig';

// Mock config
vi.mock('../src/config', () => ({
  default: testConfig
}));

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

// Mock validation
vi.mock('../src/utils/validation', async () => {
  const validationMock = {
    validateRequest: vi.fn(() => ({ valid: true })),
    validateModelPath: vi.fn(() => ({ valid: true })),
    validateMeasurePath: vi.fn(() => ({ valid: true })),
    validateOutputPath: vi.fn(() => ({ valid: true })),
    validateSimulationOptions: vi.fn(() => ({ valid: true })),
    isPathSafe: vi.fn(() => true),
    getValidationSchema: vi.fn(() => ({}))
  };
  
  return {
    default: validationMock,
    ...validationMock
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