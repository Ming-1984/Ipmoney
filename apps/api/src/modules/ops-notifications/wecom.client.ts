const WECOM_API_BASE = 'https://qyapi.weixin.qq.com';
const WECOM_API_TIMEOUT_MS = 10_000;
const ACCESS_TOKEN_REFRESH_LEEWAY_SECONDS = 300;

type WecomConfig = {
  corpId?: string;
  agentId?: number;
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

export type WecomRecipient = {
  touser?: string[];
  toparty?: string[];
  totag?: string[];
};

export type WecomSendMarkdownInput = {
  recipients: WecomRecipient;
  content: string;
  enableDuplicateCheck?: boolean;
  duplicateCheckInterval?: number;
  safe?: 0 | 1;
};

export class WecomClientError extends Error {
  code: string;
  statusCode?: number;
  details?: unknown;

  constructor(code: string, message: string, statusCode?: number, details?: unknown) {
    super(message);
    this.name = 'WecomClientError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

function trim(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizePipeList(raw: unknown): string[] {
  return Array.from(
    new Set(
      String(raw ?? '')
        .split('|')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function parseErrCode(payload: unknown): number {
  const code = Number((payload as any)?.errcode ?? 0);
  if (!Number.isFinite(code)) return 0;
  return Math.trunc(code);
}

function parseErrMsg(payload: unknown): string {
  return trim((payload as any)?.errmsg) || 'wecom api error';
}

export class WecomClient {
  private accessTokenCache: AccessTokenCache | null = null;

  private getConfig(): WecomConfig {
    const corpId = trim(process.env.WECOM_CORP_ID) || undefined;
    const appSecret = trim(process.env.WECOM_APP_SECRET || process.env.WECOM_SECRET) || undefined;
    const parsedAgentId = Number(trim(process.env.WECOM_AGENT_ID));
    const agentId = Number.isSafeInteger(parsedAgentId) && parsedAgentId > 0 ? parsedAgentId : undefined;
    return { corpId, agentId, appSecret };
  }

  getMissingFields(): string[] {
    const config = this.getConfig();
    const missing: string[] = [];
    if (!config.corpId) missing.push('WECOM_CORP_ID');
    if (!config.agentId) missing.push('WECOM_AGENT_ID');
    if (!config.appSecret) missing.push('WECOM_APP_SECRET');
    return missing;
  }

  isConfigured(): boolean {
    return this.getMissingFields().length === 0;
  }

  getDefaultRecipients(): WecomRecipient {
    return {
      touser: normalizePipeList(process.env.WECOM_DEFAULT_TOUSER),
      toparty: normalizePipeList(process.env.WECOM_DEFAULT_TOPARTY),
      totag: normalizePipeList(process.env.WECOM_DEFAULT_TOTAG),
    };
  }

  hasRecipients(recipients: WecomRecipient): boolean {
    return Boolean(recipients.touser?.length || recipients.toparty?.length || recipients.totag?.length);
  }

  private assertConfigured() {
    const missing = this.getMissingFields();
    if (!missing.length) return;
    throw new WecomClientError('WECOM_NOT_CONFIGURED', `wecom config missing: ${missing.join(', ')}`, undefined, {
      missingFields: missing,
    });
  }

  private async requestJson(url: string, init: RequestInit, errorCode: string): Promise<JsonResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), WECOM_API_TIMEOUT_MS);
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
      const message = error instanceof Error && error.name === 'AbortError' ? 'wecom api request timeout' : 'wecom api request failed';
      const cause = error instanceof Error ? error.message : String(error);
      throw new WecomClientError(errorCode, message, undefined, { cause });
    } finally {
      clearTimeout(timer);
    }
  }

  private async getAccessToken(forceRefresh = false): Promise<string> {
    this.assertConfigured();
    if (!forceRefresh && this.accessTokenCache && this.accessTokenCache.expiresAtMs > Date.now()) {
      return this.accessTokenCache.token;
    }

    const config = this.getConfig();
    const url =
      `${WECOM_API_BASE}/cgi-bin/gettoken` +
      `?corpid=${encodeURIComponent(config.corpId as string)}` +
      `&corpsecret=${encodeURIComponent(config.appSecret as string)}`;

    const result = await this.requestJson(url, { method: 'GET' }, 'WECOM_ACCESS_TOKEN_REQUEST_FAILED');
    if (result.status < 200 || result.status >= 300) {
      throw new WecomClientError(
        'WECOM_ACCESS_TOKEN_HTTP_FAILED',
        `wecom access token request failed with status ${result.status}`,
        result.status,
        result.json || result.text,
      );
    }

    const errCode = parseErrCode(result.json);
    if (errCode !== 0) {
      throw new WecomClientError('WECOM_ACCESS_TOKEN_FAILED', parseErrMsg(result.json), result.status, result.json);
    }

    const accessToken = trim(result.json?.access_token);
    const expiresIn = Number(result.json?.expires_in ?? 7200);
    if (!accessToken) {
      throw new WecomClientError(
        'WECOM_ACCESS_TOKEN_PAYLOAD_INVALID',
        'wecom access token payload is invalid',
        result.status,
        result.json,
      );
    }

    const ttlSeconds = Number.isFinite(expiresIn) ? Math.max(60, Math.trunc(expiresIn) - ACCESS_TOKEN_REFRESH_LEEWAY_SECONDS) : 6900;
    this.accessTokenCache = {
      token: accessToken,
      expiresAtMs: Date.now() + ttlSeconds * 1000,
    };
    return accessToken;
  }

  private async executeSendMarkdown(accessToken: string, input: WecomSendMarkdownInput) {
    const config = this.getConfig();
    const url = `${WECOM_API_BASE}/cgi-bin/message/send?access_token=${encodeURIComponent(accessToken)}`;
    const duplicateCheckInterval = Number(input.duplicateCheckInterval ?? 600);
    const payload = {
      touser: (input.recipients.touser || []).join('|'),
      toparty: (input.recipients.toparty || []).join('|'),
      totag: (input.recipients.totag || []).join('|'),
      msgtype: 'markdown',
      agentid: config.agentId,
      markdown: { content: input.content },
      safe: input.safe ?? 0,
      enable_id_trans: 0,
      enable_duplicate_check: input.enableDuplicateCheck ? 1 : 0,
      duplicate_check_interval: Math.min(14400, Math.max(0, Math.trunc(duplicateCheckInterval))),
    };

    const result = await this.requestJson(
      url,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      },
      'WECOM_MESSAGE_SEND_REQUEST_FAILED',
    );

    if (result.status < 200 || result.status >= 300) {
      throw new WecomClientError(
        'WECOM_MESSAGE_SEND_HTTP_FAILED',
        `wecom message send failed with status ${result.status}`,
        result.status,
        result.json || result.text,
      );
    }

    const errCode = parseErrCode(result.json);
    if (errCode !== 0) {
      throw new WecomClientError('WECOM_MESSAGE_SEND_FAILED', parseErrMsg(result.json), result.status, result.json);
    }

    return {
      msgId: trim(result.json?.msgid) || undefined,
      invalidUser: trim(result.json?.invaliduser) || undefined,
      invalidParty: trim(result.json?.invalidparty) || undefined,
      invalidTag: trim(result.json?.invalidtag) || undefined,
      response: result.json,
    };
  }

  async sendMarkdown(input: WecomSendMarkdownInput) {
    this.assertConfigured();
    if (!this.hasRecipients(input.recipients)) {
      throw new WecomClientError('WECOM_RECIPIENT_REQUIRED', 'wecom recipients are required');
    }

    const firstToken = await this.getAccessToken(false);
    try {
      return await this.executeSendMarkdown(firstToken, input);
    } catch (error) {
      if (!(error instanceof WecomClientError)) throw error;
      if (error.code !== 'WECOM_MESSAGE_SEND_FAILED') throw error;
      const errCode = parseErrCode(error.details);
      if (![40014, 42001].includes(errCode)) throw error;
      const refreshedToken = await this.getAccessToken(true);
      return await this.executeSendMarkdown(refreshedToken, input);
    }
  }
}
