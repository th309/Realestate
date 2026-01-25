"""
Cache Management API Routes

Provides endpoints for managing the data cache:
- View cache status
- Sync cache with database
- Clear cache
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from pydantic import BaseModel

from app.services.data_cache import get_data_cache

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cache", tags=["cache"])


class CacheStatusResponse(BaseModel):
    """Response for cache status."""
    success: bool
    data: dict


class CacheSyncResponse(BaseModel):
    """Response for cache sync operation."""
    success: bool
    results: dict


@router.get("/status", response_model=CacheStatusResponse)
async def get_cache_status():
    """
    Get the current status of all data caches.
    
    Returns information about each geography type cache:
    - Whether it exists
    - File size
    - Record count
    - Last sync date
    """
    logger.info("GET /cache/status")
    
    try:
        cache = get_data_cache()
        status = cache.get_cache_status()
        
        return CacheStatusResponse(
            success=True,
            data=status
        )
    except Exception as e:
        logger.exception("Failed to get cache status")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sync", response_model=CacheSyncResponse)
async def sync_cache(
    geo_type: Optional[str] = Query(None, description="Geography type to sync (state, metro, county, zip). If not specified, syncs all."),
    force_full: bool = Query(False, description="Force full refresh instead of incremental"),
):
    """
    Synchronize cache with database.
    
    By default, performs incremental sync (only fetches new records).
    Use force_full=true to do a complete refresh.
    
    This operation may take several minutes for large datasets.
    """
    logger.info(f"POST /cache/sync geo_type={geo_type} force_full={force_full}")
    
    try:
        cache = get_data_cache()
        
        if geo_type:
            if geo_type not in ['state', 'metro', 'county', 'zip']:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid geo_type: {geo_type}. Must be one of: state, metro, county, zip"
                )
            result = cache.sync_cache(geo_type, force_full)
            results = {geo_type: result}
        else:
            results = cache.sync_all(force_full)
        
        return CacheSyncResponse(
            success=True,
            results=results
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Cache sync failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/progress")
async def get_export_progress():
    """
    Get current data export progress.
    
    Returns real-time progress for each geography type being exported,
    including records fetched, total records, and percentage complete.
    """
    try:
        cache = get_data_cache()
        progress = cache.get_export_progress()
        
        return {
            "success": True,
            "progress": progress,
        }
    except Exception as e:
        logger.exception("Failed to get export progress")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sync-background")
async def sync_cache_background(
    background_tasks: BackgroundTasks,
    geo_type: Optional[str] = Query(None, description="Geography type to sync"),
    force_full: bool = Query(False, description="Force full refresh"),
):
    """
    Start cache sync in background.
    
    Returns immediately and runs sync in background task.
    Use /cache/progress to check real-time progress.
    Use /cache/status to check final results.
    """
    logger.info(f"POST /cache/sync-background geo_type={geo_type} force_full={force_full}")
    
    def do_sync():
        cache = get_data_cache()
        cache.reset_progress()  # Reset progress before starting
        if geo_type:
            cache.sync_cache(geo_type, force_full)
        else:
            cache.sync_all(force_full)
    
    background_tasks.add_task(do_sync)
    
    return {
        "success": True,
        "message": "Cache sync started in background",
        "geo_type": geo_type or "all",
        "force_full": force_full,
    }


@router.delete("/clear")
async def clear_cache(
    geo_type: Optional[str] = Query(None, description="Geography type to clear. If not specified, clears all."),
):
    """
    Clear cached data.
    
    Removes cached Parquet files and resets metadata.
    """
    logger.info(f"DELETE /cache/clear geo_type={geo_type}")
    
    try:
        cache = get_data_cache()
        
        if geo_type:
            if geo_type not in ['state', 'metro', 'county', 'zip']:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid geo_type: {geo_type}"
                )
            cache.clear_cache(geo_type)
            return {"success": True, "cleared": geo_type}
        else:
            cache.clear_cache()
            return {"success": True, "cleared": "all"}
            
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to clear cache")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/info/{geo_type}")
async def get_cache_info(geo_type: str):
    """
    Get detailed info about a specific geography cache.
    
    Returns sample data and statistics if cache exists.
    """
    if geo_type not in ['state', 'metro', 'county', 'zip']:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid geo_type: {geo_type}"
        )
    
    try:
        cache = get_data_cache()
        
        if not cache.is_cached(geo_type):
            return {
                "success": True,
                "geo_type": geo_type,
                "cached": False,
                "message": "No cache exists for this geography type"
            }
        
        df = cache.load_from_cache(geo_type)
        
        if df is None or len(df) == 0:
            return {
                "success": True,
                "geo_type": geo_type,
                "cached": True,
                "record_count": 0,
            }
        
        # Build info
        info = {
            "success": True,
            "geo_type": geo_type,
            "cached": True,
            "record_count": len(df),
            "columns": list(df.columns),
        }
        
        # Date range
        if 'period_date' in df.columns:
            info["date_range"] = {
                "min": str(df['period_date'].min()),
                "max": str(df['period_date'].max()),
            }
        
        # Score stats
        for score_col in ['investoredge_score', 'homeready_score']:
            if score_col in df.columns:
                valid = df[score_col].dropna()
                if len(valid) > 0:
                    info[f"{score_col}_stats"] = {
                        "count": len(valid),
                        "mean": round(float(valid.mean()), 2),
                        "std": round(float(valid.std()), 2),
                        "min": round(float(valid.min()), 2),
                        "max": round(float(valid.max()), 2),
                    }
        
        # Outcome stats
        for col in ['actual_appreciation_12m', 'actual_appreciation_36m']:
            if col in df.columns:
                valid = df[col].dropna()
                if len(valid) > 0:
                    info[f"{col}_stats"] = {
                        "count": len(valid),
                        "mean": round(float(valid.mean()), 4),
                    }
        
        return info
        
    except Exception as e:
        logger.exception(f"Failed to get cache info for {geo_type}")
        raise HTTPException(status_code=500, detail=str(e))
