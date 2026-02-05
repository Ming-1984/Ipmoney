import achievement1 from '../assets/achievements/achievement-hainu-1.jpg';
import achievement2 from '../assets/achievements/achievement-hainu-2.jpg';
import achievement3 from '../assets/achievements/achievement-hainu-3.jpg';

const LOCAL_ASSETS: Record<string, string> = {
  '/assets/achievements/achievement-hainu-1.jpg': achievement1,
  'assets/achievements/achievement-hainu-1.jpg': achievement1,
  '/assets/achievements/achievement-hainu-2.jpg': achievement2,
  'assets/achievements/achievement-hainu-2.jpg': achievement2,
  '/assets/achievements/achievement-hainu-3.jpg': achievement3,
  'assets/achievements/achievement-hainu-3.jpg': achievement3,
};

export function resolveLocalAsset(url?: string | null): string {
  if (!url) return '';
  return LOCAL_ASSETS[url] || url;
}

export function resolveLocalAssetList(urls: Array<string | null | undefined>): string[] {
  return urls.map((item) => resolveLocalAsset(item)).filter(Boolean);
}
