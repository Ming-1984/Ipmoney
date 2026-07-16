import { Button, Card, Space, Typography } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import React from 'react';
import { useNavigate } from 'react-router-dom';

export function HomeBannersPage() {
  const navigate = useNavigate();

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/config/home-landing')} style={{ alignSelf: 'flex-start' }}>
            前往首页展示内容
          </Button>
          <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 0 }}>
            首页轮播已并入首页展示内容
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            现在首页这个位置不再单独维护图片或视频轮播，相关图片和点击后的去向已经统一合并到“首页展示内容”页的“首页固定展示图”模块。
          </Typography.Paragraph>
        </Space>
      </Card>

      <Card>
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Typography.Text strong>现在去哪里改？</Typography.Text>
          <Typography.Text type="secondary">请进入“首页展示内容”，在同一页内统一维护：</Typography.Text>
          <Typography.Text type="secondary">1. 首页首屏文案</Typography.Text>
          <Typography.Text type="secondary">2. 首页固定展示图</Typography.Text>
          <Typography.Text type="secondary">3. 首页特色入口</Typography.Text>
        </Space>
      </Card>
    </Space>
  );
}
