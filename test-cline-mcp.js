#!/usr/bin/env node

/**
 * Test MCP server exactly as Cline (Claude Dev) would use it
 */

const { spawn } = require('child_process');

async function testClineMCP() {
  console.log('🧪 Testing MCP Server (Cline simulation)...');
  
  const server = spawn('node', ['/Users/achapin/OpenStudio/openstudio-mcp/mcp-simple-server.js'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'production' }
  });
  
  let responses = [];
  let serverMessages = [];
  let initializeReceived = false;
  let toolsReceived = false;
  
  server.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => {
      try {
        const response = JSON.parse(line);
        responses.push(response);
        console.log(`📥 Response: ${response.id} - ${response.result ? 'SUCCESS' : 'ERROR'}`);
        
        if (response.id === 'cline-init') {
          initializeReceived = true;
        } else if (response.id === 'cline-tools') {
          toolsReceived = true;
        }
      } catch (error) {
        // Ignore parse errors for partial lines
      }
    });
  });
  
  server.stderr.on('data', (data) => {
    const message = data.toString().trim();
    serverMessages.push(message);
    console.log(`🔍 Server: ${message}`);
  });
  
  server.on('error', (error) => {
    console.log(`❌ Server error: ${error.message}`);
  });
  
  // Wait for server to start
  setTimeout(() => {
    console.log('\n📤 Sending Cline-style initialize...');
    
    // This is what Cline sends for initialization
    server.stdin.write(JSON.stringify({
      id: 'cline-init',
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {
          roots: {
            listChanged: true
          },
          sampling: {}
        },
        clientInfo: {
          name: 'cline',
          version: '3.20.2'
        }
      }
    }) + '\n');
    
    // Wait for initialize response, then request tools
    setTimeout(() => {
      if (initializeReceived) {
        console.log('📤 Sending tools/list request...');
        server.stdin.write(JSON.stringify({
          id: 'cline-tools',
          method: 'tools/list'
        }) + '\n');
      } else {
        console.log('⚠️ Initialize not received, sending tools/list anyway...');
        server.stdin.write(JSON.stringify({
          id: 'cline-tools',
          method: 'tools/list'
        }) + '\n');
      }
      
      // Test a tool call
      setTimeout(() => {
        console.log('📤 Sending tool call...');
        server.stdin.write(JSON.stringify({
          id: 'cline-call',
          method: 'tools/call',
          params: {
            name: 'openstudio.bcl.search',
            arguments: { query: 'test', limit: 1 }
          }
        }) + '\n');
        
        // Cleanup after test
        setTimeout(() => {
          server.kill('SIGTERM');
          
          console.log('\n📊 Cline Test Results:');
          console.log(`- Server messages: ${serverMessages.length}`);
          console.log(`- Responses received: ${responses.length}`);
          console.log(`- Initialize: ${initializeReceived ? '✅' : '❌'}`);
          console.log(`- Tools list: ${toolsReceived ? '✅' : '❌'}`);
          
          if (initializeReceived && toolsReceived) {
            console.log('\n🎉 MCP server should work with Cline!');
            console.log('💡 If you still see timeout errors, restart VS Code');
          } else {
            console.log('\n⚠️ There may be communication issues with Cline');
            console.log('Server messages:', serverMessages);
          }
        }, 2000);
      }, 1000);
    }, 1000);
  }, 500);
}

testClineMCP().catch(console.error);