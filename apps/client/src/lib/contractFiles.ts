import Taro from '@tarojs/taro';

import { createFileTemporaryAccess } from './files';
import { toast } from '../ui/nutui';

const PDF_PREVIEW_FAILED = '合同预览失败';

export function extractFileIdFromFileUrl(rawUrl?: string | null): string | null {
  const input = String(rawUrl || '').trim();
  if (!input) return null;
  let pathname = input;
  try {
    pathname = new URL(input).pathname || input;
  } catch {
    pathname = input.split('?')[0] || input;
  }
  const match = pathname.match(/\/files\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:$|\/)/i);
  return match?.[1] || null;
}

export async function previewContractFile(fileUrl?: string | null): Promise<void> {
  const rawUrl = String(fileUrl || '').trim();
  if (!rawUrl) {
    toast('暂无可用合同链接');
    return;
  }

  try {
    let previewUrl = rawUrl;
    const fileId = extractFileIdFromFileUrl(rawUrl);
    if (fileId) {
      const temp = await createFileTemporaryAccess(fileId, { scope: 'preview', expiresInSeconds: 600 });
      const tempUrl = String(temp?.url || '').trim();
      if (tempUrl) previewUrl = tempUrl;
    }

    if (process.env.TARO_ENV === 'weapp') {
      const downloaded = await Taro.downloadFile({ url: previewUrl });
      const filePath = String(downloaded?.tempFilePath || '').trim();
      if (!filePath) throw new Error(PDF_PREVIEW_FAILED);
      await Taro.openDocument({ filePath, fileType: 'pdf', showMenu: true });
      return;
    }

    if (typeof window !== 'undefined') {
      const opened = window.open(previewUrl, '_blank', 'noopener,noreferrer');
      if (!opened) throw new Error(PDF_PREVIEW_FAILED);
      opened.opener = null;
      return;
    }

    throw new Error(PDF_PREVIEW_FAILED);
  } catch (e: any) {
    toast(e?.message || PDF_PREVIEW_FAILED);
  }
}
