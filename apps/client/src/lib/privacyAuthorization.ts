import Taro from '@tarojs/taro';

type WechatPrivacySettingResult = {
  needAuthorization?: boolean;
  privacyContractName?: string;
};

type WechatPrivacyApi = {
  getPrivacySetting?: (options: {
    success?: (res: WechatPrivacySettingResult) => void;
    fail?: (err: unknown) => void;
  }) => void;
  requirePrivacyAuthorize?: (options: {
    success?: () => void;
    fail?: (err: unknown) => void;
  }) => void;
  openPrivacyContract?: (options?: {
    success?: () => void;
    fail?: (err: unknown) => void;
  }) => void;
};

function getWx(): WechatPrivacyApi | null {
  if (process.env.TARO_ENV !== 'weapp') return null;
  const wx = (globalThis as typeof globalThis & { wx?: WechatPrivacyApi }).wx;
  return wx || null;
}

function invoke<T>(fn: (resolve: (value: T) => void, reject: (error: unknown) => void) => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    try {
      fn(resolve, reject);
    } catch (error) {
      reject(error);
    }
  });
}

export async function ensurePrivacyAuthorization(): Promise<boolean> {
  const wx = getWx();
  if (!wx) return true;
  const hasPrivacyApis = typeof wx.getPrivacySetting === 'function' || typeof wx.requirePrivacyAuthorize === 'function';
  if (!hasPrivacyApis) return true;

  try {
    const setting = await invoke<WechatPrivacySettingResult>((resolve, reject) => {
      wx.getPrivacySetting?.({
        success: resolve,
        fail: reject,
      });
    });

    if (!setting?.needAuthorization) return true;

    if (typeof wx.requirePrivacyAuthorize === 'function') {
      await invoke<void>((resolve, reject) => {
        wx.requirePrivacyAuthorize?.({
          success: () => resolve(),
          fail: reject,
        });
      });
      return true;
    }

    if (typeof wx.openPrivacyContract === 'function') {
      await invoke<void>((resolve, reject) => {
        wx.openPrivacyContract?.({
          success: () => resolve(),
          fail: reject,
        });
      });
      return true;
    }
  } catch (error) {
    console.warn('[privacy] authorization failed', error);
  }

  return false;
}

export async function ensurePrivacyAuthorizationOrThrow(): Promise<void> {
  const ok = await ensurePrivacyAuthorization();
  if (!ok) {
    throw new Error('请先在官方隐私授权弹窗中同意后再继续操作。');
  }
}

export function isWeappPrivacyEnvironment(): boolean {
  return process.env.TARO_ENV === 'weapp' && Boolean(getWx());
}

