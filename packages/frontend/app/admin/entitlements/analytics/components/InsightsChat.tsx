'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, User, Bot } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface InsightsChatProps {
  chatHistory: ChatMessage[];
  onSendMessage: (message: string) => Promise<void>;
  isStreaming: boolean;
}

export function InsightsChat({
  chatHistory,
  onSendMessage,
  isStreaming,
}: InsightsChatProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const message = input.trim();
    if (!message || isStreaming) return;
    setInput('');
    await onSendMessage(message);
  };

  // Only show follow-up messages (skip the initial analysis which is message index 0)
  const followUpMessages = chatHistory.slice(1);
  const hasFollowUps = followUpMessages.length > 0;

  return (
    <div className="bg-surface-container rounded-xl border border-outline-variant overflow-hidden">
      {/* Chat history (only follow-ups) */}
      {hasFollowUps && (
        <div
          ref={scrollRef}
          className="max-h-96 overflow-y-auto p-4 space-y-4 border-b border-outline-variant"
        >
          {followUpMessages.map((msg, i) => (
            <div key={i} className="flex gap-3">
              <div
                className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                  msg.role === 'user'
                    ? 'bg-primary/10 text-primary'
                    : 'bg-secondary/10 text-secondary'
                }`}
              >
                {msg.role === 'user' ? (
                  <User className="w-4 h-4" />
                ) : (
                  <Bot className="w-4 h-4" />
                )}
              </div>
              <div className="flex-1 text-sm text-on-surface-variant leading-relaxed whitespace-pre-wrap">
                {msg.content || (
                  <span className="text-on-surface-variant/50 italic">
                    Thinking...
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex items-center gap-3 p-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a follow-up question..."
          disabled={isStreaming}
          className="flex-1 bg-surface border border-outline-variant rounded-full px-4 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!input.trim() || isStreaming}
          className="w-9 h-9 flex items-center justify-center bg-primary text-on-primary rounded-full hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
