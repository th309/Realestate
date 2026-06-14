"use client";

interface CodeBlockProps {
  code: string;
  language?: string;
}

/**
 * Styled code block with copy-to-clipboard button.
 * Client component for the clipboard interaction.
 */
export function CodeBlock({ code, language = "bash" }: CodeBlockProps) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // Fallback: noop — clipboard API not available
    }
  };

  return (
    <div className="relative group">
      <button
        onClick={handleCopy}
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-xs font-medium px-2 py-1 rounded-md bg-surface-container-high text-on-surface-variant hover:bg-outline-variant cursor-pointer"
        aria-label="Copy code to clipboard"
      >
        Copy
      </button>
      <pre className="bg-surface-container rounded-xl p-4 text-sm font-mono overflow-x-auto text-on-surface-variant">
        <code data-language={language}>{code}</code>
      </pre>
    </div>
  );
}
