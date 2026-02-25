export interface BlogFrontmatter {
  title: string;
  description: string;
  date: string;
  author: string;
  category: 'market-analysis' | 'investment' | 'methodology' | 'news';
  tags: string[];
  targetKeyword: string;
  image?: string;
}

export interface BlogPost {
  slug: string;
  frontmatter: BlogFrontmatter;
  content: string;
  readingTime: string;
}
