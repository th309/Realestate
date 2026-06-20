/**
 * Curated pool of recognizable major metros for the landing hero's dynamic
 * "famous cooler vs. surprising riser" contrast.
 *
 * This is the ONE human-maintained artifact behind the hero: each month the
 * hero fetch pulls live scores for this pool and auto-selects the biggest
 * 3-month faller (cooler) and biggest riser. Names/numbers/selection refresh
 * themselves — only this list is curated, and it rarely changes. Members with
 * no score / insufficient history are skipped at fetch time, so the list can be
 * generous. "Recognizable" is the bar: the live global #1 is an obscure
 * micro-metro, so we constrain selection to markets a visitor actually knows.
 */
export const FEATURED_METRO_POOL: ReadonlyArray<{
  cbsa: string;
  name: string;
}> = [
  { cbsa: "12420", name: "Austin, TX" },
  { cbsa: "19100", name: "Dallas, TX" },
  { cbsa: "26420", name: "Houston, TX" },
  { cbsa: "41700", name: "San Antonio, TX" },
  { cbsa: "34980", name: "Nashville, TN" },
  { cbsa: "12060", name: "Atlanta, GA" },
  { cbsa: "16740", name: "Charlotte, NC" },
  { cbsa: "39580", name: "Raleigh, NC" },
  { cbsa: "38060", name: "Phoenix, AZ" },
  { cbsa: "29820", name: "Las Vegas, NV" },
  { cbsa: "19740", name: "Denver, CO" },
  { cbsa: "41620", name: "Salt Lake City, UT" },
  { cbsa: "14260", name: "Boise, ID" },
  { cbsa: "33100", name: "Miami, FL" },
  { cbsa: "45300", name: "Tampa, FL" },
  { cbsa: "36740", name: "Orlando, FL" },
  { cbsa: "27260", name: "Jacksonville, FL" },
  { cbsa: "42660", name: "Seattle, WA" },
  { cbsa: "38900", name: "Portland, OR" },
  { cbsa: "15380", name: "Buffalo, NY" },
  { cbsa: "38300", name: "Pittsburgh, PA" },
  { cbsa: "40380", name: "Rochester, NY" },
  { cbsa: "19820", name: "Detroit, MI" },
  { cbsa: "41180", name: "St. Louis, MO" },
  { cbsa: "17140", name: "Cincinnati, OH" },
  { cbsa: "18140", name: "Columbus, OH" },
  { cbsa: "26900", name: "Indianapolis, IN" },
  { cbsa: "28140", name: "Kansas City, MO" },
  { cbsa: "33340", name: "Milwaukee, WI" },
  { cbsa: "33460", name: "Minneapolis, MN" },
  { cbsa: "16980", name: "Chicago, IL" },
  { cbsa: "37980", name: "Philadelphia, PA" },
  { cbsa: "14460", name: "Boston, MA" },
  { cbsa: "47900", name: "Washington, DC" },
  { cbsa: "31080", name: "Los Angeles, CA" },
  { cbsa: "41740", name: "San Diego, CA" },
  { cbsa: "40900", name: "Sacramento, CA" },
  { cbsa: "32820", name: "Memphis, TN" },
];
