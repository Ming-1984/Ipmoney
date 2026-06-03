import Taro from '@tarojs/taro';

export type RegionPickResult = {
  code: string;
  name: string;
  level?: 'PROVINCE' | 'CITY' | 'DISTRICT';
  pathCodes?: string[];
  pathNames?: string[];
};

export function openRegionPickerPage(onPicked: (result: RegionPickResult) => void) {
  try {
    Taro.navigateTo({
      url: '/subpackages/region-picker/index',
      events: {
        regionSelected: (payload: any) => {
          const code = String(payload?.code || '').trim();
          if (!code) return;
          const name = String(payload?.name || code).trim();
          onPicked({
            code,
            name,
            level: payload?.level,
            pathCodes: Array.isArray(payload?.pathCodes) ? payload.pathCodes : undefined,
            pathNames: Array.isArray(payload?.pathNames) ? payload.pathNames : undefined,
          });
        },
      },
    } as any);
  } catch {
    // do nothing; caller may show UI fallback if needed
  }
}
