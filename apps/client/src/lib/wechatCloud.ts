import { WECHAT_CLOUD_ENV } from '../constants';

let initialized = false;

type WxCloud = {
  init?: (options?: { env?: string; traceUser?: boolean }) => void;
};

export function initWechatCloud(): boolean {
  if (process.env.TARO_ENV !== 'weapp') return false;
  if (initialized) return true;

  try {
    const wxGlobal = (globalThis as { wx?: { cloud?: WxCloud } }).wx;
    const cloud = wxGlobal?.cloud;
    if (typeof cloud?.init !== 'function') {
      console.warn('[client] wx.cloud unavailable; skip cloud init.');
      return false;
    }

    const env = String(WECHAT_CLOUD_ENV || '').trim();
    cloud.init(env ? { env, traceUser: true } : { traceUser: true });
    initialized = true;
    return true;
  } catch (err) {
    console.warn('[client] wx.cloud init failed', err);
    return false;
  }
}
