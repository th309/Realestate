# QGIS Supabase Connection Troubleshooting

## Common Issues and Solutions

### Issue 1: Password with Special Characters

If your password contains `$$`, QGIS might interpret it as a variable. Try:

1. **Escape the dollar signs**: In the password field, try: `Youknowwhy$$12` (double the dollar signs)
2. **Or use backticks**: `Youknowwhy\$\$12`
3. **Or check "Save password"** - sometimes QGIS handles special chars better when saved

### Issue 2: SSL Mode

Try different SSL modes in order:
1. `require` (most secure)
2. `prefer` (tries SSL, falls back if not available)
3. `allow` (uses SSL if available)

### Issue 3: Connection String Format

Instead of individual fields, try using a connection string:

```
host=db.pysflbhpnqwoczyuaaif.supabase.co port=5432 dbname=postgres user=postgres password=Youknowwhy$$12 sslmode=require
```

### Issue 4: Verify Credentials

1. Go to: https://supabase.com/dashboard/project/pysflbhpnqwoczyuaaif/settings/database
2. Under "Connection parameters", verify:
   - The password is correct
   - The host is: `db.pysflbhpnqwoczyuaaif.supabase.co`
   - The database is: `postgres`

### Issue 5: Connection Pooling

Supabase uses connection pooling. Make sure you're using:
- **Direct connection** (not pooler)
- Port: `5432` (not `6543` which is for pooling)

### Issue 6: Firewall/Network

- Check if your firewall is blocking the connection
- Try from a different network
- Verify Supabase project is active (not paused)

## Step-by-Step QGIS Connection

1. **Layer → Add Layer → Add PostgreSQL Layer...** (Ctrl+Shift+D)

2. Click **"New"**

3. Fill in connection details:
   ```
   Name: Supabase Real Estate DB
   Service: (leave blank)
   Host: db.pysflbhpnqwoczyuaaif.supabase.co
   Port: 5432
   Database: postgres
   SSL Mode: require (or try 'prefer')
   Username: postgres
   Password: Youknowwhy$$12
   ```

4. **Important checkboxes:**
   - ☑ Save username
   - ☑ Save password
   - ☑ Use estimated table metadata (optional, for faster loading)

5. Click **"Test Connection"**

6. If it fails, check the error message and try:
   - Different SSL mode
   - Verify password in Supabase dashboard
   - Check if password needs escaping

## Alternative: Use Connection String

If individual fields don't work, try the connection string approach:

1. In QGIS connection dialog, look for "Service" or "Connection string" field
2. Enter:
   ```
   host=db.pysflbhpnqwoczyuaaif.supabase.co port=5432 dbname=postgres user=postgres password='Youknowwhy$$12' sslmode=require
   ```

## Still Not Working?

1. **Check Supabase Dashboard:**
   - Go to Settings → Database
   - Verify connection string matches
   - Try resetting database password if needed

2. **Test with psql** (if you have PostgreSQL client):
   ```bash
   psql -h db.pysflbhpnqwoczyuaaif.supabase.co -p 5432 -U postgres -d postgres
   ```

3. **Check QGIS Log:**
   - View → Panels → Log Messages
   - Look for detailed error messages

4. **Try pgAdmin** as alternative:
   - Install pgAdmin
   - Test connection there first
   - If pgAdmin works, QGIS should work with same credentials








