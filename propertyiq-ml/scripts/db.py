"""
Database connection helper for PropertyIQ ML scripts.

Provides connection to Supabase/PostgreSQL and common query utilities.
"""

import os
from typing import Optional
import pandas as pd
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


def get_connection_string() -> str:
    """Get PostgreSQL connection string from environment."""
    # Try direct connection string first
    conn_string = os.getenv('DATABASE_URL')
    if conn_string:
        return conn_string

    # Build from individual components
    host = os.getenv('SUPABASE_DB_HOST', 'localhost')
    port = os.getenv('SUPABASE_DB_PORT', '5432')
    database = os.getenv('SUPABASE_DB_NAME', 'postgres')
    user = os.getenv('SUPABASE_DB_USER', 'postgres')
    password = os.getenv('SUPABASE_DB_PASSWORD', '')

    return f"postgresql://{user}:{password}@{host}:{port}/{database}"


def query_to_df(sql: str, params: Optional[dict] = None) -> pd.DataFrame:
    """Execute SQL query and return as DataFrame."""
    import sqlalchemy

    engine = sqlalchemy.create_engine(get_connection_string())

    with engine.connect() as conn:
        if params:
            result = pd.read_sql(sqlalchemy.text(sql), conn, params=params)
        else:
            result = pd.read_sql(sqlalchemy.text(sql), conn)

    return result


def execute_sql(sql: str, params: Optional[dict] = None) -> None:
    """Execute SQL statement (for inserts/updates)."""
    import sqlalchemy

    engine = sqlalchemy.create_engine(get_connection_string())

    with engine.connect() as conn:
        if params:
            conn.execute(sqlalchemy.text(sql), params)
        else:
            conn.execute(sqlalchemy.text(sql))
        conn.commit()


def report_progress(percent: int, message: str = "") -> None:
    """
    Report progress to Node.js backend via stdout.

    The backend parses lines matching 'PROGRESS:XX' to update job status.
    """
    print(f"PROGRESS:{percent}", flush=True)
    if message:
        print(f"STATUS:{message}", flush=True)


def get_output_dir() -> str:
    """Get the output directory for data files."""
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base_dir, 'data')


def get_models_dir() -> str:
    """Get the directory for model files."""
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base_dir, 'models')


def get_reports_dir() -> str:
    """Get the directory for report files."""
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base_dir, 'reports')
