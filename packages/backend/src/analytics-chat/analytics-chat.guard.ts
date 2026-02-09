/**
 * Analytics Chat Guards
 *
 * Authentication and rate limiting guards for chat endpoints.
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Simple API key or session-based authentication guard.
 * Validates that requests have valid authentication before accessing chat endpoints.
 *
 * Authentication methods (checked in order):
 * 1. Bearer token in Authorization header
 * 2. x-api-key header
 * 3. Session cookie with user ID
 * 4. x-user-id header (for authenticated frontend requests)
 */
@Injectable()
export class ChatAuthGuard implements CanActivate {
  private readonly logger = new Logger(ChatAuthGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const isAuthenticated = this.validateRequest(request);

    if (!isAuthenticated) {
      this.logger.warn(
        `[ChatAuth] Unauthorized access attempt from ${request.ip || 'unknown'}`,
      );
      throw new UnauthorizedException('Authentication required for chat access');
    }

    return true;
  }

  private validateRequest(request: any): boolean {
    // 1. Check Bearer token
    const authHeader = request.headers?.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      if (this.validateToken(token)) {
        request.userId = this.extractUserIdFromToken(token);
        return true;
      }
    }

    // 2. Check API key header
    const apiKey = request.headers?.['x-api-key'];
    if (apiKey && this.validateApiKey(apiKey)) {
      request.userId = 'api-user';
      return true;
    }

    // 3. Check user ID header (trusted frontend with session)
    const userId = request.headers?.['x-user-id'];
    if (userId && this.isValidUserId(userId)) {
      request.userId = userId;
      return true;
    }

    // 4. Check session cookie
    const sessionUserId = request.cookies?.userId || request.session?.userId;
    if (sessionUserId && this.isValidUserId(sessionUserId)) {
      request.userId = sessionUserId;
      return true;
    }

    // 5. In development mode, allow unauthenticated access with warning
    if (this.configService.get<string>('NODE_ENV') === 'development') {
      this.logger.warn('[ChatAuth] Allowing unauthenticated access in development mode');
      request.userId = 'dev-user';
      return true;
    }

    return false;
  }

  private validateToken(token: string): boolean {
    // TODO: Implement proper JWT validation with Supabase
    // For now, just check if token exists and has reasonable format
    return token.length > 20;
  }

  private extractUserIdFromToken(token: string): string {
    // TODO: Decode JWT and extract user ID
    // For now, return a hash of the token
    return `user-${token.substring(0, 8)}`;
  }

  private validateApiKey(apiKey: string): boolean {
    const validApiKey = this.configService.get<string>('CHAT_API_KEY');
    if (!validApiKey) {
      // If no API key configured, don't accept API key auth
      return false;
    }
    return apiKey === validApiKey;
  }

  private isValidUserId(userId: string): boolean {
    // Basic validation: non-empty string, reasonable length
    return typeof userId === 'string' && userId.length > 0 && userId.length < 256;
  }
}

/**
 * Ownership guard to ensure users can only access their own conversations.
 * Extracts conversation ID from params and validates ownership.
 */
@Injectable()
export class ConversationOwnershipGuard implements CanActivate {
  private readonly logger = new Logger(ConversationOwnershipGuard.name);

  // Map of conversationId -> userId for ownership tracking
  private static conversationOwners: Map<string, string> = new Map();

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const conversationId = request.params?.conversationId;
    const userId = request.userId;

    if (!conversationId || !userId) {
      return true; // Let other guards handle missing data
    }

    const owner = ConversationOwnershipGuard.conversationOwners.get(conversationId);

    // If no owner yet, this is a new conversation - claim it
    if (!owner) {
      ConversationOwnershipGuard.conversationOwners.set(conversationId, userId);
      return true;
    }

    // Check if current user is the owner
    if (owner !== userId) {
      this.logger.warn(
        `[ChatAuth] User ${userId} attempted to access conversation owned by ${owner}`,
      );
      throw new UnauthorizedException('You do not have access to this conversation');
    }

    return true;
  }

  /**
   * Register a conversation owner (called when conversation is created)
   */
  static registerOwner(conversationId: string, userId: string): void {
    ConversationOwnershipGuard.conversationOwners.set(conversationId, userId);
  }

  /**
   * Remove conversation ownership (called when conversation is deleted)
   */
  static removeOwner(conversationId: string): void {
    ConversationOwnershipGuard.conversationOwners.delete(conversationId);
  }

  /**
   * Cleanup old ownership records (called periodically)
   */
  static cleanup(activeConversationIds: string[]): void {
    const activeSet = new Set(activeConversationIds);
    for (const id of ConversationOwnershipGuard.conversationOwners.keys()) {
      if (!activeSet.has(id)) {
        ConversationOwnershipGuard.conversationOwners.delete(id);
      }
    }
  }
}

/**
 * Simple in-memory rate limiter for chat endpoints.
 * Limits requests per user/IP to prevent API cost exhaustion.
 */
@Injectable()
export class ChatRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(ChatRateLimitGuard.name);

  // Rate limit: 30 requests per minute per user
  private readonly RATE_LIMIT = 30;
  private readonly WINDOW_MS = 60 * 1000; // 1 minute

  // Track requests per user
  private requestCounts: Map<string, { count: number; windowStart: number }> = new Map();

  // Cleanup old entries every 5 minutes
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldEntries();
    }, 5 * 60 * 1000);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const identifier = this.getIdentifier(request);
    const now = Date.now();

    let entry = this.requestCounts.get(identifier);

    // Reset window if expired
    if (!entry || now - entry.windowStart > this.WINDOW_MS) {
      entry = { count: 0, windowStart: now };
    }

    entry.count++;
    this.requestCounts.set(identifier, entry);

    if (entry.count > this.RATE_LIMIT) {
      const retryAfter = Math.ceil((entry.windowStart + this.WINDOW_MS - now) / 1000);
      this.logger.warn(
        `[RateLimit] User ${identifier} exceeded rate limit (${entry.count}/${this.RATE_LIMIT})`,
      );

      const response = context.switchToHttp().getResponse();
      response.setHeader('Retry-After', retryAfter);
      response.setHeader('X-RateLimit-Limit', this.RATE_LIMIT);
      response.setHeader('X-RateLimit-Remaining', 0);
      response.setHeader('X-RateLimit-Reset', entry.windowStart + this.WINDOW_MS);

      throw new UnauthorizedException(
        `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
      );
    }

    // Add rate limit headers
    const response = context.switchToHttp().getResponse();
    response.setHeader('X-RateLimit-Limit', this.RATE_LIMIT);
    response.setHeader('X-RateLimit-Remaining', Math.max(0, this.RATE_LIMIT - entry.count));
    response.setHeader('X-RateLimit-Reset', entry.windowStart + this.WINDOW_MS);

    return true;
  }

  private getIdentifier(request: any): string {
    // Prefer user ID if authenticated
    if (request.userId) {
      return `user:${request.userId}`;
    }
    // Fall back to IP address
    return `ip:${request.ip || request.headers?.['x-forwarded-for'] || 'unknown'}`;
  }

  private cleanupOldEntries(): void {
    const now = Date.now();
    for (const [key, entry] of this.requestCounts.entries()) {
      if (now - entry.windowStart > this.WINDOW_MS * 2) {
        this.requestCounts.delete(key);
      }
    }
  }
}
