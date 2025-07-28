#!/usr/bin/env node

/**
 * Validate MCP configuration files
 */

const fs = require('fs');
const path = require('path');

function validateJSON(filePath, description) {
  console.log(`\n📋 Validating ${description}...`);
  
  if (!fs.existsSync(filePath)) {
    console.log(`❌ File not found: ${filePath}`);
    return false;
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const config = JSON.parse(content);
    
    console.log(`✅ Valid JSON structure`);
    
    // Check for common MCP schema patterns
    if (config.mcpServers) {
      console.log(`📦 Found mcpServers with ${Object.keys(config.mcpServers).length} servers`);
      
      // Validate each server
      for (const [name, server] of Object.entries(config.mcpServers)) {
        console.log(`  - ${name}: ${server.command ? '✅ has command' : '❌ missing command'}`);
        if (server.args) {
          console.log(`    Args: ${server.args.length} arguments`);
        }
        if (server.disabled !== undefined) {
          console.log(`    Status: ${server.disabled ? 'disabled' : 'enabled'}`);
        }
      }
    } else if (config.servers) {
      console.log(`📦 Found servers with ${Object.keys(config.servers).length} servers`);
      
      // Validate each server
      for (const [name, server] of Object.entries(config.servers)) {
        console.log(`  - ${name}: ${server.command || server.url ? '✅ has command/url' : '❌ missing command/url'}`);
        if (server.type) {
          console.log(`    Type: ${server.type}`);
        }
      }
    } else {
      console.log(`⚠️ No recognized server configuration found`);
    }
    
    return true;
  } catch (error) {
    console.log(`❌ JSON Parse Error: ${error.message}`);
    return false;
  }
}

function main() {
  console.log('🔍 MCP Configuration Validator');
  
  const configs = [
    {
      path: path.expanduser('~/Library/Application Support/Code/User/mcp.json'),
      description: 'Global MCP Config'
    },
    {
      path: '.vscode/mcp.json',
      description: 'Workspace MCP Config'
    }
  ];
  
  let allValid = true;
  
  for (const config of configs) {
    const isValid = validateJSON(config.path, config.description);
    allValid = allValid && isValid;
  }
  
  console.log(`\n📊 Overall Status: ${allValid ? '✅ All configs valid' : '❌ Some configs have issues'}`);
  
  if (allValid) {
    console.log('\n💡 If you\'re still seeing schema errors:');
    console.log('1. Restart VS Code completely');
    console.log('2. Check which extension is showing the error');
    console.log('3. Try disabling/re-enabling MCP-related extensions');
  }
}

// Simple path expansion for ~ 
path.expanduser = function(p) {
  if (p.startsWith('~/')) {
    return p.replace('~', require('os').homedir());
  }
  return p;
};

main();