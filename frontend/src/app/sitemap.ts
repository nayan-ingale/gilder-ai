import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

/** The public pages, for search engines. Everything else needs an account. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/login`, changeFrequency: 'monthly', priority: 1 },
    { url: `${SITE_URL}/terms`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
