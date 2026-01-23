-- ============================================================================
-- Migration 065: Create Formula Versions Table
-- Description: Creates table for storing scoring formula versions per geography
-- ============================================================================

-- Create formula versions table (includes geography since formulas differ by level)
CREATE TABLE IF NOT EXISTS propertyiq_formula_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version VARCHAR(20) NOT NULL,
    score_type VARCHAR(20) NOT NULL,
    geography VARCHAR(10) NOT NULL DEFAULT 'all',
    formula_config JSONB NOT NULL,
    description TEXT,
    created_by VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT FALSE,
    is_default BOOLEAN DEFAULT FALSE,
    parent_version VARCHAR(20),
    change_notes TEXT,
    CONSTRAINT valid_score_type CHECK (score_type IN ('market_health', 'homeready', 'investoredge')),
    CONSTRAINT valid_geography CHECK (geography IN ('all', 'metro', 'county', 'zip')),
    UNIQUE(version, score_type, geography)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_formula_versions_active
    ON propertyiq_formula_versions(score_type, geography, is_active)
    WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_formula_versions_default
    ON propertyiq_formula_versions(score_type, geography, is_default)
    WHERE is_default = TRUE;

CREATE INDEX IF NOT EXISTS idx_formula_versions_lookup
    ON propertyiq_formula_versions(score_type, geography, created_at DESC);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON propertyiq_formula_versions TO service_role;
GRANT SELECT ON propertyiq_formula_versions TO authenticated;

-- ============================================================================
-- Seed formula versions from SCORING_SYSTEM_SPEC.md
-- Each geography level has different formulas
-- ============================================================================

-- METRO LEVEL FORMULAS
INSERT INTO propertyiq_formula_versions (version, score_type, geography, formula_config, description, is_active, is_default)
VALUES
    ('1.0.0', 'homeready', 'metro', '{
        "features": [
            {"name": "hotness_score", "weight": 70.6, "direction": "+"},
            {"name": "pending_ratio", "weight": 15.2, "direction": "+"},
            {"name": "unemployment_rate_yoy", "weight": 5.7, "direction": "-"},
            {"name": "population_yoy", "weight": 5.4, "direction": "-"},
            {"name": "demand_score", "weight": 3.1, "direction": "+"}
        ]
    }', 'Metro HomeReady formula from ML analysis', TRUE, TRUE),

    ('1.0.0', 'investoredge', 'metro', '{
        "features": [
            {"name": "hotness_score", "weight": 31.7, "direction": "+"},
            {"name": "median_gross_rent", "weight": 31.5, "direction": "-"},
            {"name": "affordability_ratio", "weight": 18.8, "direction": "-"},
            {"name": "pending_ratio", "weight": 8.0, "direction": "+"},
            {"name": "homeownership_rate", "weight": 4.7, "direction": "+"},
            {"name": "population_yoy", "weight": 3.5, "direction": "-"},
            {"name": "unemployment_rate_yoy", "weight": 1.8, "direction": "-"}
        ]
    }', 'Metro InvestorEdge formula from ML analysis', TRUE, TRUE),

    ('1.0.0', 'market_health', 'metro', '{
        "features": [
            {"name": "hotness_score", "weight": 41.6, "direction": "+"},
            {"name": "demand_score", "weight": 34.5, "direction": "+"},
            {"name": "pending_ratio", "weight": 23.9, "direction": "+"}
        ]
    }', 'Metro MarketHealth formula from ML analysis', TRUE, TRUE)
ON CONFLICT (version, score_type, geography) DO NOTHING;

-- COUNTY LEVEL FORMULAS
INSERT INTO propertyiq_formula_versions (version, score_type, geography, formula_config, description, is_active, is_default)
VALUES
    ('1.0.0', 'homeready', 'county', '{
        "features": [
            {"name": "hotness_score", "weight": 40.3, "direction": "+"},
            {"name": "affordability_ratio", "weight": 13.2, "direction": "+"},
            {"name": "price_reduced_share", "weight": 11.9, "direction": "-"},
            {"name": "population_yoy", "weight": 10.2, "direction": "-"},
            {"name": "rent_price_ratio", "weight": 9.1, "direction": "+"},
            {"name": "pending_ratio", "weight": 7.2, "direction": "+"},
            {"name": "unemployment_rate_yoy", "weight": 4.9, "direction": "+"},
            {"name": "demand_score", "weight": 3.3, "direction": "+"}
        ]
    }', 'County HomeReady formula from ML analysis', TRUE, TRUE),

    ('1.0.0', 'investoredge', 'county', '{
        "features": [
            {"name": "rent_price_ratio", "weight": 40.2, "direction": "+"},
            {"name": "hotness_score", "weight": 24.4, "direction": "+"},
            {"name": "affordability_ratio", "weight": 9.4, "direction": "+"},
            {"name": "price_reduced_share", "weight": 8.2, "direction": "-"},
            {"name": "population_yoy", "weight": 5.9, "direction": "-"},
            {"name": "pending_ratio", "weight": 5.4, "direction": "+"},
            {"name": "demand_score", "weight": 3.4, "direction": "+"},
            {"name": "unemployment_rate_yoy", "weight": 3.0, "direction": "+"}
        ]
    }', 'County InvestorEdge formula from ML analysis', TRUE, TRUE),

    ('1.0.0', 'market_health', 'county', '{
        "features": [
            {"name": "hotness_score", "weight": 53.3, "direction": "+"},
            {"name": "demand_score", "weight": 25.4, "direction": "+"},
            {"name": "pending_ratio", "weight": 21.3, "direction": "+"}
        ]
    }', 'County MarketHealth formula from ML analysis', TRUE, TRUE)
ON CONFLICT (version, score_type, geography) DO NOTHING;

-- ZIP LEVEL FORMULAS
INSERT INTO propertyiq_formula_versions (version, score_type, geography, formula_config, description, is_active, is_default)
VALUES
    ('1.0.0', 'homeready', 'zip', '{
        "features": [
            {"name": "hotness_score", "weight": 53.4, "direction": "+"},
            {"name": "demand_score", "weight": 18.4, "direction": "+"},
            {"name": "pending_ratio", "weight": 16.5, "direction": "+"},
            {"name": "active_listing_count_yy", "weight": 10.1, "direction": "+"},
            {"name": "price_reduced_count_yy", "weight": 1.6, "direction": "+"}
        ]
    }', 'ZIP HomeReady formula from ML analysis', TRUE, TRUE),

    ('1.0.0', 'investoredge', 'zip', '{
        "features": [
            {"name": "hotness_score", "weight": 53.4, "direction": "+"},
            {"name": "demand_score", "weight": 18.4, "direction": "+"},
            {"name": "pending_ratio", "weight": 16.5, "direction": "+"},
            {"name": "active_listing_count_yy", "weight": 10.1, "direction": "+"},
            {"name": "price_reduced_count_yy", "weight": 1.6, "direction": "+"}
        ]
    }', 'ZIP InvestorEdge formula (same as HomeReady per spec)', TRUE, TRUE),

    ('1.0.0', 'market_health', 'zip', '{
        "features": [
            {"name": "hotness_score", "weight": 69.9, "direction": "+"},
            {"name": "demand_score", "weight": 30.1, "direction": "+"}
        ]
    }', 'ZIP MarketHealth formula from ML analysis', TRUE, TRUE)
ON CONFLICT (version, score_type, geography) DO NOTHING;
