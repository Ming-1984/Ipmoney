import { Typography, message } from 'antd';
import React, { useCallback, useState } from 'react';

import { apiPost } from '../lib/api';

type ContractPreviewLinkProps = {
  fileUrl?: string | null;
  children?: React.ReactNode;
};

const TEXT = {
  preview: '预览合同',
  opening: '打开中...',
  noFile: '暂无合同文件',
  failed: '打开合同失败',
} as const;

function extractFileIdFromFileUrl(rawUrl?: string | null): string | null {
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

export function ContractPreviewLink(props: ContractPreviewLinkProps) {
  const { fileUrl, children } = props;
  const [opening, setOpening] = useState(false);

  const openPreview = useCallback(
    async (event: React.MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      if (!fileUrl) {
        message.warning(TEXT.noFile);
        return;
      }

      const previewWindow = window.open('about:blank', '_blank');
      if (previewWindow) previewWindow.opener = null;

      setOpening(true);
      try {
        const fileId = extractFileIdFromFileUrl(fileUrl);
        let previewUrl = fileUrl;
        if (fileId) {
          const temp = await apiPost<{ url: string }>(`/files/${fileId}/temporary-access`, {
            scope: 'preview',
            ttlSeconds: 300,
          });
          if (!temp?.url) throw new Error('empty preview url');
          previewUrl = temp.url;
        }

        if (previewWindow) {
          previewWindow.location.href = previewUrl;
        } else {
          window.open(previewUrl, '_blank', 'noopener,noreferrer');
        }
      } catch (e: any) {
        if (previewWindow) previewWindow.close();
        message.error(e?.message || TEXT.failed);
      } finally {
        setOpening(false);
      }
    },
    [fileUrl],
  );

  return (
    <Typography.Link href={fileUrl || undefined} onClick={openPreview} disabled={opening || !fileUrl}>
      {opening ? TEXT.opening : children || TEXT.preview}
    </Typography.Link>
  );
}
