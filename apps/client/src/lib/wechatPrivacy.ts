import Taro from '@tarojs/taro';

type WechatPrivacySettingResult = {
  needAuthorization?: boolean;
  privacyContractName?: string;
};

type WechatPrivacyApi = {
  getPrivacySetting?: (options: {
    success?: (res: WechatPrivacySettingResult) => void;
    fail?: (err: unknown) => void;
    complete?: () => void;
  }) => void;
  requirePrivacyAuthorize?: (options: {
    success?: () => void;
    fail?: (err: unknown) => void;
    complete?: () => void;
  }) => void;
  openPrivacyContract?: (options?: {
    success?: () => void;
    fail?: (err: unknown) => void;
    complete?: () => void;
  }) => void;
};

function getWx(): WechatPrivacyApi | null {
  if (process.env.TARO_ENV !== 'weapp') return null;
  const wx = (globalThis as typeof globalThis & { wx?: WechatPrivacyApi }).wx;
  return wx || null;
}

function getErrorMessage(error: unknown): string {
  const err = error as { errMsg?: unknown; message?: unknown };
  return String(err?.errMsg || err?.message || error || '').trim();
}

function callPrivacyApi<T>(invoke: (resolve: (value: T) => void, reject: (error: unknown) => void) => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    try {
      invoke(resolve, reject);
    } catch (error) {
      reject(error);
    }
  });
}

export async function ensureWeChatPrivacyAuthorized(): Promise<boolean> {
  const wx = getWx();
  if (!wx) return true;

  const hasPrivacyApis = typeof wx.getPrivacySetting === 'function' || typeof wx.requirePrivacyAuthorize === 'function';
  if (!hasPrivacyApis) return true;

  try {
    const setting = await callPrivacyApi<WechatPrivacySettingResult>((resolve, reject) => {
      wx.getPrivacySetting?.({
        success: resolve,
        fail: reject,
      });
    });

    if (!setting?.needAuthorization) return true;

    if (typeof wx.requirePrivacyAuthorize === 'function') {
      await callPrivacyApi<void>((resolve, reject) => {
        wx.requirePrivacyAuthorize?.({
          success: () => resolve(),
          fail: reject,
        });
      });
      return true;
    }

    if (typeof wx.openPrivacyContract === 'function') {
      await callPrivacyApi<void>((resolve, reject) => {
        wx.openPrivacyContract?.({
          success: () => resolve(),
          fail: reject,
        });
      });
      return true;
    }

    return false;
  } catch (error) {
    const message = getErrorMessage(error);
    if (message) {
      console.warn('[privacy] authorization check failed', message);
    }
    return false;
  }
}

export async function requireWeChatPrivacyAuthorizedOrThrow(): Promise<void> {
  const ok = await ensureWeChatPrivacyAuthorized();
  if (!ok) {
    throw new Error('当前小程序尚未完成微信隐私授权，请先在官方授权弹窗中同意后再继续。');
  }
}

