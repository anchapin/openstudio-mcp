#!/usr/bin/env node

/**
 * Debug BCL API calls
 */

const axios = require('axios');

async function testBclDirect() {
  console.log('🔍 Testing BCL API directly...\n');
  
  try {
    // Test the exact URL that should work
    const testUrl = 'https://bcl.nrel.gov/api/search?fq[]=bundle:nrel_measure&api_version=2.0&show_rows=3&q=lighting';
    console.log('Testing URL:', testUrl);
    
    const response = await axios.get(testUrl, {
      timeout: 10000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'OpenStudio-MCP-Server/0.1.0'
      }
    });
    
    console.log('✅ Direct API call successful!');
    console.log('Status:', response.status);
    console.log('Total results:', response.data.total_results);
    console.log('Complete results count:', response.data.complete_results_count);
    
    if (response.data.result && response.data.result.length > 0) {
      console.log('\nFirst measure:');
      const firstMeasure = response.data.result[0].measure;
      console.log('- Name:', firstMeasure.display_name || firstMeasure.name);
      console.log('- UUID:', firstMeasure.uuid);
      console.log('- Description:', firstMeasure.description.substring(0, 100) + '...');
    }
    
    return true;
  } catch (error) {
    console.log('❌ Direct API call failed:', error.message);
    if (error.response) {
      console.log('Response status:', error.response.status);
      console.log('Response data:', error.response.data);
    }
    return false;
  }
}

async function testViaServer() {
  console.log('\n🔍 Testing via OpenStudio MCP server...\n');
  
  try {
    const response = await axios.post('http://localhost:3000/mcp/tools/call', {
      name: 'openstudio.bcl.search',
      arguments: {
        query: 'lighting',
        limit: 3
      }
    }, {
      timeout: 15000
    });
    
    console.log('✅ Server call successful!');
    console.log('Status:', response.status);
    
    if (response.data && response.data.content && response.data.content[0]) {
      const resultText = response.data.content[0].text;
      const resultData = JSON.parse(resultText);
      
      console.log('Query:', resultData.query);
      console.log('Total found:', resultData.totalFound);
      console.log('Measures count:', resultData.measures.length);
      
      if (resultData.measures.length > 0) {
        console.log('\nFirst measure from server:');
        const firstMeasure = resultData.measures[0];
        console.log('- Name:', firstMeasure.name);
        console.log('- ID:', firstMeasure.id);
        console.log('- Description:', firstMeasure.description.substring(0, 100) + '...');
      }
    }
    
    return true;
  } catch (error) {
    console.log('❌ Server call failed:', error.message);
    if (error.response) {
      console.log('Response status:', error.response.status);
      console.log('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
}

async function main() {
  console.log('🧪 BCL API Debug Test\n');
  
  const directSuccess = await testBclDirect();
  const serverSuccess = await testViaServer();
  
  console.log('\n=== RESULTS ===');
  console.log(`Direct BCL API: ${directSuccess ? '✅ Working' : '❌ Failed'}`);
  console.log(`Via MCP Server: ${serverSuccess ? '✅ Working' : '❌ Failed'}`);
  
  if (directSuccess && !serverSuccess) {
    console.log('\n🔧 The BCL API works directly but not via the server.');
    console.log('This suggests an issue with the server\'s HTTP client configuration.');
  } else if (directSuccess && serverSuccess) {
    console.log('\n🎉 Both direct API and server are working!');
    console.log('The BCL search should work in Cline now.');
  } else if (!directSuccess) {
    console.log('\n⚠️  The BCL API itself is not responding.');
    console.log('This might be a temporary issue with the BCL service.');
  }
}

main().catch(console.error);