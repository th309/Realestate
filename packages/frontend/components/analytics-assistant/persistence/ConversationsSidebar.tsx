'use client';

/**
 * Conversations Sidebar
 *
 * Shows conversation history and allows switching between conversations.
 */

import React from 'react';
import {
  MessageSquare,
  Trash2,
  Archive,
  Plus,
  Clock,
  Loader2,
} from 'lucide-react';
import type { Conversation } from './types';

interface ConversationsSidebarProps {
  conversations: Conversation[];
  currentConversationId?: string;
  isLoading: boolean;
  onSelectConversation: (conversationId: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (conversationId: string) => void;
  onArchiveConversation: (conversationId: string) => void;
}

function formatDate(dateString?: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function ConversationItem({
  conversation,
  isActive,
  onSelect,
  onDelete,
  onArchive,
}: {
  conversation: Conversation;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onArchive: () => void;
}) {
  return (
    <div
      className={`group relative px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
        isActive
          ? 'bg-primary/10 text-primary'
          : 'hover:bg-surface-container-high text-on-surface'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start gap-2.5">
        <MessageSquare className="w-4 h-4 mt-0.5 flex-shrink-0 opacity-60" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {conversation.title || 'New Conversation'}
          </p>
          <p className="text-xs text-on-surface-variant flex items-center gap-1 mt-0.5">
            <Clock className="w-3 h-3" />
            {formatDate(conversation.last_message_at)}
            <span className="opacity-50">·</span>
            {conversation.message_count} msgs
          </p>
        </div>
      </div>

      {/* Actions on hover */}
      <div
        className={`absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onArchive}
          className="p-1 rounded hover:bg-surface-container text-on-surface-variant hover:text-on-surface"
          title="Archive"
        >
          <Archive className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onDelete}
          className="p-1 rounded hover:bg-error-container text-on-surface-variant hover:text-error"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export function ConversationsSidebar({
  conversations,
  currentConversationId,
  isLoading,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onArchiveConversation,
}: ConversationsSidebarProps) {
  return (
    <div className="flex flex-col h-full bg-surface-container-low">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant">
        <h3 className="text-sm font-semibold text-on-surface">History</h3>
        <button
          onClick={onNewConversation}
          className="p-1.5 rounded-lg bg-primary text-on-primary hover:bg-primary/90 transition-colors"
          title="New conversation"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-on-surface-variant" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-8 px-4">
            <MessageSquare className="w-8 h-8 mx-auto text-on-surface-variant/30 mb-2" />
            <p className="text-sm text-on-surface-variant">No conversations yet</p>
            <p className="text-xs text-on-surface-variant/60 mt-1">
              Start a new chat to begin
            </p>
          </div>
        ) : (
          conversations.map((conversation) => (
            <ConversationItem
              key={conversation.id}
              conversation={conversation}
              isActive={conversation.conversation_id === currentConversationId}
              onSelect={() => onSelectConversation(conversation.conversation_id)}
              onDelete={() => onDeleteConversation(conversation.conversation_id)}
              onArchive={() => onArchiveConversation(conversation.conversation_id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
