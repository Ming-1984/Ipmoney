const LOCAL_ASSETS: Record<string, string> = {};

export function resolveLocalAsset(url?: string | null): string {
  if (!url) return '';
  return LOCAL_ASSETS[url] || url;
}

export function resolveLocalAssetList(urls: Array<string | null | undefined>): string[] {
  return urls.map((item) => resolveLocalAsset(item)).filter(Boolean);
}
