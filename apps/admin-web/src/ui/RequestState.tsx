import { Alert, Button, Space, Typography } from 'antd';
import React, { useMemo, useState } from 'react';

import { ApiError } from '../lib/api';

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function normalizeErrorForAlert(error: unknown): { message: string; retryable: boolean; debug?: string } {
  if (!error) return { message: '未知错误', retryable: true };
  if (typeof error === 'string') return { message: error, retryable: true };
  if (error instanceof ApiError) {
    const debug = safeStringify({
      kind: error.kind,
      status: error.status,
      code: error.code,
      debug: error.debug,
    });
    return { message: error.message || '请求失败', retryable: error.retryable, debug };
  }
  if (error instanceof Error) {
    const debug = error.stack || error.message;
    return { message: error.message || '请求失败', retryable: true, debug };
  }
  return { message: safeStringify(error), retryable: true, debug: safeStringify(error) };
}

export function RequestErrorAlert(props: { error: unknown; onRetry?: () => void }) {
  const [showDebug, setShowDebug] = useState(false);
  const norm = useMemo(() => normalizeErrorForAlert(props.error), [props.error]);

  return (
    <Alert
      type="error"
      showIcon
      message="加载失败"
      description={
        <Space direction="vertical" size={8}>
          <Typography.Text>{norm.message}</Typography.Text>
          {norm.debug ? (
            <div>
              <Space size={12}>
                <Typography.Link onClick={() => setShowDebug((v) => !v)}>
                  {showDebug ? '收起详情' : '展开详情'}
                </Typography.Link>
                <Typography.Link
                  onClick={() => {
                    try {
                      void navigator.clipboard?.writeText(norm.debug || '');
                    } catch {
                      // ignore
                    }
                  }}
                >
                  复制详情
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
            重试
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
      message="审计提示"
      description={
        <Space direction="vertical" size={4}>
          <Typography.Text type="secondary">
            {props.text || '关键操作建议二次确认；系统需记录操作者、时间与原因。'}
          </Typography.Text>
        </Space>
      }
    />
  );
}
