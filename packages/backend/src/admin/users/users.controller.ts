import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('api/admin/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async listUsers(
    @Query('search') search?: string,
    @Query('tier') tier?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.usersService.getUsers({
      search,
      tier,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('stats')
  async getStats() {
    return this.usersService.getStats();
  }

  @Get(':userId')
  async getUserDetail(@Param('userId') userId: string) {
    const user = await this.usersService.getUserDetail(userId);
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }
    return user;
  }

  @Post(':userId/overrides')
  async addOverride(
    @Param('userId') userId: string,
    @Body() body: {
      featureSlug: string;
      reason?: string;
      expiresAt?: string;
    },
  ) {
    await this.usersService.addOverride(userId, body.featureSlug, {
      reason: body.reason,
      expiresAt: body.expiresAt,
    });
    return { success: true };
  }

  @Delete(':userId/overrides/:featureSlug')
  async removeOverride(
    @Param('userId') userId: string,
    @Param('featureSlug') featureSlug: string,
  ) {
    await this.usersService.removeOverride(userId, featureSlug);
    return { success: true };
  }

  @Put(':userId/tier')
  async updateTier(
    @Param('userId') userId: string,
    @Body() body: { tier: string },
  ) {
    await this.usersService.updateUserTier(userId, body.tier);
    return { success: true };
  }
}
