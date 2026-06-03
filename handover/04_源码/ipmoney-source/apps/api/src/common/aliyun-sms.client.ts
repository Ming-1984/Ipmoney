import crypto from 'node:crypto';

const ALIYUN_SMS_TIMEOUT_MS = 10_000;
const ALIYUN_SMS_VERSION = '2017-05-25';
const ALIYUN_SMS_DEFAULT_REGION = 'cn-hangzhou';
const ALIYUN_SMS_DEFAULT_ENDPOINT = 'https://dysmsapi.aliyuncs.com/';

export type SmsPurpose = 'LOGIN' | 'BIND_PHONE';

type AliyunSmsConfig = {
  accessKeyId?: string;
  accessKeySecret?: string;
  signName?: string;
  templateCode?: string;
  templateParamKey: string;
  regionId: string;
  endpoint: string;
};

type AliyunSmsResponse = {
  Code?: string;
  Message?: string;
  RequestId?: string;
  BizId?: string;
};

export class AliyunSmsError extends Error {
  code: string;
  statusCode?: number;
  details?: unknown;

  constructor(code: string, message: string, statusCode?: number, details?: unknown) {
    super(message);
    this.name = 'AliyunSmsError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

function trim(value: unknown): string {
  return String(value ?? '').trim();
}

function percentEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/\+/g, '%20')
    .replace(/\*/g, '%2A')
    .replace(/%7E/g, '~');
}

function isReleaseLike(value: string | undefined): boolean {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return false;
  if (raw === 'prod' || raw === 'production') return true;
  if (raw === 'staging' || raw === 'stage') return true;
  if (/(^|[-_])prod($|[-_])/.test(raw)) return true;
  if (/(^|[-_])staging($|[-_])/.test(raw)) return true;
  return false;
}

export function isReleaseLikeEnv(): boolean {
  const values = [process.env.NODE_ENV, process.env.DEPLOY_ENV, process.env.APP_MODE, process.env.STAGE, process.env.ENV];
  return values.some((v) => isReleaseLike(v));
}

function resolveTemplateCode(purpose: SmsPurpose): string | undefined {
  const genericTemplateCode = trim(process.env.SMS_TEMPLATE_ID);
  const loginTemplateCode = trim(process.env.SMS_TEMPLATE_ID_LOGIN);
  if (purpose === 'BIND_PHONE') {
    return trim(process.env.SMS_TEMPLATE_ID_BIND_PHONE) || genericTemplateCode || loginTemplateCode || undefined;
  }
  return genericTemplateCode || loginTemplateCode || undefined;
}

function resolveAccessKeyPair(): { accessKeyId?: string; accessKeySecret?: string } {
  const envPairs = [
    {
      accessKeyId: trim(process.env.SMS_ACCESS_KEY),
      accessKeySecret: trim(process.env.SMS_SECRET_KEY),
    },
    {
      accessKeyId: trim(process.env.SMS_ACCESS_KEY_ID),
      accessKeySecret: trim(process.env.SMS_ACCESS_KEY_SECRET),
    },
    {
      accessKeyId: trim(process.env.SMS_API_KEY),
      accessKeySecret: trim(process.env.SMS_API_SECRET),
    },
  ];

  const completePair = envPairs.find((pair) => pair.accessKeyId && pair.accessKeySecret);
  if (completePair) {
    return {
      accessKeyId: completePair.accessKeyId,
      accessKeySecret: completePair.accessKeySecret,
    };
  }

  // Do not cross-mix key and secret from different env name groups.
  // If no complete pair exists, expose only values from one group so validation fails fast.
  const fallbackGroup = envPairs.find((pair) => pair.accessKeyId || pair.accessKeySecret);
  return {
    accessKeyId: fallbackGroup?.accessKeyId || undefined,
    accessKeySecret: fallbackGroup?.accessKeySecret || undefined,
  };
}

function normalizeEndpoint(raw: string | undefined): string {
  const text = trim(raw);
  if (!text) return ALIYUN_SMS_DEFAULT_ENDPOINT;
  if (text.endsWith('/')) return text;
  return `${text}/`;
}

export class AliyunSmsClient {
  private getConfig(purpose: SmsPurpose): AliyunSmsConfig {
    const keyPair = resolveAccessKeyPair();
    const accessKeyId = keyPair.accessKeyId;
    const accessKeySecret = keyPair.accessKeySecret;
    const signName = trim(process.env.SMS_SIGN_NAME) || undefined;
    const templateCode = resolveTemplateCode(purpose);
    const templateParamKey = trim(process.env.SMS_TEMPLATE_PARAM_KEY) || 'code';
    const regionId = trim(process.env.SMS_REGION_ID) || ALIYUN_SMS_DEFAULT_REGION;
    const endpoint = normalizeEndpoint(process.env.SMS_ALIYUN_ENDPOINT);

    return {
      accessKeyId,
      accessKeySecret,
      signName,
      templateCode,
      templateParamKey,
      regionId,
      endpoint,
    };
  }

  getMissingFields(purpose: SmsPurpose): string[] {
    const config = this.getConfig(purpose);
    const missing: string[] = [];
    if (!config.accessKeyId) missing.push('SMS_ACCESS_KEY_ID');
    if (!config.accessKeySecret) missing.push('SMS_ACCESS_KEY_SECRET');
    if (!config.signName) missing.push('SMS_SIGN_NAME');
    if (!config.templateCode) {
      if (purpose === 'BIND_PHONE') missing.push('SMS_TEMPLATE_ID_BIND_PHONE (or SMS_TEMPLATE_ID/SMS_TEMPLATE_ID_LOGIN)');
      else missing.push('SMS_TEMPLATE_ID (or SMS_TEMPLATE_ID_LOGIN)');
    }
    return missing;
  }

  isConfigured(purpose: SmsPurpose): boolean {
    return this.getMissingFields(purpose).length === 0;
  }

  private buildSignature(params: Record<string, string>, accessKeySecret: string): string {
    const canonicalized = Object.keys(params)
      .sort()
      .map((key) => `${percentEncode(key)}=${percentEncode(params[key] || '')}`)
      .join('&');
    const stringToSign = `POST&%2F&${percentEncode(canonicalized)}`;
    return crypto.createHmac('sha1', `${accessKeySecret}&`).update(stringToSign).digest('base64');
  }

  async sendCode(input: { phone: string; code: string; purpose: SmsPurpose }): Promise<{ requestId?: string; bizId?: string }> {
    const config = this.getConfig(input.purpose);
    const missing = this.getMissingFields(input.purpose);
    if (missing.length) {
      throw new AliyunSmsError('ALIYUN_SMS_NOT_CONFIGURED', `missing fields: ${missing.join(', ')}`, undefined, {
        missingFields: missing,
      });
    }

    const params: Record<string, string> = {
      Action: 'SendSms',
      Version: ALIYUN_SMS_VERSION,
      Format: 'JSON',
      RegionId: config.regionId,
      AccessKeyId: config.accessKeyId as string,
      SignatureMethod: 'HMAC-SHA1',
      SignatureVersion: '1.0',
      SignatureNonce: crypto.randomUUID(),
      Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
      PhoneNumbers: input.phone,
      SignName: config.signName as string,
      TemplateCode: config.templateCode as string,
      TemplateParam: JSON.stringify({ [config.templateParamKey]: input.code }),
    };
    params.Signature = this.buildSignature(params, config.accessKeySecret as string);

    const body = new URLSearchParams(params);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ALIYUN_SMS_TIMEOUT_MS);
    try {
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body,
        signal: controller.signal,
      });
      const text = await response.text();
      let json: AliyunSmsResponse = {};
      if (text) {
        try {
          json = JSON.parse(text) as AliyunSmsResponse;
        } catch {
          json = {};
        }
      }

      if (response.status < 200 || response.status >= 300) {
        throw new AliyunSmsError(
          'ALIYUN_SMS_HTTP_FAILED',
          `aliyun sms request failed with status ${response.status}`,
          response.status,
          json || text,
        );
      }

      const code = trim(json.Code);
      if (!code || code !== 'OK') {
        throw new AliyunSmsError('ALIYUN_SMS_SEND_FAILED', trim(json.Message) || 'aliyun sms send failed', response.status, json);
      }

      return {
        requestId: trim(json.RequestId) || undefined,
        bizId: trim(json.BizId) || undefined,
      };
    } catch (error) {
      if (error instanceof AliyunSmsError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new AliyunSmsError('ALIYUN_SMS_TIMEOUT', 'aliyun sms request timeout');
      }
      throw new AliyunSmsError('ALIYUN_SMS_REQUEST_FAILED', 'aliyun sms request failed', undefined, {
        cause: error instanceof Error ? error.message : String(error),
      });
    } finally {
      clearTimeout(timer);
    }
  }
}
