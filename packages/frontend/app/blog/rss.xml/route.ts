import { getAllPosts } from '@/lib/blog';

const BASE_URL = 'https://www.propertyiq.app';

export async function GET() {
  const posts = getAllPosts();

  const rssItems = posts.map(post => `
    <item>
      <title><![CDATA[${post.frontmatter.title}]]></title>
      <link>${BASE_URL}/blog/${post.slug}</link>
      <description><![CDATA[${post.frontmatter.description}]]></description>
      <pubDate>${new Date(post.frontmatter.date).toUTCString()}</pubDate>
      <guid>${BASE_URL}/blog/${post.slug}</guid>
      <category>${post.frontmatter.category}</category>
    </item>`).join('');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>PropertyIQ Blog</title>
    <link>${BASE_URL}/blog</link>
    <description>Data-driven housing market analysis, forecasts, and investment insights.</description>
    <language>en-us</language>
    <atom:link href="${BASE_URL}/blog/rss.xml" rel="self" type="application/rss+xml"/>
    ${rssItems}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: { 'Content-Type': 'application/xml' },
  });
}
