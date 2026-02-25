import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/', '/dev/', '/auth/', '/account/', '/health/', '/betatest/'],
      },
    ],
    sitemap: 'https://www.propertyiq.app/sitemap.xml',
  };
}
