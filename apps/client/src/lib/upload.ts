import Taro from '@tarojs/taro';

import { requireWeChatPrivacyAuthorizedOrThrow } from './wechatPrivacy';

export type UploadRetryOptions = Taro.uploadFile.Option & { retry?: number; retryDelayMs?: number };
export type UploadJsonResult<T> = {
  data: T;
  response: Taro.uploadFile.SuccessCallbackResult;
};
export type PickedLocalFile = {
  path: string;
  name: string;
};

type PickerSource = 'image' | 'message-image' | 'message-file';

const WECHAT_PRIVACY_SCOPE_ERROR = 'api scope is not declared in the privacy agreement';
const FILE_PRIVACY_ERROR_MESSAGE =
  '当前小程序尚未完成“从聊天记录选择文件”的隐私声明，微信已拦截该能力。请先在微信小程序后台的“用户隐私保护指引”中补充文件选择声明后再试。';
const IMAGE_PRIVACY_ERROR_MESSAGE =
  '当前小程序尚未完成图片选择相关隐私声明，微信已拦截图片选择。请先在微信小程序后台补充图片/相册相关声明后再试。';
const MESSAGE_IMAGE_PRIVACY_ERROR_MESSAGE =
  '当前小程序尚未完成“从聊天记录选择图片”的隐私声明，微信已拦截该能力。建议先改用系统相册/拍照上传，或在微信小程序后台补充对应隐私声明后再试。';

async function wait(ms: number) {
  return await new Promise((resolve) => setTimeout(resolve, ms));
}

function buildFileNameFromPath(path: string, fallback: string) {
  const normalized = String(path || '').trim();
  if (!normalized) return fallback;
  const parts = normalized.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] || fallback;
}

function getPickerErrorText(error: any) {
  return String(error?.errMsg || error?.message || error || '').trim();
}

export function isPrivacyAgreementScopeError(error: any) {
  return getPickerErrorText(error).toLowerCase().includes(WECHAT_PRIVACY_SCOPE_ERROR);
}

export function normalizePickerError(error: any, source: PickerSource) {
  if (!isPrivacyAgreementScopeError(error)) return error;
  const message =
    source === 'message-file'
      ? FILE_PRIVACY_ERROR_MESSAGE
      : source === 'message-image'
        ? MESSAGE_IMAGE_PRIVACY_ERROR_MESSAGE
        : IMAGE_PRIVACY_ERROR_MESSAGE;
  const nextError = new Error(message) as Error & { errMsg?: string; cause?: unknown };
  nextError.errMsg = getPickerErrorText(error);
  nextError.cause = error;
  return nextError;
}

export async function chooseImageFiles(options: {
  count: number;
  sourceType?: Array<'album' | 'camera'>;
  sizeType?: Array<'original' | 'compressed'>;
}): Promise<PickedLocalFile[]> {
  try {
    await requireWeChatPrivacyAuthorizedOrThrow();
    const chosen = await Taro.chooseImage({
      count: Math.max(1, options.count),
      sourceType: options.sourceType || ['album', 'camera'],
      sizeType: options.sizeType || ['compressed'],
    });
    const tempFiles = Array.isArray((chosen as any)?.tempFiles) ? ((chosen as any).tempFiles as Array<{ path?: string }>) : [];
    const tempFilePaths = Array.isArray((chosen as any)?.tempFilePaths)
      ? (((chosen as any).tempFilePaths as string[]).map((path) => ({ path } satisfies { path?: string })))
      : [];
    const files = (tempFiles.length ? tempFiles : tempFilePaths)
      .map((file, index) => {
        const path = String(file?.path || '').trim();
        return {
          path,
          name: buildFileNameFromPath(path, `image-${index + 1}`),
        };
      })
      .filter((file) => Boolean(file.path));
    return files;
  } catch (error: any) {
    throw normalizePickerError(error, 'image');
  }
}

export async function chooseMessageFiles(options: {
  count: number;
  type: 'all' | 'image' | 'file';
  extension?: string[];
}): Promise<PickedLocalFile[]> {
  if (typeof Taro.chooseMessageFile !== 'function') {
    throw new Error('当前微信环境不支持从聊天记录选择文件，请在真机微信中重试。');
  }
  try {
    await requireWeChatPrivacyAuthorizedOrThrow();
    const chosen = await Taro.chooseMessageFile({
      count: Math.max(1, options.count),
      type: options.type as any,
      extension: options.extension,
    });
    return (((chosen as any)?.tempFiles || []) as Array<{ path?: string; name?: string }>)
      .map((file, index) => {
        const path = String(file?.path || '').trim();
        return {
          path,
          name: String(file?.name || '').trim() || buildFileNameFromPath(path, `file-${index + 1}`),
        };
      })
      .filter((file) => Boolean(file.path));
  } catch (error: any) {
    throw normalizePickerError(error, options.type === 'image' ? 'message-image' : 'message-file');
  }
}

export async function uploadWithRetry(options: UploadRetryOptions) {
  const retries = Math.max(0, options.retry ?? 1);
  const delayMs = Math.max(300, options.retryDelayMs ?? 800);
  let attempt = 0;
  while (true) {
    try {
      const res = await Taro.uploadFile(options);
      if ((res.statusCode === 429 || res.statusCode >= 500) && attempt < retries) {
        attempt += 1;
        await wait(delayMs * attempt);
        continue;
      }
      return res;
    } catch (e) {
      if (attempt >= retries) throw e;
      attempt += 1;
      await wait(delayMs * attempt);
    }
  }
}

function normalizeUploadErrorMessage(statusCode: number, data: unknown): string {
  const parsed = data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  const message = typeof parsed?.message === 'string' ? parsed.message.trim() : '';
  if (message) return message;
  if (statusCode === 401 || statusCode === 403) return '请先重新登录后再上传';
  if (statusCode === 413) return '文件过大，请压缩后重试';
  if (statusCode === 429) return '上传过于频繁，请稍后重试';
  if (statusCode >= 500) return '上传服务暂时不可用，请稍后重试';
  return `上传失败（${statusCode}）`;
}

export async function uploadFileToApi<T = Record<string, unknown>>(options: UploadRetryOptions): Promise<UploadJsonResult<T>> {
  const response = await uploadWithRetry(options);
  const raw = String(response.data ?? '').trim();

  let data: unknown = {};
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      const error = new Error('上传响应解析失败') as Error & {
        statusCode?: number;
        responseText?: string;
      };
      error.statusCode = response.statusCode;
      error.responseText = raw;
      throw error;
    }
  }

  if (response.statusCode < 200 || response.statusCode >= 300) {
    const error = new Error(normalizeUploadErrorMessage(response.statusCode, data)) as Error & {
      statusCode?: number;
      responseData?: unknown;
    };
    error.statusCode = response.statusCode;
    error.responseData = data;
    throw error;
  }

  return {
    data: data as T,
    response,
  };
}
