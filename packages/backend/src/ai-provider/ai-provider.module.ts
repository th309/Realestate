import { Global, Module } from '@nestjs/common';
import { AiProviderController } from './ai-provider.controller';
import { AiProviderService } from './ai-provider.service';
import { AiShadowController } from './ai-shadow.controller';

@Global()
@Module({
  controllers: [AiProviderController, AiShadowController],
  providers: [AiProviderService],
  exports: [AiProviderService],
})
export class AiProviderModule {}
