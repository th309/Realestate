"use client";

import { Bot } from "lucide-react";

/**
 * Quinn chatbot customization section — PAUSED.
 *
 * Hooks are in place (DB columns exist: quinn_bot_name, quinn_greeting,
 * quinn_topic_restrictions). UI is disabled until Quinn development resumes.
 */

interface QuinnCustomizationSectionProps {
  botName: string;
  greeting: string;
  onBotNameChange: (v: string) => void;
  onGreetingChange: (v: string) => void;
}

export function QuinnCustomizationSection({
  botName,
  greeting,
  onBotNameChange,
  onGreetingChange,
}: QuinnCustomizationSectionProps) {
  return (
    <div className="bg-surface-container-low rounded-xl shadow-sm p-6 opacity-60">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-on-surface-variant" />
          <h3 className="text-sm font-medium text-on-surface-variant tracking-wide">
            QUINN AI ASSISTANT
          </h3>
        </div>
        <span className="rounded-full bg-surface-container-high px-2.5 py-0.5 text-xs font-medium text-on-surface-variant">
          Coming Soon
        </span>
      </div>
      <p className="text-xs text-on-surface-variant mb-4">
        Customize Quinn&apos;s name, greeting, and topic restrictions for your
        organization.
      </p>
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-on-surface-variant mb-1">
            Bot Name
          </label>
          <input
            type="text"
            value={botName}
            onChange={(e) => onBotNameChange(e.target.value)}
            placeholder="Quinn"
            disabled
            className="w-full px-3 py-2 text-sm rounded-lg border border-outline-variant bg-surface-container text-on-surface-variant cursor-not-allowed"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-on-surface-variant mb-1">
            Greeting Message
          </label>
          <textarea
            value={greeting}
            onChange={(e) => onGreetingChange(e.target.value)}
            placeholder="Hi! I'm your real estate market assistant. How can I help?"
            disabled
            rows={2}
            className="w-full px-3 py-2 text-sm rounded-lg border border-outline-variant bg-surface-container text-on-surface-variant cursor-not-allowed resize-none"
          />
        </div>
      </div>
    </div>
  );
}
