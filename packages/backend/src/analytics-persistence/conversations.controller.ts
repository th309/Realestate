/**
 * Conversations Controller
 *
 * REST endpoints for conversation history.
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
  ConversationsService,
  SaveConversationDto,
  ConversationMessage,
} from './conversations.service';

@Controller('analytics/conversations')
export class ConversationsController {
  private readonly logger = new Logger(ConversationsController.name);

  constructor(private readonly conversationsService: ConversationsService) {}

  /**
   * Get all conversations for a user
   * GET /api/analytics/conversations?userId=xxx&includeArchived=false
   */
  @Get()
  async getAll(
    @Query('userId') userId: string,
    @Query('includeArchived') includeArchived?: string,
  ) {
    this.logger.log(`GET /analytics/conversations for user ${userId}`);

    if (!userId) {
      throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    }

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
   * GET /api/analytics/conversations/recent?userId=xxx&limit=10
   */
  @Get('recent')
  async getRecent(
    @Query('userId') userId: string,
    @Query('limit') limit?: string,
  ) {
    this.logger.log(`GET /analytics/conversations/recent for user ${userId}`);

    if (!userId) {
      throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    }

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
   * GET /api/analytics/conversations/:conversationId?userId=xxx
   */
  @Get(':conversationId')
  async getByConversationId(
    @Param('conversationId') conversationId: string,
    @Query('userId') userId: string,
  ) {
    this.logger.log(`GET /analytics/conversations/${conversationId}`);

    if (!userId) {
      throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    }

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
  async save(@Body() body: SaveConversationDto & { userId: string }) {
    this.logger.log(`POST /analytics/conversations`);

    const { userId, ...dto } = body;

    if (!userId || !dto.conversation_id) {
      throw new HttpException(
        'userId and conversation_id are required',
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
   * Add a message to a conversation
   * POST /api/analytics/conversations/:conversationId/messages
   */
  @Post(':conversationId/messages')
  async addMessage(
    @Param('conversationId') conversationId: string,
    @Body() body: { userId: string; message: ConversationMessage },
  ) {
    this.logger.log(`POST /analytics/conversations/${conversationId}/messages`);

    if (!body.userId || !body.message) {
      throw new HttpException(
        'userId and message are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const conversation = await this.conversationsService.addMessage(
        body.userId,
        conversationId,
        body.message,
      );
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
   * Update conversation title
   * PUT /api/analytics/conversations/:conversationId/title
   */
  @Put(':conversationId/title')
  async updateTitle(
    @Param('conversationId') conversationId: string,
    @Body() body: { userId: string; title: string },
  ) {
    this.logger.log(`PUT /analytics/conversations/${conversationId}/title`);

    if (!body.userId || !body.title) {
      throw new HttpException(
        'userId and title are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const conversation = await this.conversationsService.updateTitle(
        body.userId,
        conversationId,
        body.title,
      );
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
   * Archive a conversation
   * PUT /api/analytics/conversations/:conversationId/archive
   */
  @Put(':conversationId/archive')
  async archive(
    @Param('conversationId') conversationId: string,
    @Body() body: { userId: string },
  ) {
    this.logger.log(`PUT /analytics/conversations/${conversationId}/archive`);

    if (!body.userId) {
      throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    }

    try {
      await this.conversationsService.archive(body.userId, conversationId);
      return {
        success: true,
        archived: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Unarchive a conversation
   * PUT /api/analytics/conversations/:conversationId/unarchive
   */
  @Put(':conversationId/unarchive')
  async unarchive(
    @Param('conversationId') conversationId: string,
    @Body() body: { userId: string },
  ) {
    this.logger.log(`PUT /analytics/conversations/${conversationId}/unarchive`);

    if (!body.userId) {
      throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    }

    try {
      await this.conversationsService.unarchive(body.userId, conversationId);
      return {
        success: true,
        archived: false,
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
   * DELETE /api/analytics/conversations/:conversationId?userId=xxx
   */
  @Delete(':conversationId')
  async delete(
    @Param('conversationId') conversationId: string,
    @Query('userId') userId: string,
  ) {
    this.logger.log(`DELETE /analytics/conversations/${conversationId}`);

    if (!userId) {
      throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    }

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
