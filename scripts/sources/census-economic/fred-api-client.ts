/**
 * Federal Reserve Economic Data (FRED) API client.
 *
 * Fetches unemployment rates and employment data (total nonfarm)
 * at national, state, and metro levels.
 *
 * API docs: https://fred.stlouisfed.org/docs/api/fred/
 */

import axios from 'axios';
import { parseNumeric } from '../../lib';
import {
  STATE_FIPS_TO_NAME,
  STATE_FIPS_TO_ABBREV,
  rateLimitWait,
} from './census-economic-config';

const FRED_BASE_URL = 'https://api.stlouisfed.org/fred';

function getFredApiKey(): string {
  const key = process.env.FRED_API_KEY;
  if (!key) {
    throw new Error('FATAL: FRED_API_KEY environment variable is not set.');
  }
  return key;
}

// ---------------------------------------------------------------------------
// Base FRED series fetch
// ---------------------------------------------------------------------------

interface FredObservation {
  date: string;
  value: string;
}

async function fetchFredSeries(
  seriesId: string,
  observationStart?: string,
): Promise<FredObservation[]> {
  await rateLimitWait();

  const params: Record<string, string> = {
    series_id: seriesId,
    api_key: getFredApiKey(),
    file_type: 'json',
  };
  if (observationStart) params.observation_start = observationStart;

  try {
    const response = await axios.get(`${FRED_BASE_URL}/series/observations`, { params, timeout: 30000 });
    return response.data?.observations || [];
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`  FRED series ${seriesId} fetch error: ${message}`);
    return [];
  }
}

// ---------------------------------------------------------------------------
// State FIPS -> FRED unemployment series ID
// ---------------------------------------------------------------------------

const STATE_FIPS_TO_FRED_UNEMPLOYMENT: Record<string, string> = {
  '01': 'ALUR', '02': 'AKUR', '04': 'AZUR', '05': 'ARUR', '06': 'CAUR',
  '08': 'COUR', '09': 'CTUR', '10': 'DEUR', '11': 'DCUR', '12': 'FLUR',
  '13': 'GAUR', '15': 'HIUR', '16': 'IDUR', '17': 'ILUR', '18': 'INUR',
  '19': 'IAUR', '20': 'KSUR', '21': 'KYUR', '22': 'LAUR', '23': 'MEUR',
  '24': 'MDUR', '25': 'MAUR', '26': 'MIUR', '27': 'MNUR', '28': 'MSUR',
  '29': 'MOUR', '30': 'MTUR', '31': 'NEUR', '32': 'NVUR', '33': 'NHUR',
  '34': 'NJUR', '35': 'NMUR', '36': 'NYUR', '37': 'NCUR', '38': 'NDUR',
  '39': 'OHUR', '40': 'OKUR', '41': 'ORUR', '42': 'PAUR', '44': 'RIUR',
  '45': 'SCUR', '46': 'SDUR', '47': 'TNUR', '48': 'TXUR', '49': 'UTUR',
  '50': 'VTUR', '51': 'VAUR', '53': 'WAUR', '54': 'WVUR', '55': 'WIUR',
  '56': 'WYUR',
};

// ---------------------------------------------------------------------------
// State FIPS -> FRED employment series ID
// ---------------------------------------------------------------------------

const STATE_FIPS_TO_FRED_EMPLOYMENT: Record<string, string> = {
  '01': 'ALNA', '02': 'AKNA', '04': 'AZNA', '05': 'ARNA', '06': 'CANA',
  '08': 'CONA', '09': 'CTNA', '10': 'DENA', '11': 'DCNA', '12': 'FLNA',
  '13': 'GANA', '15': 'HINA', '16': 'IDNA', '17': 'ILNA', '18': 'INNA',
  '19': 'IANA', '20': 'KSNA', '21': 'KYNA', '22': 'LANA', '23': 'MENA',
  '24': 'MDNA', '25': 'MANA', '26': 'MINA', '27': 'MNNA', '28': 'MSNA',
  '29': 'MONA', '30': 'MTNA', '31': 'NENA', '32': 'NVNA', '33': 'NHNA',
  '34': 'NJNA', '35': 'NMNA', '36': 'NYNA', '37': 'NCNA', '38': 'NDNA',
  '39': 'OHNA', '40': 'OKNA', '41': 'ORNA', '42': 'PANA', '44': 'RINA',
  '45': 'SCNA', '46': 'SDNA', '47': 'TNNA', '48': 'TXNA', '49': 'UTNA',
  '50': 'VTNA', '51': 'VANA', '53': 'WANA', '54': 'WVNA', '55': 'WINA',
  '56': 'WYNA',
};

// ---------------------------------------------------------------------------
// Metro CBSA -> FRED unemployment short-form series
// ---------------------------------------------------------------------------

const METRO_CBSA_TO_FRED_UNEMPLOYMENT: Record<string, string> = {
  '35620': 'NEWY636URN', '31080': 'LOSA106URN', '16980': 'CHIC917URN',
  '19100': 'DALL148URN', '26420': 'HOUS448URN', '47900': 'WASH911URN',
  '33100': 'MIAM112URN', '37980': 'PHIL942URN', '12060': 'ATLA013URN',
  '14460': 'BOST625URN', '38060': 'PHOE004URN', '41860': 'SANF806URN',
  '40140': 'RIVE806URN', '19820': 'DETR826URN', '42660': 'SEAT653URN',
  '33460': 'MINN427URN', '41740': 'SAND706URN', '45300': 'TAMP312URN',
  '19740': 'DENV708URN', '41180': 'STLURN',     '12580': 'BALT512URN',
  '36740': 'ORLA712URN', '16740': 'CHAR737URN', '41700': 'SANA748URN',
  '38900': 'PORT941URN', '39580': 'RALE537URN', '40900': 'SACR906URN',
  '29820': 'LASV832URN', '12420': 'AUST448URN', '18140': 'COLU139URN',
  '17460': 'CLEV439URN', '28140': 'KANS129URN', '26900': 'INDI918URN',
  '41620': 'SALT649URN', '27260': 'JACK212URN', '36420': 'OKLA440URN',
  '32820': 'MPHURN',
};

// ---------------------------------------------------------------------------
// Metro CBSA -> FRED employment series (SMU format)
// ---------------------------------------------------------------------------

const METRO_CBSA_TO_FRED_EMPLOYMENT: Record<string, string> = {
  '35620': 'SMU36935620000000001', '31080': 'SMU06310800000000001',
  '16980': 'SMU17169800000000001', '19100': 'SMU48191000000000001',
  '26420': 'SMU48264200000000001', '47900': 'SMU11479000000000001',
  '33100': 'SMU12331000000000001', '37980': 'SMU42379800000000001',
  '12060': 'SMU13120600000000001', '14460': 'SMU25144600000000001',
  '38060': 'SMU04380600000000001', '41860': 'SMU06418600000000001',
  '40140': 'SMU06401400000000001', '19820': 'SMU26198200000000001',
  '42660': 'SMU53426600000000001', '33460': 'SMU27334600000000001',
  '41740': 'SMU06417400000000001', '45300': 'SMU12453000000000001',
  '19740': 'SMU08197400000000001', '41180': 'SMU29411800000000001',
  '12580': 'SMU24125800000000001', '36740': 'SMU12367400000000001',
  '16740': 'SMU37167400000000001', '41700': 'SMU48417000000000001',
  '38900': 'SMU41389000000000001',
};

// ---------------------------------------------------------------------------
// National unemployment + employment
// ---------------------------------------------------------------------------

export async function fetchFredNationalUnemployment(startYear: number): Promise<Record<string, unknown>[]> {
  console.log('  Fetching FRED national unemployment rate...');
  const observations = await fetchFredSeries('UNRATE', `${startYear}-01-01`);
  return observations
    .filter(obs => obs.value !== '.')
    .map(obs => ({
      period_date: obs.date,
      unemployment_rate: parseNumeric(obs.value),
    }));
}

export async function fetchFredNationalEmployment(startYear: number): Promise<Record<string, unknown>[]> {
  console.log('  Fetching FRED national employment (PAYEMS)...');
  const observations = await fetchFredSeries('PAYEMS', `${startYear}-01-01`);
  return observations
    .filter(obs => obs.value !== '.')
    .map(obs => {
      const rawEmployment = parseNumeric(obs.value);
      return {
        period_date: obs.date,
        total_nonfarm_employment: rawEmployment !== null ? rawEmployment * 1000 : null,
      };
    });
}

// ---------------------------------------------------------------------------
// State unemployment + employment
// ---------------------------------------------------------------------------

export async function fetchFredStateUnemployment(startYear: number): Promise<Record<string, unknown>[]> {
  console.log('  Fetching FRED state unemployment rates...');
  const allRecords: Record<string, unknown>[] = [];
  const startDate = `${startYear}-01-01`;

  for (const [fips, seriesId] of Object.entries(STATE_FIPS_TO_FRED_UNEMPLOYMENT)) {
    const observations = await fetchFredSeries(seriesId, startDate);
    for (const obs of observations) {
      if (obs.value !== '.') {
        allRecords.push({
          period_date: obs.date,
          state_fips: fips,
          state_name: STATE_FIPS_TO_NAME[fips] || '',
          state_abbrev: STATE_FIPS_TO_ABBREV[fips] || '',
          unemployment_rate: parseNumeric(obs.value),
        });
      }
    }
  }

  console.log(`  Fetched ${allRecords.length} state unemployment records`);
  return allRecords;
}

export async function fetchFredStateEmployment(startYear: number): Promise<Record<string, unknown>[]> {
  console.log('  Fetching FRED state employment...');
  const allRecords: Record<string, unknown>[] = [];
  const startDate = `${startYear}-01-01`;

  for (const [fips, seriesId] of Object.entries(STATE_FIPS_TO_FRED_EMPLOYMENT)) {
    const observations = await fetchFredSeries(seriesId, startDate);
    for (const obs of observations) {
      if (obs.value !== '.') {
        const rawEmployment = parseNumeric(obs.value);
        allRecords.push({
          period_date: obs.date,
          state_fips: fips,
          state_name: STATE_FIPS_TO_NAME[fips] || '',
          state_abbrev: STATE_FIPS_TO_ABBREV[fips] || '',
          total_nonfarm_employment: rawEmployment !== null ? rawEmployment * 1000 : null,
        });
      }
    }
  }

  console.log(`  Fetched ${allRecords.length} state employment records`);
  return allRecords;
}

// ---------------------------------------------------------------------------
// Metro unemployment + employment
// ---------------------------------------------------------------------------

export async function fetchFredMetroUnemployment(startYear: number): Promise<Record<string, unknown>[]> {
  console.log('  Fetching FRED metro unemployment rates...');
  const allRecords: Record<string, unknown>[] = [];
  const startDate = `${startYear}-01-01`;

  for (const [cbsa, seriesId] of Object.entries(METRO_CBSA_TO_FRED_UNEMPLOYMENT)) {
    const observations = await fetchFredSeries(seriesId, startDate);
    for (const obs of observations) {
      if (obs.value !== '.') {
        allRecords.push({
          period_date: obs.date,
          cbsa_code: cbsa,
          unemployment_rate: parseNumeric(obs.value),
        });
      }
    }
  }

  console.log(`  Fetched ${allRecords.length} metro unemployment records`);
  return allRecords;
}

export async function fetchFredMetroEmployment(startYear: number): Promise<Record<string, unknown>[]> {
  console.log('  Fetching FRED metro employment...');
  const allRecords: Record<string, unknown>[] = [];
  const startDate = `${startYear}-01-01`;

  for (const [cbsa, seriesId] of Object.entries(METRO_CBSA_TO_FRED_EMPLOYMENT)) {
    const observations = await fetchFredSeries(seriesId, startDate);
    for (const obs of observations) {
      if (obs.value !== '.') {
        const rawEmployment = parseNumeric(obs.value);
        allRecords.push({
          period_date: obs.date,
          cbsa_code: cbsa,
          total_nonfarm_employment: rawEmployment !== null ? rawEmployment * 1000 : null,
        });
      }
    }
  }

  console.log(`  Fetched ${allRecords.length} metro employment records`);
  return allRecords;
}
