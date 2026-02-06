import { Button, Card, Descriptions, Divider, Drawer, Image, Input, Select, Space, Table, Tag, Typography, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type { components } from '@ipmoney/api-types';

import { apiGet, apiPost } from '../lib/api';
import { fenToYuan, formatTimeSmart } from '../lib/format';
import {
  auditStatusLabel,
  artworkCategoryLabel,
  artworkStatusLabel,
  calligraphyScriptLabel,
  paintingGenreLabel,
  priceTypeLabel,
} from '../lib/labels';
import { AuditHint, RequestErrorAlert } from '../ui/RequestState';
import { confirmActionWithReason } from '../ui/confirm';

type Artwork = components['schemas']['Artwork'];
type PagedArtwork = components['schemas']['PagedArtwork'];
type AuditStatus = components['schemas']['AuditStatus'];
type ArtworkStatus = components['schemas']['ArtworkStatus'];
type PriceType = components['schemas']['PriceType'];

function auditTag(status: AuditStatus) {
  if (status === 'APPROVED') return <Tag color="green">{auditStatusLabel(status)}</Tag>;
  if (status === 'REJECTED') return <Tag color="red">{auditStatusLabel(status)}</Tag>;
  return <Tag color="orange">{auditStatusLabel(status)}</Tag>;
}

function statusTag(status: ArtworkStatus) {
  if (status === 'ACTIVE') return <Tag color="green">{artworkStatusLabel(status)}</Tag>;
  if (status === 'OFF_SHELF') return <Tag>{artworkStatusLabel(status)}</Tag>;
  if (status === 'SOLD') return <Tag color="blue">{artworkStatusLabel(status)}</Tag>;
  return <Tag>{artworkStatusLabel(status)}</Tag>;
}

function priceLabel(priceType?: PriceType | null, priceAmountFen?: number | null): string {
  if (!priceType) return '-';
  if (priceType === 'NEGOTIABLE') return '面议';
  return priceAmountFen !== undefined && priceAmountFen !== null ? `¥${fenToYuan(priceAmountFen)}` : '-';
}

export function ArtworksAuditPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [data, setData] = useState<PagedArtwork | null>(null);
  const [q, setQ] = useState('');
  const [regionCode, setRegionCode] = useState('');
  const [auditStatus, setAuditStatus] = useState<AuditStatus | ''>('PENDING');
  const [status, setStatus] = useState<ArtworkStatus | ''>('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [active, setActive] = useState<Artwork | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<PagedArtwork>('/admin/artworks', {
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
            书画审核
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            审核通过后对外展示，驳回需填写原因并留痕。
          </Typography.Paragraph>
        </div>

        {error ? <RequestErrorAlert error={error} onRetry={load} /> : <AuditHint text="审核通过后才会进入前台检索；驳回需填写原因。" />}

        <Space wrap size={12}>
          <Input
            value={q}
            style={{ width: 220 }}
            placeholder="关键词（作品名/作者/证书号）"
            allowClear
            onChange={(e) => setQ(e.target.value)}
            onPressEnter={() => void load()}
          />
          <Input
            value={regionCode}
            style={{ width: 180 }}
            placeholder="地区编码（adcode）"
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
            onChange={(v) => setStatus((v as ArtworkStatus) || '')}
            options={[
              { value: '', label: '全部上架状态' },
              { value: 'DRAFT', label: '草稿' },
              { value: 'ACTIVE', label: '已上架' },
              { value: 'OFF_SHELF', label: '已下架' },
              { value: 'SOLD', label: '已成交' },
            ]}
          />
          <Button onClick={load}>查询</Button>
        </Space>

        <Table<Artwork>
          rowKey="id"
          loading={loading}
          dataSource={rows}
          pagination={false}
          columns={[
            { title: '作品名称', dataIndex: 'title', render: (v) => v || '-' },
            { title: '类别', dataIndex: 'category', render: (v) => artworkCategoryLabel(v) },
            { title: '作者', dataIndex: 'creatorName', render: (v) => v || '-' },
            {
              title: '报价',
              key: 'price',
              render: (_, r) => `${priceTypeLabel(r.priceType)} · ${priceLabel(r.priceType, r.priceAmountFen)}`,
            },
            { title: '订金', dataIndex: 'depositAmountFen', render: (v) => (v ? `¥${fenToYuan(v)}` : '-') },
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
                          title: '确认通过该书画？',
                          content: '通过后将对外展示，需记录审核留痕。',
                          okText: '通过',
                          defaultReason: '通过',
                          reasonLabel: '审核备注（建议填写）',
                          reasonHint: '建议说明核验点：权属材料、证书编号、图片合规等。',
                        });
                        if (!ok) return;
                        try {
                          await apiPost(`/admin/artworks/${r.id}/approve`, {});
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
                          title: '确认驳回该书画？',
                          content: '驳回原因会对发布者可见，请清晰说明需补充的材料。',
                          okText: '驳回',
                          danger: true,
                          reasonLabel: '驳回原因',
                          reasonPlaceholder: '例：证书编号不完整/权属材料不清晰/图片不合规等。',
                          reasonRequired: true,
                        });
                        if (!ok) return;
                        try {
                          await apiPost(`/admin/artworks/${r.id}/reject`, { reason: reason || '不符合规范' });
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
      </Space>

      <Drawer
        title={active?.title ? `书画详情：${active.title}` : '书画详情'}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={760}
        destroyOnClose
      >
        {active ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Descriptions size="small" column={1} bordered>
              <Descriptions.Item label="书画ID">{active.id}</Descriptions.Item>
              <Descriptions.Item label="来源">{active.source || '-'}</Descriptions.Item>
              <Descriptions.Item label="作者">{active.creatorName || '-'}</Descriptions.Item>
              <Descriptions.Item label="类别">{artworkCategoryLabel(active.category)}</Descriptions.Item>
              <Descriptions.Item label="书体">{calligraphyScriptLabel(active.calligraphyScript)}</Descriptions.Item>
              <Descriptions.Item label="题材">{paintingGenreLabel(active.paintingGenre)}</Descriptions.Item>
              <Descriptions.Item label="创作日期">{active.creationDate || '-'}</Descriptions.Item>
              <Descriptions.Item label="创作年份">{active.creationYear || '-'}</Descriptions.Item>
              <Descriptions.Item label="证书编号">{active.certificateNo || '-'}</Descriptions.Item>
              <Descriptions.Item label="地区">{active.regionCode || '-'}</Descriptions.Item>
              <Descriptions.Item label="材质">{active.material || '-'}</Descriptions.Item>
              <Descriptions.Item label="尺寸">{active.size || '-'}</Descriptions.Item>
              <Descriptions.Item label="价格">
                {priceTypeLabel(active.priceType)} · {priceLabel(active.priceType, active.priceAmountFen)}
              </Descriptions.Item>
              <Descriptions.Item label="订金">
                {active.depositAmountFen ? `¥${fenToYuan(active.depositAmountFen)}` : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Space wrap>
                  {statusTag(active.status)}
                  {auditTag(active.auditStatus)}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">{formatTimeSmart(active.createdAt)}</Descriptions.Item>
              <Descriptions.Item label="更新时间">{formatTimeSmart(active.updatedAt)}</Descriptions.Item>
            </Descriptions>

            <div>
              <Typography.Text strong>证书材料</Typography.Text>
              <div style={{ marginTop: 8 }}>
                {active.certificateFileIds?.length ? (
                  <Space wrap>
                    {active.certificateFileIds.map((id) => (
                      <Tag key={id}>{id}</Tag>
                    ))}
                  </Space>
                ) : (
                  <Typography.Text type="secondary">-</Typography.Text>
                )}
              </div>
            </div>

            <div>
              <Typography.Text strong>作品介绍</Typography.Text>
              <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
                {active.description || '-'}
              </Typography.Paragraph>
            </div>

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

            <Divider />

            <div>
              <Typography.Text strong>审核记录</Typography.Text>
              <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
                驳回原因/审计日志可在此展示（需后端支持）。
              </Typography.Paragraph>
            </div>
          </Space>
        ) : null}
      </Drawer>
    </Card>
  );
}
