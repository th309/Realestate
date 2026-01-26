"""
News Analysis API Routes

Provides Quinn with news search and impact analysis capabilities.
"""

import logging
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.news_analysis_service import get_news_analysis_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/news", tags=["news"])


# === Request Models ===

class SearchNewsRequest(BaseModel):
    """Request for news search."""
    query: Optional[str] = Field(None, description="Search term (e.g., 'housing market', 'mortgage rates')")
    geography_name: Optional[str] = Field(None, description="Specific geography (e.g., 'Austin', 'Texas')")
    geography_type: Optional[str] = Field(None, description="Type: metro, state, national")
    days_back: int = Field(30, ge=1, le=365, description="Days to search back")
    limit: int = Field(20, ge=1, le=100, description="Max articles")


class AnalyzeImpactRequest(BaseModel):
    """Request for news impact analysis."""
    article_id: Optional[str] = Field(None, description="Article ID from news cache")
    article_title: Optional[str] = Field(None, description="Article title (if not using ID)")
    article_content: Optional[str] = Field(None, description="Article content")
    article_url: Optional[str] = Field(None, description="Article URL")
    article_source: Optional[str] = Field(None, description="Article source")
    article_date: Optional[str] = Field(None, description="Published date")
    geography_id: str = Field(..., description="Geography ID to analyze impact for")
    geography_name: str = Field(..., description="Geography name")
    geography_type: str = Field("metro", description="Geography type")


# === Endpoints ===

@router.post("/search")
async def search_news(request: SearchNewsRequest):
    """
    Search real estate news.

    Search the news cache for articles matching criteria.
    Can filter by search terms, geography, and date range.

    Examples:
    - Search for national housing news: {"query": "housing market", "days_back": 7}
    - Search Austin-specific news: {"geography_name": "Austin", "days_back": 30}
    - Search mortgage rate news: {"query": "mortgage rates", "days_back": 14}
    """
    logger.info(f"POST /news/search: query={request.query}, geography={request.geography_name}")

    try:
        service = get_news_analysis_service()
        result = service.search_news(
            query=request.query,
            geography_name=request.geography_name,
            geography_type=request.geography_type,
            days_back=request.days_back,
            limit=request.limit
        )
        return result
    except Exception as e:
        logger.exception("News search failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze-impact")
async def analyze_impact(request: AnalyzeImpactRequest):
    """
    Analyze how a news article might impact a specific market.

    Takes a news article and a geography, returns analysis of:
    - Relevance to the market (high/medium/low)
    - Impact direction (positive/negative/neutral)
    - Impact magnitude (high/medium/low)
    - Affected factors (prices, demand, supply, etc.)
    - Affected metrics (ZHVI, listings, rates, etc.)
    - Time horizon (immediate/short-term/long-term)
    - Sentiment analysis
    - Confidence level

    Use this to understand how news might affect markets in user's watchlist
    or any market they're interested in.

    Example flow:
    1. Search for news about "housing market crash"
    2. For each article, analyze impact on "Austin, TX"
    3. Show user which articles are most relevant and their potential impact
    """
    logger.info(f"POST /news/analyze-impact: geography={request.geography_name}")

    try:
        service = get_news_analysis_service()

        # Build article dict
        article = {
            'title': request.article_title or '',
            'content': request.article_content or '',
            'url': request.article_url,
            'source': request.article_source or 'Unknown',
            'published_date': request.article_date
        }

        # If article_id provided, fetch from database
        if request.article_id:
            # Fetch full article from news_cache
            from app.services.database_query_service import get_database_query_service
            db_service = get_database_query_service()
            article_result = db_service.query_table(
                table_name='news_cache',
                filters={'id': request.article_id},
                limit=1
            )
            if article_result.get('data'):
                article = article_result['data'][0]

        result = service.analyze_news_impact(
            article=article,
            geography_id=request.geography_id,
            geography_name=request.geography_name,
            geography_type=request.geography_type
        )
        return result
    except Exception as e:
        logger.exception("Impact analysis failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "news-analysis"}
