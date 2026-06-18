// dev-walkthrough.imports.ts
import { DynamicModule } from '@nestjs/common';
import { DevWalkthroughModule } from './dev-walkthrough.module';

export function devWalkthroughImports(): (typeof DevWalkthroughModule)[] {
  return process.env.DEV_WALKTHROUGH_ENABLED === 'true' &&
    process.env.NODE_ENV !== 'production'
    ? [DevWalkthroughModule]
    : [];
}
