"""
Export all non-empty Supabase tables to Parquet files.

Usage:
    python scripts/export-db-to-parquet.py
    python scripts/export-db-to-parquet.py --tables redfin_zip propertyiq_scores_v2
    python scripts/export-db-to-parquet.py --skip-large   # skip tables >1M rows
"""

import argparse
import time
from pathlib import Path

import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
import psycopg2

DB_DSN = "postgresql://postgres.pysflbhpnqwoczyuaaif:IHatedoingpt12@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require"

OUTPUT_DIR = Path(__file__).parent.parent / "data" / "parquet"
CHUNK_SIZE = 100_000


def get_tables_with_rows(conn) -> list[tuple[str, int]]:
    """Get all public tables with their approximate row counts."""
    query = """
        SELECT relname as table_name, n_live_tup as approx_rows
        FROM pg_stat_user_tables
        WHERE schemaname = 'public' AND n_live_tup > 0
        ORDER BY n_live_tup DESC;
    """
    with conn.cursor() as cur:
        cur.execute(query)
        return cur.fetchall()


def get_primary_key(conn, table: str) -> str | None:
    """Get primary key column for ordered reads."""
    query = """
        SELECT a.attname
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = %s::regclass AND i.indisprimary
        LIMIT 1;
    """
    with conn.cursor() as cur:
        cur.execute(query, (table,))
        row = cur.fetchone()
        return row[0] if row else None


def export_table(conn, table: str, output_path: Path, approx_rows: int):
    """Export table to parquet using chunked reads with streaming parquet writer."""
    pk = get_primary_key(conn, table)
    order_clause = f" ORDER BY {pk}" if pk else ""

    # For small tables, just read all at once
    if approx_rows < CHUNK_SIZE:
        df = pd.read_sql(f"SELECT * FROM {table}{order_clause}", conn)
        df.to_parquet(output_path, engine="pyarrow", index=False)
        return len(df)

    # For large tables, use LIMIT/OFFSET with streaming parquet writer
    print(f"    Chunked export (~{approx_rows:,} rows)...")
    writer = None
    total_rows = 0
    offset = 0
    chunk_num = 0

    try:
        while True:
            query = f"SELECT * FROM {table}{order_clause} LIMIT {CHUNK_SIZE} OFFSET {offset}"
            df = pd.read_sql(query, conn)

            if df.empty:
                break

            chunk_num += 1
            total_rows += len(df)
            offset += CHUNK_SIZE

            arrow_table = pa.Table.from_pandas(df, preserve_index=False)

            if writer is None:
                writer = pq.ParquetWriter(str(output_path), arrow_table.schema)

            writer.write_table(arrow_table)
            del df, arrow_table

            print(f"    Chunk {chunk_num}: {total_rows:,} rows written...", end="\r")

        print()
    finally:
        if writer is not None:
            writer.close()

    return total_rows


def main():
    parser = argparse.ArgumentParser(description="Export Supabase tables to Parquet")
    parser.add_argument("--tables", nargs="+", help="Specific tables to export")
    parser.add_argument(
        "--skip-large", action="store_true", help="Skip tables with >1M rows"
    )
    args = parser.parse_args()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Output directory: {OUTPUT_DIR}")

    conn = psycopg2.connect(DB_DSN)
    conn.set_session(readonly=True, autocommit=True)
    print("Connected to database.\n")

    try:
        if args.tables:
            # For explicit tables, get their row counts
            tables = []
            for t in args.tables:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT n_live_tup FROM pg_stat_user_tables WHERE relname = %s",
                        (t,),
                    )
                    row = cur.fetchone()
                    tables.append((t, row[0] if row else 0))
        else:
            tables = get_tables_with_rows(conn)

        if not tables:
            print("No tables with data found.")
            return

        print(f"Found {len(tables)} tables with data:\n")
        for name, approx in tables:
            print(f"  {name:<40} ~{approx:>12,} rows")
        print()

        exported = 0
        skipped = 0
        errors = []

        for table_name, approx_rows in tables:
            if args.skip_large and approx_rows > 1_000_000:
                print(f"[SKIP] {table_name} ({approx_rows:,} rows) - --skip-large")
                skipped += 1
                continue

            output_path = OUTPUT_DIR / f"{table_name}.parquet"
            print(f"[EXPORT] {table_name}...")
            start = time.time()

            try:
                row_count = export_table(conn, table_name, output_path, approx_rows)
                elapsed = time.time() - start
                size_mb = output_path.stat().st_size / (1024 * 1024)
                print(f"    -> {row_count:,} rows, {size_mb:.1f} MB, {elapsed:.1f}s")
                exported += 1

            except Exception as e:
                elapsed = time.time() - start
                print(f"    [ERROR] {e} ({elapsed:.1f}s)")
                errors.append((table_name, str(e)))

        print(f"\nDone: {exported} exported, {skipped} skipped, {len(errors)} errors")
        if errors:
            print("\nErrors:")
            for tbl, err in errors:
                print(f"  {tbl}: {err}")

    finally:
        conn.close()


if __name__ == "__main__":
    main()
