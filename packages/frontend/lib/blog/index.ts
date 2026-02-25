import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import readingTime from 'reading-time';
import type { BlogFrontmatter, BlogPost } from './types';

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog');

export function getAllPosts(): BlogPost[] {
  if (!fs.existsSync(BLOG_DIR)) return [];

  const files = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.mdx'));

  const posts = files.map(filename => {
    const slug = filename.replace(/\.mdx$/, '');
    return getPostBySlug(slug);
  }).filter((post): post is BlogPost => post !== null);

  // Sort by date descending
  return posts.sort((a, b) =>
    new Date(b.frontmatter.date).getTime() - new Date(a.frontmatter.date).getTime()
  );
}

export function getPostBySlug(slug: string): BlogPost | null {
  const filePath = path.join(BLOG_DIR, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);
  const frontmatter = data as BlogFrontmatter;
  const stats = readingTime(content);

  return {
    slug,
    frontmatter,
    content,
    readingTime: stats.text,
  };
}

export function getAllSlugs(): string[] {
  if (!fs.existsSync(BLOG_DIR)) return [];
  return fs.readdirSync(BLOG_DIR)
    .filter(f => f.endsWith('.mdx'))
    .map(f => f.replace(/\.mdx$/, ''));
}

export function getPostsByCategory(category: string): BlogPost[] {
  return getAllPosts().filter(post => post.frontmatter.category === category);
}

export type { BlogFrontmatter, BlogPost } from './types';
