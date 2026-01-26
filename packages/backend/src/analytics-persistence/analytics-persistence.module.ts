/**
 * Analytics Persistence Module
 *
 * Handles saved queries, watchlist, notes, conversations, alerts, shares, and export.
 */

import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { SavedQueriesService } from './saved-queries.service';
import { SavedQueriesController } from './saved-queries.controller';
import { WatchlistService } from './watchlist.service';
import { WatchlistController } from './watchlist.controller';
import { NotesService } from './notes.service';
import { NotesController } from './notes.controller';
import { ConversationsService } from './conversations.service';
import { ConversationsController } from './conversations.controller';
import { AlertsService } from './alerts.service';
import { AlertsController } from './alerts.controller';
import { SharesService } from './shares.service';
import { SharesController } from './shares.controller';
import { ExportService } from './export.service';
import { ExportController } from './export.controller';

@Module({
  imports: [SupabaseModule],
  providers: [
    SavedQueriesService,
    WatchlistService,
    NotesService,
    ConversationsService,
    AlertsService,
    SharesService,
    ExportService,
  ],
  controllers: [
    SavedQueriesController,
    WatchlistController,
    NotesController,
    ConversationsController,
    AlertsController,
    SharesController,
    ExportController,
  ],
  exports: [
    SavedQueriesService,
    WatchlistService,
    NotesService,
    ConversationsService,
    AlertsService,
    SharesService,
    ExportService,
  ],
})
export class AnalyticsPersistenceModule {}
