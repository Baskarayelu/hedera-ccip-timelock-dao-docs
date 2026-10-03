import { GROUPS } from '@/content/manifest';
import { getHomeFacts, getPages, repoUrl, SOURCE } from './content';
import type { NavGroup, SiteLinks } from './nav';
import config from '../../docs.config.json';

export const SITE_URL = config.siteUrl;
export const SITE_NAME = 'CCIP Timelock DAO docs';

export async function getNav(): Promise<{ groups: NavGroup[]; links: SiteLinks }> {
  const pages = await getPages();
  const facts = await getHomeFacts();
  const groups = GROUPS.map((g) => ({
    title: g.title,
    items: pages.filter((p) => p.group.id === g.id).map((p) => ({ title: p.title, url: p.url })),
  }));
  const first = (id: string) => pages.find((p) => p.group.id === id)!.url;
  return {
    groups,
    links: {
      guide: first('guide'),
      reference: first('reference'),
      liveDemo: facts.liveDemoUrl,
      repo: repoUrl,
      ref: SOURCE.ref,
      commitShort: SOURCE.short,
      commitUrl: `${repoUrl}/commit/${SOURCE.commit}`,
    },
  };
}
