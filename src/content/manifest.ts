// Which part of the template's docs becomes which page (data in manifest.json, which the
// drift check also reads). Pages take their text from the source at the pinned commit;
// the manifest only says where each piece goes.
//
// `from` and `to` name headings in `file` (matched on their text). A page runs from the
// `from` heading up to, not including, the `to` heading; the `from` heading becomes the
// page title. Without `from` the page starts at the top of the file, and without `to` it
// runs to the end. A whole file's leading H1 is its page title unless `title` is given.
import manifest from './manifest.json';

export type GroupId = 'getting-started' | 'guide' | 'extend' | 'reference';

export interface PageSpec {
  group: GroupId;
  slug: string;
  file: string;
  from?: string;
  to?: string;
  title?: string;
}

export interface Elsewhere {
  file: string;
  from?: string;
  to?: string;
  firstNodeOnly?: boolean;
  /** Top-level nodes whose markdown source matches this pattern, wherever they are in the file. */
  nodeMatches?: string;
  shownOn: 'home' | 'footer' | 'nowhere';
  reason: string;
}

export const GROUPS = manifest.groups as { id: GroupId; title: string }[];
export const PAGES = manifest.pages as PageSpec[];
/** Source sections that are not pages, and where their text goes instead. */
export const ELSEWHERE = manifest.elsewhere as Elsewhere[];
