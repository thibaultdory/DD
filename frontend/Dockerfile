# Frontend Dockerfile
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm install

# Copy application code
COPY . .

# Expose port for dev server
EXPOSE 54287

# Start development server
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "54287"]
