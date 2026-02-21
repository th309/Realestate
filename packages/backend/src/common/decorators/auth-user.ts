/**
 * Auth User Decorators
 *
 * Parameter decorators to extract the authenticated user ID
 * from the request object (set by JwtAuthGuard).
 */

import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Extracts the authenticated user ID from the request.
 * Requires JwtAuthGuard to be applied to the route/controller.
 *
 * @example
 * @UseGuards(JwtAuthGuard)
 * @Get()
 * async getItems(@AuthUserId() userId: string) { ... }
 */
export const AuthUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.userId;
  },
);
