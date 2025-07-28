#!/usr/bin/env node

/**
 * Test script for OpenStudio MCP Server
 */

const WebSocket = require('ws');

async function testMCPConnection() {
  console.log('Testing OpenStudio MCP Server connection...');
  
  // Test HTTP endpoints first
  try {
    const response = await fetch('http://localhost:3000/health');
    const health = await response.json();
    console.log('✅ Health check:', health);
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
    return;
  }
  
  try {
    const response = await fetch('http://localhost:3000/capabilities');
    const capabilities = await response.json();
    console.log('✅ Capabilities loaded:', capabilities.capabilities.length, 'capabilities');
  } catch (error) {
    console.log('❌ Capabilities check failed:', error.message);
    return;
  }
  
  // Test WebSocket connection
  const ws = new WebSocket('ws://localhost:3000');
  
  ws.on('open', () => {
    console.log('✅ WebSocket connected');
    
    // Test a simple request
    const testRequest = {
      id: 'test-1',
      type: 'openstudio.model.create',
      params: {
        templateType: 'empty',
        path: './test-model.osm'
      }
    };
    
    console.log('📤 Sending test request:', testRequest);
    ws.send(JSON.stringify(testRequest));
    
    // Set a timeout to close connection if no response
    setTimeout(() => {
      if (!receivedTestResponse) {
        console.log('⏰ Timeout waiting for test response');
        ws.close();
      }
    }, 10000);
  });
  
  let receivedCapabilities = false;
  let receivedTestResponse = false;
  
  ws.on('message', (data) => {
    try {
      const response = JSON.parse(data.toString());
      console.log('📥 Received response:', response);
      
      if (response.type === 'capabilities') {
        console.log('✅ Capabilities received');
        receivedCapabilities = true;
      } else if (response.id === 'test-1') {
        receivedTestResponse = true;
        if (response.status === 'success') {
          console.log('✅ Test request successful!');
          if (response.result && response.result.measures) {
            console.log(`📊 Found ${response.result.measures.length} measures`);
          }
        } else {
          console.log('❌ Test request failed:', response.error);
        }
      }
      
      // Close connection after receiving both responses or after timeout
      if (receivedCapabilities && receivedTestResponse) {
        setTimeout(() => ws.close(), 1000);
      }
    } catch (error) {
      console.log('❌ Error parsing response:', error);
      ws.close();
    }
  });
  
  ws.on('error', (error) => {
    console.log('❌ WebSocket error:', error.message);
  });
  
  ws.on('close', () => {
    console.log('🔌 WebSocket connection closed');
    process.exit(0);
  });
}

// Add fetch polyfill for older Node versions
if (!global.fetch) {
  global.fetch = require('node-fetch');
}

testMCPConnection();