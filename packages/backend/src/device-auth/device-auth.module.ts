import { Module } from '@nestjs/common';
import { UserApiKeysModule } from '../user-api-keys/user-api-keys.module';
import { DeviceAuthService } from './device-auth.service';
import { DeviceAuthController } from './device-auth.controller';

@Module({
  imports: [UserApiKeysModule],
  controllers: [DeviceAuthController],
  providers: [DeviceAuthService],
})
export class DeviceAuthModule {}
