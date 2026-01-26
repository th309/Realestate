import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.api.routes import health, scoring, backtest, workflow, cache, adhoc, advanced, database, news, geography

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Suppress noisy HTTP client logs (httpx, httpcore, urllib3)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("urllib3").setLevel(logging.WARNING)
logging.getLogger("hpack").setLevel(logging.WARNING)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    logger.info("=" * 60)
    logger.info("Starting PropertyIQ Analytics service")
    logger.info("=" * 60)
    settings = get_settings()
    logger.info(f"Debug mode: {settings.debug}")
    logger.info(f"Allowed origins: {settings.allowed_origins_list}")
    
    # Validate Supabase connection at startup
    logger.info("Validating Supabase connection...")
    if settings.supabase_url and settings.supabase_service_key:
        logger.info(f"  SUPABASE_URL: {settings.supabase_url[:50]}...")
        logger.info(f"  SUPABASE_SERVICE_KEY: {'*' * 10} (set)")
        try:
            from app.services.data_cache import get_data_cache
            cache = get_data_cache()
            result = cache.validate_connection(timeout_seconds=30)
            if result['success']:
                logger.info(f"  Supabase connection: OK")
                logger.info(f"  Test query returned {result['details'].get('total_count', 0)} records")
            else:
                logger.error(f"  Supabase connection: FAILED - {result['message']}")
        except Exception as e:
            logger.error(f"  Supabase validation error: {e}")
    else:
        logger.error("  SUPABASE_URL or SUPABASE_SERVICE_KEY not set!")
        logger.error("  Quinn will not be able to access market data.")
    
    logger.info("=" * 60)
    logger.info("PropertyIQ Analytics service ready")
    logger.info("=" * 60)
    
    # Load ALL most recent data from DB into cache (covers ~90% of user queries)
    import asyncio
    async def warm_cache():
        try:
            from app.services.data_cache import get_data_cache
            cache = get_data_cache()
            geo_types = ['metro', 'state', 'county', 'zip']  # Metro first (most common)
            for geo in geo_types:
                try:
                    if not cache.is_cached(geo):
                        logger.info(f"Cache empty for {geo} - syncing from Supabase...")
                        cache.sync_cache(geo, force_full=True)
                        logger.info(f"  {geo}: done")
                    else:
                        logger.info(f"  {geo}: already cached, skipping")
                except Exception as e:
                    logger.error(f"  {geo}: sync failed - {e}")
            logger.info("Cache warming complete - all geography types loaded from DB")
        except Exception as e:
            logger.error(f"Cache warming failed: {e}")
    
    # Run in background (don't block startup)
    asyncio.create_task(warm_cache())
    
    yield
    logger.info("Shutting down PropertyIQ Analytics service")


# Create FastAPI app
app = FastAPI(
    title="PropertyIQ Analytics",
    description="ML scoring and backtesting service for real estate analytics",
    version="1.0.0",
    lifespan=lifespan,
)

# Configure CORS
settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all incoming requests."""
    start_time = time.time()

    # Log request
    logger.info(f"Request: {request.method} {request.url.path}")

    # Process request
    response = await call_next(request)

    # Log response
    duration_ms = (time.time() - start_time) * 1000
    logger.info(
        f"Response: {request.method} {request.url.path} "
        f"status={response.status_code} duration={duration_ms:.1f}ms"
    )

    return response


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle unhandled exceptions."""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "internal_error",
            "message": "An unexpected error occurred",
        },
    )


# Include routers
app.include_router(health.router, prefix="/api/v1")
app.include_router(scoring.router, prefix="/api/v1")
app.include_router(backtest.router, prefix="/api/v1")
app.include_router(workflow.router, prefix="/api/v1")
app.include_router(cache.router, prefix="/api/v1")
app.include_router(adhoc.router, prefix="/api/v1")
app.include_router(advanced.router, prefix="/api/v1")
app.include_router(database.router, prefix="/api/v1")
app.include_router(news.router, prefix="/api/v1")
app.include_router(geography.router, prefix="/api/v1")


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with service info."""
    return {
        "service": "PropertyIQ Analytics",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/api/v1/health",
    }


if __name__ == "__main__":
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.port,
        reload=settings.debug,
    )
