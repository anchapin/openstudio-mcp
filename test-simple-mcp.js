#!/usr/bin/env node

/**
 * Test the simple MCP server for quick responses
 */

const { spawn } = require('child_process');

async function testSimpleMCP() {
  console.log('Testing Simple MCP Server...');
  
  const server = spawn('node', ['mcp-simple-server.js'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  let responses = [];
  let startTime = Date.now();
  
  server.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => {
      try {
        const response = JSON.parse(line);
        const elapsed = Date.now() - startTime;
        responses.push({ response, elapsed });
        console.log(`📥 Response (${elapsed}ms):`, response.id, response.result ? 'success' : 'error');
      } catch (error) {
        console.log('📥 Raw:', line);
      }
    });
  });
  
  server.stderr.on('data', (data) => {
    console.log('🔍 Stderr:', data.toString().trim());
  });
  
  // Test sequence
  setTimeout(() => {
    console.log('📤 Sending initialize...');
    startTime = Date.now();
    server.stdin.write(JSON.stringify({
      id: 'init',
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' }
      }
    }) + '\n');
  }, 100);
  
  setTimeout(() => {
    console.log('📤 Sending tools/list...');
    startTime = Date.now();
    server.stdin.write(JSON.stringify({
      id: 'list',
      method: 'tools/list'
    }) + '\n');
  }, 200);
  
  setTimeout(() => {
    console.log('📤 Sending tools/call...');
    startTime = Date.now();
    server.stdin.write(JSON.stringify({
      id: 'call',
      method: 'tools/call',
      params: {
        name: 'openstudio.bcl.search',
        arguments: { query: 'lighting', limit: 2 }
      }
    }) + '\n');
  }, 300);
  
  setTimeout(() => {
    server.kill('SIGTERM');
    
    console.log('\n📊 Performance Summary:');
    responses.forEach(({ response, elapsed }) => {
      console.log(`- ${response.id}: ${elapsed}ms`);
    });
    
    const avgTime = responses.reduce((sum, r) => sum + r.elapsed, 0) / responses.length;
    console.log(`- Average response time: ${avgTime.toFixed(1)}ms`);
    
    if (avgTime < 1000) {
      console.log('✅ Response times are good for MCP client');
    } else {
      console.log('⚠️ Response times may cause timeouts');
    }
  }, 2000);
}

testSimpleMCP().catch(console.error);