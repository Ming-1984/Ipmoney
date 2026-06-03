const WECHAT_API_BASE = 'https://api.weixin.qq.com';
const WECHAT_API_TIMEOUT_MS = 10_000;
const ACCESS_TOKEN_REFRESH_LEEWAY_SECONDS = 120;
const WECHAT_CONFIG_FIELDS = ['WX_MP_APPID', 'WX_MP_SECRET'] as const;

type WechatMpConfig = {
  appId?: string;
  appSecret?: string;
};

type AccessTokenCache = {
  token: string;
  expiresAtMs: number;
};

type JsonResult = {
  status: number;
  json: any;
  text: string;
};

type WechatApiErrorPayload = {
  errcode?: unknown;
  errmsg?: unknown;
};

export type WechatCode2SessionResult = {
  openid: string;
  sessionKey: string;
  unionid?: string;
};

export type WechatPhoneNumberResult = {
  phoneNumber: string;
  purePhoneNumber: string;
  countryCode?: string;
};

export class WechatMpError extends Error {
  code: string;
  statusCode?: number;
  details?: unknown;

  constructor(code: string, message: string, statusCode?: number, details?: unknown) {
    super(message);
    this.name = 'WechatMpError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

function trim(value: unknown): string {
  return String(value ?? '').trim();
}

function toErrorPayload(value: unknown): WechatApiErrorPayload {
  if (!value || typeof value !== 'object') return {};
  return value as WechatApiErrorPayload;
}

function parseWechatErrCode(payload: unknown): number {
  const errCode = Number(toErrorPayload(payload).errcode ?? 0);
  if (!Number.isFinite(errCode)) return 0;
  return Math.trunc(errCode);
}

function parseWechatErrMsg(payload: unknown): string {
  const message = trim(toErrorPayload(payload).errmsg);
  return message || 'wechat api error';
}

export class WechatMpClient {
  private accessTokenCache: AccessTokenCache | null = null;

  private getConfig(): WechatMpConfig {
    const appId = trim(process.env.WX_MP_APPID) || trim(process.env.WX_MP_ID) || undefined;
    const appSecret = trim(process.env.WX_MP_SECRET) || undefined;
    return { appId, appSecret };
  }

  getMissingFields(): string[] {
    const config = this.getConfig();
    const missing: string[] = [];
    if (!config.appId) missing.push('WX_MP_APPID (or WX_MP_ID)');
    if (!config.appSecret) missing.push('WX_MP_SECRET');
    return missing;
  }

  isConfigured(): boolean {
    return this.getMissingFields().length === 0;
  }

  private assertConfigured() {
    const missing = this.getMissingFields();
    if (!missing.length) return;
    throw new WechatMpError(
      'WECHAT_MP_NOT_CONFIGURED',
      `wechat mini program config missing: ${missing.join(', ')}`,
      undefined,
      { missingFields: missing },
    );
  }

  private async requestJson(url: string, init: RequestInit, errorCode: string): Promise<JsonResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), WECHAT_API_TIMEOUT_MS);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      const text = await response.text();
      let json: any = {};
      if (text) {
        try {
          json = JSON.parse(text);
        } catch {
          json = {};
        }
      }
      return { status: response.status, json, text };
    } catch (error) {
      const message = error instanceof Error && error.name === 'AbortError' ? 'wechat api request timeout' : 'wechat api request failed';
      const cause = error instanceof Error ? error.message : String(error);
      throw new WechatMpError(errorCode, message, undefined, { cause });
    } finally {
      clearTimeout(timer);
    }
  }

  async code2Session(code: string): Promise<WechatCode2SessionResult> {
    this.assertConfigured();
    const normalizedCode = trim(code);
    if (!normalizedCode) {
      throw new WechatMpError('WECHAT_MP_CODE_REQUIRED', 'code is required');
    }
    const { appId, appSecret } = this.getConfig();
    const url =
      `${WECHAT_API_BASE}/sns/jscode2session` +
      `?appid=${encodeURIComponent(appId as string)}` +
      `&secret=${encodeURIComponent(appSecret as string)}` +
      `&js_code=${encodeURIComponent(normalizedCode)}` +
      '&grant_type=authorization_code';
    const result = await this.requestJson(url, { method: 'GET' }, 'WECHAT_MP_CODE2SESSION_REQUEST_FAILED');
    if (result.status < 200 || result.status >= 300) {
      throw new WechatMpError(
        'WECHAT_MP_CODE2SESSION_HTTP_FAILED',
        `wechat code2Session request failed with status ${result.status}`,
        result.status,
        result.json || result.text,
      );
    }
    const errCode = parseWechatErrCode(result.json);
    if (errCode !== 0) {
      throw new WechatMpError('WECHAT_MP_CODE2SESSION_FAILED', parseWechatErrMsg(result.json), result.status, result.json);
    }
    const openid = trim(result.json?.openid);
    const sessionKey = trim(result.json?.session_key);
    const unionid = trim(result.json?.unionid) || undefined;
    if (!openid || !sessionKey) {
      throw new WechatMpError('WECHAT_MP_CODE2SESSION_PAYLOAD_INVALID', 'openid or session_key missing in code2Session response', result.status, result.json);
    }
    return { openid, sessionKey, unionid };
  }

  private async getAccessToken(forceRefresh = false): Promise<string> {
    this.assertConfigured();
    if (!forceRefresh && this.accessTokenCache && this.accessTokenCache.expiresAtMs > Date.now()) {
      return this.accessTokenCache.token;
    }

    const { appId, appSecret } = this.getConfig();
    const url =
      `${WECHAT_API_BASE}/cgi-bin/token` +
      `?grant_type=client_credential&appid=${encodeURIComponent(appId as string)}` +
      `&secret=${encodeURIComponent(appSecret as string)}`;
    const result = await this.requestJson(url, { method: 'GET' }, 'WECHAT_MP_ACCESS_TOKEN_REQUEST_FAILED');
    if (result.status < 200 || result.status >= 300) {
      throw new WechatMpError(
        'WECHAT_MP_ACCESS_TOKEN_HTTP_FAILED',
        `wechat access_token request failed with status ${result.status}`,
        result.status,
        result.json || result.text,
      );
    }
    const errCode = parseWechatErrCode(result.json);
    if (errCode !== 0) {
      throw new WechatMpError('WECHAT_MP_ACCESS_TOKEN_FAILED', parseWechatErrMsg(result.json), result.status, result.json);
    }
    const accessToken = trim(result.json?.access_token);
    const expiresIn = Number(result.json?.expires_in || 0);
    if (!accessToken || !Number.isFinite(expiresIn) || expiresIn <= 0) {
      throw new WechatMpError('WECHAT_MP_ACCESS_TOKEN_PAYLOAD_INVALID', 'access_token response is invalid', result.status, result.json);
    }
    const ttlSeconds = Math.max(60, Math.floor(expiresIn - ACCESS_TOKEN_REFRESH_LEEWAY_SECONDS));
    this.accessTokenCache = {
      token: accessToken,
      expiresAtMs: Date.now() + ttlSeconds * 1000,
    };
    return accessToken;
  }

  private async getPhoneNumberWithToken(accessToken: string, phoneCode: string): Promise<WechatPhoneNumberResult> {
    const url = `${WECHAT_API_BASE}/wxa/business/getuserphonenumber?access_token=${encodeURIComponent(accessToken)}`;
    const body = JSON.stringify({ code: phoneCode });
    const result = await this.requestJson(
      url,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      },
      'WECHAT_MP_PHONE_NUMBER_REQUEST_FAILED',
    );
    if (result.status < 200 || result.status >= 300) {
      throw new WechatMpError(
        'WECHAT_MP_PHONE_NUMBER_HTTP_FAILED',
        `wechat getPhoneNumber request failed with status ${result.status}`,
        result.status,
        result.json || result.text,
      );
    }
    const errCode = parseWechatErrCode(result.json);
    if (errCode !== 0) {
      throw new WechatMpError('WECHAT_MP_PHONE_NUMBER_FAILED', parseWechatErrMsg(result.json), result.status, result.json);
    }

    const phoneInfo = result.json?.phone_info ?? result.json?.phoneInfo;
    const purePhoneNumber = trim(phoneInfo?.purePhoneNumber);
    const phoneNumber = trim(phoneInfo?.phoneNumber) || purePhoneNumber;
    const countryCode = trim(phoneInfo?.countryCode) || undefined;
    if (!purePhoneNumber && !phoneNumber) {
      throw new WechatMpError('WECHAT_MP_PHONE_NUMBER_PAYLOAD_INVALID', 'wechat phone number payload is invalid', result.status, result.json);
    }
    return {
      phoneNumber,
      purePhoneNumber: purePhoneNumber || phoneNumber,
      countryCode,
    };
  }

  async getPhoneNumber(phoneCode: string): Promise<WechatPhoneNumberResult> {
    this.assertConfigured();
    const normalizedPhoneCode = trim(phoneCode);
    if (!normalizedPhoneCode) {
      throw new WechatMpError('WECHAT_MP_PHONE_CODE_REQUIRED', 'phoneCode is required');
    }

    const accessToken = await this.getAccessToken(false);
    try {
      return await this.getPhoneNumberWithToken(accessToken, normalizedPhoneCode);
    } catch (error) {
      if (!(error instanceof WechatMpError)) throw error;
      if (error.code !== 'WECHAT_MP_PHONE_NUMBER_FAILED') throw error;
      const errCode = parseWechatErrCode(error.details);
      if (![40001, 40014, 42001].includes(errCode)) throw error;
      const refreshedToken = await this.getAccessToken(true);
      return await this.getPhoneNumberWithToken(refreshedToken, normalizedPhoneCode);
    }
  }
}

export const WECHAT_MP_REQUIRED_ENV_FIELDS = WECHAT_CONFIG_FIELDS;
