$env:NEXT_PUBLIC_SUPABASE_URL = "https://pysflbhpnqwoczyuaaif.supabase.co"
$env:SUPABASE_SERVICE_KEY = $env:SUPABASE_SERVICE_KEY

npx tsx scripts/run-backtest-analysis.ts $args
