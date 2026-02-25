import type { MDXComponents } from 'mdx/types';

export const mdxComponents: MDXComponents = {
  h1: (props) => (
    <h1
      className="text-3xl font-bold text-on-surface mt-8 mb-4"
      {...props}
    />
  ),
  h2: (props) => (
    <h2
      className="text-2xl font-semibold text-on-surface mt-8 mb-3"
      {...props}
    />
  ),
  h3: (props) => (
    <h3
      className="text-xl font-medium text-on-surface mt-6 mb-2"
      {...props}
    />
  ),
  p: (props) => (
    <p
      className="text-on-surface-variant leading-relaxed mb-4"
      {...props}
    />
  ),
  a: (props) => (
    <a
      className="text-primary hover:text-primary/80 underline"
      {...props}
    />
  ),
  ul: (props) => (
    <ul
      className="list-disc pl-6 mb-4 space-y-1 text-on-surface-variant"
      {...props}
    />
  ),
  ol: (props) => (
    <ol
      className="list-decimal pl-6 mb-4 space-y-1 text-on-surface-variant"
      {...props}
    />
  ),
  li: (props) => (
    <li className="text-on-surface-variant" {...props} />
  ),
  blockquote: (props) => (
    <blockquote
      className="border-l-4 border-primary pl-4 italic text-on-surface-variant my-4"
      {...props}
    />
  ),
  table: (props) => (
    <div className="overflow-x-auto my-4">
      <table className="min-w-full border-collapse" {...props} />
    </div>
  ),
  th: (props) => (
    <th
      className="bg-surface-container-low px-4 py-2 text-left font-semibold border-b border-outline-variant"
      {...props}
    />
  ),
  td: (props) => (
    <td
      className="px-4 py-2 border-b border-outline-variant"
      {...props}
    />
  ),
  code: (props) => (
    <code
      className="bg-surface-container-low px-1.5 py-0.5 rounded text-sm font-mono"
      {...props}
    />
  ),
  pre: (props) => (
    <pre
      className="bg-surface-container-low p-4 rounded-xl overflow-x-auto my-4 text-sm"
      {...props}
    />
  ),
  hr: () => <hr className="border-outline-variant my-8" />,
  strong: (props) => (
    <strong className="font-semibold text-on-surface" {...props} />
  ),
};
