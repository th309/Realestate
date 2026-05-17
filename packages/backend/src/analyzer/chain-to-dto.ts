import type { GeoChainStep } from '../metric-resolution/metric-resolution.types';
import type { GeographyChainDto } from './dto/market-context.dto';

/**
 * Flatten GeographyChainService's ordered chain steps into the analyzer's
 * flat DTO shape: { zip?, county_fips?, cbsa_code?, state? }.
 *
 * The chain skips levels that aren't in the crosswalk row (e.g., an
 * unmetropolitan ZIP yields no `cbsa_code`), so missing keys are normal.
 */
export function chainToDto(steps: GeoChainStep[]): GeographyChainDto {
  const out: GeographyChainDto = {};
  for (const s of steps) {
    if (s.level === 'zip') out.zip = s.id;
    else if (s.level === 'county') out.county_fips = s.id;
    else if (s.level === 'metro') out.cbsa_code = s.id;
    else if (s.level === 'state') out.state = s.id;
  }
  return out;
}
