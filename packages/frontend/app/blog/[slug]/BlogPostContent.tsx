import { MDXRemote } from 'next-mdx-remote/rsc';
import Link from 'next/link';
import type { BlogPost } from '@/lib/blog/types';
import { mdxComponents } from './mdx-components';
import { NewsletterSignup } from '@/components/newsletter/NewsletterSignup';

interface BlogPostContentProps {
  post: BlogPost;
}

export function BlogPostContent({ post }: BlogPostContentProps) {
  return (
    <article>
      {/* Breadcrumb */}
      <nav
        className="text-sm text-on-surface-variant mb-6"
        aria-label="Breadcrumb"
      >
        <Link href="/" className="hover:text-primary">
          Home
        </Link>
        <span className="mx-2">/</span>
        <Link href="/blog" className="hover:text-primary">
          Blog
        </Link>
        <span className="mx-2">/</span>
        <span className="text-on-surface font-medium">
          {post.frontmatter.title}
        </span>
      </nav>

      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-on-surface mb-4 leading-tight">
          {post.frontmatter.title}
        </h1>
        <div className="flex items-center gap-3 text-sm text-on-surface-variant">
          <time dateTime={post.frontmatter.date}>
            {new Date(post.frontmatter.date).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </time>
          <span>·</span>
          <span>{post.readingTime}</span>
          <span>·</span>
          <span>{post.frontmatter.author}</span>
        </div>
      </header>

      {/* MDX Content */}
      <div className="prose prose-lg max-w-none">
        <MDXRemote source={post.content} components={mdxComponents} />
      </div>

      {/* Tags */}
      {post.frontmatter.tags?.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-8 pt-6 border-t border-outline-variant">
          {post.frontmatter.tags.map((tag) => (
            <span
              key={tag}
              className="px-3 py-1 bg-surface-container-low text-on-surface-variant text-sm rounded-full"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Newsletter Signup */}
      <NewsletterSignup />
    </article>
  );
}
