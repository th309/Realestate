'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Loader2 } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ConversationPanelProps {
  reportId: string;
  reportTitle: string;
  onClose: () => void;
}

const STARTER_PROMPTS = [
  'What does this score mean for me?',
  'Is now a good time to buy?',
  'What are the main risks?',
  'How does this compare to national averages?',
];

export function ConversationPanel({ reportId, reportTitle, onClose }: ConversationPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // TODO: Replace with actual API call
      // const response = await fetch(`/api/reports/${reportId}/conversation`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ content: content.trim() }),
      // });
      // const data = await response.json();

      // Mock AI response
      await new Promise((r) => setTimeout(r, 1500));

      const mockResponses: Record<string, string> = {
        'What does this score mean for me?':
          'Your HomeReady Score of 72 indicates favorable market conditions for homebuyers. The score reflects a balance of affordability (65/100), market stability (78/100), value proposition (70/100), and competition levels (75/100). This suggests a market where buyers have reasonable negotiating power and prices are relatively stable.',
        'Is now a good time to buy?':
          'Based on current market indicators, this is a moderately favorable time to buy. Inventory levels are up 15% year-over-year, which reduces competition and provides more options. Price growth has moderated to 3-4% annually, meaning you are less likely to overpay. However, mortgage rates remain elevated, so factor that into your affordability calculations.',
        'What are the main risks?':
          'Key risks to consider: (1) Interest rate sensitivity - if rates rise further, affordability could decrease, (2) Employment concentration - the market relies heavily on a few major employers, (3) Water concerns - long-term drought conditions could affect property values in some areas. The overall risk profile is moderate.',
        'How does this compare to national averages?':
          'Phoenix ranks in the 68th percentile nationally for homebuyer conditions. Affordability is slightly below the national median, but market stability and inventory levels are above average. Compared to other Sun Belt metros, Phoenix offers better value than Austin or Miami but is less affordable than markets like Tampa or San Antonio.',
      };

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content:
          mockResponses[content.trim()] ||
          'I can help you understand this market better. Based on the report data, I see strong fundamentals in this geography. Could you be more specific about what aspect you would like me to analyze?',
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <aside className="fixed right-0 top-0 bottom-0 w-full lg:w-96 bg-surface-container border-l border-outline-variant shadow-lg z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant">
        <div>
          <h3 className="font-semibold text-on-surface">Ask AI</h3>
          <p className="text-xs text-on-surface-variant truncate max-w-64">{reportTitle}</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-surface-container-high text-on-surface-variant"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-on-surface-variant text-center py-4">
              Ask me anything about this market report.
            </p>
            <div className="space-y-2">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className="w-full text-left px-4 py-3 bg-surface rounded-xl text-sm text-on-surface hover:bg-surface-container-high transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm ${
                  msg.role === 'user'
                    ? 'bg-primary text-on-primary rounded-br-sm'
                    : 'bg-surface-container-high text-on-surface rounded-bl-sm'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex justify-start">
            <div className="px-4 py-3 bg-surface-container-high rounded-2xl rounded-bl-sm">
              <Loader2 className="w-5 h-5 animate-spin text-on-surface-variant" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-outline-variant">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about this market..."
            className="flex-1 px-4 py-2.5 bg-surface rounded-full border border-outline-variant focus:outline-none focus:border-primary text-sm text-on-surface placeholder:text-on-surface-variant"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="p-2.5 rounded-full bg-primary text-on-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-on-surface-variant text-center mt-2">
          Powered by Claude AI
        </p>
      </form>
    </aside>
  );
}
