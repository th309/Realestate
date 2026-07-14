import { Module } from '@nestjs/common';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { UserApiKeysService } from './user-api-keys.service';
import { UserApiKeysController } from './user-api-keys.controller';

@Module({
  imports: [OnboardingModule],
  controllers: [UserApiKeysController],
  providers: [UserApiKeysService],
  exports: [UserApiKeysService],
})
export class UserApiKeysModule {}
