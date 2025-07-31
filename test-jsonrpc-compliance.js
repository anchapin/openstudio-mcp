#!/usr/bin/env node

/**
 * Test JSON-RPC 2.0 compliance for the MCP server
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('Testing JSON-RPC 2.0 Compliance...\n');

const simpleMCPPath = path.join(__dirname, 'mcp-simple-server.js');

const mcpProcess = spawn('node', [simpleMCPPath], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let responses = [];
let logs = [];

mcpProcess.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    try {
      const response = JSON.parse(line);
      responses.push(response);
      
      // Check JSON-RPC 2.0 compliance
      const hasJsonRpc = response.jsonrpc === '2.0';
      const hasId = response.id !== undefined;
      const hasResultOrError = response.result !== undefined || response.error !== undefined;
      
      console.log(`✅ Response ${response.id}:`);
      console.log(`   - jsonrpc: ${hasJsonRpc ? '✅' : '❌'} (${response.jsonrpc})`);
      console.log(`   - id: ${hasId ? '✅' : '❌'} (${response.id})`);
      console.log(`   - result/error: ${hasResultOrError ? '✅' : '❌'}`);
      
      if (hasJsonRpc && hasId && hasResultOrError) {
        console.log(`   🎉 COMPLIANT\n`);
      } else {
        console.log(`   ❌ NOT COMPLIANT\n`);
      }
      
    } catch (e) {
      console.log(`❌ Invalid JSON response: ${line}`);
    }
  }
});

mcpProcess.stderr.on('data', (data) => {
  const logLines = data.toString().split('\n').filter(line => line.trim());
  logs.push(...logLines);
  logLines.forEach(log => console.log(`📝 ${log}`));
});

// Send test requests
setTimeout(() => {
  console.log('Sending initialize request...');
  const initRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'compliance-test',
        version: '1.0.0'
      }
    }
  };
  
  mcpProcess.stdin.write(JSON.stringify(initRequest) + '\n');
}, 500);

setTimeout(() => {
  console.log('Sending tools/list request...');
  const toolsRequest = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
    params: {}
  };
  
  mcpProcess.stdin.write(JSON.stringify(toolsRequest) + '\n');
}, 1000);

setTimeout(() => {
  console.log('Sending invalid method request...');
  const invalidRequest = {
    jsonrpc: '2.0',
    id: 3,
    method: 'invalid/method',
    params: {}
  };
  
  mcpProcess.stdin.write(JSON.stringify(invalidRequest) + '\n');
}, 1500);

// Summary
setTimeout(() => {
  console.log('\n=== COMPLIANCE SUMMARY ===');
  
  const compliantResponses = responses.filter(r => 
    r.jsonrpc === '2.0' && 
    r.id !== undefined && 
    (r.result !== undefined || r.error !== undefined)
  );
  
  console.log(`Total responses: ${responses.length}`);
  console.log(`Compliant responses: ${compliantResponses.length}`);
  console.log(`Compliance rate: ${responses.length > 0 ? Math.round((compliantResponses.length / responses.length) * 100) : 0}%`);
  
  if (compliantResponses.length === responses.length && responses.length >= 3) {
    console.log('\n🎉 ALL RESPONSES ARE JSON-RPC 2.0 COMPLIANT!');
    console.log('This should fix the Cline timeout issues.');
  } else {
    console.log('\n❌ Some responses are not compliant.');
    console.log('Non-compliant responses:');
    responses.filter(r => !(r.jsonrpc === '2.0' && r.id !== undefined && (r.result !== undefined || r.error !== undefined)))
      .forEach(r => console.log(`   - ${JSON.stringify(r)}`));
  }
  
  mcpProcess.kill();
  process.exit(0);
}, 3000);

mcpProcess.on('close', (code) => {
  console.log(`\nMCP process exited with code ${code}`);
});

// Handle cleanup
process.on('SIGINT', () => {
  console.log('\nCleaning up...');
  mcpProcess.kill();
  process.exit(0);
});