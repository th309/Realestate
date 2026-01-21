/**
 * TriggerBacktestDto
 *
 * DTO class for triggering backtest runs.
 * Separates the request type from the service interface.
 */

export class TriggerBacktestDto {
  score_types?: string[];
  horizons?: string[];
  county_sample?: number;
  zip_sample?: number;
  random_seed?: number;
}
