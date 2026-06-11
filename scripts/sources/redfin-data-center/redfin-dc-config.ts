/**
 * Single source of truth for the Redfin Data Center adapter.
 *
 * Each dashboard declares the geo levels it publishes, the S3 sub-path and
 * target table for each geo, the conflict key, any extra text-dimension
 * columns (category dims, property_type), and its metric columns.
 *
 * Metric columns ARE enumerated here (normalized snake_case). The processor's
 * known-column set = STD_META_COLUMNS ∪ metricColumns ∪ target.textDims. We
 * declare them rather than introspecting the DB because PostgREST cannot read
 * information_schema (PGRST205). Columns the CSV has but config omits are
 * ignored, so Redfin adding a column never breaks an ingest. The migration for
 * each table must define exactly STD_META_COLUMNS + metricColumns (+ textDims).
 */

import {
  PRICE_DROPS_COLUMNS,
  CONTRACT_CANCELLATIONS_COLUMNS,
  DELISTINGS_RELISTINGS_COLUMNS,
  HOUSING_MARKET_COLUMNS,
  INVESTORS_COLUMNS,
  CASH_LOAN_COLUMNS,
  BUYERS_SELLERS_COLUMNS,
  RHPI_COLUMNS,
} from "./redfin-dc-columns";

export const S3_BASE =
  "https://redfin-public-data.s3.us-west-2.amazonaws.com/redfin_data_center";

/** A single (dashboard, geo) target. */
export interface GeoTarget {
  /** S3 path relative to S3_BASE. */
  path: string;
  /** Target Supabase table. */
  table: string;
  /** Upsert conflict key columns. */
  conflictKeys: string[];
  /** Extra text dimension columns beyond region_id/region_name. */
  textDims?: string[];
  /** True when rows carry no geo (category breakdowns) — skip geo resolution. */
  noGeo?: boolean;
}

export interface DashboardConfig {
  id: string;
  /** index.json top-level key (differs from id for some dashboards). */
  indexKey: string;
  /** Normalized metric column names shared by every geo of this dashboard. */
  metricColumns: string[];
  geos: Record<string, GeoTarget>;
}

const STD_CONFLICT = ["period_end", "region_id"];
// Metro rows can be metropolitan DIVISIONS that share a parent CBSA (e.g. LA +
// Anaheim -> 31080). region_name keeps both divisions instead of colliding on
// the upsert conflict key.
const METRO_CONFLICT = ["period_end", "region_id", "region_name"];

/** Metadata columns present on every redfin_dc_* table. */
export const STD_META_COLUMNS = [
  "region_id",
  "region_name",
  "period_begin",
  "period_end",
  "frequency",
  "last_updated",
];

/** Build the 5 standard geo targets for a full-coverage dashboard. */
function fullCoverage(id: string, folder: string): Record<string, GeoTarget> {
  return {
    country: {
      path: `${folder}/monthly/country.csv`,
      table: `redfin_dc_${id}_country`,
      conflictKeys: STD_CONFLICT,
    },
    state: {
      path: `${folder}/monthly/all_states.csv`,
      table: `redfin_dc_${id}_state`,
      conflictKeys: STD_CONFLICT,
    },
    metro: {
      path: `${folder}/monthly/all_metros.csv`,
      table: `redfin_dc_${id}_metro`,
      conflictKeys: METRO_CONFLICT,
    },
    county: {
      path: `${folder}/monthly/all_counties.csv`,
      table: `redfin_dc_${id}_county`,
      conflictKeys: STD_CONFLICT,
    },
    zip: {
      path: `${folder}/monthly/all_zips.csv`,
      table: `redfin_dc_${id}_zip`,
      conflictKeys: STD_CONFLICT,
    },
  };
}

export const DASHBOARDS: Record<string, DashboardConfig> = {
  price_drops: {
    id: "price_drops",
    indexKey: "price_drops",
    metricColumns: PRICE_DROPS_COLUMNS,
    geos: fullCoverage("price_drops", "price_drops"),
  },
  contract_cancellations: {
    id: "contract_cancellations",
    indexKey: "contract_cancellations",
    metricColumns: CONTRACT_CANCELLATIONS_COLUMNS,
    geos: fullCoverage("contract_cancellations", "contract_cancellations"),
  },
  delistings_relistings: {
    id: "delistings_relistings",
    indexKey: "delistings_relistings",
    metricColumns: DELISTINGS_RELISTINGS_COLUMNS,
    geos: fullCoverage("delistings_relistings", "delistings_relistings"),
  },
  housing_market: {
    id: "housing_market",
    indexKey: "housing_market",
    metricColumns: HOUSING_MARKET_COLUMNS,
    geos: fullCoverage("housing_market", "housing_market"),
  },
  investors: {
    id: "investors",
    indexKey: "investors",
    metricColumns: INVESTORS_COLUMNS,
    geos: {
      country: {
        path: "investors/by_metro/country.csv",
        table: "redfin_dc_investors_country",
        conflictKeys: STD_CONFLICT,
      },
      metro: {
        path: "investors/by_metro/all_metros.csv",
        table: "redfin_dc_investors_metro",
        conflictKeys: METRO_CONFLICT,
      },
      by_category: {
        path: "investors/by_category/price_tier.csv",
        table: "redfin_dc_investors_by_category",
        conflictKeys: ["period_end", "category_type", "category"],
        textDims: ["category_type", "category", "property_type"],
        noGeo: true,
      },
    },
  },
  cash_loan: {
    id: "cash_loan",
    indexKey: "cash_loan",
    metricColumns: CASH_LOAN_COLUMNS,
    geos: {
      country: {
        path: "all_cash_loan_types/country.csv",
        table: "redfin_dc_cash_loan_country",
        conflictKeys: STD_CONFLICT,
      },
      metro: {
        path: "all_cash_loan_types/all_metros.csv",
        table: "redfin_dc_cash_loan_metro",
        conflictKeys: METRO_CONFLICT,
      },
    },
  },
  buyers_and_sellers: {
    id: "buyers_and_sellers",
    indexKey: "buyers_and_sellers",
    metricColumns: BUYERS_SELLERS_COLUMNS,
    geos: {
      country: {
        path: "buyers_and_sellers/monthly/country.csv",
        table: "redfin_dc_buyers_sellers_country",
        conflictKeys: ["period_end", "region_id", "property_type"],
        textDims: ["property_type", "balance_of_power"],
      },
      census_region: {
        path: "buyers_and_sellers/monthly/all_census_regions.csv",
        table: "redfin_dc_buyers_sellers_census_region",
        conflictKeys: ["period_end", "region_id", "property_type"],
        textDims: ["property_type", "balance_of_power"],
      },
      metro: {
        // Redfin only publishes this dashboard at the top-50-metro level — there is
        // no all_metros.csv for buyers_and_sellers. Do not "fix" this to all_metros.
        path: "buyers_and_sellers/monthly/top_50_metros.csv",
        table: "redfin_dc_buyers_sellers_metro",
        // region_name disambiguates metro divisions sharing a CBSA (see METRO_CONFLICT).
        conflictKeys: [
          "period_end",
          "region_id",
          "region_name",
          "property_type",
        ],
        textDims: ["property_type", "balance_of_power"],
      },
    },
  },
  rhpi: {
    id: "rhpi",
    indexKey: "rhpi",
    metricColumns: RHPI_COLUMNS,
    geos: {
      country: {
        path: "rhpi/monthly/country.csv",
        table: "redfin_dc_rhpi_country",
        conflictKeys: STD_CONFLICT,
      },
      metro: {
        path: "rhpi/monthly/all_metros.csv",
        table: "redfin_dc_rhpi_metro",
        conflictKeys: METRO_CONFLICT,
      },
    },
  },
};

export const ALL_DASHBOARD_IDS = Object.keys(DASHBOARDS);

export function getDashboard(id: string): DashboardConfig {
  const d = DASHBOARDS[id];
  if (!d) {
    throw new Error(
      `Unknown dashboard "${id}". Valid: ${ALL_DASHBOARD_IDS.join(", ")}`,
    );
  }
  return d;
}

/**
 * The full set of DB columns the processor may write for a (dashboard, geo):
 * standard metadata + the dashboard's metric columns + the target's text dims.
 * Replaces runtime information_schema introspection (unavailable via PostgREST).
 */
export function getKnownColumns(
  dashboard: DashboardConfig,
  target: GeoTarget,
): Set<string> {
  return new Set([
    ...STD_META_COLUMNS,
    ...dashboard.metricColumns,
    ...(target.textDims ?? []),
  ]);
}
