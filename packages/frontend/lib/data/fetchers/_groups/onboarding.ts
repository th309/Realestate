/**
 * ONBOARDING & USER PREFERENCES FETCHERS
 *
 * Onboarding state, quiz preferences, insights, watchlist, email prefs,
 * support, research brief, anonymous listing tour.
 */

// Onboarding
export {
  fetchOnboardingState,
  completeOnboarding,
  resetOnboarding,
  saveOnboardingPreferences,
  startOnboardingTrial,
  saveOnboardingMarketSelection,
  updateChecklistTask,
  incrementUsageStat,
  dismissBeaconTask,
} from "../onboarding";
export type { OnboardingState } from "../onboarding";

// Insights (AI-generated market narratives)
export { fetchInsight, type InsightData } from "../insights";

// User quiz preferences
export {
  fetchPreferences,
  upsertPreferences,
  type UserPreferences,
  type UpsertPreferencesPayload,
  type UserGoal,
  type Timeline,
} from "../preferences";

// Research brief
export {
  fetchClarifyingQuestions,
  generateResearchBrief,
  type ClarifyingQuestion,
  type ClarifyingQuestionOption,
  type ClarifyingQuestionsResponse,
  type ResearchBriefResponse,
} from "../research-brief";

// Watchlist
export {
  fetchWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  type WatchlistItem,
  type AddToWatchlistDto,
} from "../watchlist";

// Email preferences
export {
  fetchEmailPreferences,
  updateEmailPreferences,
  type EmailPreferences,
} from "../email-preferences";

// Support
export {
  submitSupportTicket,
  submitContactForm,
  type SupportTicket,
  type ContactFormData,
} from "../support";

// Anonymous listing presentation (activation tour)
export {
  generateAnonymousListingPresentation,
  TourRateLimitError,
  type Persona,
  type MarketRef,
  type ReportSection,
  type AnonReportResponse,
} from "../anonymous-listing-presentation";

// Tour signup (anonymous → claimed user conversion)
export {
  signUpWithTour,
  type SignUpWithTourInput,
  type SignUpWithTourResult,
} from "../tour-signup";
