'use client';

/**
 * QuinnFloatingButton Component
 * 
 * A floating button that appears in the bottom-right corner of every page.
 * When clicked, it opens the Quinn AI assistant chat panel.
 */

import React, { useState, useCallback } from 'react';

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

export function QuinnFloatingButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/analytics/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          conversationId: `quinn-${Date.now()}`
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || data.message || 'I received your message but had trouble processing it.',
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }, [input, sendMessage]);

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-on-primary shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center group"
        aria-label="Open Quinn AI Assistant"
      >
        <span className="text-xl font-bold group-hover:scale-110 transition-transform">Q</span>
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-end sm:items-center justify-center sm:justify-end p-0 sm:p-6"
          onClick={() => setIsOpen(false)}
        >
          {/* Chat Panel */}
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:w-[420px] h-[85vh] sm:h-[600px] sm:max-h-[80vh] bg-surface rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom sm:slide-in-from-right duration-300"
          >
            {/* Header */}
            <div className="px-5 py-4 bg-gradient-to-r from-primary to-primary/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">Q</span>
                </div>
                <div>
                  <h3 className="text-white font-semibold text-lg leading-tight">Quinn</h3>
                  <p className="text-white/75 text-xs">AI Analytics Assistant</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white/70 hover:text-white text-2xl leading-none p-1"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-5 bg-surface-container-low">
              {messages.length === 0 ? (
                <div className="text-center py-8">
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
                        className="block w-full text-left px-4 py-3 bg-surface border border-outline-variant rounded-xl text-sm text-on-surface hover:border-primary hover:bg-primary/5 transition-colors"
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
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] px-4 py-3 text-sm leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-primary text-on-primary rounded-2xl rounded-br-sm'
                            : 'bg-surface text-on-surface rounded-2xl rounded-bl-sm shadow-sm'
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="flex items-center gap-2 text-on-surface-variant text-sm">
                      <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                      Quinn is thinking...
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-outline-variant bg-surface">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask Quinn..."
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-surface-container-low border border-outline-variant rounded-xl text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary disabled:opacity-50"
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={loading || !input.trim()}
                  className="px-5 py-3 bg-primary text-on-primary rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
