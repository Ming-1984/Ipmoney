import { Button, Card, Descriptions, Divider, Drawer, Input, InputNumber, Modal, Select, Space, Table, Tag, Typography, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { apiGet, apiPost, apiPut } from '../lib/api';
import { fenToYuan, formatTimeSmart } from '../lib/format';
import { auditStatusLabel, featuredLevelLabel, listingStatusLabel, tradeModeLabel } from '../lib/labels';
import { AuditHint, RequestErrorAlert } from '../ui/RequestState';
import { confirmActionWithReason } from '../ui/confirm';
import { modalBodyScrollStyle } from '../ui/modalStyles';

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

function auditTag(status: AuditStatus) {
  if (status === 'APPROVED') return <Tag color="green">{auditStatusLabel(status)}</Tag>;
  if (status === 'REJECTED') return <Tag color="red">{auditStatusLabel(status)}</Tag>;
  return <Tag color="orange">{auditStatusLabel(status)}</Tag>;
}

function listingTag(status: ListingStatus) {
  if (status === 'ACTIVE') return <Tag color="green">{listingStatusLabel(status)}</Tag>;
  if (status === 'OFF_SHELF') return <Tag>{listingStatusLabel(status)}</Tag>;
  if (status === 'SOLD') return <Tag color="blue">{listingStatusLabel(status)}</Tag>;
  return <Tag>{listingStatusLabel(status)}</Tag>;
}

export function ListingsAuditPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [data, setData] = useState<PagedListing | null>(null);
  const [q, setQ] = useState('');
  const [regionCode, setRegionCode] = useState('');
  const [auditStatus, setAuditStatus] = useState<AuditStatus | ''>('PENDING');
  const [status, setStatus] = useState<ListingStatus | ''>('');
  const [featureModalOpen, setFeatureModalOpen] = useState(false);
  const [featureSaving, setFeatureSaving] = useState(false);
  const [featureTarget, setFeatureTarget] = useState<Listing | null>(null);
  const [featureLevel, setFeatureLevel] = useState<FeaturedLevel>('NONE');
  const [featureRegionCode, setFeatureRegionCode] = useState('');
  const [featureRank, setFeatureRank] = useState<number>(0);
  const [featureUntilIso, setFeatureUntilIso] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detail, setDetail] = useState<Listing | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<PagedListing>('/admin/listings', {
        q: q.trim() || undefined,
        regionCode: regionCode.trim() || undefined,
        auditStatus: auditStatus || undefined,
        status: status || undefined,
        page: 1,
        pageSize: 10,
      });
      setData(d);
    } catch (e: any) {
      setError(e);
      message.error(e?.message || '加载失败');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [auditStatus, q, regionCode, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => data?.items || [], [data?.items]);

  const openDetail = useCallback(async (row: Listing) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError(null);
    setDetail(row);
    try {
      const d = await apiGet<Listing>(`/admin/listings/${row.id}`);
      setDetail(d);
    } catch (e: any) {
      setDetailError(e?.message || '加载失败');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  return (
    <Card>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Typography.Title level={3} style={{ marginTop: 0 }}>
            上架审核
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            审核通过后对外展示；驳回需填写原因并留痕。
          </Typography.Paragraph>
        </div>

        {error ? <RequestErrorAlert error={error} onRetry={load} /> : <AuditHint text="审核通过后才会在小程序端对外展示；驳回请填写原因并留痕。" />}

        <Space wrap size={12}>
          <Input
            value={q}
            style={{ width: 220 }}
            placeholder="关键词（标题/申请号/发明人等）"
            allowClear
            onChange={(e) => setQ(e.target.value)}
            onPressEnter={() => void load()}
          />
          <Input
            value={regionCode}
            style={{ width: 180 }}
            placeholder="地区编码（6 位 adcode）"
            allowClear
            inputMode="numeric"
            onChange={(e) => setRegionCode(e.target.value)}
            onPressEnter={() => void load()}
          />
          <Select
            value={auditStatus}
            style={{ width: 160 }}
            placeholder="审核状态"
            onChange={(v) => setAuditStatus((v as AuditStatus) || '')}
            options={[
              { value: '', label: '全部审核状态' },
              { value: 'PENDING', label: '待审核' },
              { value: 'APPROVED', label: '已通过' },
              { value: 'REJECTED', label: '已驳回' },
            ]}
          />
          <Select
            value={status}
            style={{ width: 160 }}
            placeholder="上架状态"
            onChange={(v) => setStatus((v as ListingStatus) || '')}
            options={[
              { value: '', label: '全部上架状态' },
              { value: 'DRAFT', label: '草稿' },
              { value: 'ACTIVE', label: '上架中' },
              { value: 'OFF_SHELF', label: '已下架' },
              { value: 'SOLD', label: '已售出' },
            ]}
          />
          <Button onClick={load}>查询</Button>
        </Space>

        <Table<Listing>
          rowKey="id"
          loading={loading}
          dataSource={rows}
          pagination={false}
          columns={[
            { title: '标题', dataIndex: 'title' },
            { title: '类型', dataIndex: 'tradeMode', render: (v) => tradeModeLabel(v) },
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
            { title: '状态', dataIndex: 'status', render: (_, r) => listingTag(r.status) },
            { title: '审核状态', dataIndex: 'auditStatus', render: (_, r) => auditTag(r.auditStatus) },
            { title: '创建时间', dataIndex: 'createdAt', render: (v) => formatTimeSmart(v) },
            {
              title: '操作',
              key: 'actions',
              render: (_, r) => {
                const disabled = r.auditStatus !== 'PENDING';
                return (
                  <Space>
                    <Button onClick={() => void openDetail(r)}>详情</Button>
                    <Button
                      type="primary"
                      disabled={disabled}
                      onClick={async () => {
                        const { ok } = await confirmActionWithReason({
                          title: '确认通过该上架？',
                          content: '通过后将对外展示；该操作应记录审计留痕。',
                          okText: '通过',
                          defaultReason: '通过',
                          reasonLabel: '审批备注（建议填写）',
                          reasonHint: '建议写明核验点：权属材料、价格/订金合理性、是否重复上架等。',
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
                        const { ok, reason } = await confirmActionWithReason({
                          title: '确认驳回该上架？',
                          content: '驳回原因会对卖家可见，请尽量写清楚需要补充/修改的内容。',
                          okText: '驳回',
                          danger: true,
                          reasonLabel: '驳回原因',
                          reasonPlaceholder: '例：权属证明不完整；申请号/权利人信息缺失；价格明显异常；涉嫌重复/冒用等。',
                          reasonRequired: true,
                        });
                        if (!ok) return;
                        try {
                          await apiPost(`/admin/listings/${r.id}/reject`, { reason: reason || '不符合规范' });
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

      <Drawer
        title="上架详情"
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={520}
        destroyOnClose
      >
        {detailError ? (
          <Typography.Text type="danger">{detailError}</Typography.Text>
        ) : (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            {detailLoading ? <Typography.Text type="secondary">加载中...</Typography.Text> : null}
            <Descriptions size="small" column={1} bordered>
              <Descriptions.Item label="上架ID">{detail?.id || '-'}</Descriptions.Item>
              <Descriptions.Item label="标题">{detail?.title || '-'}</Descriptions.Item>
              <Descriptions.Item label="类型">{detail?.tradeMode ? tradeModeLabel(detail.tradeMode) : '-'}</Descriptions.Item>
              <Descriptions.Item label="价格">
                {detail?.priceType === 'NEGOTIABLE'
                  ? '面议'
                  : detail?.priceAmountFen
                    ? `¥${fenToYuan(detail.priceAmountFen)}（固定）`
                    : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="订金">
                {detail?.depositAmountFen != null ? `¥${fenToYuan(detail.depositAmountFen)}` : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="地区">{detail?.regionCode || '-'}</Descriptions.Item>
              <Descriptions.Item label="状态">{detail ? listingTag(detail.status) : '-'}</Descriptions.Item>
              <Descriptions.Item label="审核状态">{detail ? auditTag(detail.auditStatus) : '-'}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{detail?.createdAt ? formatTimeSmart(detail.createdAt) : '-'}</Descriptions.Item>
            </Descriptions>

            <Divider />
            <Typography.Text strong>材料/附件</Typography.Text>
            <Typography.Text type="secondary">
              暂无材料列表；后续可接入后端接口展示权属材料/附件。
            </Typography.Text>

            <Divider />
            <Typography.Text strong>审核记录</Typography.Text>
            <Typography.Text type="secondary">驳回原因/审计日志可在此展示。</Typography.Text>
          </Space>
        )}
      </Drawer>

      <Modal
        open={featureModalOpen}
        title={featureTarget ? `特色置顶：${featureTarget.title}` : '特色置顶'}
        okText="保存"
        cancelText="取消"
        confirmLoading={featureSaving}
        bodyStyle={modalBodyScrollStyle}
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
