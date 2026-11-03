#!/usr/bin/env bash
# Dump the RepoLens database to /var/lib/repolens/backups, keeping the last 7.
#
#   bash scripts/deploy/backup_postgres.sh
#
# Restore (stops nothing; review before running):
#   docker compose -f docker-compose.prod.yml exec -T postgres \
#     pg_restore -U repolens -d repolens --clean --if-exists < <backup>.dump
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

DEST=/var/lib/repolens/backups
KEEP=7
file="${DEST}/repolens-$(date -u +%Y%m%dT%H%M%SZ).dump"

docker compose -f docker-compose.prod.yml exec -T postgres \
    pg_dump -U repolens -d repolens --format=custom > "${file}.partial"
mv "${file}.partial" "$file"
chmod 0600 "$file"
echo "backup: $file ($(du -h "$file" | cut -f1))"

ls -1t "$DEST"/repolens-*.dump 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f
