import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

/** robots.txt: the public pages may be indexed; chats, settings and the API are private. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/login', '/terms', '/privacy'],
      disallow: ['/c/', '/settings/', '/api/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
