# Backend Dockerfile
FROM python:3.12-slim

# Set working directory
WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY ./app ./app

# Expose port
EXPOSE 56000

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "56000", "--reload"]
