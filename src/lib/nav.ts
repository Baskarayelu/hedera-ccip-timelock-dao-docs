// Serializable navigation data handed from the server layout to client components.
export interface NavItem {
  title: string;
  url: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export interface SiteLinks {
  guide: string;
  reference: string;
  /** Only present when the pinned README links a live demo. */
  liveDemo: string | null;
  repo: string;
  ref: string;
  commitShort: string;
  commitUrl: string;
}
