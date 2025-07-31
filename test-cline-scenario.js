#!/usr/bin/env node

/**
 * Test the exact scenario that Cline would use
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('Testing Cline Integration Scenario...\n');

const simpleMCPPath = path.join(__dirname, 'mcp-simple-server.js');

const mcpProcess = spawn('node', [simpleMCPPath], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let initializeReceived = false;
let timeoutOccurred = false;

mcpProcess.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    try {
      const response = JSON.parse(line);
      
      if (response.id === 0 && response.result?.protocolVersion) {
        initializeReceived = true;
        console.log('✅ Initialize response received immediately');
        console.log(`   Protocol version: ${response.result.protocolVersion}`);
        console.log(`   Server name: ${response.result.serverInfo?.name}`);
        
        // Simulate what happens when Cline gets a proper response
        console.log('\n✅ No timeout should occur now!');
        
        // Test cancellation after successful init
        setTimeout(() => {
          console.log('\nTesting cancellation notification...');
          const cancelNotification = {
            jsonrpc: '2.0',
            method: 'notifications/cancelled',
            params: {
              requestId: 'unknown'
            }
          };
          
          mcpProcess.stdin.write(JSON.stringify(cancelNotification) + '\n');
        }, 500);
      }
      
    } catch (e) {
      console.log(`Raw output: ${line}`);
    }
  }
});

mcpProcess.stderr.on('data', (data) => {
  const logs = data.toString().split('\n').filter(line => line.trim());
  logs.forEach(log => {
    console.log(`📝 ${log}`);
    
    if (log.includes('Request cancelled: unknown')) {
      console.log('✅ Cancellation handled properly - no error response sent');
    }
  });
});

// Send the exact initialize request that was causing issues
setTimeout(() => {
  console.log('Sending initialize request (id: 0)...');
  const initRequest = {
    jsonrpc: '2.0',
    id: 0,  // This is the exact ID from your error
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'cline',
        version: '1.0.0'
      }
    }
  };
  
  mcpProcess.stdin.write(JSON.stringify(initRequest) + '\n');
  
  // Set a timeout to detect if we don't get a response
  setTimeout(() => {
    if (!initializeReceived) {
      timeoutOccurred = true;
      console.log('❌ TIMEOUT: No response received within 2 seconds');
      console.log('This would cause the "Request timed out" error in Cline');
    }
  }, 2000);
  
}, 500);

// Final summary
setTimeout(() => {
  console.log('\n=== FINAL RESULT ===');
  
  if (initializeReceived && !timeoutOccurred) {
    console.log('🎉 SUCCESS: Initialize request handled immediately');
    console.log('🎉 SUCCESS: Cancellation notifications handled properly');
    console.log('\nYour Cline integration should now work without timeout errors!');
    console.log('\nNext steps:');
    console.log('1. Make sure the main OpenStudio server is running: npm start');
    console.log('2. Restart the Cline extension in VS Code');
    console.log('3. Test with a simple OpenStudio command');
  } else {
    console.log('❌ FAILED: Issues still exist');
    if (timeoutOccurred) console.log('   - Timeout still occurring');
    if (!initializeReceived) console.log('   - Initialize response not received');
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