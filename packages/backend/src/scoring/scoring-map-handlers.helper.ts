/**
 * PropertyIQ Scoring — Bulk-By-Geography Read Handlers
 *
 * The map-display and SEO bulk-read handler bodies extracted verbatim from
 * ScoringController (getAllScores, streamAllScores, getScoredIds,
 * getScorePeriods). Only the `this.<service>` references became explicit
 * parameters — the fan-out over score types, the NDJSON streaming write
 * semantics, and every response shape are byte-identical to the originals.
 */

import { HttpException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { ScoringService } from './scoring.service';
import {
  validateGeography,
  validateScoreType,
  parseScoreTypes,
} from './scoring-request.helpers';
import { mapScoreRow } from './score-row-mapper.helper';
import { AllScoresResponse, ScoredIdsResponse } from './scoring-response.types';

/** Get all scores for a geography level (for map display, paginated). */
export async function getAllScoresHandler(
  scoringService: ScoringService,
  geography: string,
  scoreType: string,
  date?: string,
  page?: string,
  pageSize?: string,
  all?: string,
  concurrency?: string,
): Promise<AllScoresResponse> {
  const geoLevel = validateGeography(geography);
  const requestedTypes = parseScoreTypes(scoreType);
  const wantsAll = all === 'true' || all === '1';
  // Allow up to 1000 records per page (Supabase limit)
  const pageSizeNum = pageSize
    ? Math.min(Math.max(parseInt(pageSize, 10), 1), 1000)
    : 1000;
  const pageNum = page ? Math.max(0, parseInt(page, 10)) : 0;
  const concurrencyNum = concurrency
    ? Math.min(Math.max(parseInt(concurrency, 10), 1), 8)
    : 4;

  if (wantsAll) {
    const resultsByType = await Promise.all(
      requestedTypes.map(async (type) => ({
        type,
        result: await scoringService.getAllScoresForGeographyAll(
          geoLevel,
          type,
          date,
          pageSizeNum,
          concurrencyNum,
        ),
      })),
    );

    const data = resultsByType.flatMap(({ type, result }) =>
      result.data.map((item) => mapScoreRow(item, date, type)),
    );

    const total = resultsByType.reduce((sum, r) => sum + r.result.total, 0);

    return {
      success: true,
      count: data.length,
      data,
      pagination: {
        page: 0,
        pageSize: pageSizeNum,
        total,
        hasMore: false,
      },
    };
  }

  if (requestedTypes.length !== 1) {
    throw new HttpException(
      'score_type must be a single value unless all=true',
      HttpStatus.BAD_REQUEST,
    );
  }
  const validScoreType = requestedTypes[0];

  const result = await scoringService.getAllScoresForGeography(
    geoLevel,
    validScoreType,
    date,
    pageNum,
    pageSizeNum,
  );

  return {
    success: true,
    count: result.data.length,
    data: result.data.map((item) => ({
      region_id: item.location_id,
      region_name: item.location_name,
      value: item.score,
      grade: item.grade,
      confidence: item.confidence,
      confidence_level: item.confidence_level,
      date: (item as any).score_date || date || undefined,
    })),
    pagination: {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      hasMore: result.hasMore,
    },
  };
}

/** Stream all scores for a geography level as NDJSON (one row per line). */
export async function streamAllScoresHandler(
  scoringService: ScoringService,
  geography: string,
  scoreType: string,
  date: string | undefined,
  res: Response,
  pageSize?: string,
): Promise<void> {
  const geoLevel = validateGeography(geography);
  const requestedTypes = parseScoreTypes(scoreType);
  const pageSizeNum = pageSize
    ? Math.min(Math.max(parseInt(pageSize, 10), 1), 1000)
    : 1000;

  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Cache-Control', 'no-cache');

  try {
    for (const type of requestedTypes) {
      for await (const page of scoringService.iterateScoresForGeography(
        geoLevel,
        type,
        date,
        pageSizeNum,
      )) {
        for (const item of page) {
          const line = JSON.stringify(mapScoreRow(item, date, type));
          res.write(`${line}\n`);
        }
      }
    }
    res.end();
  } catch (err: any) {
    res.status(500);
    res.write(
      JSON.stringify({ error: err?.message || 'Failed to stream scores' }) +
        '\n',
    );
    res.end();
  }
}

/**
 * List all scored location IDs for a geography (latest period).
 *
 * Lean ID-only payload that powers SEO sitemap filtering and per-page noindex:
 * a ZIP/county/metro is only indexable when it has a score.
 */
export async function getScoredIdsHandler(
  scoringService: ScoringService,
  geography: string,
  scoreType?: string,
  date?: string,
): Promise<ScoredIdsResponse> {
  const geoLevel = validateGeography(geography);
  const validScoreType = validateScoreType(scoreType || 'propertyiq');
  const { date: scoredDate, ids } = await scoringService.getScoredLocationIds(
    geoLevel,
    validScoreType,
    date,
  );
  return {
    geography: geoLevel,
    score_type: validScoreType,
    // Real per-geo refresh date — powers honest sitemap <lastmod> (H4).
    date: scoredDate,
    count: ids.length,
    ids,
  };
}

/**
 * List recent distinct score_dates for a geography.
 *
 * Gives the monthly SEO slug-rebuild script the publish/redirect windows it
 * needs to enumerate per-period scored IDs without a full table scan.
 */
export async function getScorePeriodsHandler(
  scoringService: ScoringService,
  geography: string,
  scoreType: string,
  limit: string,
): Promise<{ geography: string; score_type: string; periods: string[] }> {
  const geoLevel = validateGeography(geography);
  const validScoreType = validateScoreType(scoreType);
  const periods = await scoringService.getScorePeriods(
    geoLevel,
    validScoreType,
    Math.min(Math.max(parseInt(limit, 10) || 6, 1), 24),
  );
  return { geography: geoLevel, score_type: validScoreType, periods };
}
