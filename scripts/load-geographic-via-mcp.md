# Loading Geographic Data via MCP

Since the script is failing with RPC errors, we have two options:

## Option 1: Use the API Endpoint (Recommended)

The API endpoint at `/api/admin/upload-geographic-data` has access to the service role key and should work.

1. Start the web server:
   ```powershell
   cd web
   npm run dev
   ```

2. Use the API endpoint to upload files (when frontend is ready)

## Option 2: Use MCP Directly

Since MCP `execute_sql` works, we can load data directly using MCP. However, this requires:
- Reading GeoJSON files
- Parsing them
- Constructing SQL INSERT statements
- Executing via MCP in batches

The challenge is that MCP tools are designed for interactive use, not for processing large files programmatically.

## Option 3: Fix the Script

The script is failing because:
1. It's using the anon key which may not have permissions
2. The RPC errors aren't being properly logged

**Next steps:**
1. Check if we have the service role key in environment
2. Update script to use service role key
3. Improve error logging to see actual errors

