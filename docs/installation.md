# OpenStudio MCP Server - Installation and Setup Guide

This guide provides detailed instructions for installing, configuring, and running the OpenStudio MCP Server.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation Methods](#installation-methods)
  - [Local Installation](#local-installation)
  - [Docker Installation](#docker-installation)
- [Configuration](#configuration)
  - [Environment Variables](#environment-variables)
  - [Advanced Configuration](#advanced-configuration)
- [Running the Server](#running-the-server)
  - [Development Mode](#development-mode)
  - [Production Mode](#production-mode)
- [Verifying Installation](#verifying-installation)
- [Troubleshooting](#troubleshooting)
  - [Common Issues](#common-issues)
  - [Logs and Debugging](#logs-and-debugging)

## Prerequisites

Before installing the OpenStudio MCP Server, ensure you have the following prerequisites:

- **Node.js**: Version 18.0.0 or higher
  - [Download Node.js](https://nodejs.org/)
  - Verify installation: `node --version`

- **OpenStudio CLI**: Must be installed and available in your PATH
  - [Download OpenStudio](https://openstudio.net/downloads)
  - Verify installation: `openstudio --version`

- **Git**: Required for cloning the repository (optional if downloading as ZIP)
  - [Download Git](https://git-scm.com/downloads)
  - Verify installation: `git --version`

## Installation Methods

### Local Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-org/openstudio-mcp-server.git
   cd openstudio-mcp-server
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Create configuration file**:
   ```bash
   cp .env.example .env
   ```

4. **Edit the `.env` file** with your specific configuration (see [Configuration](#configuration) section).

5. **Build the application**:
   ```bash
   npm run build
   ```

### Docker Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-org/openstudio-mcp-server.git
   cd openstudio-mcp-server
   ```

2. **Build the Docker image**:
   ```bash
   docker build -t openstudio-mcp-server .
   ```

3. **Create a `.env` file** for Docker:
   ```bash
   cp .env.example .env.docker
   ```

4. **Edit the `.env.docker` file** with your specific configuration.

5. **Run the Docker container**:
   ```bash
   docker run -p 3000:3000 --env-file .env.docker openstudio-mcp-server
   ```

   > **Note**: If you need to use OpenStudio installed on your host machine, you'll need to mount it into the container:
   > ```bash
   > docker run -p 3000:3000 --env-file .env.docker -v /path/to/openstudio:/opt/openstudio openstudio-mcp-server
   > ```
   > And set `OPENSTUDIO_CLI_PATH=/opt/openstudio/bin/openstudio` in your `.env.docker` file.

## Configuration

### Environment Variables

The OpenStudio MCP Server uses environment variables for configuration. These can be set in a `.env` file or directly in your environment.

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Port number for the server | `3000` | No |
| `HOST` | Host address to bind the server | `0.0.0.0` | No |
| `OPENSTUDIO_CLI_PATH` | Path to the OpenStudio CLI executable | `openstudio` | Yes |
| `OPENSTUDIO_TIMEOUT` | Timeout for OpenStudio commands (ms) | `300000` | No |
| `BCL_API_URL` | URL for the Building Component Library API | `https://bcl.nrel.gov/api/v1` | No |
| `BCL_MEASURES_DIR` | Directory to store downloaded BCL measures | `./measures` | No |
| `LOG_LEVEL` | Logging level (error, warn, info, debug, trace) | `info` | No |

### Advanced Configuration

#### Custom Measure Directories

You can add custom measure directories by creating a `measures.json` file in the root directory:

```json
{
  "measureDirectories": [
    "./measures",
    "/path/to/custom/measures"
  ]
}
```

#### Resource Limits

To configure resource limits for OpenStudio processes, add the following to your `.env` file:

```
MAX_CONCURRENT_PROCESSES=3
MAX_MEMORY_PER_PROCESS=2048
```

## Running the Server

### Development Mode

For development with hot reloading:

```bash
npm run dev
```

### Production Mode

For production deployment:

```bash
npm start
```

Or with PM2 for process management:

```bash
npm install -g pm2
pm2 start npm --name "openstudio-mcp" -- start
```

## Verifying Installation

To verify that the server is running correctly:

1. **Check the server status**:
   ```bash
   curl http://localhost:3000/health
   ```
   
   Expected response:
   ```json
   {"status":"ok","version":"0.1.0"}
   ```

2. **Test a simple OpenStudio command**:
   ```bash
   curl -X POST http://localhost:3000/api/v1/openstudio/version
   ```
   
   Expected response:
   ```json
   {"status":"success","result":{"version":"3.6.0"}}
   ```

## Troubleshooting

### Common Issues

#### OpenStudio Not Found

**Symptom**: Error message: "OpenStudio CLI not found"

**Solution**:
1. Verify that OpenStudio is installed: `openstudio --version`
2. Check that the path in `OPENSTUDIO_CLI_PATH` is correct
3. If using Docker, ensure OpenStudio is mounted correctly

#### Port Already in Use

**Symptom**: Error message: "EADDRINUSE: address already in use :::3000"

**Solution**:
1. Change the port in the `.env` file
2. Stop any other services using port 3000
3. Verify with: `lsof -i :3000` (Unix/Mac) or `netstat -ano | findstr :3000` (Windows)

#### Permission Issues with Measure Directory

**Symptom**: Error when downloading or accessing measures

**Solution**:
1. Check permissions on the measures directory: `ls -la ./measures`
2. Ensure the user running the server has write access
3. Create the directory manually if it doesn't exist: `mkdir -p ./measures`

### Logs and Debugging

#### Viewing Logs

The server logs to the console by default. To save logs to a file:

```bash
npm start > server.log 2>&1
```

#### Increasing Log Detail

To get more detailed logs, change the `LOG_LEVEL` in your `.env` file:

```
LOG_LEVEL=debug
```

#### Debug Mode

For even more detailed debugging:

```bash
DEBUG=openstudio-mcp:* npm start
```

#### Health Check Endpoint

The server provides a health check endpoint at `/health` that returns the current status and version.

---

If you encounter issues not covered in this guide, please [open an issue](https://github.com/your-org/openstudio-mcp-server/issues) on the GitHub repository.