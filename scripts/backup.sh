#!/bin/bash

# Get current date for backup file name
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Backup database
docker compose -f docker-compose.prod.yml exec -T db pg_dump -U ${DB_USER} ${DB_NAME} > "$BACKUP_DIR/db_backup_$DATE.sql"

# Compress backup
gzip "$BACKUP_DIR/db_backup_$DATE.sql"

# Remove backups older than 30 days
find $BACKUP_DIR -name "db_backup_*.sql.gz" -mtime +30 -delete

# Optional: Upload to remote storage (uncomment and configure as needed)
# aws s3 cp "$BACKUP_DIR/db_backup_$DATE.sql.gz" "s3://your-bucket/backups/"