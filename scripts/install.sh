#!/bin/bash
# OpenStudio MCP Server Installation Script for macOS and Linux

# Exit on error
set -e

# Detect OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
    INSTALL_DIR="/usr/local/bin"
    CONFIG_DIR="$HOME/.openstudio-mcp-server"
    BINARY_NAME="openstudio-mcp-server-mac"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
    INSTALL_DIR="/usr/local/bin"
    CONFIG_DIR="$HOME/.openstudio-mcp-server"
    BINARY_NAME="openstudio-mcp-server-linux"
else
    echo "Unsupported operating system: $OSTYPE"
    exit 1
fi

# Check if running as root for Linux
if [[ "$OS" == "linux" && $EUID -ne 0 ]]; then
    echo "This script must be run as root on Linux" 
    exit 1
fi

# Create directories
echo "Creating installation directories..."
mkdir -p "$CONFIG_DIR"
mkdir -p "$CONFIG_DIR/measures"

# Copy executable
echo "Installing OpenStudio MCP Server..."
cp "./bin/$BINARY_NAME" "$INSTALL_DIR/openstudio-mcp-server"
chmod +x "$INSTALL_DIR/openstudio-mcp-server"

# Create default configuration if it doesn't exist
if [ ! -f "$CONFIG_DIR/.env" ]; then
    echo "Creating default configuration..."
    "$INSTALL_DIR/openstudio-mcp-server" --generate-config
    
    # Move the generated config to the user config directory
    if [ -f "./.env" ]; then
        mv "./.env" "$CONFIG_DIR/.env"
    fi
fi

echo "Installation complete!"
echo "OpenStudio MCP Server has been installed to: $INSTALL_DIR/openstudio-mcp-server"
echo "Configuration directory: $CONFIG_DIR"
echo "You can now run 'openstudio-mcp-server' from the command line."