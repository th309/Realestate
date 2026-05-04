/**
 * REPORTS FETCHERS
 *
 * Report generation, history, sharing, conversation, follow-up alerts.
 */

// Reports
export {
  fetchReport,
  fetchSampleReport,
  fetchSharedReport,
  createReportShareLink,
  fetchReportHistory,
  fetchReportList,
  generateReport,
  regenerateNarratives,
  sendReportMessage,
  fetchReportConversation,
  type GenerateReportRequest,
  type GenerateReportResponse,
} from "../reports";

// Report follow-up (alerts + market changes)
export {
  fetchReportFollowUp,
  dismissReportAlert,
  type FollowUpAlert,
  type MarketChange,
  type ReportFollowUpData,
} from "../report-follow-up";
