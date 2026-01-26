#!/bin/bash
set -e

# Fix permissions on the volume so appuser can write (Railway mounts as root)
if [ -d /tmp/cache ]; then
  echo "Fixing permissions for /tmp/cache..."
  chown -R appuser:appgroup /tmp/cache
fi

# Run the main process as appuser (gosu forwards signals for graceful shutdown)
exec gosu appuser "$@"
