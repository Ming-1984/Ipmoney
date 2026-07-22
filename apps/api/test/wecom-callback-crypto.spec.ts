import { createCipheriv, createHash } from 'crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { WecomCallbackVerifier } from '../src/modules/webhooks/wecom-callback-crypto';

const ENV_KEYS = ['WECOM_CORP_ID', 'WECOM_CALLBACK_TOKEN', 'WECOM_CALLBACK_ENCODING_AES_KEY'] as const;

function pkcs7Pad(input: Buffer): Buffer {
  const blockSize = 32;
  const remainder = input.length % blockSize;
  const pad = remainder === 0 ? blockSize : blockSize - remainder;
  return Buffer.concat([input, Buffer.alloc(pad, pad)]);
}

function encryptEchoString(message: string, receiveId: string, encodingAesKey: string): string {
  const key = Buffer.from(`${encodingAesKey}=`, 'base64');
  const messageBuffer = Buffer.from(message, 'utf8');
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(messageBuffer.length);
  const plain = pkcs7Pad(Buffer.concat([Buffer.alloc(16, 1), lengthBuffer, messageBuffer, Buffer.from(receiveId)]));
  const cipher = createCipheriv('aes-256-cbc', key, key.subarray(0, 16));
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(plain), cipher.final()]).toString('base64');
}

function signature(token: string, timestamp: string, nonce: string, encrypted: string): string {
  return createHash('sha1').update([token, timestamp, nonce, encrypted].sort().join('')).digest('hex');
}

describe('WecomCallbackVerifier', () => {
  let envBackup: Record<string, string | undefined>;

  beforeEach(() => {
    envBackup = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const previous = envBackup[key];
      if (previous == null) delete process.env[key];
      else process.env[key] = previous;
    }
  });

  it('verifies signature, decrypts echostr, and returns the plaintext echo', () => {
    const corpId = 'ww32e931825a5e7446';
    const token = 'unit-token';
    const encodingAesKey = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG';
    const echostr = encryptEchoString('hello-wecom', corpId, encodingAesKey);
    const timestamp = '1720000000';
    const nonce = 'nonce-1';

    process.env.WECOM_CORP_ID = corpId;
    process.env.WECOM_CALLBACK_TOKEN = token;
    process.env.WECOM_CALLBACK_ENCODING_AES_KEY = encodingAesKey;

    expect(
      new WecomCallbackVerifier().verifyUrl({
        msg_signature: signature(token, timestamp, nonce, echostr),
        timestamp,
        nonce,
        echostr,
      }),
    ).toBe('hello-wecom');
  });

  it('allows URL verification before CorpID is configured', () => {
    const corpId = 'ww32e931825a5e7446';
    const token = 'unit-token';
    const encodingAesKey = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG';
    const echostr = encryptEchoString('hello-wecom', corpId, encodingAesKey);
    const timestamp = '1720000000';
    const nonce = 'nonce-1';

    delete process.env.WECOM_CORP_ID;
    process.env.WECOM_CALLBACK_TOKEN = token;
    process.env.WECOM_CALLBACK_ENCODING_AES_KEY = encodingAesKey;

    expect(
      new WecomCallbackVerifier().verifyUrl({
        msg_signature: signature(token, timestamp, nonce, echostr),
        timestamp,
        nonce,
        echostr,
      }),
    ).toBe('hello-wecom');
  });

  it('rejects invalid callback signature before decrypting', () => {
    process.env.WECOM_CORP_ID = 'ww32e931825a5e7446';
    process.env.WECOM_CALLBACK_TOKEN = 'unit-token';
    process.env.WECOM_CALLBACK_ENCODING_AES_KEY = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG';

    expect(() =>
      new WecomCallbackVerifier().verifyUrl({
        msg_signature: 'invalid',
        timestamp: '1720000000',
        nonce: 'nonce-1',
        echostr: 'encrypted',
      }),
    ).toThrow(/signature is invalid/);
  });
});
