#!/bin/bash

# Set a timeout for the tests (in seconds)
TIMEOUT=30

# Run the tests with a timeout
timeout $TIMEOUT npm run test:unit

# Check the exit code
EXIT_CODE=$?

# If the timeout was reached (exit code 124), kill any hanging processes
if [ $EXIT_CODE -eq 124 ]; then
  echo "Tests timed out after $TIMEOUT seconds. Killing any hanging processes..."
  
  # Find and kill any node processes related to vitest
  pkill -f "vitest"
  
  # Exit with an error code
  exit 1
else
  # Exit with the original exit code
  exit $EXIT_CODE
fi
