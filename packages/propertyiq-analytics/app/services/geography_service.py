"""
Geography Service

Handles geographic relationships and spatial queries:
- Find neighboring/adjacent geographies
- Compare geography to its neighbors
- Spatial analysis and distance calculations
"""

import logging
from typing import Optional, List, Dict, Any
import os

import pandas as pd
from supabase import create_client, Client

logger = logging.getLogger(__name__)


class GeographyService:
    """Service for geographic relationships and spatial queries."""

    def __init__(self):
        self._client: Optional[Client] = None
        logger.info("GeographyService initialized")

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

    def find_neighbors(
        self,
        geography_id: str,
        geography_type: str = 'county',
        method: str = 'same_state'
    ) -> Dict[str, Any]:
        """
        Find neighboring geographies.

        Args:
            geography_id: ID of the geography (e.g., FIPS code for county)
            geography_type: Type (county, metro, zip, state)
            method: 'same_state' (all in same state), 'adjacent' (bordering), 'nearby' (within radius)

        Returns:
            Dict with neighboring geographies
        """
        try:
            # First, get the target geography details
            target_query = self.client.table('geographies').select('*').eq('geography_id', geography_id).execute()

            if not target_query.data:
                return {
                    'success': False,
                    'error': f'Geography {geography_id} not found'
                }

            target = target_query.data[0]
            target_name = target.get('geography_name', '')
            parent_id = target.get('parent_geography_id')  # State for counties

            neighbors = []

            if method == 'same_state' and parent_id:
                # Get all geographies of same type in same state
                state_query = self.client.table('geographies').select('*').eq(
                    'parent_geography_id', parent_id
                ).eq('geography_type', geography_type).neq('geography_id', geography_id).execute()

                neighbors = state_query.data or []

            elif method == 'adjacent':
                # For adjacent, we'd need boundary data or a pre-computed adjacency table
                # Check if we have adjacency data
                adj_query = self.client.table('geography_adjacency').select('*').eq(
                    'geography_id', geography_id
                ).execute()

                if adj_query.data:
                    # Use pre-computed adjacency
                    neighbor_ids = [adj['neighbor_id'] for adj in adj_query.data]
                    neighbor_query = self.client.table('geographies').select('*').in_(
                        'geography_id', neighbor_ids
                    ).execute()
                    neighbors = neighbor_query.data or []
                else:
                    # Fallback to same_state method
                    logger.warning("No adjacency data found, falling back to same_state")
                    return self.find_neighbors(geography_id, geography_type, method='same_state')

            elif method == 'nearby':
                # For nearby, would need lat/lon distance calculation
                # For now, use same_state as approximation
                logger.warning("Nearby method not implemented, using same_state")
                return self.find_neighbors(geography_id, geography_type, method='same_state')

            return {
                'success': True,
                'target_geography': {
                    'id': geography_id,
                    'name': target_name,
                    'type': geography_type,
                    'parent': parent_id
                },
                'method': method,
                'neighbor_count': len(neighbors),
                'neighbors': neighbors
            }

        except Exception as e:
            logger.error(f"Find neighbors failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    def compare_to_neighbors(
        self,
        geography_id: str,
        geography_name: str,
        geography_type: str = 'county',
        metrics: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Compare a geography to its neighbors across key metrics.

        Args:
            geography_id: ID of geography to analyze
            geography_name: Name of geography
            geography_type: Type (county, metro, zip)
            metrics: List of metrics to compare (None = all scores)

        Returns:
            Comparison analysis
        """
        try:
            # Find neighbors
            neighbors_result = self.find_neighbors(geography_id, geography_type, method='same_state')

            if not neighbors_result['success']:
                return neighbors_result

            neighbors = neighbors_result['neighbors']
            neighbor_ids = [n['geography_id'] for n in neighbors]
            all_ids = [geography_id] + neighbor_ids

            # Get scores for target and neighbors
            scores_query = self.client.table('propertyiq_scores').select('*').in_(
                'geography_id', all_ids
            ).execute()

            if not scores_query.data:
                return {
                    'success': False,
                    'error': 'No scores found for these geographies'
                }

            # Convert to DataFrame for analysis
            df = pd.DataFrame(scores_query.data)

            # Default metrics to compare
            if metrics is None:
                metrics = ['investoredge_score', 'homeready_score', 'market_health_score']

            # Calculate rankings and comparisons
            target_data = df[df['geography_id'] == geography_id].iloc[0] if len(df[df['geography_id'] == geography_id]) > 0 else None

            if target_data is None:
                return {
                    'success': False,
                    'error': 'No data found for target geography'
                }

            comparisons = {}
            for metric in metrics:
                if metric not in df.columns:
                    continue

                target_value = float(target_data[metric]) if pd.notna(target_data[metric]) else None
                neighbor_values = df[df['geography_id'] != geography_id][metric].dropna()

                if target_value is None or len(neighbor_values) == 0:
                    continue

                avg_neighbor = float(neighbor_values.mean())
                percentile = float((neighbor_values < target_value).sum() / len(neighbor_values) * 100)

                # Rank among neighbors (1 = best)
                all_values = df[metric].dropna().sort_values(ascending=False)
                rank = int(all_values.reset_index(drop=True)[all_values == target_value].index[0] + 1) if target_value in all_values.values else None

                comparisons[metric] = {
                    'target_value': target_value,
                    'neighbor_average': avg_neighbor,
                    'difference': target_value - avg_neighbor,
                    'percentile': percentile,  # % of neighbors scored lower
                    'rank': rank,
                    'total_compared': len(all_values),
                    'better_than_average': target_value > avg_neighbor
                }

            # Overall assessment
            better_count = sum(1 for c in comparisons.values() if c['better_than_average'])
            total_metrics = len(comparisons)

            if better_count / total_metrics >= 0.75:
                assessment = 'significantly_better'
            elif better_count / total_metrics >= 0.5:
                assessment = 'better'
            elif better_count / total_metrics >= 0.25:
                assessment = 'similar'
            else:
                assessment = 'weaker'

            return {
                'success': True,
                'target': {
                    'id': geography_id,
                    'name': geography_name,
                    'type': geography_type
                },
                'neighbors_analyzed': len(neighbor_ids),
                'metrics_compared': list(comparisons.keys()),
                'comparisons': comparisons,
                'overall_assessment': assessment,
                'summary': self._generate_comparison_summary(
                    geography_name, comparisons, assessment
                )
            }

        except Exception as e:
            logger.error(f"Compare to neighbors failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    def _generate_comparison_summary(
        self,
        geography_name: str,
        comparisons: Dict[str, Dict],
        assessment: str
    ) -> str:
        """Generate human-readable summary of comparison."""
        lines = [f"Comparison of {geography_name} to neighboring counties:"]

        for metric, data in comparisons.items():
            metric_name = metric.replace('_score', '').replace('_', ' ').title()
            target = data['target_value']
            avg = data['neighbor_average']
            pct = data['percentile']
            rank = data['rank']
            total = data['total_compared']

            if data['better_than_average']:
                lines.append(
                    f"• {metric_name}: {target:.1f} (Rank #{rank}/{total}, better than {pct:.0f}% of neighbors, +{data['difference']:.1f} above average)"
                )
            else:
                lines.append(
                    f"• {metric_name}: {target:.1f} (Rank #{rank}/{total}, {data['difference']:.1f} below neighbor average of {avg:.1f})"
                )

        if assessment == 'significantly_better':
            lines.append("\n✅ Overall: Significantly outperforms neighboring counties")
        elif assessment == 'better':
            lines.append("\n✅ Overall: Performs better than neighboring counties")
        elif assessment == 'similar':
            lines.append("\n➡️ Overall: Similar performance to neighboring counties")
        else:
            lines.append("\n⚠️ Overall: Underperforms compared to neighboring counties")

        return '\n'.join(lines)

    def find_similar_geographies(
        self,
        geography_id: str,
        geography_type: str = 'county',
        limit: int = 10,
        similarity_metrics: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Find geographies similar to the target based on scores/metrics.

        Args:
            geography_id: Target geography
            geography_type: Type of geography
            limit: Max similar geographies to return
            similarity_metrics: Metrics to use for similarity (None = scores)

        Returns:
            List of similar geographies with similarity scores
        """
        try:
            # Get target geography scores
            target_query = self.client.table('propertyiq_scores').select('*').eq(
                'geography_id', geography_id
            ).execute()

            if not target_query.data:
                return {
                    'success': False,
                    'error': 'Target geography not found'
                }

            target = target_query.data[0]

            # Get all geographies of same type
            all_query = self.client.table('propertyiq_scores').select('*').eq(
                'geography_type', geography_type
            ).neq('geography_id', geography_id).execute()

            if not all_query.data:
                return {
                    'success': False,
                    'error': 'No comparison geographies found'
                }

            # Calculate similarity (Euclidean distance)
            if similarity_metrics is None:
                similarity_metrics = ['investoredge_score', 'homeready_score', 'market_health_score']

            target_values = [float(target.get(m, 0)) for m in similarity_metrics]

            similarities = []
            for geo in all_query.data:
                geo_values = [float(geo.get(m, 0)) for m in similarity_metrics]

                # Euclidean distance
                distance = sum((t - g) ** 2 for t, g in zip(target_values, geo_values)) ** 0.5

                # Convert to similarity score (inverse of distance)
                similarity = 1 / (1 + distance)

                similarities.append({
                    'geography_id': geo['geography_id'],
                    'geography_name': geo.get('geography_name', ''),
                    'similarity_score': round(similarity, 4),
                    'distance': round(distance, 2),
                    'scores': {m: geo.get(m) for m in similarity_metrics}
                })

            # Sort by similarity (highest first)
            similarities.sort(key=lambda x: x['similarity_score'], reverse=True)

            return {
                'success': True,
                'target_geography': {
                    'id': geography_id,
                    'name': target.get('geography_name', ''),
                    'scores': {m: target.get(m) for m in similarity_metrics}
                },
                'similar_geographies': similarities[:limit],
                'similarity_metrics': similarity_metrics
            }

        except Exception as e:
            logger.error(f"Find similar geographies failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }


# Singleton
_geography_service: Optional[GeographyService] = None

def get_geography_service() -> GeographyService:
    """Get or create the geography service singleton."""
    global _geography_service
    if _geography_service is None:
        _geography_service = GeographyService()
    return _geography_service
