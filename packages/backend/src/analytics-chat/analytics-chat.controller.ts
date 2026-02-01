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
  Res,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import { Response } from 'express';
import { Observable } from 'rxjs';
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
  modelUsed?: string;
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
   * Send a chat message with streaming response
   * POST /api/analytics/chat/:conversationId/stream
   */
  @Post(':conversationId/stream')
  async sendMessageStream(
    @Param('conversationId') conversationId: string,
    @Body() body: ChatRequest,
    @Res() res: Response,
  ): Promise<void> {
    const requestId = `stream_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    this.logger.log(`[Quinn ${requestId}] === STREAM REQUEST START ===`);
    this.logger.log(`[Quinn ${requestId}] ConversationId: ${conversationId}`);
    this.logger.log(`[Quinn ${requestId}] Message: "${body.message?.slice(0, 100)}..."`);

    if (!body.message?.trim()) {
      res.status(HttpStatus.BAD_REQUEST).json({ error: 'Message is required' });
      return;
    }

    if (!this.chatService.isAvailable()) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({ error: 'Chat service not available' });
      return;
    }

    // Set headers for Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      for await (const chunk of this.chatService.chatStream(
        conversationId,
        body.message.trim(),
        body.context,
      )) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }

      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error) {
      this.logger.error(`[Quinn ${requestId}] Stream error: ${error.message}`);
      res.write(`data: ${JSON.stringify({ type: 'error', content: error.message })}\n\n`);
      res.end();
    }
  }

  /**
   * Send a chat message (non-streaming)
   * POST /api/analytics/chat/:conversationId
   */
  @Post(':conversationId')
  async sendMessage(
    @Param('conversationId') conversationId: string,
    @Body() body: ChatRequest,
  ): Promise<ChatResponse> {
    const requestId = `be_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const startTime = Date.now();
    
    this.logger.log(`[Quinn ${requestId}] === POST REQUEST START ===`);
    this.logger.log(`[Quinn ${requestId}] ConversationId: ${conversationId}`);
    this.logger.log(`[Quinn ${requestId}] Message: "${body.message?.slice(0, 100)}..."`);
    this.logger.log(`[Quinn ${requestId}] Context: ${JSON.stringify(body.context || {})}`);
    this.logger.log(`[Quinn ${requestId}] Service available: ${this.chatService.isAvailable()}`);

    if (!body.message?.trim()) {
      this.logger.warn(`[Quinn ${requestId}] Empty message rejected`);
      throw new HttpException('Message is required', HttpStatus.BAD_REQUEST);
    }

    if (!this.chatService.isAvailable()) {
      this.logger.error(`[Quinn ${requestId}] Service unavailable - ANTHROPIC_API_KEY not configured`);
      throw new HttpException(
        'Chat service not available - API key not configured',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    try {
      this.logger.log(`[Quinn ${requestId}] Calling chat service...`);
      
      const result = await this.chatService.chat(
        conversationId,
        body.message.trim(),
        body.context,
      );

      const duration = Date.now() - startTime;
      this.logger.log(`[Quinn ${requestId}] === SUCCESS === Duration: ${duration}ms`);
      this.logger.log(`[Quinn ${requestId}] Model used: ${result.modelUsed || 'unknown'}`);
      this.logger.log(`[Quinn ${requestId}] Response length: ${result.response?.length || 0}`);
      this.logger.log(`[Quinn ${requestId}] Tools used: ${result.toolsUsed?.join(', ') || 'none'}`);

      return {
        success: true,
        response: typeof result.response === 'string' ? result.response : (result.response ?? ''),
        toolsUsed: result.toolsUsed,
        structuredData: result.structuredData,
        modelUsed: result.modelUsed,
        conversationId,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`[Quinn ${requestId}] === FAILED === Duration: ${duration}ms`);
      this.logger.error(`[Quinn ${requestId}] Error type: ${error.constructor?.name}`);
      this.logger.error(`[Quinn ${requestId}] Error message: ${error.message}`);
      this.logger.error(`[Quinn ${requestId}] Error stack: ${error.stack}`);

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

  /**
   * Explain a result with detailed reasoning (hybrid mode)
   * POST /api/analytics/chat/:conversationId/explain
   */
  @Post(':conversationId/explain')
  async explainResult(
    @Param('conversationId') conversationId: string,
    @Body() body: { resultContext: string; userQuery: string },
  ): Promise<ChatResponse> {
    const requestId = `explain_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    this.logger.log(`[Quinn Explain ${requestId}] === REQUEST START ===`);
    this.logger.log(`[Quinn Explain ${requestId}] ConversationId: ${conversationId}`);
    this.logger.log(`[Quinn Explain ${requestId}] User query: "${body.userQuery?.slice(0, 100)}..."`);
    this.logger.log(`[Quinn Explain ${requestId}] Context length: ${body.resultContext?.length || 0} chars`);

    if (!body.resultContext || !body.userQuery) {
      throw new HttpException(
        'Both resultContext and userQuery are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!this.chatService.isAvailable()) {
      throw new HttpException(
        'Chat service not available',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    try {
      // Build explanation prompt
      const explanationPrompt = `The user asked: "${body.userQuery}"

Here's the data they received:
${body.resultContext}

Please provide a detailed 5-10 sentence analysis explaining:
1. What these results mean for the user
2. Why these markets ranked this way (key factors)
3. What trends or patterns are visible
4. Any recommendations or insights based on the data

Be thorough but conversational. Focus on actionable insights.`;

      const startTime = Date.now();

      const result = await this.chatService.chat(
        conversationId,
        explanationPrompt,
        { detailedAnalysis: true },
      );

      const duration = Date.now() - startTime;
      this.logger.log(`[Quinn Explain ${requestId}] === SUCCESS === Duration: ${duration}ms`);

      return {
        success: true,
        response: result.response,
        toolsUsed: result.toolsUsed,
        structuredData: result.structuredData,
        modelUsed: result.modelUsed,
        conversationId,
      };
    } catch (error) {
      this.logger.error(`[Quinn Explain ${requestId}] === FAILED ===`);
      this.logger.error(`[Quinn Explain ${requestId}] Error: ${error.message}`);

      return {
        success: false,
        error: error.message || 'Failed to generate explanation',
        conversationId,
      };
    }
  }
}
