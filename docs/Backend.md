# Backend Documentation

## Overview

The backend is built with:
- FastAPI
- PostgreSQL
- SQLAlchemy
- Alembic (migrations)
- Python 3.12+

## Project Structure

```
backend/
├── app/
│   ├── api/           # API endpoints
│   ├── core/          # Core functionality
│   ├── db/            # Database models and migrations
│   ├── schemas/       # Pydantic models
│   ├── services/      # Business logic
│   └── main.py        # Application entry point
├── tests/             # Test suite
├── alembic/           # Database migrations
├── requirements.txt   # Python dependencies
└── Dockerfile        # Docker configuration
```

## Development

### Environment Variables

Required environment variables:

```env
# Database
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/dd_db

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Security
SECRET_KEY=your_random_secret_key

# URLs
BASE_URL=http://localhost:56000
FRONTEND_URL=http://localhost:54287
```

### Database Setup

1. Create database:
   ```bash
   psql -c "CREATE DATABASE dd_db;"
   ```

2. Run migrations:
   ```bash
   alembic upgrade head
   ```

3. Seed initial data:
   ```bash
   python -m app.db.seed
   ```

### Running Tests

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=app

# Run specific test file
pytest tests/test_api.py
```

## API Implementation

### Authentication

OAuth implementation:
- `app/api/auth.py` - Authentication endpoints
- `app/core/auth.py` - Authentication logic
- `app/core/security.py` - Security utilities

### Database Models

Key models:
- `app/db/models/user.py` - User model
- `app/db/models/task.py` - Task model
- `app/db/models/contract.py` - Contract model
- `app/db/models/wallet.py` - Wallet model

### API Endpoints

Endpoint implementation:
- `app/api/tasks.py` - Task endpoints
- `app/api/contracts.py` - Contract endpoints
- `app/api/wallets.py` - Wallet endpoints

### Business Logic

Service layer:
- `app/services/task.py` - Task service
- `app/services/contract.py` - Contract service
- `app/services/wallet.py` - Wallet service

## Database Migrations

Using Alembic for migrations:

```bash
# Create new migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Rollback migration
alembic downgrade -1
```

## Scheduled Tasks

Automatic contract processing:
- `app/core/scheduler.py` - Task scheduler
- `app/services/contract_processor.py` - Contract processing logic

## Security

Security measures:

1. Authentication:
   - OAuth 2.0 with Google
   - JWT session tokens
   - CSRF protection

2. Authorization:
   - Role-based access control
   - Parent/child permissions

3. Data Protection:
   - Input validation
   - SQL injection prevention
   - XSS protection

4. Rate Limiting:
   - API rate limiting
   - Brute force protection

## Error Handling

Error handling implementation:
- `app/core/exceptions.py` - Custom exceptions
- `app/core/error_handlers.py` - Error handlers

## Logging

Logging configuration:
- `app/core/logging.py` - Logging setup
- Application logs
- Access logs
- Error logs

## Testing

Test implementation:
- Unit tests
- Integration tests
- API tests
- Database tests

## Performance

Performance optimizations:
1. Database:
   - Connection pooling
   - Query optimization
   - Indexing strategy

2. Caching:
   - Response caching
   - Query result caching

3. Async Implementation:
   - Async database operations
   - Async API endpoints

## Monitoring

Monitoring setup:
1. Health checks
2. Performance metrics
3. Error tracking
4. Resource usage

## Deployment

Deployment configurations:
1. Docker setup
2. Production settings
3. SSL/TLS configuration
4. Backup strategy