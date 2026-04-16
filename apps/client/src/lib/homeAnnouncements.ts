import { apiGet } from './api';

export type PublicHomeAnnouncementItem = {
  id: string;
  title: string;
  content: string;
  tag: string | null;
  linkUrl: string | null;
  pinned: boolean;
  order: number;
  publishedAt: string | null;
};

export type PublicHomeAnnouncementFeed = {
  generatedAt: string;
  items: PublicHomeAnnouncementItem[];
};

const HOME_ANNOUNCEMENTS_MAX = 6;

export async function fetchHomeAnnouncements(options?: {
  max?: number;
}): Promise<PublicHomeAnnouncementItem[]> {
  const max = options?.max ?? HOME_ANNOUNCEMENTS_MAX;
  const feed = await apiGet<PublicHomeAnnouncementFeed>('/public/config/home-announcements');
  return Array.isArray(feed?.items) ? feed.items.slice(0, max) : [];
}
