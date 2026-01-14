import { Button, Card, Col, Row, Space, Statistic, Typography, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type { components } from '@ipmoney/api-types';

import { apiGet } from '../lib/api';

type PagedUserVerification = components['schemas']['PagedUserVerification'];
type PagedListing = components['schemas']['PagedListing'];
type PagedOrder = components['schemas']['PagedOrder'];
type PatentMapSummaryItem = components['schemas']['PatentMapSummaryItem'];

export function DashboardPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingVerifications, setPendingVerifications] = useState<number | null>(null);
  const [pendingListings, setPendingListings] = useState<number | null>(null);
  const [ordersTotal, setOrdersTotal] = useState<number | null>(null);
  const [patentMapRegions, setPatentMapRegions] = useState<number | null>(null);
  const [patentMapTotal, setPatentMapTotal] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const results = await Promise.allSettled([
      apiGet<PagedUserVerification>('/admin/user-verifications', { status: 'PENDING', page: 1, pageSize: 1 }),
      apiGet<PagedListing>('/admin/listings', { auditStatus: 'PENDING', page: 1, pageSize: 1 }),
      apiGet<PagedOrder>('/orders', { page: 1, pageSize: 1 }),
      apiGet<PatentMapSummaryItem[]>('/patent-map/summary'),
    ]);

    const errors: string[] = [];

    const [rV, rL, rO, rM] = results;
    if (rV.status === 'fulfilled') setPendingVerifications(rV.value.page.total);
    else errors.push('认证审核数据加载失败');

    if (rL.status === 'fulfilled') setPendingListings(rL.value.page.total);
    else errors.push('上架审核数据加载失败');

    if (rO.status === 'fulfilled') setOrdersTotal(rO.value.page.total);
    else errors.push('订单数据加载失败');

    if (rM.status === 'fulfilled') {
      const arr = rM.value || [];
      setPatentMapRegions(arr.length);
      setPatentMapTotal(arr.reduce((sum, x) => sum + (x.patentCount || 0), 0));
    } else {
      errors.push('专利地图数据加载失败');
    }

    if (errors.length) {
      const msg = errors.join('；');
      setError(msg);
      message.warning(msg);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(
    () => [
      { title: '待审核认证', value: pendingVerifications, onClick: () => navigate('/verifications') },
      { title: '待审核上架', value: pendingListings, onClick: () => navigate('/listings') },
      { title: '订单总数', value: ordersTotal, onClick: () => navigate('/orders') },
      { title: '地图区域数', value: patentMapRegions, onClick: () => navigate('/patent-map') },
    ],
    [navigate, ordersTotal, patentMapRegions, pendingListings, pendingVerifications],
  );

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card>
        <Typography.Title level={3} style={{ marginTop: 0 }}>
          仪表盘
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          演示：关键指标 + 快捷入口；数据来自 Mock fixtures（随场景切换）。
        </Typography.Paragraph>
      </Card>

      <Row gutter={[16, 16]}>
        {stats.map((s) => (
          <Col key={s.title} xs={24} sm={12} lg={6}>
            <Card hoverable onClick={s.onClick} loading={loading}>
              <Statistic value={s.value ?? '-'} title={s.title} />
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card loading={loading}>
            <Typography.Title level={4} style={{ marginTop: 0 }}>
              资金与履约（P0 口径）
            </Typography.Title>
            <Typography.Paragraph type="secondary">
              订金/尾款均在平台托管；合同线下签署后由运营确认里程碑；放款以“变更完成确认”为准（P0 默认人工放款回传凭证）。
            </Typography.Paragraph>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              地图专利总量（示例）：{patentMapTotal ?? '-'}
            </Typography.Paragraph>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card loading={loading}>
            <Typography.Title level={4} style={{ marginTop: 0 }}>
              快捷入口
            </Typography.Title>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button type="primary" block onClick={() => navigate('/verifications')}>
                认证审核
              </Button>
              <Button block onClick={() => navigate('/listings')}>
                上架审核
              </Button>
              <Button block onClick={() => navigate('/config')}>
                交易/推荐配置
              </Button>
              <Button block onClick={() => navigate('/patent-map')}>
                专利地图 CMS
              </Button>
              <Button block onClick={load}>
                刷新
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>

      {error ? (
        <Card>
          <Typography.Text type="secondary">提示：{error}</Typography.Text>
        </Card>
      ) : null}
    </Space>
  );
}

