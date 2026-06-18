import { Alert, Button, Space, Typography } from 'antd';
import React, { useMemo, useState } from 'react';

import { ApiError } from '../lib/api';

const TEXT = {
  unknown: '\u672a\u77e5\u9519\u8bef',
  requestFailed: '\u8bf7\u6c42\u5931\u8d25',
  loadFailed: '\u52a0\u8f7d\u5931\u8d25',
  expand: '\u5c55\u5f00\u8be6\u60c5',
  collapse: '\u6536\u8d77\u8be6\u60c5',
  copy: '\u590d\u5236\u8be6\u60c5',
  retry: '\u91cd\u8bd5',
  auditTitle: '\u5ba1\u8ba1\u63d0\u793a',
  auditDefault: '\u5173\u952e\u64cd\u4f5c\u5efa\u8bae\u4e8c\u6b21\u786e\u8ba4\uff0c\u7cfb\u7edf\u4f1a\u8bb0\u5f55\u64cd\u4f5c\u4eba\u3001\u65f6\u95f4\u4e0e\u5907\u6ce8\u3002',
} as const;

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function extractReadableMessage(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  const payload = value as Record<string, unknown>;
  const candidates = [payload.message, payload.msg, payload.error, payload.detail, payload.title];
  for (const item of candidates) {
    if (typeof item === 'string' && item.trim()) return item.trim();
  }
  return '';
}

function normalizeErrorForAlert(error: unknown): { message: string; retryable: boolean; debug?: string } {
  if (!error) return { message: TEXT.unknown, retryable: true };
  if (typeof error === 'string') return { message: error, retryable: true };
  if (error instanceof ApiError) {
    const debug = safeStringify({
      kind: error.kind,
      status: error.status,
      code: error.code,
      debug: error.debug,
    });
    return { message: error.message || TEXT.requestFailed, retryable: error.retryable, debug };
  }
  if (error instanceof Error) {
    const debug = error.stack || error.message;
    return { message: error.message || TEXT.requestFailed, retryable: true, debug };
  }
  const debug = safeStringify(error);
  return { message: extractReadableMessage(error) || TEXT.requestFailed, retryable: true, debug };
}

export function RequestErrorAlert(props: { error: unknown; onRetry?: () => void }) {
  const [showDebug, setShowDebug] = useState(false);
  const norm = useMemo(() => normalizeErrorForAlert(props.error), [props.error]);

  return (
    <Alert
      type="error"
      showIcon
      message={TEXT.loadFailed}
      description={
        <Space direction="vertical" size={8}>
          <Typography.Text>{norm.message}</Typography.Text>
          {norm.debug ? (
            <div>
              <Space size={12}>
                <Typography.Link onClick={() => setShowDebug((value) => !value)}>
                  {showDebug ? TEXT.collapse : TEXT.expand}
                </Typography.Link>
                <Typography.Link
                  onClick={() => {
                    try {
                      void navigator.clipboard?.writeText(norm.debug || '');
                    } catch {
                      // ignore clipboard failures
                    }
                  }}
                >
                  {TEXT.copy}
                </Typography.Link>
              </Space>
              {showDebug ? (
                <pre
                  style={{
                    marginTop: 8,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    background: 'rgba(15, 23, 42, 0.04)',
                    borderRadius: 8,
                    padding: 12,
                    maxHeight: 240,
                    overflow: 'auto',
                  }}
                >
                  {norm.debug}
                </pre>
              ) : null}
            </div>
          ) : null}
        </Space>
      }
      action={
        props.onRetry && norm.retryable ? (
          <Button size="small" danger onClick={props.onRetry}>
            {TEXT.retry}
          </Button>
        ) : undefined
      }
    />
  );
}

export function AuditHint(props: { text?: string }) {
  return (
    <Alert
      type="info"
      showIcon
      message={TEXT.auditTitle}
      description={
        <Space direction="vertical" size={4}>
          <Typography.Text type="secondary">{props.text || TEXT.auditDefault}</Typography.Text>
        </Space>
      }
    />
  );
}
