#!/bin/sh

# Create directory if it doesn't exist
mkdir -p /app/dist/src/

# Create config file with the actual API base URL
echo "// This file is auto-generated at container startup
window.API_BASE_URL = '${VITE_API_BASE_URL}';" > /app/dist/src/config.js

echo "Generated config.js with API_BASE_URL = ${VITE_API_BASE_URL}"

# Start the server with explicit port
exec serve -s dist -l ${FRONTEND_PORT} --no-clipboard