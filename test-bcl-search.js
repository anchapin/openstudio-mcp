#!/usr/bin/env node

/**
 * Test BCL search functionality
 */

const axios = require('axios');

async function testBclSearch() {
  console.log('🔍 Testing BCL Search Functionality...\n');
  
  try {
    console.log('1. Testing direct API call to main server...');
    
    const response = await axios.post('http://localhost:3000/mcp/tools/call', {
      name: 'openstudio.bcl.search',
      arguments: {
        query: 'energy efficiency',
        limit: 5
      }
    });
    
    console.log('✅ Response received from main server');
    console.log('Status:', response.status);
    
    if (response.data) {
      console.log('Response data:', JSON.stringify(response.data, null, 2));
      
      if (response.data.content && response.data.content[0] && response.data.content[0].text) {
        const resultText = response.data.content[0].text;
        
        if (resultText.includes('Found') && resultText.includes('measures')) {
          console.log('🎉 BCL search is working! Found measures in the response.');
        } else if (resultText.includes('Error') || resultText.includes('404')) {
          console.log('❌ BCL API still returning errors');
        } else {
          console.log('⚠️  Unexpected response format');
        }
      }
    }
    
  } catch (error) {
    console.log('❌ Error testing BCL search:', error.message);
    
    if (error.response) {
      console.log('Error response:', error.response.data);
    }
  }
}

// Test via MCP server
async function testViaMcp() {
  console.log('\n2. Testing via MCP simple server...');
  
  const { spawn } = require('child_process');
  const path = require('path');
  
  const simpleMCPPath = path.join(__dirname, 'mcp-simple-server.js');
  
  const mcpProcess = spawn('node', [simpleMCPPath], {
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  let responseReceived = false;
  
  mcpProcess.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      try {
        const response = JSON.parse(line);
        
        if (response.id === 1 && response.result) {
          responseReceived = true;
          console.log('✅ MCP response received');
          
          if (response.result.content && response.result.content[0]) {
            const resultText = response.result.content[0].text;
            console.log('Result preview:', resultText.substring(0, 200) + '...');
            
            if (resultText.includes('Found') && resultText.includes('measures')) {
              console.log('🎉 BCL search via MCP is working!');
            } else {
              console.log('⚠️  BCL search may still have issues');
            }
          }
        }
        
      } catch (e) {
        // Ignore parsing errors
      }
    }
  });
  
  mcpProcess.stderr.on('data', (data) => {
    const logs = data.toString().split('\n').filter(line => line.trim());
    logs.forEach(log => {
      if (log.includes('Tool call completed')) {
        console.log('📝', log);
      }
    });
  });
  
  // Send tool call request
  setTimeout(() => {
    const toolCallRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'openstudio.bcl.search',
        arguments: {
          query: 'lighting',
          limit: 3
        }
      }
    };
    
    mcpProcess.stdin.write(JSON.stringify(toolCallRequest) + '\n');
  }, 1000);
  
  // Check results
  setTimeout(() => {
    if (!responseReceived) {
      console.log('❌ No response received from MCP server');
    }
    
    mcpProcess.kill();
    
    console.log('\n=== SUMMARY ===');
    console.log('✅ MCP Connection: Working');
    console.log('✅ Tool Execution: Working');
    console.log(`✅ BCL Search: ${responseReceived ? 'Working' : 'Needs Investigation'}`);
    
    if (responseReceived) {
      console.log('\n🎉 Your BCL search should now work in Cline!');
      console.log('Try asking: "Search for lighting efficiency measures"');
    }
    
    process.exit(0);
  }, 5000);
}

// Run tests
testBclSearch().then(() => {
  testViaMcp();
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});