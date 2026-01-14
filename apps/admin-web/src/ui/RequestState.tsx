import { Alert, Button, Space, Typography } from 'antd';
import React from 'react';

export function RequestErrorAlert(props: { error: string; onRetry?: () => void }) {
  return (
    <Alert
      type="error"
      showIcon
      message="加载失败"
      description={props.error}
      action={
        props.onRetry ? (
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
            {props.text || '关键操作建议二次确认；系统需记录操作者、时间与原因（P0 演示为文案提示）。'}
          </Typography.Text>
        </Space>
      }
    />
  );
}

