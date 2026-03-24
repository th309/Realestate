/**
 * Organization Admin Guard
 *
 * Requires that OrgContextGuard has already run (i.e., request.org is set)
 * and that the authenticated user holds the 'admin' role in the organization.
 *
 * Usage:
 *   @UseGuards(JwtAuthGuard, OrgContextGuard, OrgAdminGuard)
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

@Injectable()
export class OrgAdminGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    if (!request.org) {
      throw new NotFoundException('Organization not found');
    }

    if (request.orgRole !== 'admin') {
      throw new ForbiddenException('Organization admin access required');
    }

    return true;
  }
}
