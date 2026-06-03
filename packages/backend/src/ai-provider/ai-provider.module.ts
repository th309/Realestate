import { Global, Module } from '@nestjs/common';
import { AiProviderController } from './ai-provider.controller';
import { AiProviderService } from './ai-provider.service';
import { AiShadowController } from './ai-shadow.controller';
import { AiShadowService } from './ai-shadow.service';

@Global()
@Module({
  controllers: [AiProviderController, AiShadowController],
  providers: [AiProviderService, AiShadowService],
  exports: [AiProviderService, AiShadowService],
})
export class AiProviderModule {}
