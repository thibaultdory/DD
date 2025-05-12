#!/bin/sh

# Create config file with the actual API base URL
echo "// This file is auto-generated at container startup
export const API_BASE_URL = '${VITE_API_BASE_URL}';" > /app/dist/config.js

echo "Generated config.js with API_BASE_URL = ${VITE_API_BASE_URL}"

# Start the server
exec "$@"