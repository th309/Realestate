"""Single source of truth for the analysis-time DB engine.

Reads SUPABASE_DB_PASSWORD from env. Statement timeout is 5 minutes —
discovery queries can pull large panels (ZIP level is ~1.2M rows).
"""

import os
from urllib.parse import quote_plus

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine

REF = "pysflbhpnqwoczyuaaif"
HOST = "aws-1-us-east-1.pooler.supabase.com"
STATEMENT_TIMEOUT_MS = 300_000  # 5 minutes


def get_engine() -> Engine:
    pw = os.environ.get("SUPABASE_DB_PASSWORD")
    if not pw:
        raise RuntimeError(
            "SUPABASE_DB_PASSWORD env var is required. "
            "Get it from 1Password or `supabase status` locally."
        )
    url = (
        f"postgresql://postgres.{REF}:{quote_plus(pw)}"
        f"@{HOST}:6543/postgres?sslmode=require"
    )
    return create_engine(
        url,
        connect_args={"options": f"-c statement_timeout={STATEMENT_TIMEOUT_MS}"},
    )
