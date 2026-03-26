"use client";

import { useState, useEffect } from "react";
import { CodeBlock } from "./CodeBlock";

const STORAGE_KEY = "piq-docs-code-lang";

interface CodeExample {
  language: string;
  label: string;
  code: string;
}

interface CodeTabsProps {
  examples: CodeExample[];
}

export function CodeTabs({ examples }: CodeTabsProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const idx = examples.findIndex((e) => e.language === saved);
      if (idx >= 0) setActiveIndex(idx);
    }
  }, [examples]);

  function handleSelect(index: number) {
    setActiveIndex(index);
    localStorage.setItem(STORAGE_KEY, examples[index].language);
  }

  return (
    <div>
      <div className="flex gap-1 border-b border-outline-variant mb-0">
        {examples.map((ex, i) => (
          <button
            key={ex.language}
            onClick={() => handleSelect(i)}
            className={`px-3 py-1.5 text-xs font-medium rounded-t-lg transition-colors ${
              i === activeIndex
                ? "bg-surface-container text-on-surface border-b-2 border-primary"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low"
            }`}
          >
            {ex.label}
          </button>
        ))}
      </div>
      <CodeBlock
        code={examples[activeIndex].code}
        language={examples[activeIndex].language}
      />
    </div>
  );
}
