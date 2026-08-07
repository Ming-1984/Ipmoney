import Taro, { useDidShow, useShareAppMessage } from '@tarojs/taro';
import { buildSharePayload } from './wechatSharePayload';
export { buildSharePayload, DEFAULT_SHARE_PATH, DEFAULT_SHARE_TITLE } from './wechatSharePayload';
export type { GlobalShareOptions, SharePayload } from './wechatSharePayload';
import type { GlobalShareOptions } from './wechatSharePayload';

export function useGlobalShareAppMessage(options: GlobalShareOptions = {}): void {
  useShareAppMessage(() => buildSharePayload(options));
  useDidShow(() => {
    if (process.env.TARO_ENV !== 'weapp') return;
    const showShareMenu = Taro.showShareMenu as unknown as (options: { menus: string[] }) => Promise<unknown>;
    void showShareMenu({ menus: ['shareAppMessage'] }).catch(() => undefined);
  });
}
