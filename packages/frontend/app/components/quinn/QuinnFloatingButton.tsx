'use client';

/**
 * QuinnFloatingButton Component
 *
 * A floating button that appears in the bottom-right corner of every page.
 * When clicked, it opens the Quinn AI assistant chat panel.
 * 
 * Design: Material Design 3 compliant per CLAUDE.md Section 8 (Brand & Design)
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useQuinnUser, generateConversationId } from './useQuinnUser';
import { QuinnRichData } from './QuinnRichData';
import { STARTER_PROMPTS, parseChatApiResponse, classifyErrorMessage } from './quinnChatHelpers';
import type { QuinnStructuredData } from './QuinnStructuredData.types';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  structuredData?: QuinnStructuredData;
  followUps?: string[];
}

/** Material Symbol icon component */
function MaterialIcon({ name, className = '', filled = false }: {
  name: string;
  className?: string;
  filled?: boolean;
}) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={{
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24`
      }}
    >
      {name}
    </span>
  );
}

export function QuinnFloatingButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { userId, isLoading: isUserLoading } = useQuinnUser();

  const conversationId = useMemo(() => {
    if (!userId) return '';
    return generateConversationId(userId);
  }, [userId]);

  // Show tooltip briefly on mount
  useEffect(() => {
    const showTimer = setTimeout(() => setShowTooltip(true), 2000);
    const hideTimer = setTimeout(() => setShowTooltip(false), 7000);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Auto-resize textarea up to 10 lines (~200px), then scroll
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const maxHeight = 200;
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  }, [input]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || !conversationId) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const headers = await buildAuthHeaders(userId);
      const response = await fetch(`/api/analytics/chat/${conversationId}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ message: text }),
      });

      const responseText = await response.text();
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(`Invalid JSON response: ${responseText.slice(0, 100)}`);
      }

      if (!response.ok) {
        throw new Error((data.error ?? data.message ?? `HTTP ${response.status}`) as string);
      }
      if (data.success === false) {
        throw new Error((data.error as string) || 'Backend processing failed');
      }

      const parsed = parseChatApiResponse(data);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: parsed.content,
        timestamp: new Date().toISOString(),
        ...(parsed.structuredData ? { structuredData: parsed.structuredData } : {}),
        ...(parsed.followUps.length > 0 ? { followUps: parsed.followUps } : {}),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: classifyErrorMessage(error as Error),
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  }, [conversationId, userId]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }, [input, sendMessage]);

  return (
    <>
      {/* Material Symbols font */}
      <link
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        rel="stylesheet"
      />

      {/* Floating Button Container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {/* Status Tooltip */}
        {showTooltip && !isOpen && (
          <div className="bg-surface-container-high text-on-surface px-4 py-2 rounded-xl text-xs font-medium elevation-3 flex items-center gap-2 animate-slideIn">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            Quinn is ready to assist
          </div>
        )}

        {/* FAB Button */}
        <button
          onClick={() => setIsOpen(true)}
          disabled={isUserLoading}
          className="group relative flex items-center justify-center w-16 h-16 rounded-full bg-primary-container text-on-primary-container elevation-3 hover:elevation-4 transition-all duration-200 active:scale-95 disabled:opacity-70"
          aria-label="Open Quinn AI Assistant"
        >
          <span className="text-2xl font-bold group-hover:scale-110 transition-transform duration-200">Q</span>
          <span className={`absolute top-0 right-0 w-4 h-4 rounded-full border-2 border-surface ${isUserLoading ? 'bg-amber-500' : 'bg-emerald-500'}`} />
        </button>
      </div>

      {/* Modal Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-[9999] flex items-end sm:items-center justify-center sm:justify-end p-0 sm:p-6"
          onClick={() => setIsOpen(false)}
        >
          {/* Chat Panel */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:w-[420px] h-[85vh] sm:h-[640px] sm:max-h-[80vh] bg-surface rounded-t-[28px] sm:rounded-[28px] elevation-5 flex flex-col overflow-hidden animate-slideIn"
          >
            <ChatHeader onClose={() => setIsOpen(false)} />

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-5 bg-surface-container-low">
              {messages.length === 0 ? (
                <EmptyState onSend={sendMessage} />
              ) : (
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <ChatBubble key={msg.id} message={msg} onFollowUp={sendMessage} />
                  ))}
                  {loading && <TypingIndicator />}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-outline-variant bg-surface-container">
              <div className="flex items-end gap-3 bg-surface-container-high px-4 py-3 rounded-2xl border border-outline-variant focus-within:border-primary transition-colors">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask Quinn about properties..."
                  disabled={loading}
                  rows={1}
                  className="flex-1 bg-transparent border-none text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-0 disabled:opacity-50 resize-none overflow-y-auto leading-5"
                  style={{ minHeight: '20px', maxHeight: '200px' }}
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={loading || !input.trim()}
                  className="w-9 h-9 flex items-center justify-center bg-primary text-on-primary rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors duration-200 shrink-0 self-end"
                  aria-label="Send message"
                >
                  <MaterialIcon name="send" className="text-lg" />
                </button>
              </div>
              <p className="mt-2 text-center text-[10px] text-on-surface-variant">
                Quinn can make mistakes. Verify important data.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ChatHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className="px-5 py-4 border-b border-outline-variant bg-surface-container flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container">
            <span className="text-lg font-bold">Q</span>
          </div>
          <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-surface" />
        </div>
        <div>
          <h3 className="text-on-surface font-semibold text-base leading-tight">Quinn</h3>
          <p className="text-on-surface-variant text-[11px] uppercase tracking-wider font-medium mt-0.5">
            Your Property Expert
          </p>
        </div>
      </div>
      <div className="flex gap-1">
        <button
          className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-full transition-colors"
          aria-label="More options"
        >
          <MaterialIcon name="more_vert" className="text-xl" />
        </button>
        <button
          onClick={onClose}
          className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-full transition-colors"
          aria-label="Close"
        >
          <MaterialIcon name="close" className="text-xl" />
        </button>
      </div>
    </div>
  );
}

function EmptyState({ onSend }: { onSend: (text: string) => void }) {
  return (
    <div className="text-center py-8">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container">
        <span className="text-3xl font-bold">Q</span>
      </div>
      <p className="text-on-surface-variant text-sm leading-relaxed mb-5 max-w-[320px] mx-auto">
        I&apos;m Quinn, your real estate market analyst. I track 900+ metros and 3,000+ counties with weekly intelligence briefings.
      </p>
      <p className="text-on-surface text-sm font-medium mb-3">
        Try asking me something:
      </p>
      <div className="space-y-2">
        {STARTER_PROMPTS.map((prompt, i) => (
          <button
            key={i}
            onClick={() => onSend(prompt.text)}
            className="flex items-center gap-3 w-full text-left px-4 py-3 bg-surface border border-outline-variant rounded-xl text-sm text-on-surface hover:border-primary hover:bg-primary-container/10 transition-colors duration-200"
          >
            <MaterialIcon name={prompt.icon} className="text-lg text-on-surface-variant" />
            {prompt.text}
          </button>
        ))}
      </div>
    </div>
  );
}

function ChatBubble({ message, onFollowUp }: { message: Message; onFollowUp: (text: string) => void }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex items-start gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container shrink-0">
          <span className="text-sm font-bold">Q</span>
        </div>
      )}
      <div className={`flex flex-col gap-2 ${!isUser && message.structuredData ? 'max-w-[360px]' : ''}`}>
        <div
          className={`px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? 'max-w-[280px] bg-primary text-on-primary rounded-[20px] rounded-br-sm'
              : 'max-w-[360px] bg-surface-container-high text-on-surface rounded-[20px] rounded-bl-sm'
          }`}
        >
          {message.content}
        </div>
        {!isUser && message.structuredData && (
          <QuinnRichData data={message.structuredData} />
        )}
        {!isUser && message.followUps && message.followUps.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-1">
            {message.followUps.map((question, i) => (
              <button
                key={i}
                onClick={() => onFollowUp(question)}
                className="text-xs px-3 py-1.5 rounded-full border border-outline-variant text-on-surface-variant hover:bg-surface-container-high transition-colors duration-200"
              >
                {question}
              </button>
            ))}
          </div>
        )}
        {isUser && (
          <span className="text-[10px] text-on-surface-variant text-right">Delivered</span>
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-start gap-2">
      <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container shrink-0">
        <span className="text-sm font-bold">Q</span>
      </div>
      <div className="bg-surface-container-high px-4 py-3 rounded-[20px] rounded-bl-sm">
        <div className="flex gap-1">
          <span className="w-2 h-2 bg-on-surface-variant rounded-full animate-bounce" />
          <span className="w-2 h-2 bg-on-surface-variant rounded-full animate-bounce [animation-delay:0.2s]" />
          <span className="w-2 h-2 bg-on-surface-variant rounded-full animate-bounce [animation-delay:0.4s]" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function buildAuthHeaders(userId: string): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  try {
    const supabase = createSupabaseBrowserClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
      return headers;
    }
  } catch {
    // Fall through to anonymous header
  }

  headers['x-user-id'] = userId;
  return headers;
}
