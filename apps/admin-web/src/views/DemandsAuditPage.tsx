import { Button, Card, Descriptions, Divider, Drawer, Image, Input, Select, Space, Table, Tag, Typography, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type { components } from '@ipmoney/api-types';

import { apiGet, apiPost } from '../lib/api';
import { fenToYuan, formatTimeSmart } from '../lib/format';
import { auditStatusLabel, contentStatusLabel, deliveryPeriodLabel } from '../lib/labels';
import { AuditHint, RequestErrorAlert } from '../ui/RequestState';
import { confirmActionWithReason } from '../ui/confirm';

type Demand = components['schemas']['Demand'];
type PagedDemand = components['schemas']['PagedDemand'];
type AuditStatus = components['schemas']['AuditStatus'];
type ContentStatus = components['schemas']['ContentStatus'];
type PriceType = components['schemas']['PriceType'];
type CooperationMode = components['schemas']['CooperationMode'];

function statusTag(status: ContentStatus) {
  if (status === 'ACTIVE') return <Tag color="green">{contentStatusLabel(status)}</Tag>;
  if (status === 'OFF_SHELF') return <Tag>{contentStatusLabel(status)}</Tag>;
  return <Tag color="default">{contentStatusLabel(status)}</Tag>;
}

function auditTag(status: AuditStatus) {
  if (status === 'APPROVED') return <Tag color="green">{auditStatusLabel(status)}</Tag>;
  if (status === 'REJECTED') return <Tag color="red">{auditStatusLabel(status)}</Tag>;
  return <Tag color="orange">{auditStatusLabel(status)}</Tag>;
}

function budgetLabel(it: Pick<Demand, 'budgetType' | 'budgetMinFen' | 'budgetMaxFen'>): string {
  const type = it.budgetType as PriceType | undefined;
  if (!type) return '-';
  if (type === 'NEGOTIABLE') return '面议';
  const min = it.budgetMinFen;
  const max = it.budgetMaxFen;
  if (min !== undefined && min !== null && max !== undefined && max !== null) return `¥${fenToYuan(min)}–¥${fenToYuan(max)}`;
  if (min !== undefined && min !== null) return `≥¥${fenToYuan(min)}`;
  if (max !== undefined && max !== null) return `≤¥${fenToYuan(max)}`;
  return '固定';
}

function cooperationModeLabel(mode: CooperationMode): string {
  if (mode === 'TRANSFER') return '专利转让';
  if (mode === 'TECH_CONSULTING') return '技术咨询';
  if (mode === 'COMMISSIONED_DEV') return '委托开发';
  if (mode === 'PLATFORM_CO_BUILD') return '平台共建';
  return '其他';
}

export function DemandsAuditPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [data, setData] = useState<PagedDemand | null>(null);
  const [q, setQ] = useState('');
  const [regionCode, setRegionCode] = useState('');
  const [auditStatus, setAuditStatus] = useState<AuditStatus | ''>('PENDING');
  const [status, setStatus] = useState<ContentStatus | ''>('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [active, setActive] = useState<Demand | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<PagedDemand>('/admin/demands', {
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
  const detailMedia = useMemo(() => {
    if (!active?.media?.length) return [];
    return [...active.media].sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0));
  }, [active]);
  const detailImages = useMemo(() => detailMedia.filter((m) => m.type === 'IMAGE' && m.url), [detailMedia]);
  const detailVideos = useMemo(() => detailMedia.filter((m) => m.type === 'VIDEO' && m.url), [detailMedia]);
  const detailFiles = useMemo(() => detailMedia.filter((m) => m.type === 'FILE'), [detailMedia]);

  return (
    <Card>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Typography.Title level={3} style={{ marginTop: 0 }}>
            需求审核
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            对产学研需求进行审核；通过后将在小程序端可被检索与浏览。
          </Typography.Paragraph>
        </div>

        {error ? <RequestErrorAlert error={error} onRetry={load} /> : <AuditHint text="通过/驳回需留痕；驳回原因将对发布者可见。" />}

        <Space wrap size={12}>
          <Input
            value={q}
            style={{ width: 220 }}
            placeholder="关键词（标题/摘要等）"
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
            placeholder="内容状态"
            onChange={(v) => setStatus((v as ContentStatus) || '')}
            options={[
              { value: '', label: '全部内容状态' },
              { value: 'DRAFT', label: '草稿' },
              { value: 'ACTIVE', label: '上架中' },
              { value: 'OFF_SHELF', label: '已下架' },
            ]}
          />
          <Button onClick={load}>查询</Button>
        </Space>

        <Table<Demand>
          rowKey="id"
          loading={loading}
          dataSource={rows}
          pagination={false}
          columns={[
            { title: '标题', dataIndex: 'title' },
            { title: '预算', key: 'budget', render: (_, r) => budgetLabel(r) },
            { title: '发布方', key: 'publisher', render: (_, r) => r.publisher?.displayName || '-' },
            { title: '地区', dataIndex: 'regionCode', render: (v) => v || '-' },
            { title: '状态', dataIndex: 'status', render: (_, r) => statusTag(r.status) },
            { title: '审核', dataIndex: 'auditStatus', render: (_, r) => auditTag(r.auditStatus) },
            { title: '创建时间', dataIndex: 'createdAt', render: (v) => formatTimeSmart(v) },
            {
              title: '操作',
              key: 'actions',
              render: (_, r) => {
                const disabled = r.auditStatus !== 'PENDING';
                return (
                  <Space>
                    <Button
                      onClick={() => {
                        setActive(r);
                        setDetailOpen(true);
                      }}
                    >
                      详情
                    </Button>
                    <Button
                      type="primary"
                      disabled={disabled}
                      onClick={async () => {
                        const { ok } = await confirmActionWithReason({
                          title: '确认通过该需求？',
                          content: '通过后将对外展示并可被检索；该操作应记录审计留痕。',
                          okText: '通过',
                          defaultReason: '通过',
                          reasonLabel: '审批备注（建议填写）',
                          reasonHint: '建议写明核验点：标题/预算/合作方式/材料完整性等。',
                        });
                        if (!ok) return;
                        try {
                          await apiPost<Demand>(`/admin/demands/${r.id}/approve`, {});
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
                          title: '确认驳回该需求？',
                          content: '驳回原因会对发布者可见，请尽量写清楚需要补充/修改的内容。',
                          okText: '驳回',
                          danger: true,
                          reasonLabel: '驳回原因',
                          reasonPlaceholder: '例：需求描述不清晰；预算范围不合理；缺少关键材料/联系方式等。',
                          reasonRequired: true,
                        });
                        if (!ok) return;
                        try {
                          await apiPost<Demand>(`/admin/demands/${r.id}/reject`, { reason: reason || '不符合规范' });
                          message.success('已驳回');
                          void load();
                        } catch (e: any) {
                          message.error(e?.message || '操作失败');
                        }
                      }}
                    >
                      驳回
                    </Button>
                  </Space>
                );
              },
            },
          ]}
        />

        <Button onClick={load}>刷新</Button>

        <Drawer
          title={active?.title ? `需求详情：${active.title}` : '需求详情'}
          open={detailOpen}
          onClose={() => setDetailOpen(false)}
          width={760}
          destroyOnClose
        >
          {active ? (
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <Descriptions size="small" column={1} bordered>
                <Descriptions.Item label="需求ID">{active.id}</Descriptions.Item>
                <Descriptions.Item label="发布方">{active.publisher?.displayName || '-'}</Descriptions.Item>
                <Descriptions.Item label="地区">{active.regionCode || '-'}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Space wrap>
                    {statusTag(active.status)}
                    {auditTag(active.auditStatus)}
                  </Space>
                </Descriptions.Item>
                <Descriptions.Item label="创建时间">{formatTimeSmart(active.createdAt)}</Descriptions.Item>
                <Descriptions.Item label="更新时间">{formatTimeSmart(active.updatedAt)}</Descriptions.Item>
              </Descriptions>

              <Divider />

              <Descriptions size="small" column={1} bordered>
                <Descriptions.Item label="预算">{budgetLabel(active)}</Descriptions.Item>
                <Descriptions.Item label="合作方式">
                  {active.cooperationModes?.length ? (
                    <Space wrap>
                      {active.cooperationModes.map((mode) => (
                        <Tag key={mode}>{cooperationModeLabel(mode)}</Tag>
                      ))}
                    </Space>
                  ) : (
                    <Typography.Text type="secondary">-</Typography.Text>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="交付周期">{deliveryPeriodLabel(active.deliveryPeriod)}</Descriptions.Item>
              </Descriptions>

              <Divider />

              <Descriptions size="small" column={1} bordered>
                <Descriptions.Item label="产业标签">
                  {active.industryTags?.length ? (
                    <Space wrap>
                      {active.industryTags.map((tag) => (
                        <Tag key={tag}>{tag}</Tag>
                      ))}
                    </Space>
                  ) : (
                    <Typography.Text type="secondary">-</Typography.Text>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="关键词">
                  {active.keywords?.length ? (
                    <Space wrap>
                      {active.keywords.map((tag) => (
                        <Tag key={tag}>{tag}</Tag>
                      ))}
                    </Space>
                  ) : (
                    <Typography.Text type="secondary">-</Typography.Text>
                  )}
                </Descriptions.Item>
              </Descriptions>

              <Divider />

              <Descriptions size="small" column={1} bordered>
                <Descriptions.Item label="联系人">{active.contactName || '-'}</Descriptions.Item>
                <Descriptions.Item label="职务/部门">{active.contactTitle || '-'}</Descriptions.Item>
                <Descriptions.Item label="联系方式（脱敏）">{active.contactPhoneMasked || '-'}</Descriptions.Item>
              </Descriptions>

              <Divider />

              <div>
                <Typography.Text strong>摘要</Typography.Text>
                <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
                  {active.summary || '-'}
                </Typography.Paragraph>
              </div>

              <div>
                <Typography.Text strong>详情</Typography.Text>
                <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
                  {active.description || '-'}
                </Typography.Paragraph>
              </div>

              <Divider />

              <div>
                <Typography.Text strong>封面</Typography.Text>
                <div style={{ marginTop: 8 }}>
                  {active.coverUrl ? (
                    <Image src={active.coverUrl} width={200} height={120} style={{ objectFit: 'cover' }} />
                  ) : (
                    <Typography.Text type="secondary">-</Typography.Text>
                  )}
                </div>
              </div>

              <div>
                <Typography.Text strong>附件/媒体</Typography.Text>
                <div style={{ marginTop: 8 }}>
                  {detailImages.length ? (
                    <Image.PreviewGroup>
                      <Space wrap>
                        {detailImages.map((m) => (
                          <Image key={m.fileId} src={m.url} width={160} height={100} style={{ objectFit: 'cover' }} />
                        ))}
                      </Space>
                    </Image.PreviewGroup>
                  ) : (
                    <Typography.Text type="secondary">-</Typography.Text>
                  )}
                </div>
                {detailVideos.length ? (
                  <div style={{ marginTop: 12 }}>
                    <Space direction="vertical" size={12} style={{ width: '100%' }}>
                      {detailVideos.map((m) => (
                        <video key={m.fileId} src={m.url} controls style={{ width: '100%', maxWidth: 520 }} />
                      ))}
                    </Space>
                  </div>
                ) : null}
                {detailFiles.length ? (
                  <div style={{ marginTop: 12 }}>
                    <Space direction="vertical" size={8}>
                      {detailFiles.map((m) => (
                        <Typography.Link key={m.fileId} href={m.url || '#'} target="_blank" rel="noreferrer">
                          {m.url || m.fileId}
                        </Typography.Link>
                      ))}
                    </Space>
                  </div>
                ) : null}
              </div>
            </Space>
          ) : null}
        </Drawer>
      </Space>
    </Card>
  );
}
