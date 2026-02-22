#!/bin/bash

# Database Backup Script for LeetCode Dashboard
# Usage: ./backup.sh [backup_directory]

BACKUP_DIR="${1:-./backups}"
DB_PATH="${DB_PATH:-./data/dashboard.db}"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="dashboard_backup_${DATE}.db"
RETENTION_DAYS=30

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Check if database exists
if [ ! -f "$DB_PATH" ]; then
    echo "Error: Database not found at $DB_PATH"
    exit 1
fi

# Create backup
echo "Creating backup..."
if sqlite3 "$DB_PATH" ".backup '${BACKUP_DIR}/${BACKUP_FILE}'"; then
    echo "Backup created: ${BACKUP_DIR}/${BACKUP_FILE}"
    
    # Compress backup
    gzip "${BACKUP_DIR}/${BACKUP_FILE}"
    echo "Backup compressed: ${BACKUP_FILE}.gz"
else
    echo "Error: Backup failed"
    exit 1
fi

# Clean up old backups
echo "Cleaning up backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name "dashboard_backup_*.db.gz" -mtime +$RETENTION_DAYS -delete

# List remaining backups
echo "Current backups:"
ls -lh "$BACKUP_DIR"

echo "Backup completed successfully!"
