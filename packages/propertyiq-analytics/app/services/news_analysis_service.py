"""
News Analysis Service

Searches real estate news and analyzes impact on specific markets.
Uses AI to determine relevance and potential market effects.
"""

import logging
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
import os
import re

import pandas as pd
from supabase import create_client, Client

logger = logging.getLogger(__name__)


class NewsAnalysisService:
    """Service for searching and analyzing real estate news."""

    def __init__(self):
        self._client: Optional[Client] = None
        logger.info("NewsAnalysisService initialized")

    @property
    def client(self) -> Client:
        """Lazy-load Supabase client."""
        if self._client is None:
            url = os.getenv("SUPABASE_URL")
            key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY")
            if not url or not key:
                raise ValueError("SUPABASE_URL and SUPABASE_KEY required")
            self._client = create_client(url, key)
        return self._client

    def search_news(
        self,
        query: Optional[str] = None,
        geography_name: Optional[str] = None,
        geography_type: Optional[str] = None,
        days_back: int = 30,
        limit: int = 20
    ) -> Dict[str, Any]:
        """
        Search news cache for relevant articles.

        Args:
            query: Search term (e.g., "housing market", "mortgage rates")
            geography_name: Specific geography (e.g., "Austin", "Texas")
            geography_type: Type of geography (metro, state, national)
            days_back: Number of days to search back
            limit: Max articles to return

        Returns:
            Dict with matching news articles
        """
        try:
            # Build query
            db_query = self.client.table('news_cache').select('*')

            # Date filter
            cutoff_date = (datetime.now() - timedelta(days=days_back)).isoformat()
            db_query = db_query.gte('published_date', cutoff_date)

            # Geography filter
            if geography_name:
                db_query = db_query.ilike('content', f'%{geography_name}%')

            # Search term filter
            if query:
                db_query = db_query.or_(
                    f'title.ilike.%{query}%,content.ilike.%{query}%,summary.ilike.%{query}%'
                )

            # Sort and limit
            db_query = db_query.order('published_date', desc=True).limit(limit)

            result = db_query.execute()

            if not result.data:
                return {
                    'success': True,
                    'count': 0,
                    'articles': [],
                    'message': 'No articles found matching criteria'
                }

            return {
                'success': True,
                'count': len(result.data),
                'articles': result.data,
                'search_params': {
                    'query': query,
                    'geography': geography_name,
                    'days_back': days_back
                }
            }

        except Exception as e:
            logger.error(f"News search failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    def analyze_news_impact(
        self,
        article: Dict[str, Any],
        geography_id: str,
        geography_name: str,
        geography_type: str = 'metro'
    ) -> Dict[str, Any]:
        """
        Analyze how a news article might impact a specific market.

        Args:
            article: News article dict with title, content, summary
            geography_id: Geographic ID (e.g., CBSA code)
            geography_name: Geographic name (e.g., "Austin, TX")
            geography_type: Type of geography

        Returns:
            Dict with impact analysis
        """
        try:
            title = article.get('title', '')
            content = article.get('content', article.get('summary', ''))
            source = article.get('source', 'Unknown')

            # Simple relevance scoring
            relevance_score = self._calculate_relevance(
                title, content, geography_name, geography_type
            )

            # Impact analysis
            impact_analysis = self._analyze_impact_factors(title, content)

            # Sentiment analysis
            sentiment = self._analyze_sentiment(title, content)

            # Time horizon
            time_horizon = self._estimate_time_horizon(title, content)

            # Confidence
            confidence = self._calculate_confidence(
                relevance_score, article, geography_type
            )

            return {
                'success': True,
                'article': {
                    'title': title,
                    'source': source,
                    'published_date': article.get('published_date'),
                    'url': article.get('url')
                },
                'geography': {
                    'id': geography_id,
                    'name': geography_name,
                    'type': geography_type
                },
                'relevance': {
                    'score': relevance_score,
                    'level': self._relevance_level(relevance_score),
                    'explanation': self._explain_relevance(
                        relevance_score, geography_name, title, content
                    )
                },
                'impact': {
                    'direction': sentiment['direction'],  # positive, negative, neutral
                    'magnitude': impact_analysis['magnitude'],  # low, medium, high
                    'factors': impact_analysis['factors'],
                    'affected_metrics': impact_analysis['metrics'],
                    'time_horizon': time_horizon,  # immediate, short-term, long-term
                },
                'sentiment': sentiment,
                'confidence': {
                    'score': confidence,
                    'level': 'high' if confidence > 0.7 else 'medium' if confidence > 0.4 else 'low'
                }
            }

        except Exception as e:
            logger.error(f"Impact analysis failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    def _calculate_relevance(
        self,
        title: str,
        content: str,
        geography_name: str,
        geography_type: str
    ) -> float:
        """Calculate relevance score 0-1."""
        score = 0.0
        text = (title + ' ' + content).lower()

        # Direct mention of geography
        if geography_name.lower() in text:
            score += 0.5

        # State mention (if metro/county)
        if geography_type in ['metro', 'county']:
            parts = geography_name.split(',')
            if len(parts) > 1 and parts[1].strip().lower() in text:
                score += 0.2

        # National news (relevant to all)
        national_terms = ['national', 'federal', 'fed', 'treasury', 'nationwide']
        if any(term in text for term in national_terms):
            score += 0.3

        # Real estate relevance
        re_terms = ['housing', 'home', 'real estate', 'property', 'mortgage', 'rent']
        mentions = sum(1 for term in re_terms if term in text)
        score += min(mentions * 0.1, 0.3)

        return min(score, 1.0)

    def _analyze_impact_factors(
        self,
        title: str,
        content: str
    ) -> Dict[str, Any]:
        """Analyze what factors might be impacted."""
        text = (title + ' ' + content).lower()

        factors = []
        metrics = []
        magnitude = 'low'

        # Price impact
        if any(term in text for term in ['price', 'appreciation', 'value', 'expensive', 'affordable']):
            factors.append('prices')
            metrics.append('ZHVI')
            metrics.append('median_listing_price')

        # Demand impact
        if any(term in text for term in ['demand', 'buyer', 'sales', 'sold', 'inventory']):
            factors.append('demand')
            metrics.append('active_listing_count')
            metrics.append('new_listing_count')

        # Supply impact
        if any(term in text for term in ['supply', 'inventory', 'listing', 'builder', 'construction']):
            factors.append('supply')
            metrics.append('months_of_supply')
            metrics.append('active_listing_count')

        # Interest rates
        if any(term in text for term in ['rate', 'mortgage', 'fed', 'interest', 'financing']):
            factors.append('financing')
            metrics.append('mortgage_rates')

        # Economic factors
        if any(term in text for term in ['job', 'employment', 'economy', 'gdp', 'income']):
            factors.append('economic_fundamentals')
            metrics.append('unemployment_rate')
            metrics.append('median_household_income')

        # Migration/population
        if any(term in text for term in ['migration', 'moving', 'population', 'relocate']):
            factors.append('migration')
            metrics.append('population_growth')

        # Magnitude assessment
        if any(term in text for term in ['surge', 'soar', 'plunge', 'crash', 'boom']):
            magnitude = 'high'
        elif any(term in text for term in ['increase', 'decrease', 'rise', 'fall', 'grow']):
            magnitude = 'medium'

        return {
            'factors': list(set(factors)),
            'metrics': list(set(metrics)),
            'magnitude': magnitude
        }

    def _analyze_sentiment(self, title: str, content: str) -> Dict[str, Any]:
        """Simple sentiment analysis."""
        text = (title + ' ' + content).lower()

        positive_terms = [
            'growth', 'increase', 'rise', 'boom', 'strong', 'gain', 'improve',
            'surge', 'hot', 'demand', 'recovery', 'soar'
        ]

        negative_terms = [
            'decline', 'fall', 'drop', 'crash', 'weak', 'loss', 'worsen',
            'plunge', 'cool', 'slowdown', 'recession', 'crisis'
        ]

        pos_count = sum(1 for term in positive_terms if term in text)
        neg_count = sum(1 for term in negative_terms if term in negative_terms)

        if pos_count > neg_count * 1.5:
            direction = 'positive'
            score = min(pos_count / 5, 1.0)
        elif neg_count > pos_count * 1.5:
            direction = 'negative'
            score = min(neg_count / 5, 1.0)
        else:
            direction = 'neutral'
            score = 0.5

        return {
            'direction': direction,
            'score': score,
            'positive_signals': pos_count,
            'negative_signals': neg_count
        }

    def _estimate_time_horizon(self, title: str, content: str) -> str:
        """Estimate when impact might occur."""
        text = (title + ' ' + content).lower()

        if any(term in text for term in ['today', 'now', 'immediate', 'just', 'breaking']):
            return 'immediate'
        elif any(term in text for term in ['next month', 'coming weeks', 'soon', 'q1', 'q2']):
            return 'short-term'
        else:
            return 'long-term'

    def _calculate_confidence(
        self,
        relevance_score: float,
        article: Dict[str, Any],
        geography_type: str
    ) -> float:
        """Calculate confidence in the analysis."""
        confidence = relevance_score * 0.6

        # More confident about national news
        if geography_type == 'national':
            confidence += 0.2

        # More confident if article has more data
        if article.get('content') and len(article['content']) > 500:
            confidence += 0.1

        # More confident if recent
        pub_date = article.get('published_date')
        if pub_date:
            try:
                days_old = (datetime.now() - datetime.fromisoformat(pub_date.replace('Z', ''))).days
                if days_old < 7:
                    confidence += 0.1
            except:
                pass

        return min(confidence, 1.0)

    def _relevance_level(self, score: float) -> str:
        """Convert relevance score to level."""
        if score >= 0.7:
            return 'high'
        elif score >= 0.4:
            return 'medium'
        else:
            return 'low'

    def _explain_relevance(
        self,
        score: float,
        geography_name: str,
        title: str,
        content: str
    ) -> str:
        """Explain why article is relevant."""
        text = (title + ' ' + content).lower()
        geo_lower = geography_name.lower()

        if geo_lower in text:
            return f"Article specifically mentions {geography_name}"
        elif score > 0.5:
            return f"Article discusses factors that impact {geography_name}"
        elif score > 0.3:
            return f"Article covers national trends relevant to {geography_name}"
        else:
            return f"Article has limited relevance to {geography_name}"


# Singleton
_news_service: Optional[NewsAnalysisService] = None

def get_news_analysis_service() -> NewsAnalysisService:
    """Get or create the news analysis service singleton."""
    global _news_service
    if _news_service is None:
        _news_service = NewsAnalysisService()
    return _news_service
