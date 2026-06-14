import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

import type { ObjectionItem } from './prepObjections.constants';

/**
 * Single expandable objection card
 */
export function ObjectionCard({
  item,
  isOpen,
  onToggle,
}: {
  item: ObjectionItem;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className="rounded-[var(--report-radius-md)]"
      style={{
        backgroundColor: 'var(--report-cream)',
        border: '1px solid rgba(27, 46, 74, 0.06)',
        overflow: 'hidden',
      }}
    >
      {/* Header - clickable */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between text-left"
        style={{
          padding: 'var(--report-space-md)',
          cursor: 'pointer',
          background: 'none',
          border: 'none',
        }}
        aria-expanded={isOpen}
        aria-controls={`objection-${item.id}`}
      >
        <p
          className="text-sm font-medium italic"
          style={{
            color: 'var(--report-stone)',
            margin: 0,
            flex: 1,
          }}
        >
          &ldquo;{item.objection}&rdquo;
        </p>
        {isOpen ? (
          <ChevronUp
            className="w-4 h-4 flex-shrink-0 ml-2"
            style={{ color: 'var(--report-stone-light)' }}
          />
        ) : (
          <ChevronDown
            className="w-4 h-4 flex-shrink-0 ml-2"
            style={{ color: 'var(--report-stone-light)' }}
          />
        )}
      </button>

      {/* Expandable content */}
      {isOpen && (
        <div
          id={`objection-${item.id}`}
          style={{
            padding: '0 var(--report-space-md) var(--report-space-md)',
            borderTop: '1px solid rgba(27, 46, 74, 0.04)',
            paddingTop: 'var(--report-space-md)',
          }}
        >
          {/* Response */}
          <p
            className="text-sm leading-relaxed"
            style={{
              color: 'var(--report-navy)',
              margin: 0,
              marginBottom: 'var(--report-space-sm)',
            }}
          >
            {item.response}
          </p>

          {/* Data points */}
          {item.dataPoints.length > 0 && (
            <div
              className="flex flex-wrap gap-2"
              style={{ marginTop: 'var(--report-space-sm)' }}
            >
              {item.dataPoints.map((dp, index) => (
                <span
                  key={index}
                  className="inline-flex items-center text-[0.6875rem] font-medium px-2 py-1 rounded-full"
                  style={{
                    backgroundColor: 'white',
                    color: 'var(--report-navy)',
                    border: '1px solid rgba(27, 46, 74, 0.08)',
                  }}
                >
                  {dp}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ObjectionCard;
