"use client";

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { ChevronDown } from "lucide-react";

interface CollapsibleFeatureProps {
  id: string;
  icon: ReactNode;
  title: string;
  subtitle: string;
  summary: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function CollapsibleFeature({
  id,
  icon,
  title,
  subtitle,
  summary,
  defaultOpen = false,
  children,
}: CollapsibleFeatureProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | undefined>(
    undefined,
  );

  const measureHeight = useCallback(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, []);

  useEffect(() => {
    measureHeight();
    window.addEventListener("resize", measureHeight);
    return () => window.removeEventListener("resize", measureHeight);
  }, [measureHeight]);

  // If navigated to via anchor, auto-expand
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === `#${id}`) {
      setIsOpen(true);
    }
  }, [id]);

  return (
    <section id={id} className="scroll-mt-24 mb-20">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center gap-2.5 mb-3 group cursor-pointer text-left"
        aria-expanded={isOpen}
        aria-controls={`${id}-content`}
      >
        <div className="p-1.5 rounded-lg bg-primary/10">{icon}</div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-on-surface">{title}</h3>
          <p className="text-xs text-on-surface-variant">{subtitle}</p>
        </div>
        {!isOpen && (
          <span className="hidden md:block text-sm text-on-surface-variant/60 truncate max-w-[50%]">
            {summary}
          </span>
        )}
        <ChevronDown
          className={`w-5 h-5 text-on-surface-variant/50 shrink-0 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      <div
        id={`${id}-content`}
        style={{
          maxHeight: isOpen ? (contentHeight ?? 2000) : 0,
          opacity: isOpen ? 1 : 0,
        }}
        className="overflow-hidden transition-all duration-400 ease-[cubic-bezier(0.2,0,0,1)]"
      >
        <div ref={contentRef}>{children}</div>
      </div>
    </section>
  );
}
