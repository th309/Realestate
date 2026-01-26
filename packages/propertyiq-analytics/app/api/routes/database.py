"""
Database Query API Routes

Provides Quinn with direct read access to Supabase database.
Allows exploration and querying of any table.
"""

import logging
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.services.database_query_service import get_database_query_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/database", tags=["database"])


# === Request Models ===

class QueryTableRequest(BaseModel):
    """Request for querying a table."""
    table_name: str = Field(..., description="Table name to query")
    columns: Optional[List[str]] = Field(None, description="Columns to select (None = all)")
    filters: Optional[Dict[str, Any]] = Field(None, description="Filters to apply")
    order_by: Optional[str] = Field(None, description="Column to sort by (prefix with - for desc)")
    limit: int = Field(100, ge=1, le=1000, description="Max rows to return")
    offset: int = Field(0, ge=0, description="Number of rows to skip")


class SearchTablesRequest(BaseModel):
    """Request for searching across tables."""
    search_term: str = Field(..., description="Text to search for")
    tables: Optional[List[str]] = Field(None, description="Tables to search (None = common tables)")
    columns: Optional[List[str]] = Field(None, description="Columns to search in")
    limit_per_table: int = Field(10, ge=1, le=100, description="Max results per table")


class AggregateQueryRequest(BaseModel):
    """Request for aggregation query."""
    table_name: str = Field(..., description="Table to query")
    aggregations: List[Dict[str, str]] = Field(
        ...,
        description="List of aggregations like [{'function': 'avg', 'column': 'price', 'alias': 'avg_price'}]"
    )
    group_by: Optional[List[str]] = Field(None, description="Columns to group by")
    filters: Optional[Dict[str, Any]] = Field(None, description="Filters to apply")
    limit: int = Field(100, ge=1, le=1000, description="Max groups to return")


# === Endpoints ===

@router.get("/tables")
async def get_all_tables():
    """
    Get list of all tables in the database.

    Returns table names, row counts, and column information.
    Use this to discover what data is available.
    """
    logger.info("GET /database/tables")

    try:
        service = get_database_query_service()
        result = service.get_all_tables()
        return result
    except Exception as e:
        logger.exception("Failed to get tables")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tables/{table_name}")
async def describe_table(table_name: str):
    """
    Get detailed schema information about a specific table.

    Returns:
    - Column names and types
    - Sample values
    - Statistics for numeric columns
    - Row count

    Use this to understand the structure of a table before querying it.
    """
    logger.info(f"GET /database/tables/{table_name}")

    try:
        service = get_database_query_service()
        result = service.describe_table(table_name)
        return result
    except Exception as e:
        logger.exception(f"Failed to describe table {table_name}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/query")
async def query_table(request: QueryTableRequest):
    """
    Query a table with filters, sorting, and pagination.

    Examples:
    - Get all metros: {"table_name": "geographies", "filters": {"geography_type": "metro"}}
    - Get high scores: {"table_name": "propertyiq_scores", "filters": {"investoredge_score": {"gte": 80}}}
    - Get sorted: {"table_name": "zillow_metro", "order_by": "-period_date", "limit": 50}

    Supported filter operators:
    - Simple: {"column": "value"}
    - Range: {"column": {"gte": 100, "lte": 200}}
    - List: {"column": ["value1", "value2"]}
    - Like: {"column": {"like": "%pattern%"}}
    """
    logger.info(f"POST /database/query: table={request.table_name}")

    try:
        service = get_database_query_service()
        result = service.query_table(
            table_name=request.table_name,
            columns=request.columns,
            filters=request.filters,
            order_by=request.order_by,
            limit=request.limit,
            offset=request.offset
        )
        return result
    except Exception as e:
        logger.exception("Query failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/search")
async def search_tables(request: SearchTablesRequest):
    """
    Search across multiple tables for a term.

    Searches in name, title, and description columns.
    Returns matching rows from each table.

    Example: Search for "Austin" to find all references to Austin markets.
    """
    logger.info(f"POST /database/search: term={request.search_term}")

    try:
        service = get_database_query_service()
        result = service.search_tables(
            search_term=request.search_term,
            tables=request.tables,
            columns=request.columns,
            limit_per_table=request.limit_per_table
        )
        return result
    except Exception as e:
        logger.exception("Search failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/aggregate")
async def aggregate_query(request: AggregateQueryRequest):
    """
    Run aggregation queries (COUNT, SUM, AVG, MIN, MAX).

    Examples:
    - Count by state: {
        "table_name": "propertyiq_scores",
        "aggregations": [{"function": "count", "column": "geography_id", "alias": "count"}],
        "group_by": ["parent_geography_id"]
      }
    - Average score: {
        "table_name": "propertyiq_scores",
        "aggregations": [{"function": "avg", "column": "investoredge_score"}]
      }

    Supported functions: count, sum, avg, mean, min, max
    """
    logger.info(f"POST /database/aggregate: table={request.table_name}")

    try:
        service = get_database_query_service()
        result = service.aggregate_query(
            table_name=request.table_name,
            aggregations=request.aggregations,
            group_by=request.group_by,
            filters=request.filters,
            limit=request.limit
        )
        return result
    except Exception as e:
        logger.exception("Aggregation failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/summary")
async def get_data_summary():
    """
    Get high-level summary of all data in the database.

    Returns:
    - Record counts for each data source (Zillow, Realtor, Census, etc.)
    - Latest data dates
    - Number of geographies
    - Analytics usage stats

    Use this to get an overview of what data is available.
    """
    logger.info("GET /database/summary")

    try:
        service = get_database_query_service()
        result = service.get_data_summary()
        return result
    except Exception as e:
        logger.exception("Failed to get summary")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "database-query"}
