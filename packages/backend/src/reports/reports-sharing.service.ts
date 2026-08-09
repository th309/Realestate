/**
 * Reports Sharing Service
 *
 * Thin NestJS DI wrapper around reports-sharing.ts's standalone functions
 * (share links + conversations). Split out of ReportsService to keep it
 * under CLAUDE.md's 300-line hard limit (§1.3) — same reasoning as the
 * ai-provider streaming-method extraction.
 */

import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { ReportAiService } from './report-ai.service';
import { NewsScoutService } from './news-scout.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { ReportsService } from './reports.service';
import {
  streamConversationMessage as streamConversationMessageFn,
  ConversationStreamEvent,
  getConversation as getConversationFn,
  createShareLink as createShareLinkFn,
  getSharedReport as getSharedReportFn,
} from './reports-sharing';

@Injectable()
export class ReportsSharingService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly reportAiService: ReportAiService,
    private readonly newsScoutService: NewsScoutService,
    private readonly entitlementsService: EntitlementsService,
    private readonly reportsService: ReportsService,
  ) {}

  streamConversationMessage(
    reportId: string,
    userId: string,
    content: string,
  ): AsyncGenerator<ConversationStreamEvent> {
    return streamConversationMessageFn(
      this.supabase.getClient(),
      {
        reportAiService: this.reportAiService,
        newsScoutService: this.newsScoutService,
        entitlementsService: this.entitlementsService,
        getReport: (rid, uid) => this.reportsService.getReport(rid, uid),
      },
      reportId,
      userId,
      content,
    );
  }

  async getConversation(reportId: string, userId: string): Promise<any> {
    return getConversationFn(this.supabase.getClient(), reportId, userId);
  }

  async createShareLink(
    reportId: string,
    userId: string,
    accessLevel: 'view' | 'download',
    expiresInDays?: number,
  ): Promise<string> {
    return createShareLinkFn(
      this.supabase.getClient(),
      reportId,
      userId,
      accessLevel,
      expiresInDays,
    );
  }

  async getSharedReport(token: string): Promise<any> {
    return getSharedReportFn(this.supabase.getClient(), token);
  }
}
