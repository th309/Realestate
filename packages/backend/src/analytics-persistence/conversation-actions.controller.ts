/**
 * Conversation Actions Controller
 *
 * REST endpoints for per-conversation actions: messages, title update,
 * archive, and unarchive.
 * Protected by JwtAuthGuard — userId is extracted from the validated JWT.
 *
 * Split from conversations.controller.ts to stay within file size limits.
 */

import {
  Controller,
  Post,
  Put,
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
  ConversationsService,
  ConversationMessage,
} from './conversations.service';

@UseGuards(JwtAuthGuard)
@Controller('analytics/conversations')
export class ConversationActionsController {
  private readonly logger = new Logger(ConversationActionsController.name);

  constructor(private readonly conversationsService: ConversationsService) {}

  /**
   * Add a message to a conversation
   * POST /api/analytics/conversations/:conversationId/messages
   */
  @Post(':conversationId/messages')
  async addMessage(
    @Param('conversationId') conversationId: string,
    @AuthUserId() userId: string,
    @Body() body: { message: ConversationMessage },
  ) {
    this.logger.log(`POST /analytics/conversations/${conversationId}/messages`);

    if (!body.message) {
      throw new HttpException('message is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const conversation = await this.conversationsService.addMessage(
        userId,
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
    @AuthUserId() userId: string,
    @Body() body: { title: string },
  ) {
    this.logger.log(`PUT /analytics/conversations/${conversationId}/title`);

    if (!body.title) {
      throw new HttpException('title is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const conversation = await this.conversationsService.updateTitle(
        userId,
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
    @AuthUserId() userId: string,
  ) {
    this.logger.log(`PUT /analytics/conversations/${conversationId}/archive`);

    try {
      await this.conversationsService.archive(userId, conversationId);
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
    @AuthUserId() userId: string,
  ) {
    this.logger.log(`PUT /analytics/conversations/${conversationId}/unarchive`);

    try {
      await this.conversationsService.unarchive(userId, conversationId);
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
}
