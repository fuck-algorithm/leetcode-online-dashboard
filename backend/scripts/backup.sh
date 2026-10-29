#!/bin/bash

# Database Backup Script for LeetCode Dashboard (PostgreSQL)
# Usage: ./backup.sh [backup_directory]
# Requires pg_dump and the DB_* environment variables from .env.

BACKUP_DIR="${1:-./backups}"
DB_HOST="${DB_HOST:-local-server-001}"
DB_PORT="${DB_PORT:-30432}"
DB_USER="${DB_USER:-leetcode_dashboard}"
DB_NAME="${DB_NAME:-leetcode_dashboard}"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${DB_NAME}_backup_${DATE}.sql.gz"
RETENTION_DAYS=30

mkdir -p "$BACKUP_DIR"

echo "Creating PostgreSQL backup from ${DB_HOST}:${DB_PORT}/${DB_NAME}..."
if PGPASSWORD="${DB_PASSWORD:-}" pg_dump \
    -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --no-owner --no-privileges | gzip > "${BACKUP_DIR}/${BACKUP_FILE}"; then
    echo "Backup created: ${BACKUP_DIR}/${BACKUP_FILE}"
else
    echo "Error: Backup failed"
    rm -f "${BACKUP_DIR}/${BACKUP_FILE}"
    exit 1
fi

echo "Cleaning up backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name "${DB_NAME}_backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "Current backups:"
ls -lh "$BACKUP_DIR"

echo "Backup completed successfully!"
