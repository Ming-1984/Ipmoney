import { Button, Card, Input, InputNumber, Modal, Select, Space, Table, Tag, Typography, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { apiGet, apiPost, apiPut } from '../lib/api';
import { AuditHint, RequestErrorAlert } from '../ui/RequestState';
import { confirmAction } from '../ui/confirm';

type AuditStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type ListingStatus = 'DRAFT' | 'ACTIVE' | 'OFF_SHELF' | 'SOLD';
type FeaturedLevel = 'NONE' | 'CITY' | 'PROVINCE';

type Listing = {
  id: string;
  title: string;
  auditStatus: AuditStatus;
  status: ListingStatus;
  regionCode?: string;
  depositAmountFen: number;
  priceType: 'FIXED' | 'NEGOTIABLE';
  priceAmountFen?: number;
  tradeMode: 'ASSIGNMENT' | 'LICENSE';
  createdAt: string;
  sellerUserId?: string;
  featuredLevel?: FeaturedLevel;
  featuredRegionCode?: string | null;
  featuredRank?: number | null;
  featuredUntil?: string | null;
};

type PagedListing = {
  items: Listing[];
  page: { page: number; pageSize: number; total: number };
};

function fenToYuan(fen?: number): string {
  if (fen === undefined || fen === null) return '-';
  return (fen / 100).toFixed(2);
}

function featuredLevelLabel(level?: FeaturedLevel): string {
  if (!level || level === 'NONE') return '无';
  if (level === 'PROVINCE') return '省级';
  if (level === 'CITY') return '市级';
  return String(level);
}

export function ListingsAuditPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PagedListing | null>(null);
  const [featureModalOpen, setFeatureModalOpen] = useState(false);
  const [featureSaving, setFeatureSaving] = useState(false);
  const [featureTarget, setFeatureTarget] = useState<Listing | null>(null);
  const [featureLevel, setFeatureLevel] = useState<FeaturedLevel>('NONE');
  const [featureRegionCode, setFeatureRegionCode] = useState('');
  const [featureRank, setFeatureRank] = useState<number>(0);
  const [featureUntilIso, setFeatureUntilIso] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<PagedListing>('/admin/listings', {
        auditStatus: 'PENDING',
        page: 1,
        pageSize: 10,
      });
      setData(d);
    } catch (e: any) {
      const msg = e?.message || '加载失败';
      setError(msg);
      message.error(msg);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => data?.items || [], [data?.items]);

  return (
    <Card>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Typography.Title level={3} style={{ marginTop: 0 }}>
            上架审核（演示）
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            演示审核通过/驳回与留痕（原因输入）。
          </Typography.Paragraph>
        </div>

        {error ? <RequestErrorAlert error={error} onRetry={load} /> : <AuditHint text="审核通过后才会在小程序端对外展示；驳回请填写原因并留痕。" />}

        <Table<Listing>
          rowKey="id"
          loading={loading}
          dataSource={rows}
          pagination={false}
          columns={[
            { title: '标题', dataIndex: 'title' },
            { title: '类型', dataIndex: 'tradeMode' },
            {
              title: '价格',
              key: 'price',
              render: (_, r) =>
                r.priceType === 'NEGOTIABLE' ? '面议' : `¥${fenToYuan(r.priceAmountFen)}（固定）`,
            },
            { title: '订金', dataIndex: 'depositAmountFen', render: (v) => `¥${fenToYuan(v)}` },
            {
              title: '特色',
              key: 'featured',
              render: (_, r) => {
                const lvl = r.featuredLevel;
                if (!lvl || lvl === 'NONE') return <Typography.Text type="secondary">-</Typography.Text>;
                return (
                  <Space size={6}>
                    <Tag color="orange">{featuredLevelLabel(lvl)}</Tag>
                    <Typography.Text type="secondary">{r.featuredRegionCode || r.regionCode || '-'}</Typography.Text>
                    {typeof r.featuredRank === 'number' ? (
                      <Typography.Text type="secondary">#{r.featuredRank}</Typography.Text>
                    ) : null}
                  </Space>
                );
              },
            },
            { title: '状态', dataIndex: 'status' },
            { title: '审核状态', dataIndex: 'auditStatus' },
            { title: '创建时间', dataIndex: 'createdAt' },
            {
              title: '操作',
              key: 'actions',
              render: (_, r) => {
                const disabled = r.auditStatus !== 'PENDING';
                return (
                  <Space>
                    <Button
                      type="primary"
                      disabled={disabled}
                      onClick={async () => {
                        const ok = await confirmAction({
                          title: '确认通过该上架？',
                          content: '通过后将对外展示；该操作应记录审计留痕。',
                          okText: '通过',
                        });
                        if (!ok) return;
                        try {
                          await apiPost(`/admin/listings/${r.id}/approve`, {});
                          message.success('已通过');
                          void load();
                        } catch (e: any) {
                          message.error(e?.message || '操作失败');
                        }
                      }}
                    >
                      通过
                    </Button>
                    <Button
                      danger
                      disabled={disabled}
                      onClick={async () => {
                        const reason = await new Promise<string | null>((resolve) => {
                          let value = '';
                          Modal.confirm({
                            title: '驳回原因',
                            content: (
                              <textarea
                                style={{ width: '100%', minHeight: 96 }}
                                placeholder="请输入驳回原因（演示）"
                                onChange={(e) => {
                                  value = e.target.value;
                                }}
                              />
                            ),
                            okText: '驳回',
                            cancelText: '取消',
                            okButtonProps: { danger: true },
                            onOk: () => resolve(value || '不符合规范（演示）'),
                            onCancel: () => resolve(null),
                          });
                        });
                        if (!reason) return;
                        try {
                          await apiPost(`/admin/listings/${r.id}/reject`, { reason });
                          message.success('已驳回');
                          void load();
                        } catch (e: any) {
                          message.error(e?.message || '操作失败');
                        }
                      }}
                    >
                      驳回
                    </Button>
                    <Button
                      onClick={() => {
                        setFeatureTarget(r);
                        const lvl = (r.featuredLevel || 'NONE') as FeaturedLevel;
                        setFeatureLevel(lvl);
                        setFeatureRegionCode(String(r.featuredRegionCode || r.regionCode || ''));
                        setFeatureRank(typeof r.featuredRank === 'number' ? r.featuredRank : 0);
                        setFeatureUntilIso(r.featuredUntil ? String(r.featuredUntil) : null);
                        setFeatureModalOpen(true);
                      }}
                    >
                      特色置顶
                    </Button>
                  </Space>
                );
              },
            },
          ]}
        />

        <Button onClick={load}>刷新</Button>
      </Space>

      <Modal
        open={featureModalOpen}
        title={featureTarget ? `特色置顶：${featureTarget.title}` : '特色置顶'}
        okText="保存"
        cancelText="取消"
        confirmLoading={featureSaving}
        onCancel={() => setFeatureModalOpen(false)}
        onOk={async () => {
          if (!featureTarget) return;
          if (featureLevel !== 'NONE' && !/^[0-9]{6}$/.test(featureRegionCode.trim())) {
            message.error('请填写 6 位地区编码（adcode）');
            return;
          }

          setFeatureSaving(true);
          try {
            const payload: any = { featuredLevel: featureLevel };
            if (featureLevel !== 'NONE') {
              payload.featuredRegionCode = featureRegionCode.trim();
              payload.featuredRank = featureRank;
              if (featureUntilIso) payload.featuredUntil = featureUntilIso;
            }
            await apiPut(`/admin/listings/${featureTarget.id}/featured`, payload, {
              idempotencyKey: `featured-${featureTarget.id}-${featureLevel}-${featureRank}`,
            });
            message.success('已更新');
            setFeatureModalOpen(false);
            void load();
          } catch (e: any) {
            message.error(e?.message || '保存失败');
          } finally {
            setFeatureSaving(false);
          }
        }}
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            省/市级特色产业专利用于首页与搜索加权展示；Level=NONE 表示取消。
          </Typography.Paragraph>

          <Select
            value={featureLevel}
            style={{ width: '100%' }}
            options={[
              { value: 'NONE', label: '无（取消）' },
              { value: 'PROVINCE', label: '省级特色' },
              { value: 'CITY', label: '市级特色' },
            ]}
            onChange={(v) => setFeatureLevel(v as FeaturedLevel)}
          />

          <Input
            disabled={featureLevel === 'NONE'}
            value={featureRegionCode}
            placeholder="生效地区编码 adcode（例：110000）"
            onChange={(e) => setFeatureRegionCode(e.target.value)}
          />

          <Space>
            <Typography.Text>排序</Typography.Text>
            <InputNumber
              disabled={featureLevel === 'NONE'}
              value={featureRank}
              min={0}
              onChange={(v) => setFeatureRank(Number(v || 0))}
            />
          </Space>

          <Space>
            <Typography.Text>过期</Typography.Text>
            <Input
              disabled={featureLevel === 'NONE'}
              value={featureUntilIso || ''}
              placeholder="可选（ISO8601，如 2026-02-01T00:00:00Z）"
              onChange={(e) => setFeatureUntilIso(e.target.value.trim() || null)}
              style={{ width: 320 }}
            />
          </Space>
        </Space>
      </Modal>
    </Card>
  );
}
