import { createDecipheriv, createHash, timingSafeEqual } from 'crypto';

type WecomCallbackConfig = {
  corpId?: string;
  token: string;
  encodingAesKey: string;
};

export type WecomCallbackVerifyQuery = {
  msg_signature?: unknown;
  timestamp?: unknown;
  nonce?: unknown;
  echostr?: unknown;
};

export class WecomCallbackError extends Error {
  code: string;
  details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'WecomCallbackError';
    this.code = code;
    this.details = details;
  }
}

function trim(value: unknown): string {
  return String(value ?? '').trim();
}

function getConfig(): WecomCallbackConfig {
  return {
    corpId: trim(process.env.WECOM_CORP_ID) || undefined,
    token: trim(process.env.WECOM_CALLBACK_TOKEN),
    encodingAesKey: trim(process.env.WECOM_CALLBACK_ENCODING_AES_KEY),
  };
}

function getMissingFields(config: WecomCallbackConfig): string[] {
  const missing: string[] = [];
  if (!config.token) missing.push('WECOM_CALLBACK_TOKEN');
  if (!config.encodingAesKey) missing.push('WECOM_CALLBACK_ENCODING_AES_KEY');
  return missing;
}

function assertSafeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function computeSignature(token: string, timestamp: string, nonce: string, encrypted: string): string {
  return createHash('sha1').update([token, timestamp, nonce, encrypted].sort().join('')).digest('hex');
}

function decodeEncodingAesKey(encodingAesKey: string): Buffer {
  if (!/^[A-Za-z0-9+/]{43}$/.test(encodingAesKey)) {
    throw new WecomCallbackError('WECOM_CALLBACK_AES_KEY_INVALID', 'WeCom callback EncodingAESKey must be 43 base64 characters');
  }
  const key = Buffer.from(`${encodingAesKey}=`, 'base64');
  if (key.length !== 32) {
    throw new WecomCallbackError('WECOM_CALLBACK_AES_KEY_INVALID', 'WeCom callback EncodingAESKey decoded length is invalid');
  }
  return key;
}

function removePkcs7Padding(plain: Buffer): Buffer {
  if (!plain.length) {
    throw new WecomCallbackError('WECOM_CALLBACK_DECRYPT_FAILED', 'WeCom callback plaintext is empty');
  }
  const pad = plain[plain.length - 1];
  if (pad < 1 || pad > 32 || pad > plain.length) {
    throw new WecomCallbackError('WECOM_CALLBACK_PADDING_INVALID', 'WeCom callback plaintext padding is invalid');
  }
  return plain.subarray(0, plain.length - pad);
}

function decryptEchoString(encryptedEchoString: string, encodingAesKey: string) {
  try {
    const key = decodeEncodingAesKey(encodingAesKey);
    const decipher = createDecipheriv('aes-256-cbc', key, key.subarray(0, 16));
    decipher.setAutoPadding(false);
    const decrypted = Buffer.concat([decipher.update(encryptedEchoString, 'base64'), decipher.final()]);
    const plain = removePkcs7Padding(decrypted);
    if (plain.length < 20) {
      throw new WecomCallbackError('WECOM_CALLBACK_PLAINTEXT_INVALID', 'WeCom callback plaintext is too short');
    }

    const messageLength = plain.readUInt32BE(16);
    const messageStart = 20;
    const messageEnd = messageStart + messageLength;
    if (messageEnd > plain.length) {
      throw new WecomCallbackError('WECOM_CALLBACK_PLAINTEXT_INVALID', 'WeCom callback message length is invalid');
    }

    return {
      message: plain.subarray(messageStart, messageEnd).toString('utf8'),
      receiveId: plain.subarray(messageEnd).toString('utf8'),
    };
  } catch (error) {
    if (error instanceof WecomCallbackError) throw error;
    throw new WecomCallbackError('WECOM_CALLBACK_DECRYPT_FAILED', 'WeCom callback echostr decrypt failed');
  }
}

export class WecomCallbackVerifier {
  getMissingFields(): string[] {
    return getMissingFields(getConfig());
  }

  verifyUrl(query: WecomCallbackVerifyQuery): string {
    const config = getConfig();
    const missing = getMissingFields(config);
    if (missing.length) {
      throw new WecomCallbackError('WECOM_CALLBACK_NOT_CONFIGURED', `WeCom callback config missing: ${missing.join(', ')}`, {
        missingFields: missing,
      });
    }

    const msgSignature = trim(query.msg_signature);
    const timestamp = trim(query.timestamp);
    const nonce = trim(query.nonce);
    const encryptedEchoString = trim(query.echostr);
    if (!msgSignature || !timestamp || !nonce || !encryptedEchoString) {
      throw new WecomCallbackError('WECOM_CALLBACK_QUERY_MISSING', 'WeCom callback verification query is incomplete');
    }

    const expectedSignature = computeSignature(config.token, timestamp, nonce, encryptedEchoString);
    if (!assertSafeEqual(msgSignature, expectedSignature)) {
      throw new WecomCallbackError('WECOM_CALLBACK_SIGNATURE_INVALID', 'WeCom callback signature is invalid');
    }

    const decrypted = decryptEchoString(encryptedEchoString, config.encodingAesKey);
    if (config.corpId && decrypted.receiveId !== config.corpId) {
      throw new WecomCallbackError('WECOM_CALLBACK_CORP_ID_MISMATCH', 'WeCom callback receive id does not match corp id');
    }
    return decrypted.message;
  }
}
