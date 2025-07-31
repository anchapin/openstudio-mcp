#!/usr/bin/env node

/**
 * Test the simple MCP server specifically for Cline integration
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('Testing Simple MCP Server for Cline...\n');

const simpleMCPPath = path.join(__dirname, 'mcp-simple-server.js');

const mcpProcess = spawn('node', [simpleMCPPath], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let responses = [];
let errors = [];

mcpProcess.stdout.on('data', (data) => {
  const output = data.toString().trim();
  if (output) {
    try {
      const response = JSON.parse(output);
      responses.push(response);
      console.log('✅ Received response:', JSON.stringify(response, null, 2));
    } catch (e) {
      console.log('Raw output:', output);
    }
  }
});

mcpProcess.stderr.on('data', (data) => {
  const error = data.toString().trim();
  if (error) {
    errors.push(error);
    console.log('📝 Server log:', error);
  }
});

// Test sequence
setTimeout(() => {
  console.log('\n1. Sending initialize request...');
  const initRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'cline-test',
        version: '1.0.0'
      }
    }
  };
  
  mcpProcess.stdin.write(JSON.stringify(initRequest) + '\n');
}, 500);

setTimeout(() => {
  console.log('\n2. Sending tools/list request...');
  const toolsRequest = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
    params: {}
  };
  
  mcpProcess.stdin.write(JSON.stringify(toolsRequest) + '\n');
}, 1500);

setTimeout(() => {
  console.log('\n3. Testing cancellation notification...');
  const cancelNotification = {
    jsonrpc: '2.0',
    method: 'notifications/cancelled',
    params: {
      requestId: 999
    }
  };
  
  mcpProcess.stdin.write(JSON.stringify(cancelNotification) + '\n');
}, 2500);

setTimeout(() => {
  console.log('\n4. Testing tool call...');
  const toolCallRequest = {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'openstudio.model.info',
      arguments: {
        modelPath: '/tmp/test.osm',
        detailLevel: 'basic'
      }
    }
  };
  
  mcpProcess.stdin.write(JSON.stringify(toolCallRequest) + '\n');
}, 3500);

// Summary after tests
setTimeout(() => {
  console.log('\n=== TEST SUMMARY ===');
  console.log(`Responses received: ${responses.length}`);
  console.log(`Server logs: ${errors.length}`);
  
  const hasInitResponse = responses.some(r => r.id === 1 && r.result?.protocolVersion);
  const hasToolsList = responses.some(r => r.id === 2 && r.result?.tools);
  const hasToolCall = responses.some(r => r.id === 3);
  
  console.log(`✅ Initialize response: ${hasInitResponse ? 'PASS' : 'FAIL'}`);
  console.log(`✅ Tools list response: ${hasToolsList ? 'PASS' : 'FAIL'}`);
  console.log(`✅ Tool call response: ${hasToolCall ? 'PASS' : 'FAIL'}`);
  console.log(`✅ Cancellation handling: ${errors.some(e => e.includes('cancelled')) ? 'PASS' : 'FAIL'}`);
  
  if (hasInitResponse && hasToolsList) {
    console.log('\n🎉 MCP server is working correctly for Cline!');
    console.log('\nNext steps:');
    console.log('1. Make sure your cline-mcp-fixed.json is configured in Cline');
    console.log('2. Restart Cline extension');
    console.log('3. The timeout and cancellation issues should be resolved');
  } else {
    console.log('\n❌ Some tests failed. Check the responses above.');
  }
  
  mcpProcess.kill();
  process.exit(0);
}, 5000);

mcpProcess.on('close', (code) => {
  console.log(`\nMCP process exited with code ${code}`);
});

// Handle cleanup
process.on('SIGINT', () => {
  console.log('\nCleaning up...');
  mcpProcess.kill();
  process.exit(0);
});