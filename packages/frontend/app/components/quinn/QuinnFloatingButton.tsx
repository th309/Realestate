'use client';

/**
 * QuinnFloatingButton Component
 * 
 * A floating button that appears in the bottom-right corner of every page.
 * When clicked, it opens the Quinn AI assistant chat panel.
 * 
 * Design: Material Design 3 compliant per project_instructions.md §5
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useQuinnUser, generateConversationId } from './useQuinnUser';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const STARTER_PROMPTS = [
  "What's the market trend in Los Angeles?",
  "Compare Austin vs Denver for investment",
  "Which metros have the best rental yields?",
];

const SUGGESTION_CHIPS = [
  "Analyze zip code",
  "Compare ROI",
  "Find hot markets",
];

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
  
  // Get user ID (authenticated or anonymous)
  const { userId, isLoading: isUserLoading } = useQuinnUser();
  
  // Generate conversation ID tied to user - stable for this chat session
  const conversationId = useMemo(() => {
    if (!userId) return '';
    return generateConversationId(userId);
  }, [userId]);

  // Show tooltip briefly on mount
  useEffect(() => {
    const timer = setTimeout(() => setShowTooltip(true), 2000);
    const hideTimer = setTimeout(() => setShowTooltip(false), 7000);
    return () => {
      clearTimeout(timer);
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
    if (textarea) {
      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = 'auto';
      // Set height to scrollHeight, capped at max (10 lines ≈ 200px)
      const maxHeight = 200;
      textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    }
  }, [input]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || !conversationId) {
      console.warn('[Quinn Client] sendMessage blocked:', { hasText: !!text.trim(), hasConversationId: !!conversationId });
      return;
    }

    const requestId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    console.log(`[Quinn Client ${requestId}] === SEND MESSAGE START ===`);
    console.log(`[Quinn Client ${requestId}] Message:`, text.slice(0, 100));
    console.log(`[Quinn Client ${requestId}] ConversationId:`, conversationId);

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    const startTime = Date.now();
    
    try {
      const apiUrl = `/api/analytics/chat/${conversationId}`;
      console.log(`[Quinn Client ${requestId}] Fetching:`, apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text
        })
      });

      const duration = Date.now() - startTime;
      console.log(`[Quinn Client ${requestId}] Response received in ${duration}ms`);
      console.log(`[Quinn Client ${requestId}] Status:`, response.status, response.statusText);

      const responseText = await response.text();
      console.log(`[Quinn Client ${requestId}] Response length:`, responseText.length);
      console.log(`[Quinn Client ${requestId}] Response preview:`, responseText.slice(0, 300));

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseErr) {
        console.error(`[Quinn Client ${requestId}] JSON parse failed:`, parseErr);
        console.error(`[Quinn Client ${requestId}] Raw response:`, responseText);
        throw new Error(`Invalid JSON response: ${responseText.slice(0, 100)}`);
      }

      console.log(`[Quinn Client ${requestId}] Parsed data:`, {
        success: data.success,
        hasResponse: !!data.response,
        hasError: !!data.error,
        debug: data.debug,
        toolsUsed: data.toolsUsed,
      });

      if (!response.ok) {
        console.error(`[Quinn Client ${requestId}] HTTP error:`, response.status, data.error || data.message);
        throw new Error(data.error || data.message || `HTTP ${response.status}`);
      }

      if (data.success === false) {
        console.error(`[Quinn Client ${requestId}] Backend returned success=false:`, data.error);
        throw new Error(data.error || 'Backend processing failed');
      }

      let content = typeof data.response === 'string' ? data.response.trim() : '';
      if (!content && data.message) content = String(data.message).trim();
      if (!content && data.structuredData?.rankings?.items?.length) {
        const r = data.structuredData.rankings;
        const label = r.direction === 'bottom' ? 'Bottom' : 'Top';
        const top = r.items.slice(0, 5);
        content = `${label} markets:\n${top.map((i: { rank: number; name: string; score?: number; state?: string }) => `${i.rank}. ${i.name}${i.score != null ? ` (${i.score})` : ''}${i.state ? `, ${i.state}` : ''}`).join('\n')}`;
      }
      if (!content) content = 'I received your message but had trouble showing a response. Please try again.';

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content,
        timestamp: new Date().toISOString()
      };

      console.log(`[Quinn Client ${requestId}] === SUCCESS === Response length:`, assistantMessage.content.length);
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const duration = Date.now() - startTime;
      const err = error as Error;
      
      console.error(`[Quinn Client ${requestId}] === FAILED after ${duration}ms ===`);
      console.error(`[Quinn Client ${requestId}] Error:`, err.name, err.message);
      console.error(`[Quinn Client ${requestId}] Stack:`, err.stack);
      
      // Show more helpful error message based on error type
      let userErrorMessage = 'Sorry, I encountered an error. Please try again.';
      if (err.message.includes('fetch') || err.message.includes('network')) {
        userErrorMessage = 'Unable to reach the server. Please check your connection and try again.';
      } else if (err.message.includes('timeout')) {
        userErrorMessage = 'The request timed out. Please try again.';
      } else if (err.message.includes('503') || err.message.includes('unavailable')) {
        userErrorMessage = 'The AI service is temporarily unavailable. Please try again in a moment.';
      }
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: userErrorMessage,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

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
          {/* Online Status Indicator */}
          <span className={`absolute top-0 right-0 w-4 h-4 rounded-full border-2 border-surface ${isUserLoading ? 'bg-amber-500' : 'bg-emerald-500'}`} />
        </button>
      </div>

      {/* Modal Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-[9999] flex items-end sm:items-center justify-center sm:justify-end p-0 sm:p-6"
          onClick={() => setIsOpen(false)}
        >
          {/* Chat Panel - M3 Dialog radius */}
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:w-[420px] h-[85vh] sm:h-[640px] sm:max-h-[80vh] bg-surface rounded-t-[28px] sm:rounded-[28px] elevation-5 flex flex-col overflow-hidden animate-slideIn"
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-outline-variant bg-surface-container flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container">
                    <span className="text-lg font-bold">Q</span>
                  </div>
                  {/* Online indicator */}
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
                  onClick={() => setIsOpen(false)}
                  className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-full transition-colors"
                  aria-label="Close"
                >
                  <MaterialIcon name="close" className="text-xl" />
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-5 bg-surface-container-low">
              {messages.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container">
                    <span className="text-3xl font-bold">Q</span>
                  </div>
                  <h4 className="text-on-surface font-medium mb-2">
                    Ask Quinn anything about real estate markets
                  </h4>
                  <p className="text-on-surface-variant text-sm mb-6">
                    Get insights on home values, market trends, and investment opportunities
                  </p>
                  <div className="space-y-2">
                    {STARTER_PROMPTS.map((prompt, i) => (
                      <button
                        key={i}
                        onClick={() => sendMessage(prompt)}
                        className="block w-full text-left px-4 py-3 bg-surface border border-outline-variant rounded-xl text-sm text-on-surface hover:border-primary hover:bg-primary-container/10 transition-colors duration-200"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex items-start gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {msg.role === 'assistant' && (
                        <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container shrink-0">
                          <span className="text-sm font-bold">Q</span>
                        </div>
                      )}
                      <div className="flex flex-col gap-1">
                        <div
                          className={`max-w-[280px] px-4 py-3 text-sm leading-relaxed ${
                            msg.role === 'user'
                              ? 'bg-primary text-on-primary rounded-[20px] rounded-br-sm'
                              : 'bg-surface-container-high text-on-surface rounded-[20px] rounded-bl-sm'
                          }`}
                        >
                          {msg.content}
                        </div>
                        {msg.role === 'user' && (
                          <span className="text-[10px] text-on-surface-variant text-right">Delivered</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {loading && (
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
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-outline-variant bg-surface-container">
              {/* Suggestion Chips */}
              <div className="flex gap-2 overflow-x-auto pb-3 -mx-1 px-1">
                {SUGGESTION_CHIPS.map((chip, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(chip)}
                    className="whitespace-nowrap px-3 py-1.5 bg-surface border border-outline-variant rounded-full text-xs font-medium text-on-surface hover:border-primary hover:bg-primary-container/10 transition-colors duration-200"
                  >
                    {chip}
                  </button>
                ))}
              </div>
              
              {/* Input Field */}
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
              
              {/* Disclaimer */}
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
