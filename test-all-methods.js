#!/usr/bin/env node

/**
 * Test all MCP methods that Cline uses
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('Testing All MCP Methods for Cline...\n');

const simpleMCPPath = path.join(__dirname, 'mcp-simple-server.js');

const mcpProcess = spawn('node', [simpleMCPPath], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let responses = [];
let expectedResponses = 4; // initialize, tools/list, resources/list, resources/templates/list

mcpProcess.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    try {
      const response = JSON.parse(line);
      responses.push(response);
      
      console.log(`✅ Response ${response.id}: ${getMethodFromResponse(response)}`);
      
    } catch (e) {
      console.log(`Raw output: ${line}`);
    }
  }
});

mcpProcess.stderr.on('data', (data) => {
  const logs = data.toString().split('\n').filter(line => line.trim());
  logs.forEach(log => console.log(`📝 ${log}`));
});

function getMethodFromResponse(response) {
  if (response.result?.protocolVersion) return 'initialize';
  if (response.result?.tools) return 'tools/list';
  if (response.result?.resources !== undefined) return 'resources/list';
  if (response.result?.resourceTemplates !== undefined) return 'resources/templates/list';
  if (response.error) return `error: ${response.error.message}`;
  return 'unknown';
}

// Send the sequence of requests that Cline makes
setTimeout(() => {
  console.log('1. Sending notifications/initialized...');
  const initNotification = {
    jsonrpc: '2.0',
    method: 'notifications/initialized'
  };
  mcpProcess.stdin.write(JSON.stringify(initNotification) + '\n');
}, 500);

setTimeout(() => {
  console.log('2. Sending tools/list...');
  const toolsRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list'
  };
  mcpProcess.stdin.write(JSON.stringify(toolsRequest) + '\n');
}, 1000);

setTimeout(() => {
  console.log('3. Sending resources/list...');
  const resourcesRequest = {
    jsonrpc: '2.0',
    id: 2,
    method: 'resources/list'
  };
  mcpProcess.stdin.write(JSON.stringify(resourcesRequest) + '\n');
}, 1500);

setTimeout(() => {
  console.log('4. Sending resources/templates/list...');
  const templatesRequest = {
    jsonrpc: '2.0',
    id: 3,
    method: 'resources/templates/list'
  };
  mcpProcess.stdin.write(JSON.stringify(templatesRequest) + '\n');
}, 2000);

// Summary
setTimeout(() => {
  console.log('\n=== TEST RESULTS ===');
  
  const hasToolsList = responses.some(r => r.result?.tools);
  const hasResourcesList = responses.some(r => r.result?.resources !== undefined);
  const hasTemplatesList = responses.some(r => r.result?.resourceTemplates !== undefined);
  const hasErrors = responses.some(r => r.error);
  
  console.log(`✅ Tools list: ${hasToolsList ? 'PASS' : 'FAIL'}`);
  console.log(`✅ Resources list: ${hasResourcesList ? 'PASS' : 'FAIL'}`);
  console.log(`✅ Templates list: ${hasTemplatesList ? 'PASS' : 'FAIL'}`);
  console.log(`✅ No errors: ${!hasErrors ? 'PASS' : 'FAIL'}`);
  
  if (hasToolsList && hasResourcesList && hasTemplatesList && !hasErrors) {
    console.log('\n🎉 ALL METHODS WORKING!');
    console.log('Cline should now connect without any timeout errors.');
  } else {
    console.log('\n❌ Some methods failed.');
    if (hasErrors) {
      console.log('Errors found:');
      responses.filter(r => r.error).forEach(r => 
        console.log(`   - ID ${r.id}: ${r.error.message}`)
      );
    }
  }
  
  mcpProcess.kill();
  process.exit(0);
}, 4000);

mcpProcess.on('close', (code) => {
  console.log(`\nMCP process exited with code ${code}`);
});

// Handle cleanup
process.on('SIGINT', () => {
  console.log('\nCleaning up...');
  mcpProcess.kill();
  process.exit(0);
});