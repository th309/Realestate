/**
 * Saved Queries Controller
 *
 * REST endpoints for saved analytics queries.
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  SavedQueriesService,
  CreateSavedQueryDto,
  UpdateSavedQueryDto,
} from './saved-queries.service';

@Controller('analytics/saved-queries')
export class SavedQueriesController {
  private readonly logger = new Logger(SavedQueriesController.name);

  constructor(private readonly savedQueriesService: SavedQueriesService) {}

  /**
   * Get all saved queries for a user
   * GET /api/analytics/saved-queries?userId=xxx
   */
  @Get()
  async getAll(@Query('userId') userId: string) {
    this.logger.log(`GET /analytics/saved-queries for user ${userId}`);

    if (!userId) {
      throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    }

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
   * GET /api/analytics/saved-queries/favorites?userId=xxx
   */
  @Get('favorites')
  async getFavorites(@Query('userId') userId: string) {
    this.logger.log(`GET /analytics/saved-queries/favorites for user ${userId}`);

    if (!userId) {
      throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    }

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
   * GET /api/analytics/saved-queries/:id?userId=xxx
   */
  @Get(':id')
  async getById(@Param('id') id: string, @Query('userId') userId: string) {
    this.logger.log(`GET /analytics/saved-queries/${id}`);

    if (!userId) {
      throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    }

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
  async create(
    @Body() body: CreateSavedQueryDto & { userId: string },
  ) {
    this.logger.log(`POST /analytics/saved-queries`);

    const { userId, ...dto } = body;

    if (!userId) {
      throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    }

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
    @Body() body: UpdateSavedQueryDto & { userId: string },
  ) {
    this.logger.log(`PUT /analytics/saved-queries/${id}`);

    const { userId, ...dto } = body;

    if (!userId) {
      throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    }

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
   * DELETE /api/analytics/saved-queries/:id?userId=xxx
   */
  @Delete(':id')
  async delete(@Param('id') id: string, @Query('userId') userId: string) {
    this.logger.log(`DELETE /analytics/saved-queries/${id}`);

    if (!userId) {
      throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    }

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
  async run(
    @Param('id') id: string,
    @Body() body: { userId: string },
  ) {
    this.logger.log(`POST /analytics/saved-queries/${id}/run`);

    if (!body.userId) {
      throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    }

    try {
      await this.savedQueriesService.incrementRunCount(body.userId, id);
      const query = await this.savedQueriesService.getById(body.userId, id);
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
