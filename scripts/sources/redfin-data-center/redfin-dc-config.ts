/**
 * Single source of truth for the Redfin Data Center adapter.
 *
 * Each dashboard declares the geo levels it publishes, the S3 sub-path and
 * target table for each geo, the conflict key, and any extra text-dimension
 * columns (category dims, property_type) that are part of the row identity.
 *
 * Metric columns are NOT enumerated here — the generic processor derives them
 * from the CSV header via the column normalizer, intersected with the table's
 * actual columns (unknown columns are ignored, so Redfin adding a column never
 * breaks an ingest).
 */

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
  geos: Record<string, GeoTarget>;
}

const STD_CONFLICT = ["period_end", "region_id"];

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
      conflictKeys: STD_CONFLICT,
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
    geos: fullCoverage("price_drops", "price_drops"),
  },
  contract_cancellations: {
    id: "contract_cancellations",
    indexKey: "contract_cancellations",
    geos: fullCoverage("contract_cancellations", "contract_cancellations"),
  },
  delistings_relistings: {
    id: "delistings_relistings",
    indexKey: "delistings_relistings",
    geos: fullCoverage("delistings_relistings", "delistings_relistings"),
  },
  housing_market: {
    id: "housing_market",
    indexKey: "housing_market",
    geos: fullCoverage("housing_market", "housing_market"),
  },
  investors: {
    id: "investors",
    indexKey: "investors",
    geos: {
      country: {
        path: "investors/by_metro/country.csv",
        table: "redfin_dc_investors_country",
        conflictKeys: STD_CONFLICT,
      },
      metro: {
        path: "investors/by_metro/all_metros.csv",
        table: "redfin_dc_investors_metro",
        conflictKeys: STD_CONFLICT,
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
    geos: {
      country: {
        path: "all_cash_loan_types/country.csv",
        table: "redfin_dc_cash_loan_country",
        conflictKeys: STD_CONFLICT,
      },
      metro: {
        path: "all_cash_loan_types/all_metros.csv",
        table: "redfin_dc_cash_loan_metro",
        conflictKeys: STD_CONFLICT,
      },
    },
  },
  buyers_and_sellers: {
    id: "buyers_and_sellers",
    indexKey: "buyers_and_sellers",
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
        path: "buyers_and_sellers/monthly/top_50_metros.csv",
        table: "redfin_dc_buyers_sellers_metro",
        conflictKeys: ["period_end", "region_id", "property_type"],
        textDims: ["property_type", "balance_of_power"],
      },
    },
  },
  rhpi: {
    id: "rhpi",
    indexKey: "rhpi",
    geos: {
      country: {
        path: "rhpi/monthly/country.csv",
        table: "redfin_dc_rhpi_country",
        conflictKeys: STD_CONFLICT,
      },
      metro: {
        path: "rhpi/monthly/all_metros.csv",
        table: "redfin_dc_rhpi_metro",
        conflictKeys: STD_CONFLICT,
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
