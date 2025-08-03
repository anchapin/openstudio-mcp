# OpenStudio MCP

A standalone server that provides OpenStudio CLI functionality through a standardized MCP (Model Context Protocol) interface. This tool enables AI assistants to interact with OpenStudio's capabilities, allowing users to perform building energy modeling tasks through natural language requests.

## Prerequisites

- Node.js (v18 or higher)
- OpenStudio CLI installed and available in your PATH

## Installation

### Standard Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/anchapin/openstudio-mcp.git
   cd openstudio-mcp
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory with your configuration:
   ```
   PORT=3000
   OPENSTUDIO_CLI_PATH=/path/to/openstudio
   LOG_LEVEL=info
   ```

### Standalone Application

OpenStudio MCP can be installed as a standalone application:

#### Windows
```powershell
.\scripts\install-win.ps1
```

#### macOS/Linux
```bash
./scripts/install.sh
```

For more details, see [Standalone Application Packaging](docs/standalone-packaging.md).

### Docker Container

OpenStudio MCP can be run as a Docker container:

```bash
docker-compose up -d
```

For more details, see [Docker Containerization](docs/docker-containerization.md).

## Development

Start the development server with hot reloading:
```bash
npm run dev
```

### CI/CD

This project uses GitHub Actions for continuous integration and deployment:

- **CI Workflow**: Automatically runs linting, building, and testing on push to main and pull requests
- **Release Workflow**: Automatically builds and packages the application when a new version tag is pushed
- **Docker Workflow**: Builds and publishes Docker images to GitHub Container Registry
- **Dependency Review**: Scans dependencies for security vulnerabilities on pull requests

## Building

Build the project:
```bash
npm run build
```

## Running

Start the server:
```bash
npm start
```

## Packaging

### Standalone Application

Package the application as a standalone executable:

```bash
# Package for all platforms
npm run package:all

# Package for specific platforms
npm run package:win   # Windows
npm run package:mac   # macOS
npm run package:linux # Linux
```

### Docker Image

Build the Docker image:

```bash
docker build -t openstudio-mcp .
```

## Testing

Run tests:
```bash
npm test
```

Run tests with coverage:
```bash
npm run test:coverage
```

For more detailed testing information, see [Testing Guide](docs/testing.md).

## Linting and Formatting

Lint the code:
```bash
npm run lint
```

Format the code:
```bash
npm run format
```

## Documentation

- [API Documentation](docs/api.md)
- [Developer Guide](docs/developer-guide.md)
- [Installation Guide](docs/installation.md)
- [Standalone Application Packaging](docs/standalone-packaging.md)
- [Docker Containerization](docs/docker-containerization.md)

## License

MIT