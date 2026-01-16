# Working psql connection script
# Usage: .\scripts\psql.ps1 "SELECT COUNT(*) FROM markets;"
# Or: .\scripts\psql.ps1 (for interactive session)

param(
    [string]$Query = ""
)

$env:PGPASSWORD = 'IHatedoingpt12'

if ($Query) {
    psql -h aws-1-us-east-1.pooler.supabase.com -p 6543 -d postgres -U postgres.pysflbhpnqwoczyuaaif -c $Query
}
else {
    psql -h aws-1-us-east-1.pooler.supabase.com -p 6543 -d postgres -U postgres.pysflbhpnqwoczyuaaif
}

$env:PGPASSWORD = $null

