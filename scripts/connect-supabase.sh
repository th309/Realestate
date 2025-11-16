#!/bin/bash
# Direct Supabase PostgreSQL Connection Script (Bash version)
# Usage: ./scripts/connect-supabase.sh [query]
# Example: ./scripts/connect-supabase.sh "SELECT COUNT(*) FROM markets;"

QUERY="${1:-}"
HOST="${SUPABASE_DB_HOST:-db.pysflbhpnqwoczyuaaif.supabase.co}"
PORT="${SUPABASE_DB_PORT:-5432}"
DATABASE="${SUPABASE_DB_NAME:-postgres}"
USERNAME="${SUPABASE_DB_USER:-postgres}"
PASSWORD="${SUPABASE_DB_PASSWORD:-}"

# Try to get password from .env.local if not set
if [ -z "$PASSWORD" ] && [ -f "web/.env.local" ]; then
    PASSWORD=$(grep -E '^SUPABASE_DB_PASSWORD=|^DATABASE_URL=' web/.env.local | \
               sed -E 's/.*SUPABASE_DB_PASSWORD=(.+)/\1/' | \
               sed -E 's/.*postgresql:\/\/[^:]+:([^@]+)@.*/\1/' | \
               head -1 | tr -d ' ')
fi

# If still no password, prompt for it
if [ -z "$PASSWORD" ]; then
    echo "Database password not found in environment."
    read -sp "Enter Supabase database password: " PASSWORD
    echo
fi

export PGPASSWORD="$PASSWORD"

echo ""
echo "🔌 Connecting to Supabase PostgreSQL..."
echo "   Host: $HOST"
echo "   Port: $PORT"
echo "   Database: $DATABASE"
echo "   Username: $USERNAME"
echo ""

# If query provided, execute it
if [ -n "$QUERY" ]; then
    echo "Executing query..."
    echo "Query: $QUERY"
    echo ""
    psql -h "$HOST" -p "$PORT" -U "$USERNAME" -d "$DATABASE" -c "$QUERY"
    EXIT_CODE=$?
else
    # Start interactive session
    echo "Starting interactive psql session..."
    echo "Type \q to exit"
    echo ""
    psql -h "$HOST" -p "$PORT" -U "$USERNAME" -d "$DATABASE"
    EXIT_CODE=$?
fi

unset PGPASSWORD
exit $EXIT_CODE

