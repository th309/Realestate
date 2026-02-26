/**
 * Conversations Controller
 *
 * REST endpoints for conversation CRUD (list, get, save, delete).
 * Protected by JwtAuthGuard — userId is extracted from the validated JWT.
 *
 * Per-conversation actions (messages, title, archive) are in
 * conversation-actions.controller.ts to stay within file size limits.
 */

import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards';
import { AuthUserId } from '../common/decorators';
import {
  ConversationsService,
  SaveConversationDto,
} from './conversations.service';

@UseGuards(JwtAuthGuard)
@Controller('analytics/conversations')
export class ConversationsController {
  private readonly logger = new Logger(ConversationsController.name);

  constructor(private readonly conversationsService: ConversationsService) {}

  /**
   * Get all conversations for the authenticated user
   * GET /api/analytics/conversations?includeArchived=false
   */
  @Get()
  async getAll(
    @AuthUserId() userId: string,
    @Query('includeArchived') includeArchived?: string,
  ) {
    this.logger.log(`GET /analytics/conversations for user ${userId}`);

    try {
      const conversations = await this.conversationsService.getAll(
        userId,
        includeArchived === 'true',
      );
      return {
        success: true,
        data: conversations,
        count: conversations.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get recent conversations
   * GET /api/analytics/conversations/recent?limit=10
   */
  @Get('recent')
  async getRecent(
    @AuthUserId() userId: string,
    @Query('limit') limit?: string,
  ) {
    this.logger.log(`GET /analytics/conversations/recent for user ${userId}`);

    try {
      const conversations = await this.conversationsService.getRecent(
        userId,
        limit ? parseInt(limit, 10) : 10,
      );
      return {
        success: true,
        data: conversations,
        count: conversations.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get a single conversation by conversation_id
   * GET /api/analytics/conversations/:conversationId
   */
  @Get(':conversationId')
  async getByConversationId(
    @Param('conversationId') conversationId: string,
    @AuthUserId() userId: string,
  ) {
    this.logger.log(`GET /analytics/conversations/${conversationId}`);

    try {
      const conversation = await this.conversationsService.getByConversationId(
        userId,
        conversationId,
      );
      if (!conversation) {
        return {
          success: true,
          data: null,
          exists: false,
        };
      }
      return {
        success: true,
        data: conversation,
        exists: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Save a conversation
   * POST /api/analytics/conversations
   */
  @Post()
  async save(@AuthUserId() userId: string, @Body() dto: SaveConversationDto) {
    this.logger.log(`POST /analytics/conversations`);

    if (!dto.conversation_id) {
      throw new HttpException(
        'conversation_id is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const conversation = await this.conversationsService.save(userId, dto);
      return {
        success: true,
        data: conversation,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Delete a conversation
   * DELETE /api/analytics/conversations/:conversationId
   */
  @Delete(':conversationId')
  async delete(
    @Param('conversationId') conversationId: string,
    @AuthUserId() userId: string,
  ) {
    this.logger.log(`DELETE /analytics/conversations/${conversationId}`);

    try {
      await this.conversationsService.delete(userId, conversationId);
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
