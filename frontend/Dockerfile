# Frontend Dockerfile
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm install

# Copy application code
COPY . .

# Add build arguments for environment variables
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

# Expose port for dev server
EXPOSE ${FRONTEND_PORT}

# Start development server
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "${FRONTEND_PORT}"]
