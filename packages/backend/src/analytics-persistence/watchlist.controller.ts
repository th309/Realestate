/**
 * Watchlist Controller
 *
 * REST endpoints for market watchlist.
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
  Headers,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  WatchlistService,
  AddToWatchlistDto,
  UpdateWatchlistItemDto,
} from './watchlist.service';

@Controller('analytics/watchlist')
export class WatchlistController {
  private readonly logger = new Logger(WatchlistController.name);

  constructor(private readonly watchlistService: WatchlistService) {}

  /**
   * Get all watchlist items
   * GET /api/analytics/watchlist?folder=xxx
   */
  @Get()
  async getAll(
    @Headers('x-user-id') userId: string,
    @Query('folder') folder?: string,
  ) {
    this.logger.log(`GET /analytics/watchlist for user ${userId}`);

    if (!userId) {
      throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const items = await this.watchlistService.getAll(userId, folder);
      const limitInfo = await this.watchlistService.checkWatchlistLimit(userId);
      return {
        success: true,
        data: items,
        count: items.length,
        limit: limitInfo.limit,
        remaining:
          limitInfo.limit === -1
            ? -1
            : Math.max(0, limitInfo.limit - items.length),
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Failed to get watchlist: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Get watchlist summary with current scores and changes
   * GET /api/analytics/watchlist/summary
   */
  @Get('summary')
  async getSummary(@Headers('x-user-id') userId: string) {
    this.logger.log(`GET /analytics/watchlist/summary for user ${userId}`);

    if (!userId) {
      throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const items = await this.watchlistService.getAll(userId);

      // For each item, return with placeholder score data
      // Score enrichment can be added later when scoring service integration is needed
      return {
        success: true,
        data: items.map((item) => ({
          ...item,
          currentScores: null,
          scoreChanges: null,
        })),
        count: items.length,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Failed to get watchlist summary: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Get watchlist grouped by folder
   * GET /api/analytics/watchlist/grouped
   */
  @Get('grouped')
  async getGrouped(@Headers('x-user-id') userId: string) {
    this.logger.log(`GET /analytics/watchlist/grouped for user ${userId}`);

    if (!userId) {
      throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const grouped = await this.watchlistService.getGroupedByFolder(userId);
      return {
        success: true,
        data: grouped,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Failed to get grouped watchlist: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Get all folders
   * GET /api/analytics/watchlist/folders
   */
  @Get('folders')
  async getFolders(@Headers('x-user-id') userId: string) {
    this.logger.log(`GET /analytics/watchlist/folders for user ${userId}`);

    if (!userId) {
      throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const folders = await this.watchlistService.getFolders(userId);
      return {
        success: true,
        data: folders,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Failed to get folders: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Check if a market is in watchlist
   * GET /api/analytics/watchlist/check?geographyType=metro&geographyId=12420
   */
  @Get('check')
  async check(
    @Headers('x-user-id') userId: string,
    @Query('geographyType') geographyType: string,
    @Query('geographyId') geographyId: string,
  ) {
    if (!userId || !geographyType || !geographyId) {
      throw new HttpException(
        'userId, geographyType, and geographyId are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const isInWatchlist = await this.watchlistService.isInWatchlist(
        userId,
        geographyType,
        geographyId,
      );
      return {
        success: true,
        inWatchlist: isInWatchlist,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Failed to check watchlist: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Add to watchlist
   * POST /api/analytics/watchlist
   */
  @Post()
  async add(
    @Headers('x-user-id') userId: string,
    @Body() dto: AddToWatchlistDto,
  ) {
    this.logger.log(`POST /analytics/watchlist`);

    if (!userId || !dto.geography_type || !dto.geography_id) {
      throw new HttpException(
        'userId, geography_type, and geography_id are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const item = await this.watchlistService.add(userId, dto);
      return {
        success: true,
        data: item,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Failed to add to watchlist: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Update watchlist item
   * PUT /api/analytics/watchlist/:id
   */
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
    @Body() dto: UpdateWatchlistItemDto,
  ) {
    this.logger.log(`PUT /analytics/watchlist/${id}`);

    if (!userId) {
      throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const item = await this.watchlistService.update(userId, id, dto);
      return {
        success: true,
        data: item,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Failed to update watchlist item: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Remove from watchlist
   * DELETE /api/analytics/watchlist/:id
   */
  @Delete(':id')
  async remove(@Param('id') id: string, @Headers('x-user-id') userId: string) {
    this.logger.log(`DELETE /analytics/watchlist/${id}`);

    if (!userId) {
      throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    }

    try {
      await this.watchlistService.remove(userId, id);
      return {
        success: true,
        deleted: true,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Failed to remove from watchlist: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Remove by geography
   * DELETE /api/analytics/watchlist/geography/:type/:id
   */
  @Delete('geography/:type/:geoId')
  async removeByGeography(
    @Param('type') type: string,
    @Param('geoId') geoId: string,
    @Headers('x-user-id') userId: string,
  ) {
    this.logger.log(`DELETE /analytics/watchlist/geography/${type}/${geoId}`);

    if (!userId) {
      throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    }

    try {
      await this.watchlistService.removeByGeography(userId, type, geoId);
      return {
        success: true,
        deleted: true,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Failed to remove by geography: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
