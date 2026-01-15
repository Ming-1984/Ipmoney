import { Card, Typography } from 'antd';
import React from 'react';

export function PlaceholderPage(props: { title: string }) {
  return (
    <Card>
      <Typography.Title level={3} style={{ marginTop: 0 }}>
        {props.title}
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
        页面建设中：后续接入业务表格与接口数据。
      </Typography.Paragraph>
    </Card>
  );
}
