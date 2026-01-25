/**
 * Analytics Chat Controller
 *
 * REST endpoints for natural language analytics queries.
 */

import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AnalyticsChatService } from './analytics-chat.service';

interface ChatRequest {
  message: string;
  context?: {
    geographyType?: string;
    geographyId?: string;
    geographyName?: string;
  };
}

interface ChatResponse {
  success: boolean;
  response?: string;
  toolsUsed?: string[];
  structuredData?: any;
  conversationId: string;
  error?: string;
}

@Controller('analytics/chat')
export class AnalyticsChatController {
  private readonly logger = new Logger(AnalyticsChatController.name);

  constructor(private readonly chatService: AnalyticsChatService) {}

  /**
   * Health check for the chat service
   * GET /api/analytics/chat/health
   */
  @Get('health')
  async healthCheck() {
    return {
      available: this.chatService.isAvailable(),
      activeConversations: this.chatService.listConversations().length,
    };
  }

  /**
   * Send a chat message
   * POST /api/analytics/chat/:conversationId
   */
  @Post(':conversationId')
  async sendMessage(
    @Param('conversationId') conversationId: string,
    @Body() body: ChatRequest,
  ): Promise<ChatResponse> {
    this.logger.log(
      `POST /analytics/chat/${conversationId}: "${body.message?.slice(0, 50)}..."`,
    );

    if (!body.message?.trim()) {
      throw new HttpException('Message is required', HttpStatus.BAD_REQUEST);
    }

    if (!this.chatService.isAvailable()) {
      throw new HttpException(
        'Chat service not available - API key not configured',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    try {
      const result = await this.chatService.chat(
        conversationId,
        body.message.trim(),
        body.context,
      );

      return {
        success: true,
        response: result.response,
        toolsUsed: result.toolsUsed,
        structuredData: result.structuredData,
        conversationId,
      };
    } catch (error) {
      this.logger.error(`Chat failed: ${error.message}`, error.stack);

      // Return structured error instead of throwing
      return {
        success: false,
        error: error.message || 'An error occurred processing your request',
        conversationId,
      };
    }
  }

  /**
   * Get conversation history
   * GET /api/analytics/chat/:conversationId
   */
  @Get(':conversationId')
  async getConversation(@Param('conversationId') conversationId: string) {
    this.logger.log(`GET /analytics/chat/${conversationId}`);

    const conversation = this.chatService.getConversation(conversationId);

    if (!conversation) {
      return {
        success: true,
        conversationId,
        messages: [],
        exists: false,
      };
    }

    return {
      success: true,
      conversationId,
      messages: conversation.messages,
      context: conversation.context,
      createdAt: conversation.createdAt,
      lastMessageAt: conversation.lastMessageAt,
      exists: true,
    };
  }

  /**
   * Clear conversation history
   * DELETE /api/analytics/chat/:conversationId
   */
  @Delete(':conversationId')
  async clearConversation(@Param('conversationId') conversationId: string) {
    this.logger.log(`DELETE /analytics/chat/${conversationId}`);

    const existed = this.chatService.clearConversation(conversationId);

    return {
      success: true,
      conversationId,
      cleared: existed,
    };
  }

  /**
   * List active conversations (admin/debug endpoint)
   * GET /api/analytics/chat
   */
  @Get()
  async listConversations() {
    const conversations = this.chatService.listConversations();

    return {
      success: true,
      count: conversations.length,
      conversations: conversations.map((id) => {
        const conv = this.chatService.getConversation(id);
        return {
          id,
          messageCount: conv?.messages.length || 0,
          createdAt: conv?.createdAt,
          lastMessageAt: conv?.lastMessageAt,
        };
      }),
    };
  }
}
