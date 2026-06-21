"use client";

import React, { useState, useRef, useEffect } from "react";
import { X, Send, Loader2, AlertCircle } from "lucide-react";
import { sendReportMessage, fetchReportConversation } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { useEntitlements } from "@/lib/entitlements/EntitlementsContext";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface ConversationPanelProps {
  reportId: string;
  reportTitle: string;
  onClose: () => void;
}

const STARTER_PROMPTS = [
  "What does this score mean for me?",
  "Is now a good time to buy?",
  "What are the main risks?",
  "How does this compare to national averages?",
];

export function ConversationPanel({
  reportId,
  reportTitle,
  onClose,
}: ConversationPanelProps) {
  const { user } = useAuth();
  const { tier } = useEntitlements();
  const userId = user?.id ?? "";
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    // Defer to after paint so streaming message updates don't scroll mid-layout
    // (which caused the view to jump while a reply was still rendering).
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load existing conversation on mount
  useEffect(() => {
    if (!userId) return;
    fetchReportConversation(reportId, { userId })
      .then((data) => {
        if (data.messages?.length) {
          setMessages(data.messages);
        }
      })
      .catch(() => {
        // No existing conversation — that's fine
      });
  }, [reportId, userId]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading || !userId) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: content.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const data = await sendReportMessage(reportId, content.trim(), {
        userId,
        userTier: tier ?? undefined,
      });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to get AI response",
      );
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
          <p className="text-xs text-on-surface-variant truncate max-w-64">
            {reportTitle}
          </p>
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
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-on-primary rounded-br-sm"
                    : "bg-surface-container-high text-on-surface rounded-bl-sm"
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

        {error && (
          <div className="flex justify-start">
            <div className="max-w-[85%] px-4 py-3 rounded-2xl rounded-bl-sm bg-red-50 text-red-700 text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="p-4 border-t border-outline-variant"
      >
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
