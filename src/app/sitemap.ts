import type { MetadataRoute } from 'next';
import { getPages } from '@/lib/content';
import { SITE_URL } from '@/lib/site';

export const dynamic = 'force-static';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = await getPages();
  return [{ url: SITE_URL }, ...pages.map((p) => ({ url: `${SITE_URL}${p.url}` }))];
}
