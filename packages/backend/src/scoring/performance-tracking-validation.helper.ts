import { SupabaseClient } from '@supabase/supabase-js';
import { GeographyLevel } from './formula-weights';
import { ValidationResult } from './performance-tracking.types';

/**
 * Prediction validation logic extracted from PerformanceTrackingService.
 * I/O helpers take the Supabase client as an explicit first parameter
 * instead of reading it off `this`.
 */

/**
 * Validate predictions from 12 months ago.
 * Should be run monthly as a scheduled job.
 */
export async function runValidatePredictions1Y(
  supabase: SupabaseClient,
): Promise<ValidationResult> {
  // Calculate the prediction date to validate (12 months ago)
  const now = new Date();
  const predictionDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
  const predictionDateStr = predictionDate.toISOString().slice(0, 7) + '-01'; // YYYY-MM-01

  // Get predictions that haven't been validated yet
  const { data: predictions, error } = await supabase
    .from('score_performance_tracking')
    .select('*')
    .eq('prediction_date', predictionDateStr)
    .is('validated_1y_at', null);

  if (error || !predictions || predictions.length === 0) {
    return { validated: 0, errors: 0, predictionDate: predictionDateStr };
  }

  // Get actual returns from Zillow data
  // We need to calculate: (current_price - price_at_prediction) / price_at_prediction * 100
  const currentDate = now.toISOString().slice(0, 10);

  // Group predictions by geography for batch processing
  const predictionsByGeo = new Map<string, typeof predictions>();
  for (const pred of predictions) {
    const key = pred.geography;
    if (!predictionsByGeo.has(key)) {
      predictionsByGeo.set(key, []);
    }
    predictionsByGeo.get(key)!.push(pred);
  }

  // Calculate market medians per geography for comparison
  const medians = await calculateMarketMedians(
    supabase,
    predictions,
    currentDate,
  );

  let validated = 0;
  let errors = 0;

  for (const pred of predictions) {
    try {
      const actualReturn = await getActualReturn(
        supabase,
        pred.location_id,
        pred.geography,
        pred.price_at_prediction,
      );

      if (actualReturn === null) {
        // Can't validate without current price
        continue;
      }

      const medianReturn = medians[pred.geography] || 0;
      const beatMarket = actualReturn > medianReturn;

      // Update the prediction with actual outcome
      const { error: updateError } = await supabase
        .from('score_performance_tracking')
        .update({
          actual_return_1y: actualReturn,
          beat_market_1y: beatMarket,
          validated_1y_at: new Date().toISOString(),
        })
        .eq('id', pred.id);

      if (updateError) {
        errors++;
      } else {
        validated++;
      }
    } catch (err) {
      errors++;
      console.error(`Error validating prediction ${pred.id}:`, err);
    }
  }

  return { validated, errors, predictionDate: predictionDateStr };
}

/**
 * Validate predictions from 36 months ago against actual 3-year outcomes.
 * Should be run monthly alongside runValidatePredictions1Y().
 *
 * This is the primary validation horizon — scores are trained to predict
 * 3-year excess returns vs state median.
 */
export async function runValidatePredictions3Y(
  supabase: SupabaseClient,
): Promise<ValidationResult> {
  // Calculate the prediction date to validate (36 months ago)
  const now = new Date();
  const predictionDate = new Date(now.getFullYear() - 3, now.getMonth(), 1);
  const predictionDateStr = predictionDate.toISOString().slice(0, 7) + '-01';

  // Get predictions that have 1Y validation but not yet 3Y
  const { data: predictions, error } = await supabase
    .from('score_performance_tracking')
    .select('*')
    .eq('prediction_date', predictionDateStr)
    .is('validated_3y_at', null);

  if (error || !predictions || predictions.length === 0) {
    return { validated: 0, errors: 0, predictionDate: predictionDateStr };
  }

  const medians = await calculateMarketMedians(
    supabase,
    predictions,
    now.toISOString().slice(0, 10),
  );

  let validated = 0;
  let errors = 0;

  for (const pred of predictions) {
    try {
      const actualReturn = await getActualReturn(
        supabase,
        pred.location_id,
        pred.geography,
        pred.price_at_prediction,
      );

      if (actualReturn === null) continue;

      // Annualize the 3-year return: (1 + r)^(1/3) - 1
      const annualizedReturn =
        (Math.pow(1 + actualReturn / 100, 1 / 3) - 1) * 100;
      const annualizedRounded = Math.round(annualizedReturn * 100) / 100;

      const medianReturn = medians[pred.geography] || 0;
      const medianAnnualized =
        (Math.pow(1 + medianReturn / 100, 1 / 3) - 1) * 100;
      const beatMarket = annualizedReturn > medianAnnualized;

      const { error: updateError } = await supabase
        .from('score_performance_tracking')
        .update({
          actual_return_3y_ann: annualizedRounded,
          beat_market_3y: beatMarket,
          validated_3y_at: new Date().toISOString(),
        })
        .eq('id', pred.id);

      if (updateError) {
        errors++;
      } else {
        validated++;
      }
    } catch (err) {
      errors++;
      console.error(`Error validating 3Y prediction ${pred.id}:`, err);
    }
  }

  return { validated, errors, predictionDate: predictionDateStr };
}

async function calculateMarketMedians(
  supabase: SupabaseClient,
  predictions: any[],
  currentDate: string,
): Promise<Record<string, number>> {
  const medians: Record<string, number> = {};
  const geographies = [...new Set(predictions.map((p) => p.geography))];

  for (const geography of geographies) {
    // Get all returns for this geography
    const geoPredictions = predictions.filter((p) => p.geography === geography);
    const returns: number[] = [];

    for (const pred of geoPredictions) {
      const actualReturn = await getActualReturn(
        supabase,
        pred.location_id,
        geography,
        pred.price_at_prediction,
      );
      if (actualReturn !== null) {
        returns.push(actualReturn);
      }
    }

    if (returns.length > 0) {
      returns.sort((a, b) => a - b);
      medians[geography] = returns[Math.floor(returns.length / 2)];
    } else {
      medians[geography] = 0;
    }
  }

  return medians;
}

async function getActualReturn(
  supabase: SupabaseClient,
  locationId: string,
  geography: GeographyLevel,
  priceAtPrediction: number | null,
): Promise<number | null> {
  if (!priceAtPrediction || priceAtPrediction === 0) {
    return null;
  }

  // Get current price from propertyiq_scores or realtor data
  const { data } = await supabase
    .from('propertyiq_scores')
    .select('median_price')
    .eq('location_id', locationId)
    .eq('geography', geography)
    .eq('score_type', 'propertyiq') // Just need one to get median_price
    .order('score_date', { ascending: false })
    .limit(1);

  if (!data || data.length === 0 || !data[0].median_price) {
    return null;
  }

  const currentPrice = data[0].median_price;
  const returnPct =
    ((currentPrice - priceAtPrediction) / priceAtPrediction) * 100;

  return Math.round(returnPct * 100) / 100; // Round to 2 decimals
}
