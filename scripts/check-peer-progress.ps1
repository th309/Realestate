$env:PGPASSWORD = 'IHatedoingpt12'
psql -h aws-1-us-east-1.pooler.supabase.com -p 6543 -U postgres.pysflbhpnqwoczyuaaif -d postgres -c @"
SELECT geography_type,
  COUNT(*) as total,
  COUNT(peer_group_id) as with_peer,
  COUNT(parent_geography_id) as with_parent,
  ROUND(100.0 * COUNT(peer_group_id) / COUNT(*), 1) as peer_pct
FROM propertyiq_scores_history
GROUP BY geography_type
ORDER BY geography_type;
"@
