# PropertyIQ Analytics Service - v1.0.3
# Build trigger: 2026-02-08-auth
import logging
import os
import time
from contextlib import asynccontextmanager
from datetime import datetime, timedelta

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

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

# Paths that don't require authentication (health checks, root info)
PUBLIC_PATHS = {"/", "/health", "/api/v1/health", "/docs", "/openapi.json", "/redoc"}


class ServiceAuthMiddleware(BaseHTTPMiddleware):
    """
    Middleware to validate service-to-service authentication.
    Expects Authorization: Bearer <secret> header on protected endpoints.
    """

    def __init__(self, app, expected_secret: str | None):
        super().__init__(app)
        self.expected_secret = expected_secret

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # Allow public paths without auth (health checks, docs)
        if path in PUBLIC_PATHS:
            return await call_next(request)

        # If no secret is configured, skip auth (development mode)
        if not self.expected_secret:
            return await call_next(request)

        # Validate Authorization header
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            logger.warning(f"Missing Authorization header for {request.method} {path}")
            return JSONResponse(
                status_code=401,
                content={"error": "unauthorized", "message": "Missing Authorization header"},
            )

        # Expect "Bearer <token>" format
        if not auth_header.startswith("Bearer "):
            logger.warning(f"Invalid Authorization format for {request.method} {path}")
            return JSONResponse(
                status_code=401,
                content={"error": "unauthorized", "message": "Invalid Authorization format"},
            )

        token = auth_header[7:]  # Remove "Bearer " prefix
        if token != self.expected_secret:
            logger.warning(f"Invalid service secret for {request.method} {path}")
            return JSONResponse(
                status_code=401,
                content={"error": "unauthorized", "message": "Invalid service secret"},
            )

        return await call_next(request)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    import asyncio
    logger.info("=" * 60)
    logger.info("Starting PropertyIQ Analytics service")
    logger.info("=" * 60)
    settings = get_settings()
    logger.info(f"Debug mode: {settings.debug}")
    logger.info(f"Allowed origins: {settings.allowed_origins_list}")
    logger.info("PropertyIQ Analytics service ready")
    logger.info("=" * 60)

    async def validate_supabase():
        """Run Supabase validation in background so healthcheck can pass immediately."""
        if not settings.supabase_url or not settings.supabase_service_key:
            logger.error("SUPABASE_URL or SUPABASE_SERVICE_KEY not set! Quinn will not have market data.")
            return
        logger.info("Validating Supabase connection (background)...")
        try:
            from app.services.data_cache import get_data_cache
            cache = get_data_cache()

            def _validate():
                return cache.validate_connection(timeout_seconds=10)

            result = await asyncio.get_event_loop().run_in_executor(None, _validate)
            if result.get("success"):
                logger.info(f"  Supabase connection: OK (count={result.get('details', {}).get('total_count', 0)})")
            else:
                logger.error(f"  Supabase connection: FAILED - {result.get('message', 'unknown')}")
        except Exception as e:
            logger.error(f"  Supabase validation error: {e}")

    def _warm_cache_sync():
        """Run in thread so event loop can still serve /api/v1/health."""
        try:
            from app.services.data_cache import get_data_cache
            cache = get_data_cache()
            for geo in ['metro', 'state', 'county', 'zip']:
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

    async def warm_cache():
        try:
            await asyncio.get_event_loop().run_in_executor(None, _warm_cache_sync)
        except Exception as e:
            logger.error(f"Cache warming failed: {e}")

    async def warm_market_data_cache():
        """Load market tables from Parquet only (fast). DB is used only when Parquet is missing."""
        try:
            from app.services.market_data_cache import get_market_data_cache
            cache = get_market_data_cache()
            logger.info("Market data cache: loading from Parquet...")
            loop = asyncio.get_event_loop()
            results = await loop.run_in_executor(None, cache.load_all)
            ok = sum(1 for v in results.values() if v)
            logger.info(f"Market data cache: loaded {ok}/{len(results)} tables")
        except Exception as e:
            logger.error(f"Market data cache warming failed: {e}")

    def _run_weekly_refresh_sync():
        """Run incremental/full refresh for all market tables (blocking)."""
        try:
            from app.services.market_data_cache import get_market_data_cache
            cache = get_market_data_cache()
            logger.info("Market data cache: weekly refresh from Supabase (4am EST)...")
            results = cache.refresh_all_from_supabase()
            ok = sum(1 for v in results.values() if v)
            logger.info(f"Market data cache: refresh complete {ok}/{len(results)} tables")
        except Exception as e:
            logger.error(f"Market data cache weekly refresh failed: {e}")

    async def weekly_refresh_at_4am_est():
        """Schedule market cache refresh every Sunday at 4am EST."""
        from zoneinfo import ZoneInfo
        tz = ZoneInfo("America/New_York")
        while True:
            now = datetime.now(tz)
            # Next Sunday at 4am EST
            days_ahead = (6 - now.weekday()) % 7
            if days_ahead == 0 and now.hour >= 4:
                days_ahead = 7
            next_sunday = now.replace(hour=4, minute=0, second=0, microsecond=0)
            if days_ahead > 0:
                next_sunday = next_sunday + timedelta(days=days_ahead)
            elif now.hour >= 4:
                next_sunday = next_sunday + timedelta(days=7)
            delay = (next_sunday - now).total_seconds()
            if delay < 60:
                delay = 60
            logger.info(f"Market data cache: next refresh at {next_sunday.isoformat()} EST (in {delay/3600:.1f}h)")
            await asyncio.sleep(delay)
            await asyncio.get_event_loop().run_in_executor(None, _run_weekly_refresh_sync)

    # Run in background (don't block startup) so /api/v1/health responds within Railway's 10s window
    asyncio.create_task(validate_supabase())
    asyncio.create_task(warm_cache())
    asyncio.create_task(warm_market_data_cache())
    asyncio.create_task(weekly_refresh_at_4am_est())
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

# Configure service-to-service authentication
analytics_service_secret = os.environ.get("ANALYTICS_SERVICE_SECRET")
if analytics_service_secret:
    logger.info("Service authentication enabled (ANALYTICS_SERVICE_SECRET configured)")
else:
    logger.warning("ANALYTICS_SERVICE_SECRET not set - endpoints are unprotected")
app.add_middleware(ServiceAuthMiddleware, expected_secret=analytics_service_secret)


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
