"""DB engine for the monolithic-discovery analysis.

Reads SUPABASE_DB_URL from the environment, falling back to
packages/backend/.env (local analysis convenience — never shipped).
"""

import os
import re
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine

STATEMENT_TIMEOUT_MS = 300_000  # 5 minutes; ZIP panels are multi-million-row pulls

REPO_ROOT = Path(__file__).resolve().parents[3]
BACKEND_ENV = REPO_ROOT / "packages" / "backend" / ".env"


def _database_url() -> str:
    url = os.environ.get("SUPABASE_DB_URL")
    if url:
        return url
    if BACKEND_ENV.exists():
        match = re.search(
            r"^SUPABASE_DB_URL=(.+)$", BACKEND_ENV.read_text(), re.MULTILINE
        )
        if match:
            return match.group(1).strip().strip("'\"")
    raise RuntimeError(
        "SUPABASE_DB_URL not found in env or packages/backend/.env"
    )


def get_engine() -> Engine:
    url = _database_url()
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg2://", 1)
    return create_engine(
        url,
        connect_args={"options": f"-c statement_timeout={STATEMENT_TIMEOUT_MS}"},
    )
