/**
 * Organization Member Guard
 *
 * Requires that OrgContextGuard has already run (i.e., request.org is set)
 * and that the authenticated user holds ANY active role in the organization.
 *
 * Usage:
 *   @UseGuards(JwtAuthGuard, OrgContextGuard, OrgMemberGuard)
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

@Injectable()
export class OrgMemberGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    if (!request.org) {
      throw new NotFoundException('Organization not found');
    }

    if (!request.orgRole) {
      throw new ForbiddenException('Organization membership required');
    }

    return true;
  }
}
