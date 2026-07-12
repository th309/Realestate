"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { MCP_FAQ } from "../mcp-docs-data";

function FaqRow({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-outline-variant last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 py-4 text-left"
      >
        <span className="text-sm font-medium text-on-surface">{question}</span>
        {open ? (
          <ChevronDown className="w-4 h-4 text-on-surface-variant shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-on-surface-variant shrink-0" />
        )}
      </button>
      {open && <p className="text-sm text-on-surface-variant pb-4">{answer}</p>}
    </div>
  );
}

export function McpFaqSection() {
  return (
    <section className="max-w-3xl mx-auto px-6 py-14">
      <span className="text-xs font-mono font-medium uppercase tracking-wide text-primary">
        FAQ
      </span>
      <h2 className="mt-2 text-2xl font-semibold text-on-surface">
        Questions, answered
      </h2>

      <div className="mt-6 rounded-xl border border-outline-variant px-5">
        {MCP_FAQ.map((item) => (
          <FaqRow
            key={item.question}
            question={item.question}
            answer={item.answer}
          />
        ))}
      </div>
    </section>
  );
}
