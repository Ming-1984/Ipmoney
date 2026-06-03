import { Card, Typography } from 'antd';
import React from 'react';

export function PlaceholderPage(props: { title: string }) {
  return (
    <Card>
      <Typography.Title level={3} style={{ marginTop: 0 }}>
        {props.title}
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
        当前页面保留了系统扩展位置，后续可按业务需求接入正式功能与接口数据。
      </Typography.Paragraph>
    </Card>
  );
}
