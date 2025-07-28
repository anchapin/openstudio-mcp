#!/usr/bin/env node

/**
 * Test the MCP configuration by simulating what VS Code does
 */

const { spawn } = require('child_process');
const path = require('path');

async function testMCPConfig() {
  console.log('Testing MCP Configuration...');
  
  // Test the exact command from your MCP config
  const mcpPath = '/Users/achapin/OpenStudio/openstudio-mcp/mcp-simple-server.js';
  
  console.log(`📍 Testing MCP server at: ${mcpPath}`);
  
  // Check if file exists
  const fs = require('fs');
  if (!fs.existsSync(mcpPath)) {
    console.log('❌ MCP server file not found!');
    console.log('💡 Update your MCP config with the correct path');
    return;
  }
  
  console.log('✅ MCP server file exists');
  
  // Test the server startup
  const server = spawn('node', [mcpPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'production' }
  });
  
  let initReceived = false;
  let toolsReceived = false;
  
  server.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => {
      try {
        const response = JSON.parse(line);
        if (response.id === 'init-test') {
          initReceived = true;
          console.log('✅ Initialize response received');
        } else if (response.id === 'tools-test') {
          toolsReceived = true;
          console.log('✅ Tools list response received');
          console.log(`📊 Found ${response.result.tools.length} tools`);
        }
      } catch (error) {
        // Ignore parse errors for partial lines
      }
    });
  });
  
  server.stderr.on('data', (data) => {
    console.log('🔍 Server:', data.toString().trim());
  });
  
  // Wait for server to start
  setTimeout(() => {
    console.log('📤 Sending initialize request...');
    server.stdin.write(JSON.stringify({
      id: 'init-test',
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'vscode-test', version: '1.0.0' }
      }
    }) + '\n');
    
    setTimeout(() => {
      console.log('📤 Sending tools/list request...');
      server.stdin.write(JSON.stringify({
        id: 'tools-test',
        method: 'tools/list'
      }) + '\n');
      
      setTimeout(() => {
        server.kill('SIGTERM');
        
        console.log('\n📊 Test Results:');
        console.log(`- Initialize: ${initReceived ? '✅ Working' : '❌ Failed'}`);
        console.log(`- Tools List: ${toolsReceived ? '✅ Working' : '❌ Failed'}`);
        
        if (initReceived && toolsReceived) {
          console.log('\n🎉 MCP configuration should work with VS Code!');
          console.log('💡 Restart VS Code to pick up the configuration changes');
        } else {
          console.log('\n⚠️ MCP configuration may have issues');
        }
      }, 1000);
    }, 500);
  }, 500);
}

testMCPConfig().catch(console.error);