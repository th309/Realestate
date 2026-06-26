import { getPostBySlug } from "@/lib/blog";
import { readMethodologyReport } from "@/lib/scores/methodology-report";
import { STATIC_MARKDOWN_PAGES } from "@/lib/agent-markdown/static-pages";

// Map a content pathname to its markdown source for agent content negotiation.
// Returns null for any path with no markdown representation.
export function resolveMarkdown(pathname: string): string | null {
  const blogMatch = pathname.match(/^\/blog\/([^/]+)$/);
  if (blogMatch) {
    const post = getPostBySlug(blogMatch[1]);
    if (!post) return null;
    return `# ${post.frontmatter.title}\n\n${post.content}`;
  }
  if (pathname === "/scores/methodology") {
    try {
      return readMethodologyReport();
    } catch {
      return null;
    }
  }
  if (pathname in STATIC_MARKDOWN_PAGES) return STATIC_MARKDOWN_PAGES[pathname];
  return null;
}
