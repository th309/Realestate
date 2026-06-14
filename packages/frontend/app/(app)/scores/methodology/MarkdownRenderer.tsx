'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 className="text-2xl font-[var(--font-source-serif)] font-semibold text-on-surface mt-12 mb-4">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-xl font-[var(--font-source-serif)] font-semibold text-on-surface mt-10 mb-3">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-lg font-semibold text-on-surface mt-8 mb-2">{children}</h3>
        ),
        p: ({ children }) => (
          <p className="text-on-surface-variant leading-relaxed mb-4">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="list-disc list-inside text-on-surface-variant space-y-1 mb-4 ml-4">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside text-on-surface-variant space-y-1 mb-4 ml-4">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="text-on-surface-variant leading-relaxed">{children}</li>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto mb-6 rounded-xl border border-outline-variant">
            <table className="w-full text-sm">{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-surface-container text-on-surface font-medium">{children}</thead>
        ),
        tbody: ({ children }) => (
          <tbody className="divide-y divide-outline-variant">{children}</tbody>
        ),
        tr: ({ children }) => (
          <tr className="hover:bg-surface-container/50">{children}</tr>
        ),
        th: ({ children }) => (
          <th className="px-4 py-3 text-left text-xs uppercase tracking-wider">{children}</th>
        ),
        td: ({ children }) => (
          <td className="px-4 py-3 text-on-surface-variant">{children}</td>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-on-surface">{children}</strong>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-primary/30 pl-4 italic text-on-surface-variant my-4">{children}</blockquote>
        ),
        code: ({ children }) => (
          <code className="bg-surface-container px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>
        ),
        hr: () => (
          <hr className="border-outline-variant my-8" />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
