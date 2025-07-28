# OpenStudio MCP Setup for GitHub Copilot in VS Code

This guide will help you connect your OpenStudio MCP server to GitHub Copilot in VS Code.

## Prerequisites

1. **OpenStudio MCP Server** - Your server should be built and ready to run
2. **VS Code** with GitHub Copilot extension installed
3. **Node.js** (v18 or higher)

## Step 1: Build and Test Your MCP Server

```bash
# Build the project
npm run build

# Test the server
node test-mcp-connection.js
```

You should see:
- ✅ Health check successful
- ✅ Capabilities loaded
- ✅ WebSocket connected

## Step 2: Configure MCP for VS Code

Based on the GitHub community discussion, VS Code expects a specific configuration format. Here are the correct configurations:

### Option A: User-Level Configuration (Recommended)

Create the MCP configuration file at the correct location for your OS:

**macOS**: `~/Library/Application Support/Code/User/mcp.json`
**Linux**: `~/.config/Code/User/mcp.json`  
**Windows**: `%APPDATA%\Code\User\mcp.json`

```json
{
  "servers": {
    "openstudio-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/your/openstudio-mcp/mcp-simple-server.js"],
      "env": {
        "NODE_ENV": "production"
      },
      "tools": [
        "openstudio.model.create",
        "openstudio.model.info", 
        "openstudio.bcl.search",
        "openstudio.bcl.recommend",
        "openstudio.simulation.run"
      ]
    }
  },
  "inputs": []
}
```

### Option B: Workspace Configuration

Create `.vscode/mcp.json` in your project root:

```json
{
  "servers": {
    "openstudio-mcp": {
      "command": "node",
      "args": ["./mcp-simple-server.js"],
      "cwd": "/absolute/path/to/your/openstudio-mcp",
      "env": {
        "NODE_ENV": "production"
      },
      "tools": [
        "openstudio.model.create",
        "openstudio.model.info",
        "openstudio.bcl.search",
        "openstudio.bcl.recommend"
      ]
    }
  },
  "inputs": []
}
```

### Option C: HTTP Server Configuration (Alternative)

If the stdio approach doesn't work, you can configure your server as an HTTP MCP server:

```json
{
  "servers": {
    "openstudio-mcp": {
      "url": "http://localhost:3000/mcp/",
      "type": "http",
      "tools": [
        "openstudio.model.create",
        "openstudio.model.info",
        "openstudio.bcl.search",
        "openstudio.bcl.recommend"
      ]
    }
  },
  "inputs": []
}
```

## Step 3: Create Tool Sets (Optional but Recommended)

Based on the community discussion, create a tool sets file to help VS Code recognize your tools better.

Create the file at the appropriate location:
- **macOS**: `~/Library/Application Support/Code/User/prompts/openstudio-mcp.toolsets.jsonc`
- **Linux**: `~/.config/Code/User/prompts/openstudio-mcp.toolsets.jsonc`
- **Windows**: `%APPDATA%\Code\User\prompts\openstudio-mcp.toolsets.jsonc`

Copy the contents from `openstudio-mcp.toolsets.jsonc` in your project.

## Step 4: Start the MCP Server

In one terminal, start your OpenStudio MCP server:

```bash
npm start
```

The server should start on port 3000 and show:
```
OpenStudio MCP Server running on port 3000
```

## Step 5: Test the MCP Connection

Test both the WebSocket and HTTP endpoints:

```bash
# Test WebSocket connection
node test-mcp-connection.js

# Test HTTP MCP endpoint
curl -X POST http://localhost:3000/mcp/tools/list
```

## Step 6: Configure VS Code

1. Open VS Code
2. Open Command Palette (`Cmd+Shift+P` on macOS, `Ctrl+Shift+P` on Windows/Linux)
3. Search for "MCP" or "Copilot" commands
4. Look for MCP server management options
5. Verify your OpenStudio MCP server is listed and enabled

## Step 7: Test with GitHub Copilot

Once configured, you can ask Copilot questions like:

### Model Creation
- "Create a new OpenStudio office building model"
- "Create an empty OpenStudio model at ./my-building.osm"

### Model Analysis
- "Get information about this OpenStudio model"
- "Analyze the building components in this model"

### BCL Integration
- "Search for HVAC measures in the Building Component Library"
- "Find lighting efficiency measures"
- "Recommend measures for energy efficiency improvements"

### Simulation
- "Run a simulation on this OpenStudio model"
- "Configure and run an energy simulation"

## Available MCP Tools

Your OpenStudio MCP server provides these tools:

1. **openstudio.model.create** - Create new OpenStudio models
2. **openstudio.model.open** - Open existing models
3. **openstudio.model.save** - Save models
4. **openstudio.model.info** - Get model information
5. **openstudio.simulation.run** - Run energy simulations
6. **openstudio.bcl.search** - Search Building Component Library
7. **openstudio.bcl.download** - Download BCL measures
8. **openstudio.bcl.recommend** - Get measure recommendations
9. **openstudio.measure.apply** - Apply measures to models

## Troubleshooting

### Server Not Starting
- Check that OpenStudio CLI is installed and accessible
- Verify the `OPENSTUDIO_CLI_PATH` in your `.env` file
- Test with: `/Applications/OpenStudio-3.10.0-rc4/bin/openstudio --version`

### MCP Connection Issues
- Ensure the server is running on port 3000
- Test the WebSocket connection: `node test-mcp-connection.js`
- Check VS Code's MCP server status in the command palette

### Timeout Errors
If you see "Request timed out" errors in VS Code logs:
- Use `mcp-simple-server.js` instead of `mcp-stdio-server.js`
- Test response times: `node test-simple-mcp.js`
- Ensure your OpenStudio server is running: `npm start`
- Check VS Code extension logs for specific error details

### Permission Issues
- Make sure the `mcp-client-wrapper.js` file is executable
- Check that Node.js can access the wrapper script
- Verify file paths are absolute in the MCP configuration

### OpenStudio Command Failures
- Verify OpenStudio installation
- Check file permissions for model files
- Ensure sufficient disk space for model operations

## Example Interactions

### Creating a Model
```
User: "Create a new office building model"
Copilot: I'll create a new OpenStudio office building model for you.
[Uses openstudio.model.create with templateType: "office"]
```

### Searching BCL
```
User: "Find measures for improving lighting efficiency"
Copilot: I'll search the Building Component Library for lighting efficiency measures.
[Uses openstudio.bcl.search with query: "lighting efficiency"]
```

### Running Simulation
```
User: "Run an energy simulation on this model"
Copilot: I'll configure and run an energy simulation on your OpenStudio model.
[Uses openstudio.simulation.run with the current model]
```

## Advanced Configuration

### Custom Environment Variables
```json
{
  "mcpServers": {
    "openstudio-mcp": {
      "command": "node",
      "args": ["./mcp-client-wrapper.js"],
      "env": {
        "OPENSTUDIO_CLI_PATH": "/custom/path/to/openstudio",
        "BCL_API_URL": "https://bcl.nrel.gov/api/v1",
        "LOG_LEVEL": "debug"
      }
    }
  }
}
```

### Auto-Approval Settings
Add tools to `autoApprove` array to skip confirmation prompts:
```json
"autoApprove": [
  "openstudio.model.info",
  "openstudio.bcl.search",
  "openstudio.bcl.recommend"
]
```

## Security Considerations

- The MCP server validates all file paths to prevent directory traversal
- Commands are restricted to OpenStudio CLI operations only
- Consider running in a sandboxed environment for production use
- Review auto-approved tools carefully

## Support

If you encounter issues:
1. Check the server logs for error messages
2. Test the WebSocket connection independently
3. Verify OpenStudio CLI accessibility
4. Review VS Code's MCP server status