#!/usr/bin/env node

/**
 * Final test of BCL search via MCP for Cline
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🎉 Final BCL Search Test for Cline\n');

const simpleMCPPath = path.join(__dirname, 'mcp-simple-server.js');

const mcpProcess = spawn('node', [simpleMCPPath], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let testResults = {
  searchWorking: false,
  measuresFound: 0,
  responseTime: 0
};

mcpProcess.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    try {
      const response = JSON.parse(line);
      
      if (response.id === 1 && response.result) {
        testResults.searchWorking = true;
        
        if (response.result.content && response.result.content[0]) {
          const resultText = response.result.content[0].text;
          const resultData = JSON.parse(resultText);
          
          testResults.measuresFound = resultData.measures.length;
          
          console.log('✅ BCL Search Results:');
          console.log(`   Query: "${resultData.query}"`);
          console.log(`   Total Found: ${resultData.totalFound}`);
          console.log(`   Returned: ${resultData.measures.length} measures`);
          
          if (resultData.measures.length > 0) {
            console.log('\n📋 Sample Measures:');
            resultData.measures.slice(0, 2).forEach((measure, index) => {
              console.log(`   ${index + 1}. ${measure.name}`);
              console.log(`      ID: ${measure.id}`);
              console.log(`      Description: ${measure.description.substring(0, 80)}...`);
            });
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

// Test different search queries
const testQueries = [
  { query: 'energy efficiency', limit: 3 },
  { query: 'lighting', limit: 2 },
  { query: 'hvac', limit: 2 }
];

let currentTest = 0;

function runNextTest() {
  if (currentTest >= testQueries.length) {
    // All tests complete
    setTimeout(() => {
      console.log('\n' + '='.repeat(50));
      console.log('🏁 FINAL BCL TEST RESULTS');
      console.log('='.repeat(50));
      
      console.log(`✅ BCL Search Working: ${testResults.searchWorking ? 'YES' : 'NO'}`);
      console.log(`✅ Measures Found: ${testResults.measuresFound}`);
      
      if (testResults.searchWorking && testResults.measuresFound > 0) {
        console.log('\n🎉 SUCCESS! BCL search is fully working!');
        console.log('\n📝 You can now ask Cline:');
        console.log('   • "Search for energy efficiency measures"');
        console.log('   • "Find lighting improvement measures"');
        console.log('   • "Show me HVAC optimization measures"');
        console.log('   • "Recommend measures for building energy savings"');
      } else {
        console.log('\n❌ BCL search is not working properly');
      }
      
      console.log('='.repeat(50));
      
      mcpProcess.kill();
      process.exit(testResults.searchWorking ? 0 : 1);
    }, 1000);
    return;
  }
  
  const test = testQueries[currentTest];
  console.log(`\n🔍 Test ${currentTest + 1}: Searching for "${test.query}"...`);
  
  const toolCallRequest = {
    jsonrpc: '2.0',
    id: currentTest + 1,
    method: 'tools/call',
    params: {
      name: 'openstudio.bcl.search',
      arguments: test
    }
  };
  
  mcpProcess.stdin.write(JSON.stringify(toolCallRequest) + '\n');
  currentTest++;
  
  // Run next test after delay
  setTimeout(runNextTest, 3000);
}

// Start tests
setTimeout(() => {
  console.log('🚀 Starting BCL search tests...');
  runNextTest();
}, 1000);

mcpProcess.on('close', (code) => {
  console.log(`\nMCP process exited with code ${code}`);
});

// Handle cleanup
process.on('SIGINT', () => {
  console.log('\nCleaning up...');
  mcpProcess.kill();
  process.exit(0);
});