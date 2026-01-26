/**
 * Export Controller
 *
 * REST endpoints for exporting analytics data.
 */

import {
  Controller,
  Post,
  Body,
  Res,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ExportService, ExportOptions } from './export.service';

@Controller('analytics/export')
export class ExportController {
  private readonly logger = new Logger(ExportController.name);

  constructor(private readonly exportService: ExportService) {}

  /**
   * Export query results
   * POST /api/analytics/export/query
   */
  @Post('query')
  async exportQuery(
    @Body() body: {
      columns: Array<{ key: string; label: string }>;
      rows: Record<string, unknown>[];
      format?: 'csv' | 'json';
      filename?: string;
    },
    @Res() res: Response,
  ) {
    this.logger.log('POST /analytics/export/query');

    if (!body.columns || !body.rows) {
      throw new HttpException(
        'columns and rows are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const result = this.exportService.exportQueryResults(
        { columns: body.columns, rows: body.rows },
        { format: body.format || 'csv' },
      );

      const filename = body.filename || result.filename;

      res.setHeader('Content-Type', result.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(result.data);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Export comparison data
   * POST /api/analytics/export/comparison
   */
  @Post('comparison')
  async exportComparison(
    @Body() body: {
      geographies: Array<{
        name: string;
        type: string;
        metrics: Record<string, number | string>;
      }>;
      metricLabels: Record<string, string>;
      format?: 'csv' | 'json';
      filename?: string;
    },
    @Res() res: Response,
  ) {
    this.logger.log('POST /analytics/export/comparison');

    if (!body.geographies || !body.metricLabels) {
      throw new HttpException(
        'geographies and metricLabels are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const result = this.exportService.exportComparison(
        body.geographies,
        body.metricLabels,
        { format: body.format || 'csv' },
      );

      const filename = body.filename || result.filename;

      res.setHeader('Content-Type', result.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(result.data);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Export time series data
   * POST /api/analytics/export/timeseries
   */
  @Post('timeseries')
  async exportTimeSeries(
    @Body() body: {
      series: Array<{
        name: string;
        data: Array<{ date: string; value: number }>;
      }>;
      format?: 'csv' | 'json';
      filename?: string;
    },
    @Res() res: Response,
  ) {
    this.logger.log('POST /analytics/export/timeseries');

    if (!body.series) {
      throw new HttpException('series is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const result = this.exportService.exportTimeSeries(body.series, {
        format: body.format || 'csv',
      });

      const filename = body.filename || result.filename;

      res.setHeader('Content-Type', result.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(result.data);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Export raw data
   * POST /api/analytics/export/raw
   */
  @Post('raw')
  async exportRaw(
    @Body() body: {
      data: Record<string, unknown>[];
      format?: 'csv' | 'json';
      columns?: string[];
      filename?: string;
    },
    @Res() res: Response,
  ) {
    this.logger.log('POST /analytics/export/raw');

    if (!body.data) {
      throw new HttpException('data is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const options: ExportOptions = {
        format: body.format || 'csv',
        columns: body.columns,
      };

      const result = options.format === 'json'
        ? this.exportService.exportToJson(body.data, options)
        : this.exportService.exportToCsv(body.data, options);

      const filename = body.filename || result.filename;

      res.setHeader('Content-Type', result.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(result.data);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
