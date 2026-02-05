@echo off
cd /d d:\Projects\rei-platform
npx ts-node packages/backend/src/scripts/backfill-historical-scores.ts --years=5
