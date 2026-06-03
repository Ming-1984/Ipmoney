import Taro from '@tarojs/taro';

export type UploadRetryOptions = Taro.uploadFile.Option & { retry?: number; retryDelayMs?: number };

async function wait(ms: number) {
  return await new Promise((resolve) => setTimeout(resolve, ms));
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
