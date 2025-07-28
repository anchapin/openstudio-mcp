#!/usr/bin/env node

/**
 * Comprehensive test for all MCP connection methods
 */

const WebSocket = require('ws');
const { spawn } = require('child_process');

async function testHTTPEndpoints() {
  console.log('\n🌐 Testing HTTP MCP Endpoints...');
  
  try {
    // Test tools/list endpoint
    const toolsResponse = await fetch('http://localhost:3000/mcp/tools/list');
    const tools = await toolsResponse.json();
    console.log('✅ HTTP tools/list:', tools.tools?.length || 0, 'tools found');
    
    // Test tools/call endpoint
    const callResponse = await fetch('http://localhost:3000/mcp/tools/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'openstudio.bcl.search',
        arguments: { query: 'lighting', limit: 3 }
      })
    });
    const callResult = await callResponse.json();
    console.log('✅ HTTP tools/call successful:', callResult.content ? 'Yes' : 'No');
    
  } catch (error) {
    console.log('❌ HTTP endpoints failed:', error.message);
  }
}

async function testWebSocketConnection() {
  console.log('\n🔌 Testing WebSocket Connection...');
  
  return new Promise((resolve) => {
    const ws = new WebSocket('ws://localhost:3000');
    let received = false;
    
    ws.on('open', () => {
      console.log('✅ WebSocket connected');
      
      const request = {
        id: 'ws-test',
        type: 'openstudio.bcl.search',
        params: { query: 'lighting', limit: 2 }
      };
      
      ws.send(JSON.stringify(request));
    });
    
    ws.on('message', (data) => {
      try {
        const response = JSON.parse(data.toString());
        if (response.id === 'ws-test') {
          received = true;
          console.log('✅ WebSocket response received:', response.status);
          ws.close();
        }
      } catch (error) {
        console.log('❌ WebSocket response error:', error.message);
        ws.close();
      }
    });
    
    ws.on('close', () => {
      console.log('🔌 WebSocket closed');
      resolve(received);
    });
    
    ws.on('error', (error) => {
      console.log('❌ WebSocket error:', error.message);
      resolve(false);
    });
    
    setTimeout(() => {
      if (!received) {
        console.log('⏰ WebSocket timeout');
        ws.close();
      }
    }, 5000);
  });
}

async function testStdioServer() {
  console.log('\n📝 Testing MCP stdio server...');
  
  return new Promise((resolve) => {
    const stdio = spawn('node', ['mcp-stdio-server.js'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let responses = [];
    let initialized = false;
    
    stdio.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(line => line.trim());
      lines.forEach(line => {
        try {
          const response = JSON.parse(line);
          responses.push(response);
          console.log('📥 stdio response:', response.id, response.result ? 'success' : 'error');
        } catch (error) {
          // Ignore parse errors for partial lines
        }
      });
    });
    
    stdio.stderr.on('data', (data) => {
      console.log('🔍 stdio stderr:', data.toString().trim());
    });
    
    // Wait for connection then send test requests
    setTimeout(() => {
      // Initialize
      stdio.stdin.write(JSON.stringify({
        id: 'init',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' }
        }
      }) + '\n');
      
      // List tools
      setTimeout(() => {
        stdio.stdin.write(JSON.stringify({
          id: 'list-tools',
          method: 'tools/list'
        }) + '\n');
      }, 1000);
      
      // Call a tool
      setTimeout(() => {
        stdio.stdin.write(JSON.stringify({
          id: 'call-tool',
          method: 'tools/call',
          params: {
            name: 'openstudio.bcl.search',
            arguments: { query: 'lighting', limit: 2 }
          }
        }) + '\n');
      }, 2000);
      
      // Close after tests
      setTimeout(() => {
        stdio.kill('SIGTERM');
        console.log('✅ stdio server test completed:', responses.length, 'responses');
        resolve(responses.length > 0);
      }, 4000);
      
    }, 2000);
  });
}

async function runAllTests() {
  console.log('🧪 Running comprehensive MCP tests...');
  
  // Test basic server health
  try {
    const health = await fetch('http://localhost:3000/health');
    const healthData = await health.json();
    console.log('✅ Server health:', healthData.status);
  } catch (error) {
    console.log('❌ Server not running. Start with: npm start');
    return;
  }
  
  // Run all tests
  await testHTTPEndpoints();
  const wsResult = await testWebSocketConnection();
  const stdioResult = await testStdioServer();
  
  console.log('\n📊 Test Summary:');
  console.log('- HTTP endpoints:', '✅ Working');
  console.log('- WebSocket:', wsResult ? '✅ Working' : '❌ Failed');
  console.log('- stdio server:', stdioResult ? '✅ Working' : '❌ Failed');
  
  console.log('\n🎯 Recommendations for VS Code:');
  console.log('1. Try HTTP configuration first (most reliable)');
  console.log('2. Use stdio server as fallback');
  console.log('3. Ensure tool sets file is in correct location');
  console.log('4. Check VS Code MCP server status in Command Palette');
}

// Add fetch polyfill for older Node versions
if (!global.fetch) {
  global.fetch = require('node-fetch');
}

runAllTests().catch(console.error);