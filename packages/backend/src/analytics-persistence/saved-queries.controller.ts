/**
 * Saved Queries Controller
 *
 * REST endpoints for saved analytics queries.
 * Protected by JwtAuthGuard — userId is extracted from the validated JWT.
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards';
import { AuthUserId } from '../common/decorators';
import {
  SavedQueriesService,
  CreateSavedQueryDto,
  UpdateSavedQueryDto,
} from './saved-queries.service';

@UseGuards(JwtAuthGuard)
@Controller('analytics/saved-queries')
export class SavedQueriesController {
  private readonly logger = new Logger(SavedQueriesController.name);

  constructor(private readonly savedQueriesService: SavedQueriesService) {}

  /**
   * Get all saved queries for the authenticated user
   * GET /api/analytics/saved-queries
   */
  @Get()
  async getAll(@AuthUserId() userId: string) {
    this.logger.log(`GET /analytics/saved-queries for user ${userId}`);

    try {
      const queries = await this.savedQueriesService.getAll(userId);
      return {
        success: true,
        data: queries,
        count: queries.length,
      };
    } catch (error) {
      this.logger.error(`Failed to get saved queries: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get favorites only
   * GET /api/analytics/saved-queries/favorites
   */
  @Get('favorites')
  async getFavorites(@AuthUserId() userId: string) {
    this.logger.log(
      `GET /analytics/saved-queries/favorites for user ${userId}`,
    );

    try {
      const queries = await this.savedQueriesService.getFavorites(userId);
      return {
        success: true,
        data: queries,
        count: queries.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get a single saved query
   * GET /api/analytics/saved-queries/:id
   */
  @Get(':id')
  async getById(@Param('id') id: string, @AuthUserId() userId: string) {
    this.logger.log(`GET /analytics/saved-queries/${id}`);

    try {
      const query = await this.savedQueriesService.getById(userId, id);
      if (!query) {
        return {
          success: false,
          error: 'Saved query not found',
        };
      }
      return {
        success: true,
        data: query,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Create a new saved query
   * POST /api/analytics/saved-queries
   */
  @Post()
  async create(@AuthUserId() userId: string, @Body() dto: CreateSavedQueryDto) {
    this.logger.log(`POST /analytics/saved-queries`);

    if (!dto.name || !dto.query_text) {
      throw new HttpException(
        'name and query_text are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const query = await this.savedQueriesService.create(userId, dto);
      return {
        success: true,
        data: query,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Update a saved query
   * PUT /api/analytics/saved-queries/:id
   */
  @Put(':id')
  async update(
    @Param('id') id: string,
    @AuthUserId() userId: string,
    @Body() dto: UpdateSavedQueryDto,
  ) {
    this.logger.log(`PUT /analytics/saved-queries/${id}`);

    try {
      const query = await this.savedQueriesService.update(userId, id, dto);
      return {
        success: true,
        data: query,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Delete a saved query
   * DELETE /api/analytics/saved-queries/:id
   */
  @Delete(':id')
  async delete(@Param('id') id: string, @AuthUserId() userId: string) {
    this.logger.log(`DELETE /analytics/saved-queries/${id}`);

    try {
      await this.savedQueriesService.delete(userId, id);
      return {
        success: true,
        deleted: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Run a saved query (increment count)
   * POST /api/analytics/saved-queries/:id/run
   */
  @Post(':id/run')
  async run(@Param('id') id: string, @AuthUserId() userId: string) {
    this.logger.log(`POST /analytics/saved-queries/${id}/run`);

    try {
      await this.savedQueriesService.incrementRunCount(userId, id);
      const query = await this.savedQueriesService.getById(userId, id);
      return {
        success: true,
        data: query,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
