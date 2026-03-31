import { Module } from '@nestjs/common';
import { UserApiKeysService } from './user-api-keys.service';
import { UserApiKeysController } from './user-api-keys.controller';

@Module({
  controllers: [UserApiKeysController],
  providers: [UserApiKeysService],
  exports: [UserApiKeysService],
})
export class UserApiKeysModule {}
