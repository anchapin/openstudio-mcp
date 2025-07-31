#!/usr/bin/env node

/**
 * Test script to verify Cline MCP connection
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('Testing Cline MCP Connection...\n');

// Test 1: Check if the main OpenStudio server can start
console.log('1. Testing main OpenStudio MCP server...');
const serverPath = path.join(__dirname, 'dist', 'index.js');

const serverProcess = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, NODE_ENV: 'development' }
});

let serverStarted = false;
let serverOutput = '';

serverProcess.stdout.on('data', (data) => {
  const output = data.toString();
  serverOutput += output;
  console.log('Server:', output.trim());
  
  if (output.includes('Server listening') || output.includes('started')) {
    serverStarted = true;
    console.log('✅ Main server started successfully\n');
    
    // Test 2: Test the simple MCP server
    setTimeout(() => {
      console.log('2. Testing simple MCP server communication...');
      testSimpleMCPServer();
    }, 1000);
  }
});

serverProcess.stderr.on('data', (data) => {
  console.log('Server Error:', data.toString().trim());
});

serverProcess.on('close', (code) => {
  console.log(`Server process exited with code ${code}`);
});

// Timeout for server start
setTimeout(() => {
  if (!serverStarted) {
    console.log('❌ Main server failed to start within 5 seconds');
    console.log('Server output:', serverOutput);
    serverProcess.kill();
    process.exit(1);
  }
}, 5000);

function testSimpleMCPServer() {
  const simpleMCPPath = path.join(__dirname, 'mcp-simple-server.js');
  
  const mcpProcess = spawn('node', [simpleMCPPath], {
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  let mcpOutput = '';
  let mcpErrors = '';
  
  mcpProcess.stdout.on('data', (data) => {
    mcpOutput += data.toString();
  });
  
  mcpProcess.stderr.on('data', (data) => {
    const error = data.toString();
    mcpErrors += error;
    console.log('MCP:', error.trim());
  });
  
  // Send initialize request
  const initRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'test-client',
        version: '1.0.0'
      }
    }
  };
  
  console.log('Sending initialize request...');
  mcpProcess.stdin.write(JSON.stringify(initRequest) + '\n');
  
  // Wait for response
  setTimeout(() => {
    if (mcpOutput.includes('protocolVersion')) {
      console.log('✅ MCP server responded to initialize');
      
      // Test tools/list
      const toolsRequest = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {}
      };
      
      console.log('Sending tools/list request...');
      mcpProcess.stdin.write(JSON.stringify(toolsRequest) + '\n');
      
      setTimeout(() => {
        if (mcpOutput.includes('openstudio.model.create')) {
          console.log('✅ MCP server responded with tools list');
          console.log('\n🎉 All tests passed! Your setup should work with Cline.');
        } else {
          console.log('❌ MCP server did not respond with tools list');
          console.log('Output:', mcpOutput);
        }
        
        mcpProcess.kill();
        serverProcess.kill();
        process.exit(0);
      }, 2000);
      
    } else {
      console.log('❌ MCP server did not respond to initialize');
      console.log('Output:', mcpOutput);
      console.log('Errors:', mcpErrors);
      
      mcpProcess.kill();
      serverProcess.kill();
      process.exit(1);
    }
  }, 2000);
  
  mcpProcess.on('close', (code) => {
    console.log(`MCP process exited with code ${code}`);
  });
}

// Handle cleanup
process.on('SIGINT', () => {
  console.log('\nCleaning up...');
  if (serverProcess) serverProcess.kill();
  process.exit(0);
});