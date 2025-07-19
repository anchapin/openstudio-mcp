#!/bin/bash

# Run tests with timeout
node "$(dirname "$0")/run-tests-with-timeout.js"

# Check if tests timed out
if [ $? -eq 143 ] || [ $? -eq 130 ]; then
  echo "Tests timed out. Check test-debug.log for more information."
  exit 1
fi
