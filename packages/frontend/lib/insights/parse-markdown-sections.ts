/**
 * Parse markdown-style ## headers into structured HTML sections.
 * Splits content on `## ` lines and renders each as a titled section.
 */
export function parseMarkdownSections(
  content: string,
): { title: string; body: string }[] {
  const sections: { title: string; body: string }[] = [];
  const parts = content.split(/^## /m).filter(Boolean);

  for (const part of parts) {
    const newlineIndex = part.indexOf("\n");
    if (newlineIndex === -1) {
      sections.push({ title: part.trim(), body: "" });
    } else {
      const title = part.slice(0, newlineIndex).trim();
      const body = part.slice(newlineIndex + 1).trim();
      sections.push({ title, body });
    }
  }

  return sections;
}
