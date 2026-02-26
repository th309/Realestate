/**
 * Notes Controller
 *
 * REST endpoints for market notes.
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
import { NotesService, CreateNoteDto, UpdateNoteDto } from './notes.service';

@UseGuards(JwtAuthGuard)
@Controller('analytics/notes')
export class NotesController {
  private readonly logger = new Logger(NotesController.name);

  constructor(private readonly notesService: NotesService) {}

  /**
   * Get all notes for the authenticated user
   * GET /api/analytics/notes
   */
  @Get()
  async getAll(@AuthUserId() userId: string) {
    this.logger.log(`GET /analytics/notes for user ${userId}`);

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
   * GET /api/analytics/notes/geography/:type/:id
   */
  @Get('geography/:type/:geoId')
  async getByGeography(
    @Param('type') type: string,
    @Param('geoId') geoId: string,
    @AuthUserId() userId: string,
  ) {
    this.logger.log(`GET /analytics/notes/geography/${type}/${geoId}`);

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
   * GET /api/analytics/notes/reminders
   */
  @Get('reminders')
  async getPendingReminders(@AuthUserId() userId: string) {
    this.logger.log(`GET /analytics/notes/reminders for user ${userId}`);

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
   * GET /api/analytics/notes/:id
   */
  @Get(':id')
  async getById(@Param('id') id: string, @AuthUserId() userId: string) {
    this.logger.log(`GET /analytics/notes/${id}`);

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
  async create(@AuthUserId() userId: string, @Body() dto: CreateNoteDto) {
    this.logger.log(`POST /analytics/notes`);

    if (!dto.geography_type || !dto.geography_id || !dto.content) {
      throw new HttpException(
        'geography_type, geography_id, and content are required',
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
    @AuthUserId() userId: string,
    @Body() dto: UpdateNoteDto,
  ) {
    this.logger.log(`PUT /analytics/notes/${id}`);

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
   * DELETE /api/analytics/notes/:id
   */
  @Delete(':id')
  async delete(@Param('id') id: string, @AuthUserId() userId: string) {
    this.logger.log(`DELETE /analytics/notes/${id}`);

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
