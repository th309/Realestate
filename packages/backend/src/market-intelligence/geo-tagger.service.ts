/**
 * Geo-Tagger Service
 *
 * Matches article text (headline + description) against a curated list of
 * metro names and common abbreviations to produce geography tags. Metro names
 * are lazy-loaded from Supabase on first use and cached in memory.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

/** Result of geo-tagging an article against known metro areas */
export interface GeoTagResult {
  geography_id: string;
  geography_name: string;
  confidence: number;
}

/** Internal representation of a metro area with its searchable names */
interface MetroEntry {
  geography_id: string;
  geography_name: string;
  /** Regex patterns to match against text (word-boundary-aware) */
  searchPatterns: RegExp[];
}

/** Headline matches are more reliable than description-only matches */
const HEADLINE_CONFIDENCE = 0.95;
const DESCRIPTION_CONFIDENCE = 0.75;

/**
 * Common metro abbreviations and colloquial names mapped to the official
 * metro name prefix they should match. The value must be a substring of
 * the official `geography_name` stored in the database.
 */
const METRO_ABBREVIATIONS: Record<string, string> = {
  'nyc': 'new york',
  'dfw': 'dallas-fort worth',
  'dmv': 'washington',
  'bay area': 'san francisco',
  'socal': 'los angeles',
  'norcal': 'san francisco',
  'philly': 'philadelphia',
  'chi-town': 'chicago',
  'atl': 'atlanta',
  'bos': 'boston',
  'dc': 'washington',
  'la': 'los angeles',
  'sf': 'san francisco',
  'lv': 'las vegas',
  'stl': 'st. louis',
  'kc': 'kansas city',
  'msp': 'minneapolis',
  'rdu': 'raleigh',
  'oc': 'los angeles',
  'ie': 'riverside',
  'hampton roads': 'virginia beach',
  'silicon valley': 'san jose',
  'motor city': 'detroit',
  'twin cities': 'minneapolis',
  'the woodlands': 'houston',
};

@Injectable()
export class GeoTaggerService {
  private readonly logger = new Logger(GeoTaggerService.name);
  private metroEntries: MetroEntry[] | null = null;

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Tag an article's headline and description against known metro areas.
   * Returns all matches sorted by confidence descending.
   */
  async tagArticle(headline: string, description: string): Promise<GeoTagResult[]> {
    const entries = await this.getMetroEntries();

    const headlineLower = headline.toLowerCase();
    const descriptionLower = description.toLowerCase();
    const results: GeoTagResult[] = [];

    for (const entry of entries) {
      const matchedInHeadline = entry.searchPatterns.some(
        pattern => pattern.test(headlineLower),
      );
      const matchedInDescription = !matchedInHeadline && entry.searchPatterns.some(
        pattern => pattern.test(descriptionLower),
      );

      if (matchedInHeadline) {
        results.push({
          geography_id: entry.geography_id,
          geography_name: entry.geography_name,
          confidence: HEADLINE_CONFIDENCE,
        });
      } else if (matchedInDescription) {
        results.push({
          geography_id: entry.geography_id,
          geography_name: entry.geography_name,
          confidence: DESCRIPTION_CONFIDENCE,
        });
      }
    }

    results.sort((a, b) => b.confidence - a.confidence);
    return results;
  }

  /**
   * Lazy-load metro entries from Supabase on first call, then serve from
   * in-memory cache. Falls back to a hardcoded list if the DB query fails.
   */
  private async getMetroEntries(): Promise<MetroEntry[]> {
    if (this.metroEntries) return this.metroEntries;

    try {
      const client = this.supabase.getClient();
      const { data, error } = await client
        .from('geographies')
        .select('geography_id, geography_name')
        .eq('geography_type', 'metro');

      if (error || !data || data.length === 0) {
        this.logger.warn(
          'Could not load metros from geographies table, using hardcoded fallback',
        );
        this.metroEntries = this.buildFallbackEntries();
        return this.metroEntries;
      }

      this.metroEntries = data.map(row =>
        this.buildMetroEntry(row.geography_id, row.geography_name),
      );
    } catch (err) {
      this.logger.warn(`DB unavailable for metro load: ${err.message}`);
      this.metroEntries = this.buildFallbackEntries();
    }

    // Append abbreviation-based entries that map to loaded metros
    this.appendAbbreviationEntries();

    return this.metroEntries!;
  }

  /**
   * Build a MetroEntry with search patterns derived from the official name.
   * e.g. "Dallas-Fort Worth-Arlington, TX" generates patterns for:
   *   "dallas-fort worth-arlington, tx", "dallas-fort worth", "dallas"
   * Short terms (<=3 chars) use word-boundary matching to avoid false positives.
   */
  private buildMetroEntry(id: string, name: string): MetroEntry {
    const terms: string[] = [name.toLowerCase()];

    // Add the part before the state abbreviation
    const commaIdx = name.indexOf(',');
    if (commaIdx > 0) {
      terms.push(name.substring(0, commaIdx).toLowerCase());
    }

    // Add the first city (before the first dash or hyphen)
    const dashIdx = name.indexOf('-');
    if (dashIdx > 0) {
      terms.push(name.substring(0, dashIdx).toLowerCase().trim());
    }

    return {
      geography_id: id,
      geography_name: name,
      searchPatterns: terms.map(t => this.buildSearchPattern(t)),
    };
  }

  /** Link abbreviation patterns to their parent metro entry */
  private appendAbbreviationEntries(): void {
    if (!this.metroEntries) return;

    for (const [abbrev, metroNameFragment] of Object.entries(METRO_ABBREVIATIONS)) {
      const matchingEntry = this.metroEntries.find(
        e => e.geography_name.toLowerCase().includes(metroNameFragment),
      );
      if (matchingEntry) {
        matchingEntry.searchPatterns.push(this.buildSearchPattern(abbrev));
      }
    }
  }

  /**
   * Build a regex pattern from a search term. Short terms (<=3 chars) use
   * word-boundary matching to prevent false positives like "la" in "layoffs".
   */
  private buildSearchPattern(term: string): RegExp {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (term.length <= 3) {
      return new RegExp(`\\b${escaped}\\b`, 'i');
    }
    return new RegExp(escaped, 'i');
  }

  /**
   * Hardcoded top ~50 US metro areas for when the geographies table
   * is unavailable. TODO: Replace with full DB-driven list.
   */
  private buildFallbackEntries(): MetroEntry[] {
    const fallbackMetros: Array<[string, string]> = [
      ['35620', 'New York-Newark-Jersey City, NY-NJ-PA'],
      ['31080', 'Los Angeles-Long Beach-Anaheim, CA'],
      ['16980', 'Chicago-Naperville-Elgin, IL-IN-WI'],
      ['19100', 'Dallas-Fort Worth-Arlington, TX'],
      ['26420', 'Houston-The Woodlands-Sugar Land, TX'],
      ['47900', 'Washington-Arlington-Alexandria, DC-VA-MD-WV'],
      ['33100', 'Miami-Fort Lauderdale-Pompano Beach, FL'],
      ['37980', 'Philadelphia-Camden-Wilmington, PA-NJ-DE-MD'],
      ['12060', 'Atlanta-Sandy Springs-Alpharetta, GA'],
      ['14460', 'Boston-Cambridge-Newton, MA-NH'],
      ['38060', 'Phoenix-Mesa-Chandler, AZ'],
      ['41740', 'San Diego-Chula Vista-Carlsbad, CA'],
      ['41860', 'San Francisco-Oakland-Berkeley, CA'],
      ['40140', 'Riverside-San Bernardino-Ontario, CA'],
      ['19820', 'Detroit-Warren-Dearborn, MI'],
      ['42660', 'Seattle-Tacoma-Bellevue, WA'],
      ['33460', 'Minneapolis-St. Paul-Bloomington, MN-WI'],
      ['45300', 'Tampa-St. Petersburg-Clearwater, FL'],
      ['19740', 'Denver-Aurora-Lakewood, CO'],
      ['41180', 'St. Louis, MO-IL'],
      ['12580', 'Baltimore-Columbia-Towson, MD'],
      ['36740', 'Orlando-Kissimmee-Sanford, FL'],
      ['16740', 'Charlotte-Concord-Gastonia, NC-SC'],
      ['41700', 'San Antonio-New Braunfels, TX'],
      ['38900', 'Portland-Vancouver-Hillsboro, OR-WA'],
      ['41940', 'San Jose-Sunnyvale-Santa Clara, CA'],
      ['36420', 'Oklahoma City, OK'],
      ['39580', 'Raleigh-Cary, NC'],
      ['34980', 'Nashville-Davidson-Murfreesboro-Franklin, TN'],
      ['12420', 'Austin-Round Rock-Georgetown, TX'],
      ['29820', 'Las Vegas-Henderson-Paradise, NV'],
      ['17460', 'Cleveland-Elyria, OH'],
      ['18140', 'Columbus, OH'],
      ['26900', 'Indianapolis-Carmel-Anderson, IN'],
      ['41620', 'Salt Lake City, UT'],
      ['27260', 'Jacksonville, FL'],
      ['32820', 'Memphis, TN-MS-AR'],
      ['28140', 'Kansas City, MO-KS'],
      ['47260', 'Virginia Beach-Norfolk-Newport News, VA-NC'],
      ['40060', 'Richmond, VA'],
      ['33340', 'Milwaukee-Waukesha, WI'],
      ['38300', 'Pittsburgh, PA'],
      ['40900', 'Sacramento-Roseville-Folsom, CA'],
      ['12940', 'Boise City, ID'],
      ['15380', 'Buffalo-Cheektowaga, NY'],
      ['24340', 'Grand Rapids-Kentwood, MI'],
      ['46060', 'Tucson, AZ'],
      ['46140', 'Tulsa, OK'],
    ];

    return fallbackMetros.map(([id, name]) => this.buildMetroEntry(id, name));
  }

  /** Exposed for testing: clear the cached metro list */
  clearCache(): void {
    this.metroEntries = null;
  }
}
