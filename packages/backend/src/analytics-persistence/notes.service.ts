/**
 * Notes Service
 *
 * CRUD operations for user's market notes.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface Note {
  id: string;
  user_id: string;
  geography_type: string;
  geography_id: string;
  content: string;
  reminder_at?: string;
  reminder_sent: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateNoteDto {
  geography_type: string;
  geography_id: string;
  content: string;
  reminder_at?: string;
}

export interface UpdateNoteDto {
  content?: string;
  reminder_at?: string | null;
}

@Injectable()
export class NotesService {
  private readonly logger = new Logger(NotesService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Get all notes for a user
   */
  async getAll(userId: string): Promise<Note[]> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('analytics_notes')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      this.logger.error(`Failed to get notes: ${error.message}`);
      throw new Error(error.message);
    }

    return data || [];
  }

  /**
   * Get notes for a specific geography
   */
  async getByGeography(
    userId: string,
    geographyType: string,
    geographyId: string,
  ): Promise<Note[]> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('analytics_notes')
      .select('*')
      .eq('user_id', userId)
      .eq('geography_type', geographyType)
      .eq('geography_id', geographyId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Failed to get notes for geography: ${error.message}`);
      throw new Error(error.message);
    }

    return data || [];
  }

  /**
   * Get a single note by ID
   */
  async getById(userId: string, noteId: string): Promise<Note | null> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('analytics_notes')
      .select('*')
      .eq('user_id', userId)
      .eq('id', noteId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      this.logger.error(`Failed to get note: ${error.message}`);
      throw new Error(error.message);
    }

    return data;
  }

  /**
   * Create a new note
   */
  async create(userId: string, dto: CreateNoteDto): Promise<Note> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('analytics_notes')
      .insert({
        user_id: userId,
        geography_type: dto.geography_type,
        geography_id: dto.geography_id,
        content: dto.content,
        reminder_at: dto.reminder_at,
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to create note: ${error.message}`);
      throw new Error(error.message);
    }

    this.logger.log(`Created note: ${data.id} for user ${userId}`);
    return data;
  }

  /**
   * Update a note
   */
  async update(userId: string, noteId: string, dto: UpdateNoteDto): Promise<Note> {
    const client = this.supabase.getClient();

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (dto.content !== undefined) updateData.content = dto.content;
    if (dto.reminder_at !== undefined) updateData.reminder_at = dto.reminder_at;

    const { data, error } = await client
      .from('analytics_notes')
      .update(updateData)
      .eq('user_id', userId)
      .eq('id', noteId)
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to update note: ${error.message}`);
      throw new Error(error.message);
    }

    return data;
  }

  /**
   * Delete a note
   */
  async delete(userId: string, noteId: string): Promise<boolean> {
    const client = this.supabase.getClient();

    const { error } = await client
      .from('analytics_notes')
      .delete()
      .eq('user_id', userId)
      .eq('id', noteId);

    if (error) {
      this.logger.error(`Failed to delete note: ${error.message}`);
      throw new Error(error.message);
    }

    this.logger.log(`Deleted note: ${noteId}`);
    return true;
  }

  /**
   * Get notes with pending reminders
   */
  async getPendingReminders(userId: string): Promise<Note[]> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('analytics_notes')
      .select('*')
      .eq('user_id', userId)
      .eq('reminder_sent', false)
      .not('reminder_at', 'is', null)
      .lte('reminder_at', new Date().toISOString())
      .order('reminder_at', { ascending: true });

    if (error) {
      this.logger.error(`Failed to get pending reminders: ${error.message}`);
      throw new Error(error.message);
    }

    return data || [];
  }

  /**
   * Mark reminder as sent
   */
  async markReminderSent(userId: string, noteId: string): Promise<void> {
    const client = this.supabase.getClient();

    const { error } = await client
      .from('analytics_notes')
      .update({ reminder_sent: true })
      .eq('user_id', userId)
      .eq('id', noteId);

    if (error) {
      this.logger.error(`Failed to mark reminder sent: ${error.message}`);
    }
  }

  /**
   * Get count of notes
   */
  async getCount(userId: string): Promise<number> {
    const client = this.supabase.getClient();

    const { count, error } = await client
      .from('analytics_notes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (error) {
      this.logger.error(`Failed to get notes count: ${error.message}`);
      return 0;
    }

    return count || 0;
  }
}
