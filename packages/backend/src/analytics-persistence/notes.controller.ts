/**
 * Notes Controller
 *
 * REST endpoints for market notes.
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
import { NotesService, CreateNoteDto, UpdateNoteDto } from './notes.service';

@Controller('analytics/notes')
export class NotesController {
  private readonly logger = new Logger(NotesController.name);

  constructor(private readonly notesService: NotesService) {}

  /**
   * Get all notes for a user
   * GET /api/analytics/notes?userId=xxx
   */
  @Get()
  async getAll(@Query('userId') userId: string) {
    this.logger.log(`GET /analytics/notes for user ${userId}`);

    if (!userId) {
      throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const notes = await this.notesService.getAll(userId);
      return {
        success: true,
        data: notes,
        count: notes.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get notes for a specific geography
   * GET /api/analytics/notes/geography/:type/:id?userId=xxx
   */
  @Get('geography/:type/:geoId')
  async getByGeography(
    @Param('type') type: string,
    @Param('geoId') geoId: string,
    @Query('userId') userId: string,
  ) {
    this.logger.log(`GET /analytics/notes/geography/${type}/${geoId}`);

    if (!userId) {
      throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const notes = await this.notesService.getByGeography(userId, type, geoId);
      return {
        success: true,
        data: notes,
        count: notes.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get pending reminders
   * GET /api/analytics/notes/reminders?userId=xxx
   */
  @Get('reminders')
  async getPendingReminders(@Query('userId') userId: string) {
    this.logger.log(`GET /analytics/notes/reminders for user ${userId}`);

    if (!userId) {
      throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const notes = await this.notesService.getPendingReminders(userId);
      return {
        success: true,
        data: notes,
        count: notes.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get a single note
   * GET /api/analytics/notes/:id?userId=xxx
   */
  @Get(':id')
  async getById(@Param('id') id: string, @Query('userId') userId: string) {
    this.logger.log(`GET /analytics/notes/${id}`);

    if (!userId) {
      throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const note = await this.notesService.getById(userId, id);
      if (!note) {
        return {
          success: false,
          error: 'Note not found',
        };
      }
      return {
        success: true,
        data: note,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Create a new note
   * POST /api/analytics/notes
   */
  @Post()
  async create(@Body() body: CreateNoteDto & { userId: string }) {
    this.logger.log(`POST /analytics/notes`);

    const { userId, ...dto } = body;

    if (!userId || !dto.geography_type || !dto.geography_id || !dto.content) {
      throw new HttpException(
        'userId, geography_type, geography_id, and content are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const note = await this.notesService.create(userId, dto);
      return {
        success: true,
        data: note,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Update a note
   * PUT /api/analytics/notes/:id
   */
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateNoteDto & { userId: string },
  ) {
    this.logger.log(`PUT /analytics/notes/${id}`);

    const { userId, ...dto } = body;

    if (!userId) {
      throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const note = await this.notesService.update(userId, id, dto);
      return {
        success: true,
        data: note,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Delete a note
   * DELETE /api/analytics/notes/:id?userId=xxx
   */
  @Delete(':id')
  async delete(@Param('id') id: string, @Query('userId') userId: string) {
    this.logger.log(`DELETE /analytics/notes/${id}`);

    if (!userId) {
      throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    }

    try {
      await this.notesService.delete(userId, id);
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
}
