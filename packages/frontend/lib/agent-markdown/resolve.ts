import { getPostBySlug } from "@/lib/blog";
import { readMethodologyReport } from "@/lib/scores/methodology-report";

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
    return readMethodologyReport();
  }
  return null;
}
