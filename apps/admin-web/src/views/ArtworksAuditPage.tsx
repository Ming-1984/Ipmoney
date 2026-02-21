import { Button, Card, Descriptions, Divider, Drawer, Form, Image, Input, InputNumber, Modal, Select, Space, Table, Tag, Typography, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type { components } from '@ipmoney/api-types';

import { apiGet, apiPatch, apiPost } from '../lib/api';
import { fenToYuan, fenToYuanNumber, formatTimeSmart, yuanToFen } from '../lib/format';
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
type AuditMaterial = {
  id: string;
  name: string;
  url?: string;
  kind?: string;
  uploadedAt?: string;
};
type AuditLog = {
  id: string;
  action: string;
  reason?: string;
  operatorName?: string;
  createdAt?: string;
};

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

const CATEGORY_OPTIONS: { value: components['schemas']['ArtworkCategory']; label: string }[] = [
  { value: 'CALLIGRAPHY', label: '书法' },
  { value: 'PAINTING', label: '绘画' },
];

const CALLIGRAPHY_OPTIONS: { value: components['schemas']['CalligraphyScript']; label: string }[] = [
  { value: 'KAISHU', label: '楷书' },
  { value: 'XINGSHU', label: '行书' },
  { value: 'CAOSHU', label: '草书' },
  { value: 'LISHU', label: '隶书' },
  { value: 'ZHUANSHU', label: '篆书' },
];

const PAINTING_OPTIONS: { value: components['schemas']['PaintingGenre']; label: string }[] = [
  { value: 'FIGURE', label: '人物' },
  { value: 'LANDSCAPE', label: '山水' },
  { value: 'BIRD_FLOWER', label: '花鸟' },
  { value: 'OTHER', label: '其他' },
];

const PRICE_TYPE_OPTIONS: { value: PriceType; label: string }[] = [
  { value: 'FIXED', label: '一口价' },
  { value: 'NEGOTIABLE', label: '面议' },
];

const STATUS_OPTIONS: { value: ArtworkStatus; label: string }[] = [
  { value: 'DRAFT', label: '草稿' },
  { value: 'ACTIVE', label: '上架' },
  { value: 'OFF_SHELF', label: '下架' },
  { value: 'SOLD', label: '已成交' },
];

const AUDIT_STATUS_OPTIONS: { value: AuditStatus; label: string }[] = [
  { value: 'PENDING', label: '待审核' },
  { value: 'APPROVED', label: '已通过' },
  { value: 'REJECTED', label: '已驳回' },
];

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
  const [materials, setMaterials] = useState<AuditMaterial[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Artwork | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

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

  const openCreate = useCallback(() => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ status: 'DRAFT', auditStatus: 'PENDING' });
    setModalOpen(true);
  }, [form]);

  const openEdit = useCallback(
    (item: Artwork) => {
      setEditing(item);
      form.setFieldsValue({
        title: item.title,
        category: item.category,
        creatorName: item.creatorName,
        calligraphyScript: item.calligraphyScript || undefined,
        paintingGenre: item.paintingGenre || undefined,
        priceType: item.priceType,
        priceAmountYuan: fenToYuanNumber(item.priceAmountFen),
        depositAmountYuan: fenToYuanNumber(item.depositAmountFen),
        regionCode: item.regionCode || undefined,
        material: item.material || undefined,
        size: item.size || undefined,
        description: item.description || undefined,
        status: item.status || 'DRAFT',
        auditStatus: item.auditStatus || 'PENDING',
      });
      setModalOpen(true);
    },
    [form],
  );

  const handleSubmit = useCallback(async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        title: String(values.title || '').trim(),
        category: values.category,
        creatorName: String(values.creatorName || '').trim(),
        calligraphyScript: values.calligraphyScript || undefined,
        paintingGenre: values.paintingGenre || undefined,
        priceType: values.priceType,
        priceAmountFen:
          values.priceType === 'NEGOTIABLE' || values.priceAmountYuan == null ? undefined : yuanToFen(values.priceAmountYuan),
        depositAmountFen: values.depositAmountYuan == null ? undefined : yuanToFen(values.depositAmountYuan),
        regionCode: values.regionCode ? String(values.regionCode).trim() : undefined,
        material: values.material ? String(values.material).trim() : undefined,
        size: values.size ? String(values.size).trim() : undefined,
        description: values.description ? String(values.description).trim() : undefined,
        status: values.status || undefined,
        auditStatus: values.auditStatus || undefined,
      };
      setSaving(true);
      if (editing) {
        await apiPatch(`/admin/artworks/${editing.id}`, payload, { idempotencyKey: `admin-artwork-${editing.id}` });
        message.success('已更新书画');
      } else {
        await apiPost('/admin/artworks', payload, { idempotencyKey: `admin-artwork-create-${Date.now()}` });
        message.success('已创建书画');
      }
      setModalOpen(false);
      void load();
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error(e?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  }, [editing, form, load]);

  const handlePublish = useCallback(
    async (item: Artwork) => {
      const { ok, reason } = await confirmActionWithReason({
        title: '确认上架该书画？',
        content: '上架后将对外展示并可被检索。',
        okText: '上架',
        reasonLabel: '上架备注（建议填写）',
      });
      if (!ok) return;
      try {
        await apiPost(`/admin/artworks/${item.id}/publish`, { reason: reason || undefined }, { idempotencyKey: `artwork-publish-${item.id}` });
        message.success('已上架');
        void load();
      } catch (e: any) {
        message.error(e?.message || '上架失败');
      }
    },
    [load],
  );

  const handleOffShelf = useCallback(
    async (item: Artwork) => {
      const { ok, reason } = await confirmActionWithReason({
        title: '确认下架该书画？',
        content: '下架后将不再对外展示。',
        okText: '下架',
        reasonLabel: '下架原因（建议填写）',
      });
      if (!ok) return;
      try {
        await apiPost(`/admin/artworks/${item.id}/off-shelf`, { reason: reason || undefined }, { idempotencyKey: `artwork-off-${item.id}` });
        message.success('已下架');
        void load();
      } catch (e: any) {
        message.error(e?.message || '下架失败');
      }
    },
    [load],
  );

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
          <Button type="primary" onClick={openCreate}>
            新建书画
          </Button>
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
                      onClick={async () => {
                        try {
                          const [detail, m, logs] = await Promise.all([
                            apiGet<Artwork>(`/admin/artworks/${r.id}`),
                            apiGet<{ items: AuditMaterial[] }>(`/admin/artworks/${r.id}/materials`),
                            apiGet<{ items: AuditLog[] }>(`/admin/artworks/${r.id}/audit-logs`),
                          ]);
                          setActive(detail);
                          setMaterials(m.items || []);
                          setAuditLogs(logs.items || []);
                          setDetailOpen(true);
                        } catch (e: any) {
                          message.error(e?.message || '加载材料/审核记录失败');
                        }
                      }}
                    >
                      详情
                    </Button>
                    <Button onClick={() => openEdit(r)}>编辑</Button>
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
                    <Button disabled={r.status === 'ACTIVE'} onClick={() => void handlePublish(r)}>
                      上架
                    </Button>
                    <Button disabled={r.status !== 'ACTIVE'} onClick={() => void handleOffShelf(r)}>
                      下架
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
              <Typography.Text strong>材料/附件</Typography.Text>
              {materials.length ? (
                <Space direction="vertical" size={8} style={{ width: '100%', marginTop: 8 }}>
                  {materials.map((m) => (
                    <Card key={m.id} size="small">
                      <Space direction="vertical" size={4}>
                        <Typography.Text>{m.name}</Typography.Text>
                        <Typography.Text type="secondary">
                          {m.kind || '-'} · {m.uploadedAt ? formatTimeSmart(m.uploadedAt) : '-'}
                        </Typography.Text>
                        {m.url ? (
                          <a href={m.url} target="_blank" rel="noreferrer">
                            查看附件
                          </a>
                        ) : null}
                      </Space>
                    </Card>
                  ))}
                </Space>
              ) : (
                <Typography.Text type="secondary">暂无材料。</Typography.Text>
              )}
            </div>

            <Divider />

            <div>
              <Typography.Text strong>审核记录</Typography.Text>
              {auditLogs.length ? (
                <Space direction="vertical" size={8} style={{ width: '100%', marginTop: 8 }}>
                  {auditLogs.map((log) => (
                    <Card key={log.id} size="small">
                      <Space direction="vertical" size={4}>
                        <Typography.Text>{log.action}</Typography.Text>
                        {log.reason ? <Typography.Text>{log.reason}</Typography.Text> : null}
                        <Typography.Text type="secondary">
                          {log.operatorName || '管理员'} · {log.createdAt ? formatTimeSmart(log.createdAt) : '-'}
                        </Typography.Text>
                      </Space>
                    </Card>
                  ))}
                </Space>
              ) : (
                <Typography.Text type="secondary">暂无审核记录。</Typography.Text>
              )}
            </div>
          </Space>
        ) : null}
      </Drawer>

      <Modal
        title={editing ? '编辑书画' : '新建书画'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        okText="保存"
        confirmLoading={saving}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="作品名称" name="title" rules={[{ required: true, message: '请输入作品名称' }]}>
            <Input placeholder="书画作品名称" />
          </Form.Item>
          <Form.Item label="类别" name="category" rules={[{ required: true, message: '请选择类别' }]}>
            <Select options={CATEGORY_OPTIONS} />
          </Form.Item>
          <Form.Item label="作者" name="creatorName" rules={[{ required: true, message: '请输入作者' }]}>
            <Input placeholder="作者姓名" />
          </Form.Item>
          <Form.Item label="书体" name="calligraphyScript">
            <Select allowClear options={CALLIGRAPHY_OPTIONS} placeholder="书体（可选）" />
          </Form.Item>
          <Form.Item label="题材" name="paintingGenre">
            <Select allowClear options={PAINTING_OPTIONS} placeholder="题材（可选）" />
          </Form.Item>
          <Form.Item label="报价方式" name="priceType" rules={[{ required: true, message: '请选择报价方式' }]}>
            <Select options={PRICE_TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item label="报价金额（元）" name="priceAmountYuan">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="一口价时填写" />
          </Form.Item>
          <Form.Item label="订金金额（元）" name="depositAmountYuan">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="可选" />
          </Form.Item>
          <Form.Item label="地区编码" name="regionCode">
            <Input placeholder="地区编码（6 位 adcode）" />
          </Form.Item>
          <Form.Item label="材质" name="material">
            <Input placeholder="如：宣纸" />
          </Form.Item>
          <Form.Item label="尺寸" name="size">
            <Input placeholder="如：四尺整张" />
          </Form.Item>
          <Form.Item label="作品介绍" name="description">
            <Input.TextArea rows={4} placeholder="作品介绍（可选）" />
          </Form.Item>
          <Form.Item label="内容状态" name="status">
            <Select options={STATUS_OPTIONS} />
          </Form.Item>
          <Form.Item label="审核状态" name="auditStatus">
            <Select options={AUDIT_STATUS_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
