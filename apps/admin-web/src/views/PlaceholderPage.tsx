import { Card, Typography } from 'antd';
import React from 'react';

export function PlaceholderPage(props: { title: string }) {
  return (
    <Card>
      <Typography.Title level={3} style={{ marginTop: 0 }}>
        {props.title}
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
        骨架页：后续接入 OpenAPI Mock/真接口与业务表格组件。
      </Typography.Paragraph>
    </Card>
  );
}
