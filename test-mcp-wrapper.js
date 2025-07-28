#!/usr/bin/env node

/**
 * Test script for MCP Client Wrapper
 */

const { spawn } = require('child_process');
const path = require('path');

async function testMCPWrapper() {
  console.log('Testing MCP Client Wrapper...');
  
  // Start the MCP wrapper
  const wrapper = spawn('node', ['mcp-client-wrapper.js'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  let responses = [];
  
  wrapper.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => {
      try {
        const response = JSON.parse(line);
        responses.push(response);
        console.log('📥 Received:', JSON.stringify(response, null, 2));
      } catch (error) {
        console.log('📥 Raw output:', line);
      }
    });
  });
  
  wrapper.stderr.on('data', (data) => {
    console.log('🔍 Stderr:', data.toString());
  });
  
  wrapper.on('close', (code) => {
    console.log(`🔌 Wrapper closed with code ${code}`);
  });
  
  // Wait for connection
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test 1: Request capabilities
  console.log('📤 Testing capabilities request...');
  const capabilitiesRequest = {
    id: 'test-capabilities',
    method: 'tools/list'
  };
  wrapper.stdin.write(JSON.stringify(capabilitiesRequest) + '\n');
  
  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test 2: Test BCL search
  console.log('📤 Testing BCL search...');
  const searchRequest = {
    id: 'test-search',
    type: 'openstudio.bcl.search',
    params: {
      query: 'lighting',
      limit: 3
    }
  };
  wrapper.stdin.write(JSON.stringify(searchRequest) + '\n');
  
  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Test 3: Test model creation
  console.log('📤 Testing model creation...');
  const modelRequest = {
    id: 'test-model',
    type: 'openstudio.model.create',
    params: {
      templateType: 'empty',
      path: './test-wrapper-model.osm'
    }
  };
  wrapper.stdin.write(JSON.stringify(modelRequest) + '\n');
  
  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Close the wrapper
  wrapper.kill('SIGTERM');
  
  console.log(`\n📊 Test Summary:`);
  console.log(`- Total responses: ${responses.length}`);
  console.log(`- Capabilities received: ${responses.some(r => r.type === 'capabilities')}`);
  console.log(`- Search response received: ${responses.some(r => r.id === 'test-search')}`);
  console.log(`- Model response received: ${responses.some(r => r.id === 'test-model')}`);
}

testMCPWrapper().catch(console.error);