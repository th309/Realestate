/**
 * Features Admin Module Exports
 */

export { FeaturesModule } from './features.module';

// Services
export { FeaturesService, type FeatureDefinition, type FeatureMatrix } from './features.service';
export { TiersService, type SubscriptionTier, type CreateTierDto, type UpdateTierDto } from './tiers.service';
export { UserFeaturesService, type UserFeature, type ResolvedFeatures, type UserOverride } from './user-features.service';
export { GrandfatheringService, type GrandfatheredRecord, type GrandfatherPolicy, type CreateGrandfatherDto } from './grandfathering.service';
