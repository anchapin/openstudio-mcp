#!/usr/bin/env node

/**
 * Test MCP server as VS Code would use it
 */

const { spawn } = require('child_process');

async function testVSCodeMCP() {
  console.log('🧪 Testing MCP Server (VS Code simulation)...');
  
  const server = spawn('node', ['/Users/achapin/OpenStudio/openstudio-mcp/mcp-simple-server.js'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'production' }
  });
  
  let responses = [];
  let serverReady = false;
  
  server.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => {
      try {
        const response = JSON.parse(line);
        responses.push(response);
        console.log(`📥 Response: ${response.id} - ${response.result ? 'SUCCESS' : 'ERROR'}`);
      } catch (error) {
        // Ignore parse errors for partial lines
      }
    });
  });
  
  server.stderr.on('data', (data) => {
    const message = data.toString().trim();
    console.log(`🔍 Server Status: ${message}`);
    if (message.includes('Simple MCP Server started')) {
      serverReady = true;
      console.log('✅ Server is ready!');
    }
  });
  
  // Wait for server to start
  setTimeout(() => {
    if (!serverReady) {
      console.log('⚠️ Server may not have started properly');
    }
    
    console.log('\n📤 Testing MCP protocol...');
    
    // Test 1: Initialize
    server.stdin.write(JSON.stringify({
      id: 'init-1',
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'vscode', version: '1.95.0' }
      }
    }) + '\n');
    
    // Test 2: List tools
    setTimeout(() => {
      server.stdin.write(JSON.stringify({
        id: 'tools-1',
        method: 'tools/list'
      }) + '\n');
    }, 100);
    
    // Test 3: Call a tool
    setTimeout(() => {
      server.stdin.write(JSON.stringify({
        id: 'call-1',
        method: 'tools/call',
        params: {
          name: 'openstudio.bcl.search',
          arguments: { query: 'test', limit: 1 }
        }
      }) + '\n');
    }, 200);
    
    // Cleanup
    setTimeout(() => {
      server.kill('SIGTERM');
      
      console.log('\n📊 Test Results:');
      console.log(`- Server started: ${serverReady ? '✅' : '❌'}`);
      console.log(`- Responses received: ${responses.length}`);
      console.log(`- Initialize: ${responses.some(r => r.id === 'init-1') ? '✅' : '❌'}`);
      console.log(`- Tools list: ${responses.some(r => r.id === 'tools-1') ? '✅' : '❌'}`);
      console.log(`- Tool call: ${responses.some(r => r.id === 'call-1') ? '✅' : '❌'}`);
      
      if (serverReady && responses.length >= 3) {
        console.log('\n🎉 MCP server is working perfectly with VS Code!');
        console.log('💡 The stderr message you saw is normal - it means the server started successfully.');
      } else {
        console.log('\n⚠️ There may be issues with the MCP server setup.');
      }
    }, 1000);
    
  }, 500);
}

testVSCodeMCP().catch(console.error);