// The search index, written once at build time and searched in the browser (Orama).
import { createSearchAPI } from 'fumadocs-core/search/server';
import { getPages } from '@/lib/content';

export const revalidate = false;
export const dynamic = 'force-static';

export const { staticGET: GET } = createSearchAPI('advanced', {
  indexes: async () =>
    (await getPages()).map((p) => ({
      id: p.url,
      title: p.title,
      url: p.url,
      breadcrumbs: [p.group.title],
      structuredData: p.structuredData,
    })),
});
