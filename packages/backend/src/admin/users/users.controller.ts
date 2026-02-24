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
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { AdminGuard } from '../../common/guards/admin-auth.guard';

@UseGuards(AdminGuard)
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

  @Post()
  async createUser(
    @Body() body: {
      email: string;
      password: string;
      fullName?: string;
      tier?: string;
    },
  ) {
    if (!body.email || !body.password) {
      throw new HttpException(
        'Email and password are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const user = await this.usersService.createUser({
        email: body.email,
        password: body.password,
        fullName: body.fullName,
        tier: body.tier,
      });
      return { success: true, data: user };
    } catch (err) {
      throw new HttpException(
        err.message || 'Failed to create user',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Delete(':userId')
  async deleteUser(@Param('userId') userId: string) {
    try {
      await this.usersService.deleteUser(userId);
      return { success: true };
    } catch (err) {
      throw new HttpException(
        err.message || 'Failed to delete user',
        HttpStatus.BAD_REQUEST,
      );
    }
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
