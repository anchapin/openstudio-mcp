# Standalone Application Packaging

The OpenStudio MCP Server can be packaged as a standalone executable for easy distribution and installation. This document describes how to build and install the standalone application.

## Building the Standalone Application

### Prerequisites

- Node.js 18 or later
- npm 7 or later

### Building

To build the standalone application, run the following commands:

```bash
# Install dependencies
npm install

# Build for all platforms
npm run package:all

# Or build for a specific platform
npm run package:win   # Windows
npm run package:mac   # macOS (Intel and Apple Silicon)
npm run package:linux # Linux
```

The packaged executables will be created in the `bin` directory:

- `bin/openstudio-mcp-server-win.exe` - Windows executable
- `bin/openstudio-mcp-server-mac` - macOS executable (universal binary)
- `bin/openstudio-mcp-server-linux` - Linux executable

## Installation

### Windows

1. Download the Windows executable (`openstudio-mcp-server-win.exe`)
2. Open PowerShell as Administrator
3. Navigate to the directory containing the executable
4. Run the installation script:

```powershell
.\scripts\install-win.ps1
```

### macOS

1. Download the macOS executable (`openstudio-mcp-server-mac`)
2. Open Terminal
3. Navigate to the directory containing the executable
4. Run the installation script:

```bash
./scripts/install.sh
```

### Linux

1. Download the Linux executable (`openstudio-mcp-server-linux`)
2. Open Terminal
3. Navigate to the directory containing the executable
4. Run the installation script as root:

```bash
sudo ./scripts/install.sh
```

## Configuration

The standalone application uses a configuration file located at:

- Windows: `%USERPROFILE%\.openstudio-mcp-server\.env`
- macOS/Linux: `~/.openstudio-mcp-server/.env`

You can generate a default configuration file by running:

```bash
openstudio-mcp-server --generate-config
```

Or specify a custom configuration file:

```bash
openstudio-mcp-server --config /path/to/config
```

## Command Line Options

The standalone application supports the following command line options:

- `--config <path>`: Path to configuration file
- `--generate-config`: Generate a default configuration file
- `--help`, `-h`: Show help message

## Running the Server

After installation, you can run the server by executing:

```bash
openstudio-mcp-server
```

The server will start and listen on the configured port (default: 3000).