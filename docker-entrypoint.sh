#!/bin/bash
set -e

PUID=${PUID:-1000}
PGID=${PGID:-1000}

echo "
─────────────────────────────────────────
  Stand-Up Order Generator
  Running as UID:${PUID} / GID:${PGID}
─────────────────────────────────────────"

# Create group if it doesn't exist
if ! getent group standup > /dev/null 2>&1; then
    groupadd -o -g "$PGID" standup
fi

# Create user if it doesn't exist
if ! getent passwd standup > /dev/null 2>&1; then
    useradd -o -u "$PUID" -g "$PGID" \
        -d /app -s /bin/false \
        --no-create-home standup
fi

# Fix ownership of data directory
chown -R standup:standup /data 2>/dev/null || true

# Run the application as the configured user
exec gosu standup "$@"
