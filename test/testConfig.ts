/**
 * Test configuration
 */
import os from 'os';
import path from 'path';

// Create test-specific directories
const testTempDir = path.join(os.tmpdir(), 'openstudio-mcp-test');
const testMeasuresDir = path.join(testTempDir, 'measures');

// Test configuration
const testConfig = {
  server: {
    port: 3099,
    host: 'localhost'
  },
  openStudio: {
    cliPath: process.env.OPENSTUDIO_CLI_PATH || 'openstudio',
    version: '3.5.0'
  },
  bcl: {
    apiUrl: 'https://bcl.nrel.gov/api/v1',
    measuresDir: testMeasuresDir,
    tempDir: testTempDir
  },
  logging: {
    level: 'info',
    format: 'pretty'
  },
  fileOperations: {
    allowedDirectories: [testTempDir, os.tmpdir()]
  },
  security: {
    allowedCommands: ['echo', 'ls', 'pwd', 'node', 'sleep', 'timeout', 'cd'],
    allowedDirectories: [testTempDir, os.tmpdir()]
  }
};

export default testConfig;