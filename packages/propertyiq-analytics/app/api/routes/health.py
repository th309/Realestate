import logging
from fastapi import APIRouter

from app.models.responses import HealthResponse
from app.config import get_settings

router = APIRouter(tags=["health"])
logger = logging.getLogger(__name__)


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Health check endpoint for Railway."""
    return HealthResponse(status="healthy", version="1.0.0")


@router.get("/health/db")
async def database_health_check():
    """
    Test database connectivity and return diagnostic info.
    """
    from supabase import create_client
    
    settings = get_settings()
    result = {
        "supabase_url_configured": bool(settings.supabase_url),
        "supabase_url_prefix": settings.supabase_url[:30] + "..." if settings.supabase_url else None,
        "supabase_key_configured": bool(settings.supabase_service_key),
        "supabase_key_prefix": settings.supabase_service_key[:20] + "..." if settings.supabase_service_key else None,
        "connection_test": None,
        "table_test": None,
        "record_count": None,
        "error": None,
    }
    
    if not settings.supabase_url or not settings.supabase_service_key:
        result["error"] = "Supabase credentials not configured"
        return result
    
    try:
        # Test connection
        logger.info(f"Testing Supabase connection to {settings.supabase_url[:30]}...")
        client = create_client(settings.supabase_url, settings.supabase_service_key)
        result["connection_test"] = "client_created"
        
        # Test table access - just get 1 record
        logger.info("Testing table access...")
        query = client.table('propertyiq_scores').select('score_date').limit(1)
        response = query.execute()
        
        result["table_test"] = "query_executed"
        result["record_count"] = len(response.data) if response.data else 0
        
        if response.data and len(response.data) > 0:
            result["connection_test"] = "success"
            result["table_test"] = "success"
        else:
            result["table_test"] = "no_data_returned"
            
    except Exception as e:
        logger.error(f"Database health check failed: {e}", exc_info=True)
        result["error"] = str(e)
    
    return result
