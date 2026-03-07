/**
 * Calibration Service (v3.0)
 *
 * Applies isotonic calibration to raw percentile scores.
 * Loads a JSON lookup table (trained by scripts/analysis/train_calibration.py)
 * and uses piecewise-linear interpolation to map raw scores to calibrated scores.
 *
 * Supports all 9 score combinations (3 geos x 3 scores: homeready, investoredge, markethealth).
 * Calibration tables are regenerated monthly by the post-import-refresh CI workflow.
 *
 * This compresses the score range to better match actual return percentiles,
 * reducing MAD (Mean Absolute Deviation) below the 15 pp target.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

interface CalibrationPoint {
  raw: number;
  calibrated: number;
}

type CalibrationTables = Record<string, CalibrationPoint[]>;

@Injectable()
export class CalibrationService implements OnModuleInit {
  private readonly logger = new Logger(CalibrationService.name);
  private tables = new Map<string, CalibrationPoint[]>();

  onModuleInit(): void {
    const tablePath = path.join(__dirname, 'calibration-tables.json');

    if (!fs.existsSync(tablePath)) {
      this.logger.warn(
        'No calibration-tables.json found — scores will not be calibrated. ' +
          'Run scripts/analysis/train_calibration.py to generate.',
      );
      return;
    }

    const raw = fs.readFileSync(tablePath, 'utf-8');
    const parsed: CalibrationTables = JSON.parse(raw);

    for (const [key, points] of Object.entries(parsed)) {
      if (Array.isArray(points) && points.length >= 2) {
        this.tables.set(key, points);
      }
    }

    this.logger.log(
      `Loaded calibration tables for: ${[...this.tables.keys()].join(', ')}`,
    );
  }

  /**
   * Apply isotonic calibration to a raw 0-100 score.
   * Returns the calibrated score, or the original score if no table exists.
   */
  calibrate(rawScore: number, scoreType: string, geoLevel: string): number {
    const key = `${scoreType}_${geoLevel}`;
    const table = this.tables.get(key);
    if (!table) return rawScore;
    return this.piecewiseLinearInterpolate(table, rawScore);
  }

  /**
   * Check if calibration is available for a given score type + geo level.
   */
  hasCalibration(scoreType: string, geoLevel: string): boolean {
    return this.tables.has(`${scoreType}_${geoLevel}`);
  }

  /**
   * Piecewise linear interpolation between lookup points.
   */
  private piecewiseLinearInterpolate(
    table: CalibrationPoint[],
    input: number,
  ): number {
    if (input <= table[0].raw) return table[0].calibrated;
    if (input >= table[table.length - 1].raw)
      return table[table.length - 1].calibrated;

    for (let i = 0; i < table.length - 1; i++) {
      const lo = table[i];
      const hi = table[i + 1];
      if (input >= lo.raw && input <= hi.raw) {
        const t = (input - lo.raw) / (hi.raw - lo.raw);
        return lo.calibrated + t * (hi.calibrated - lo.calibrated);
      }
    }

    return input;
  }
}
