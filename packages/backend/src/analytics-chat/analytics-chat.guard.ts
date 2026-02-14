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
import { SupabaseService } from '../supabase/supabase.service';

interface JwtValidationResult {
  valid: boolean;
  userId?: string;
  error?: string;
}

/**
 * JWT-based authentication guard using Supabase Auth.
 * Validates that requests have valid authentication before accessing chat endpoints.
 *
 * Authentication methods (checked in order):
 * 1. Bearer token in Authorization header (validated via Supabase)
 * 2. x-api-key header (for service-to-service calls)
 */
@Injectable()
export class ChatAuthGuard implements CanActivate {
  private readonly logger = new Logger(ChatAuthGuard.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const result = await this.validateRequest(request);

    if (!result.valid) {
      this.logger.warn(
        `[ChatAuth] Unauthorized access attempt from ${request.ip || 'unknown'}: ${result.error || 'Unknown error'}`,
      );
      throw new UnauthorizedException(
        result.error || 'Authentication required for chat access',
      );
    }

    return true;
  }

  private async validateRequest(
    request: any,
  ): Promise<{ valid: boolean; error?: string }> {
    // 1. Check Bearer token (JWT from Supabase Auth)
    const authHeader = request.headers?.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const jwtResult = await this.validateSupabaseJwt(token);

      if (jwtResult.valid && jwtResult.userId) {
        request.userId = jwtResult.userId;
        return { valid: true };
      }

      return { valid: false, error: jwtResult.error || 'Invalid token' };
    }

    // 2. Check API key header (for service-to-service calls)
    const apiKey = request.headers?.['x-api-key'];
    if (apiKey) {
      if (this.validateApiKey(apiKey)) {
        request.userId = 'api-user';
        return { valid: true };
      }
      return { valid: false, error: 'Invalid API key' };
    }

    // 3. Development bypass - requires explicit ALLOW_DEV_AUTH=true flag
    const isDevelopment =
      this.configService.get<string>('NODE_ENV') === 'development';
    const allowDevAuth =
      this.configService.get<string>('ALLOW_DEV_AUTH') === 'true';

    if (isDevelopment && allowDevAuth) {
      // Check for x-user-id header in dev mode with explicit flag
      const devUserId = request.headers?.['x-user-id'];
      if (devUserId && this.isValidUserId(devUserId)) {
        this.logger.warn(
          '[ChatAuth] Using development auth bypass with x-user-id header',
        );
        request.userId = devUserId;
        return { valid: true };
      }
    }

    return { valid: false, error: 'No valid authentication provided' };
  }

  private async validateSupabaseJwt(token: string): Promise<JwtValidationResult> {
    try {
      const supabase = this.supabaseService.getClient();

      // Use getUser() to validate the JWT - this makes a request to Supabase Auth
      // and validates the token signature, expiration, and that the session is still valid
      const { data, error } = await supabase.auth.getUser(token);

      if (error) {
        this.logger.debug(`[ChatAuth] JWT validation failed: ${error.message}`);
        return {
          valid: false,
          error: this.mapAuthError(error.message),
        };
      }

      if (!data.user) {
        return { valid: false, error: 'No user found for token' };
      }

      // Extract user ID from the validated user object
      const userId = data.user.id;

      this.logger.debug(`[ChatAuth] JWT validated for user: ${userId}`);
      return { valid: true, userId };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`[ChatAuth] JWT validation error: ${message}`);
      return { valid: false, error: 'Token validation failed' };
    }
  }

  private mapAuthError(errorMessage: string): string {
    const lowerMessage = errorMessage.toLowerCase();

    if (lowerMessage.includes('expired')) {
      return 'Token has expired';
    }
    if (lowerMessage.includes('invalid')) {
      return 'Invalid token';
    }
    if (lowerMessage.includes('malformed')) {
      return 'Malformed token';
    }

    return 'Authentication failed';
  }

  private validateApiKey(apiKey: string): boolean {
    const validApiKey = this.configService.get<string>('CHAT_API_KEY');
    if (!validApiKey) {
      return false;
    }
    return apiKey === validApiKey;
  }

  private isValidUserId(userId: string): boolean {
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
