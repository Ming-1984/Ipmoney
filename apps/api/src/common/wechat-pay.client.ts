import { createDecipheriv, createSign, createVerify, randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

const WECHAT_PAY_API_BASE = 'https://api.mch.weixin.qq.com';

type WechatPayConfig = {
  appId?: string;
  mchId?: string;
  mchCertSerialNo?: string;
  apiV3Key?: string;
  notifyUrl?: string;
  mchPrivateKeyPem?: string;
  platformCertSerialNo?: string;
  platformCertMap: Map<string, string>;
  testOpenId?: string;
};

type WechatNotifyHeaders = Record<string, unknown>;

type WechatSignedResponse = {
  status: number;
  text: string;
  json: any;
};

export type WechatJsapiPayParams = {
  timeStamp: string;
  nonceStr: string;
  package: string;
  signType: 'RSA';
  paySign: string;
};

export type CreateWechatJsapiPaymentInput = {
  outTradeNo: string;
  amountFen: number;
  description: string;
  payerOpenId: string;
  attach?: string;
};

export type CreateWechatJsapiPaymentResult = {
  prepayId: string;
  payParams: WechatJsapiPayParams;
};

export class WechatPayError extends Error {
  code: string;
  statusCode?: number;
  details?: unknown;

  constructor(code: string, message: string, statusCode?: number, details?: unknown) {
    super(message);
    this.name = 'WechatPayError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

function readPemOrPath(value: string | undefined): string | undefined {
  const raw = String(value || '').trim();
  if (!raw) return undefined;
  if (raw.includes('-----BEGIN')) return raw;
  if (existsSync(raw)) {
    return readFileSync(raw, 'utf8');
  }
  return raw;
}

function parsePlatformCertMap(
  platformCertRaw: string | undefined,
  platformCertsRaw: string | undefined,
  platformCertSerialNo: string | undefined,
): Map<string, string> {
  const map = new Map<string, string>();
  const singleCert = readPemOrPath(platformCertRaw);
  const serial = String(platformCertSerialNo || '').trim();
  if (singleCert) {
    map.set(serial || '__single__', singleCert);
  }

  const raw = String(platformCertsRaw || '').trim();
  if (!raw) return map;

  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
          if (typeof v !== 'string') continue;
          const cert = readPemOrPath(v);
          if (cert) map.set(String(k).trim(), cert);
        }
      }
    } catch {
      // Ignore parse errors and fallback to plain pem/path handling below.
    }
    return map;
  }

  const cert = readPemOrPath(raw);
  if (cert) {
    map.set('__single__', cert);
  }
  return map;
}

function getHeader(headers: WechatNotifyHeaders | undefined, key: string): string | undefined {
  if (!headers) return undefined;
  const target = key.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() !== target) continue;
    if (Array.isArray(v)) {
      const first = v[0];
      if (typeof first === 'string' && first.trim()) return first.trim();
      return undefined;
    }
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number') return String(v);
    return undefined;
  }
  return undefined;
}

function isReleaseLike(value: string | undefined): boolean {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return false;
  if (raw === 'production' || raw === 'prod' || raw === 'staging' || raw === 'stage') return true;
  if (/(^|[-_])prod($|[-_])/.test(raw)) return true;
  if (/(^|[-_])staging($|[-_])/.test(raw)) return true;
  return false;
}

function isNonDevEnv(): boolean {
  const values = [process.env.NODE_ENV, process.env.DEPLOY_ENV, process.env.APP_MODE, process.env.STAGE, process.env.ENV];
  return values.some((v) => isReleaseLike(v));
}

export class WechatPayClient {
  private dynamicPlatformCertMap = new Map<string, string>();

  private getConfig(): WechatPayConfig {
    const appId = String(process.env.WX_MP_APPID || '').trim() || undefined;
    const mchId = String(process.env.WX_PAY_MCHID || '').trim() || undefined;
    const mchCertSerialNo = String(process.env.WX_PAY_MCH_CERT_SERIAL_NO || '').trim() || undefined;
    const apiV3Key = String(process.env.WX_PAY_API_V3_KEY || '').trim() || undefined;
    const notifyUrl = String(process.env.WX_PAY_NOTIFY_URL || '').trim() || undefined;
    const mchPrivateKeyPem = readPemOrPath(process.env.WX_PAY_MCH_PRIVATE_KEY);
    const platformCertSerialNo = String(process.env.WX_PAY_PLATFORM_CERT_SERIAL_NO || '').trim() || undefined;
    const testOpenId = String(process.env.WX_PAY_TEST_OPENID || '').trim() || undefined;

    const platformCertMap = parsePlatformCertMap(
      process.env.WX_PAY_PLATFORM_CERT,
      process.env.WX_PAY_PLATFORM_CERTS,
      platformCertSerialNo,
    );

    for (const [serial, cert] of this.dynamicPlatformCertMap.entries()) {
      if (!platformCertMap.has(serial)) {
        platformCertMap.set(serial, cert);
      }
    }

    return {
      appId,
      mchId,
      mchCertSerialNo,
      apiV3Key,
      notifyUrl,
      mchPrivateKeyPem,
      platformCertSerialNo,
      platformCertMap,
      testOpenId,
    };
  }

  getPaymentMissingFields(): string[] {
    const config = this.getConfig();
    const missing: string[] = [];
    if (!config.appId) missing.push('WX_MP_APPID');
    if (!config.mchId) missing.push('WX_PAY_MCHID');
    if (!config.mchCertSerialNo) missing.push('WX_PAY_MCH_CERT_SERIAL_NO');
    if (!config.apiV3Key) missing.push('WX_PAY_API_V3_KEY');
    if (!config.notifyUrl) missing.push('WX_PAY_NOTIFY_URL');
    if (!config.mchPrivateKeyPem) missing.push('WX_PAY_MCH_PRIVATE_KEY');
    return missing;
  }

  isPaymentEnabled(): boolean {
    return this.getPaymentMissingFields().length === 0;
  }

  isWebhookVerificationEnabled(): boolean {
    const config = this.getConfig();
    if (!config.mchId || !config.mchCertSerialNo || !config.apiV3Key || !config.mchPrivateKeyPem) return false;
    return true;
  }

  resolvePayerOpenId(userOpenId: string | null | undefined): string | undefined {
    const normalizedUserOpenId = String(userOpenId || '').trim();
    if (normalizedUserOpenId) return normalizedUserOpenId;

    const config = this.getConfig();
    if (!isNonDevEnv() && config.testOpenId) return config.testOpenId;
    return undefined;
  }

  async createJsapiPayment(input: CreateWechatJsapiPaymentInput): Promise<CreateWechatJsapiPaymentResult> {
    const config = this.getConfig();
    const missing = this.getPaymentMissingFields();
    if (missing.length > 0) {
      throw new WechatPayError('WECHATPAY_NOT_CONFIGURED', `missing fields: ${missing.join(', ')}`);
    }
    if (!config.appId || !config.mchId || !config.notifyUrl) {
      throw new WechatPayError('WECHATPAY_NOT_CONFIGURED', 'wechat pay config incomplete');
    }

    const payload = {
      appid: config.appId,
      mchid: config.mchId,
      description: String(input.description || '').trim().slice(0, 120) || 'IPMoney 订单支付',
      out_trade_no: String(input.outTradeNo || '').trim(),
      notify_url: config.notifyUrl,
      amount: {
        total: input.amountFen,
        currency: 'CNY',
      },
      payer: {
        openid: String(input.payerOpenId || '').trim(),
      },
      attach: input.attach ? String(input.attach) : undefined,
    };

    if (!payload.out_trade_no) {
      throw new WechatPayError('WECHATPAY_OUT_TRADE_NO_INVALID', 'out_trade_no is required');
    }
    if (payload.out_trade_no.length > 32) {
      throw new WechatPayError('WECHATPAY_OUT_TRADE_NO_INVALID', 'out_trade_no max length is 32');
    }
    if (!payload.payer.openid) {
      throw new WechatPayError('WECHATPAY_OPENID_REQUIRED', 'payer openid is required');
    }
    if (!Number.isSafeInteger(input.amountFen) || input.amountFen <= 0) {
      throw new WechatPayError('WECHATPAY_AMOUNT_INVALID', 'amount must be positive integer');
    }

    const response = await this.sendSignedRequest('POST', '/v3/pay/transactions/jsapi', payload);
    if (response.status < 200 || response.status >= 300) {
      const message =
        String(response.json?.message || '').trim() ||
        String(response.json?.detail || '').trim() ||
        `wechat pay jsapi failed with status ${response.status}`;
      throw new WechatPayError('WECHATPAY_PREPAY_FAILED', message, response.status, response.json || response.text);
    }

    const prepayId = String(response.json?.prepay_id || '').trim();
    if (!prepayId) {
      throw new WechatPayError('WECHATPAY_PREPAY_ID_MISSING', 'prepay_id missing in wechat pay response', response.status, response.json);
    }

    return {
      prepayId,
      payParams: this.buildClientPayParams(prepayId, config.appId, config.mchPrivateKeyPem as string),
    };
  }

  async verifyNotifySignature(headers: WechatNotifyHeaders | undefined, rawBody: string): Promise<void> {
    const config = this.getConfig();
    if (!config.mchId || !config.mchCertSerialNo || !config.apiV3Key || !config.mchPrivateKeyPem) {
      throw new WechatPayError('WECHATPAY_NOT_CONFIGURED', 'wechat pay webhook verify config incomplete');
    }

    const timestamp = getHeader(headers, 'wechatpay-timestamp');
    const nonce = getHeader(headers, 'wechatpay-nonce');
    const signature = getHeader(headers, 'wechatpay-signature');
    const serialNo = getHeader(headers, 'wechatpay-serial');
    if (!timestamp || !nonce || !signature || !serialNo) {
      throw new WechatPayError('WECHATPAY_NOTIFY_SIGNATURE_MISSING', 'wechatpay signature headers are required');
    }

    const certPem = await this.getPlatformCertPem(serialNo, config);
    const message = `${timestamp}\n${nonce}\n${rawBody}\n`;
    const verifier = createVerify('RSA-SHA256');
    verifier.update(message, 'utf8');
    verifier.end();
    const ok = verifier.verify(certPem, signature, 'base64');
    if (!ok) {
      throw new WechatPayError('WECHATPAY_NOTIFY_SIGNATURE_INVALID', 'wechatpay notify signature invalid');
    }
  }

  decryptNotifyResource(body: any): any {
    const config = this.getConfig();
    const apiV3Key = String(config.apiV3Key || '');
    if (!apiV3Key) {
      throw new WechatPayError('WECHATPAY_NOT_CONFIGURED', 'WX_PAY_API_V3_KEY is required');
    }
    const resource = body?.resource;
    if (!resource || typeof resource !== 'object') return null;
    const ciphertext = String(resource?.ciphertext || '').trim();
    if (!ciphertext) return null;
    const nonce = String(resource?.nonce || '').trim();
    const associatedData = String(resource?.associated_data || '').trim();
    const algorithm = String(resource?.algorithm || '').trim().toUpperCase();
    if (algorithm && algorithm !== 'AEAD_AES_256_GCM') {
      throw new WechatPayError('WECHATPAY_NOTIFY_ALGORITHM_INVALID', `unsupported algorithm: ${algorithm}`);
    }
    const plaintext = this.decryptAeadAes256Gcm({
      apiV3Key,
      nonce,
      associatedData,
      ciphertext,
    });
    try {
      return JSON.parse(plaintext);
    } catch {
      throw new WechatPayError('WECHATPAY_NOTIFY_DECRYPT_PARSE_FAILED', 'wechatpay notify decrypted payload is not valid json');
    }
  }

  private buildClientPayParams(prepayId: string, appId: string, privateKeyPem: string): WechatJsapiPayParams {
    const timeStamp = String(Math.floor(Date.now() / 1000));
    const nonceStr = this.randomNonce(32);
    const packageValue = `prepay_id=${prepayId}`;
    const message = `${appId}\n${timeStamp}\n${nonceStr}\n${packageValue}\n`;
    const paySign = this.signRsaSha256(message, privateKeyPem);
    return {
      timeStamp,
      nonceStr,
      package: packageValue,
      signType: 'RSA',
      paySign,
    };
  }

  private async getPlatformCertPem(serialNo: string, config: WechatPayConfig): Promise<string> {
    const direct = config.platformCertMap.get(serialNo);
    if (direct) return direct;

    const fallback = config.platformCertMap.get('__single__');
    if (fallback) return fallback;

    await this.refreshPlatformCertificates(config);
    const refreshed = this.dynamicPlatformCertMap.get(serialNo) || this.dynamicPlatformCertMap.get('__single__');
    if (refreshed) return refreshed;

    throw new WechatPayError(
      'WECHATPAY_PLATFORM_CERT_MISSING',
      `platform cert for serial ${serialNo} not found, set WX_PAY_PLATFORM_CERT or WX_PAY_PLATFORM_CERTS`,
    );
  }

  private async refreshPlatformCertificates(config: WechatPayConfig): Promise<void> {
    const response = await this.sendSignedRequest('GET', '/v3/certificates', undefined, config);
    if (response.status < 200 || response.status >= 300) {
      const message =
        String(response.json?.message || '').trim() ||
        String(response.json?.detail || '').trim() ||
        `wechat platform cert fetch failed with status ${response.status}`;
      throw new WechatPayError('WECHATPAY_PLATFORM_CERT_FETCH_FAILED', message, response.status, response.json || response.text);
    }

    const data = Array.isArray(response.json?.data) ? response.json.data : [];
    for (const item of data) {
      const serialNo = String(item?.serial_no || '').trim();
      const encryptCertificate = item?.encrypt_certificate;
      const ciphertext = String(encryptCertificate?.ciphertext || '').trim();
      const nonce = String(encryptCertificate?.nonce || '').trim();
      const associatedData = String(encryptCertificate?.associated_data || '').trim();
      if (!serialNo || !ciphertext || !nonce) continue;

      const pem = this.decryptAeadAes256Gcm({
        apiV3Key: String(config.apiV3Key || ''),
        nonce,
        associatedData,
        ciphertext,
      });
      if (pem.includes('-----BEGIN CERTIFICATE-----')) {
        this.dynamicPlatformCertMap.set(serialNo, pem);
      }
    }
  }

  private async sendSignedRequest(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH',
    pathWithQuery: string,
    body?: Record<string, unknown>,
    inputConfig?: WechatPayConfig,
  ): Promise<WechatSignedResponse> {
    const config = inputConfig || this.getConfig();
    if (!config.mchId || !config.mchCertSerialNo || !config.mchPrivateKeyPem) {
      throw new WechatPayError('WECHATPAY_NOT_CONFIGURED', 'missing merchant id/cert/private key');
    }

    const bodyText = body ? JSON.stringify(body) : '';
    const nonce = this.randomNonce(32);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const message = `${method}\n${pathWithQuery}\n${timestamp}\n${nonce}\n${bodyText}\n`;
    const signature = this.signRsaSha256(message, config.mchPrivateKeyPem);
    const authorization =
      `WECHATPAY2-SHA256-RSA2048 mchid="${config.mchId}",` +
      `nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${config.mchCertSerialNo}",signature="${signature}"`;

    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: authorization,
      'User-Agent': 'ipmoney-api/1.0',
    };
    if (bodyText) headers['Content-Type'] = 'application/json';

    const response = await fetch(`${WECHAT_PAY_API_BASE}${pathWithQuery}`, {
      method,
      headers,
      body: bodyText || undefined,
    });
    const text = await response.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    return {
      status: response.status,
      text,
      json,
    };
  }

  private signRsaSha256(message: string, privateKeyPem: string): string {
    const signer = createSign('RSA-SHA256');
    signer.update(message, 'utf8');
    signer.end();
    return signer.sign(privateKeyPem, 'base64');
  }

  private decryptAeadAes256Gcm(input: {
    apiV3Key: string;
    nonce: string;
    associatedData?: string;
    ciphertext: string;
  }): string {
    const key = Buffer.from(input.apiV3Key, 'utf8');
    if (key.length !== 32) {
      throw new WechatPayError('WECHATPAY_API_V3_KEY_INVALID', 'WX_PAY_API_V3_KEY must be 32-byte string');
    }

    const encrypted = Buffer.from(input.ciphertext, 'base64');
    if (encrypted.length <= 16) {
      throw new WechatPayError('WECHATPAY_CIPHERTEXT_INVALID', 'ciphertext is too short');
    }
    const content = encrypted.subarray(0, encrypted.length - 16);
    const authTag = encrypted.subarray(encrypted.length - 16);

    try {
      const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(input.nonce, 'utf8'));
      if (input.associatedData) {
        decipher.setAAD(Buffer.from(input.associatedData, 'utf8'));
      }
      decipher.setAuthTag(authTag);
      const plain = Buffer.concat([decipher.update(content), decipher.final()]);
      return plain.toString('utf8');
    } catch (error) {
      throw new WechatPayError(
        'WECHATPAY_DECRYPT_FAILED',
        'failed to decrypt wechat payload',
        undefined,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  private randomNonce(size: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const bytes = randomBytes(size);
    let out = '';
    for (let i = 0; i < size; i += 1) {
      out += chars[bytes[i] % chars.length];
    }
    return out;
  }
}
