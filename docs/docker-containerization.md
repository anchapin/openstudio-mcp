# Docker Containerization

The OpenStudio MCP Server can be run as a Docker container, which provides an isolated environment with all dependencies pre-installed, including OpenStudio.

## Prerequisites

- Docker Engine 20.10.0 or later
- Docker Compose 2.0.0 or later (optional, but recommended)

## Building the Docker Image

To build the Docker image, run the following command from the project root directory:

```bash
docker build -t openstudio-mcp-server .
```

This will create a Docker image named `openstudio-mcp-server` with the latest tag.

## Running the Container

### Using Docker Run

To run the container using Docker directly:

```bash
docker run -d \
  --name openstudio-mcp-server \
  -p 3000:3000 \
  -v $(pwd)/measures:/app/measures \
  -v $(pwd)/temp:/app/temp \
  openstudio-mcp-server
```

### Using Docker Compose

A Docker Compose file is provided for easier management. To start the container using Docker Compose:

```bash
docker-compose up -d
```

To stop the container:

```bash
docker-compose down
```

## Configuration

The Docker container can be configured using environment variables. The following environment variables are available:

- `PORT`: The port the server will listen on (default: 3000)
- `HOST`: The host the server will bind to (default: 0.0.0.0)
- `OPENSTUDIO_CLI_PATH`: Path to the OpenStudio CLI executable (default: /usr/local/openstudio-3.7.0/bin/openstudio)
- `OPENSTUDIO_TIMEOUT`: Timeout for OpenStudio commands in milliseconds (default: 300000)
- `BCL_API_URL`: URL for the Building Component Library API (default: https://bcl.nrel.gov/api/v1)
- `BCL_MEASURES_DIR`: Directory for storing BCL measures (default: /app/measures)
- `LOG_LEVEL`: Logging level (default: info)

You can set these environment variables in the Docker Compose file or when running the container with Docker run:

```bash
docker run -d \
  --name openstudio-mcp-server \
  -p 3000:3000 \
  -e PORT=3000 \
  -e LOG_LEVEL=debug \
  -v $(pwd)/measures:/app/measures \
  -v $(pwd)/temp:/app/temp \
  openstudio-mcp-server
```

## Volumes

The Docker container uses two volumes:

1. `/app/measures`: Directory for storing BCL measures
2. `/app/temp`: Directory for temporary files

These volumes are mounted from the host to persist data between container restarts.

## Health Check

The Docker container includes a health check that periodically checks if the server is running. You can check the health status using:

```bash
docker ps
```

The health status will be displayed in the STATUS column.

## Updating the Container

To update the container with a new version of the OpenStudio MCP Server:

1. Pull the latest code
2. Rebuild the Docker image
3. Restart the container

```bash
git pull
docker-compose build
docker-compose up -d
```

## Troubleshooting

### Viewing Logs

To view the container logs:

```bash
docker logs openstudio-mcp-server
```

Or with Docker Compose:

```bash
docker-compose logs
```

### Accessing the Container Shell

To access the container shell for debugging:

```bash
docker exec -it openstudio-mcp-server /bin/bash
```

### Common Issues

1. **Port Conflict**: If port 3000 is already in use on your host, change the port mapping in the Docker Compose file or Docker run command.

2. **Permission Issues**: If you encounter permission issues with the mounted volumes, ensure that the host directories have the correct permissions.

3. **OpenStudio Not Found**: If the OpenStudio CLI is not found, check the `OPENSTUDIO_CLI_PATH` environment variable and ensure it points to the correct location in the container.