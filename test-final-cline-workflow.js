#!/usr/bin/env node

/**
 * Final test simulating the complete Cline workflow
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🧪 Final Cline Workflow Test\n');

const simpleMCPPath = path.join(__dirname, 'mcp-simple-server.js');

const mcpProcess = spawn('node', [simpleMCPPath], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let testResults = {
  initialized: false,
  toolsList: false,
  resourcesList: false,
  templatesList: false,
  toolCall: false,
  noTimeouts: true,
  noCancellations: true
};

let responses = [];
let cancellations = 0;

mcpProcess.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    try {
      const response = JSON.parse(line);
      responses.push(response);
      
      // Check what we received
      if (response.result?.protocolVersion) {
        testResults.initialized = true;
        console.log('✅ Initialize: SUCCESS');
      } else if (response.result?.tools) {
        testResults.toolsList = true;
        console.log('✅ Tools List: SUCCESS');
      } else if (response.result?.resources !== undefined) {
        testResults.resourcesList = true;
        console.log('✅ Resources List: SUCCESS');
      } else if (response.result?.resourceTemplates !== undefined) {
        testResults.templatesList = true;
        console.log('✅ Templates List: SUCCESS');
      } else if (response.result?.content) {
        testResults.toolCall = true;
        console.log('✅ Tool Call: SUCCESS');
      }
      
    } catch (e) {
      console.log(`Raw output: ${line}`);
    }
  }
});

mcpProcess.stderr.on('data', (data) => {
  const logs = data.toString().split('\n').filter(line => line.trim());
  logs.forEach(log => {
    if (log.includes('Request cancelled')) {
      cancellations++;
      if (cancellations > 2) { // More than expected cancellations
        testResults.noCancellations = false;
      }
    }
    // Don't log every message to keep output clean
    if (log.includes('ERROR') || log.includes('TIMEOUT')) {
      console.log(`⚠️  ${log}`);
      testResults.noTimeouts = false;
    }
  });
});

// Simulate the complete Cline workflow
setTimeout(() => {
  console.log('📡 Step 1: Initialize connection...');
  const initRequest = {
    jsonrpc: '2.0',
    id: 0,
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
}, 500);

setTimeout(() => {
  console.log('📡 Step 2: Send initialized notification...');
  const initNotification = {
    jsonrpc: '2.0',
    method: 'notifications/initialized'
  };
  mcpProcess.stdin.write(JSON.stringify(initNotification) + '\n');
}, 1000);

setTimeout(() => {
  console.log('📡 Step 3: Request tools list...');
  const toolsRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list'
  };
  mcpProcess.stdin.write(JSON.stringify(toolsRequest) + '\n');
}, 1500);

setTimeout(() => {
  console.log('📡 Step 4: Request resources list...');
  const resourcesRequest = {
    jsonrpc: '2.0',
    id: 2,
    method: 'resources/list'
  };
  mcpProcess.stdin.write(JSON.stringify(resourcesRequest) + '\n');
}, 2000);

setTimeout(() => {
  console.log('📡 Step 5: Request templates list...');
  const templatesRequest = {
    jsonrpc: '2.0',
    id: 3,
    method: 'resources/templates/list'
  };
  mcpProcess.stdin.write(JSON.stringify(templatesRequest) + '\n');
}, 2500);

setTimeout(() => {
  console.log('📡 Step 6: Test tool call...');
  const toolCallRequest = {
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/call',
    params: {
      name: 'openstudio.bcl.search',
      arguments: {
        query: 'energy efficiency',
        limit: 5
      }
    }
  };
  mcpProcess.stdin.write(JSON.stringify(toolCallRequest) + '\n');
}, 3000);

// Final assessment
setTimeout(() => {
  console.log('\n' + '='.repeat(50));
  console.log('🏁 FINAL ASSESSMENT');
  console.log('='.repeat(50));
  
  const allPassed = Object.values(testResults).every(result => result === true);
  
  console.log(`📋 Initialize Connection: ${testResults.initialized ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`📋 Tools List Request: ${testResults.toolsList ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`📋 Resources List Request: ${testResults.resourcesList ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`📋 Templates List Request: ${testResults.templatesList ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`📋 Tool Call Execution: ${testResults.toolCall ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`📋 No Timeout Errors: ${testResults.noTimeouts ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`📋 Proper Cancellation Handling: ${testResults.noCancellations ? '✅ PASS' : '❌ FAIL'}`);
  
  console.log('\n' + '='.repeat(50));
  
  if (allPassed) {
    console.log('🎉 ALL TESTS PASSED!');
    console.log('🎉 Your OpenStudio MCP server is ready for Cline!');
    console.log('\n📝 Next Steps:');
    console.log('   1. Restart the Cline extension in VS Code');
    console.log('   2. Make sure your MCP config points to:');
    console.log(`      ${simpleMCPPath}`);
    console.log('   3. Test with: "Search for energy efficiency measures"');
    console.log('   4. Or: "Create a new OpenStudio model"');
  } else {
    console.log('❌ SOME TESTS FAILED');
    console.log('Check the failed items above and review the server logs.');
  }
  
  console.log('='.repeat(50));
  
  mcpProcess.kill();
  process.exit(allPassed ? 0 : 1);
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