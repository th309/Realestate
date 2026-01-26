/**
 * Analytics Persistence Module Exports
 */

export { AnalyticsPersistenceModule } from './analytics-persistence.module';

// Services
export { SavedQueriesService, type SavedQuery, type CreateSavedQueryDto, type UpdateSavedQueryDto } from './saved-queries.service';
export { WatchlistService, type WatchlistItem, type AddToWatchlistDto, type UpdateWatchlistItemDto } from './watchlist.service';
export { NotesService, type Note, type CreateNoteDto, type UpdateNoteDto } from './notes.service';
export { ConversationsService, type Conversation, type ConversationMessage, type SaveConversationDto } from './conversations.service';
export { AlertsService, type Alert, type AlertCondition, type CreateAlertDto, type UpdateAlertDto } from './alerts.service';
export { SharesService, type Share, type ShareContent, type CreateShareDto } from './shares.service';
export { ExportService, type ExportOptions, type ExportResult } from './export.service';
