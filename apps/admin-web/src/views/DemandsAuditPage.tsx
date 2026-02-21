import { Button, Card, Descriptions, Divider, Drawer, Form, Image, Input, InputNumber, Modal, Select, Space, Table, Tag, Typography, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type { components } from '@ipmoney/api-types';

import { apiGet, apiPatch, apiPost } from '../lib/api';
import { fenToYuan, fenToYuanNumber, formatTimeSmart, yuanToFen } from '../lib/format';
import { auditStatusLabel, contentStatusLabel, deliveryPeriodLabel } from '../lib/labels';
import { AuditHint, RequestErrorAlert } from '../ui/RequestState';
import { confirmActionWithReason } from '../ui/confirm';

type Demand = components['schemas']['Demand'];
type PagedDemand = components['schemas']['PagedDemand'];
type AuditStatus = components['schemas']['AuditStatus'];
type ContentStatus = components['schemas']['ContentStatus'];
type PriceType = components['schemas']['PriceType'];
type CooperationMode = components['schemas']['CooperationMode'];
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

function toTagInput(tags?: string[] | null) {
  return (tags || []).join(', ');
}

function parseTags(input?: string): string[] {
  return String(input || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const COOPERATION_OPTIONS: { value: CooperationMode; label: string }[] = [
  { value: 'TRANSFER', label: '专利转让' },
  { value: 'TECH_CONSULTING', label: '技术咨询' },
  { value: 'COMMISSIONED_DEV', label: '委托开发' },
  { value: 'PLATFORM_CO_BUILD', label: '平台共建' },
];

const PRICE_TYPE_OPTIONS: { value: PriceType; label: string }[] = [
  { value: 'FIXED', label: '固定预算' },
  { value: 'NEGOTIABLE', label: '面议' },
];

const DELIVERY_OPTIONS: { value: components['schemas']['DeliveryPeriod']; label: string }[] = [
  { value: 'WITHIN_1_MONTH', label: '≤1月' },
  { value: 'MONTH_1_3', label: '1-3月' },
  { value: 'MONTH_3_6', label: '3-6月' },
  { value: 'OVER_6_MONTHS', label: '≥6月' },
  { value: 'OTHER', label: '其他' },
];

const CONTENT_STATUS_OPTIONS: { value: ContentStatus; label: string }[] = [
  { value: 'DRAFT', label: '草稿' },
  { value: 'ACTIVE', label: '上架' },
  { value: 'OFF_SHELF', label: '下架' },
];

const AUDIT_STATUS_OPTIONS: { value: AuditStatus; label: string }[] = [
  { value: 'PENDING', label: '待审核' },
  { value: 'APPROVED', label: '已通过' },
  { value: 'REJECTED', label: '已驳回' },
];

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
  const [materials, setMaterials] = useState<AuditMaterial[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Demand | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

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

  const openCreate = useCallback(() => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ status: 'DRAFT', auditStatus: 'PENDING' });
    setModalOpen(true);
  }, [form]);

  const openEdit = useCallback(
    (item: Demand) => {
      setEditing(item);
      form.setFieldsValue({
        title: item.title,
        summary: item.summary || undefined,
        description: item.description || undefined,
        budgetType: item.budgetType || undefined,
        budgetMinYuan: fenToYuanNumber(item.budgetMinFen),
        budgetMaxYuan: fenToYuanNumber(item.budgetMaxFen),
        cooperationModes: item.cooperationModes || [],
        deliveryPeriod: item.deliveryPeriod || undefined,
        regionCode: item.regionCode || undefined,
        keywords: toTagInput(item.keywords),
        industryTags: toTagInput(item.industryTags),
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
      const budgetType = values.budgetType || undefined;
      const payload = {
        title: String(values.title || '').trim(),
        summary: values.summary ? String(values.summary).trim() : undefined,
        description: values.description ? String(values.description).trim() : undefined,
        budgetType,
        budgetMinFen:
          budgetType === 'NEGOTIABLE' || values.budgetMinYuan == null ? undefined : yuanToFen(values.budgetMinYuan),
        budgetMaxFen:
          budgetType === 'NEGOTIABLE' || values.budgetMaxYuan == null ? undefined : yuanToFen(values.budgetMaxYuan),
        cooperationModes: values.cooperationModes?.length ? values.cooperationModes : undefined,
        deliveryPeriod: values.deliveryPeriod || undefined,
        regionCode: values.regionCode ? String(values.regionCode).trim() : undefined,
        keywords: parseTags(values.keywords),
        industryTags: parseTags(values.industryTags),
        status: values.status || undefined,
        auditStatus: values.auditStatus || undefined,
      };
      setSaving(true);
      if (editing) {
        await apiPatch(`/admin/demands/${editing.id}`, payload, { idempotencyKey: `admin-demand-${editing.id}` });
        message.success('已更新需求');
      } else {
        await apiPost('/admin/demands', payload, { idempotencyKey: `admin-demand-create-${Date.now()}` });
        message.success('已创建需求');
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
    async (item: Demand) => {
      const { ok, reason } = await confirmActionWithReason({
        title: '确认上架该需求？',
        content: '上架后将对外展示并可被检索。',
        okText: '上架',
        reasonLabel: '上架备注（建议填写）',
      });
      if (!ok) return;
      try {
        await apiPost(`/admin/demands/${item.id}/publish`, { reason: reason || undefined }, { idempotencyKey: `demand-publish-${item.id}` });
        message.success('已上架');
        void load();
      } catch (e: any) {
        message.error(e?.message || '上架失败');
      }
    },
    [load],
  );

  const handleOffShelf = useCallback(
    async (item: Demand) => {
      const { ok, reason } = await confirmActionWithReason({
        title: '确认下架该需求？',
        content: '下架后将不再对外展示。',
        okText: '下架',
        reasonLabel: '下架原因（建议填写）',
      });
      if (!ok) return;
      try {
        await apiPost(`/admin/demands/${item.id}/off-shelf`, { reason: reason || undefined }, { idempotencyKey: `demand-off-${item.id}` });
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
          <Button type="primary" onClick={openCreate}>
            新建需求
          </Button>
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
                      onClick={async () => {
                        try {
                          const [detail, m, logs] = await Promise.all([
                            apiGet<Demand>(`/admin/demands/${r.id}`),
                            apiGet<{ items: AuditMaterial[] }>(`/admin/demands/${r.id}/materials`),
                            apiGet<{ items: AuditLog[] }>(`/admin/demands/${r.id}/audit-logs`),
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
      </Space>

      <Modal
        title={editing ? '编辑需求' : '新建需求'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        okText="保存"
        confirmLoading={saving}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="标题" name="title" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="需求标题" />
          </Form.Item>
          <Form.Item label="摘要" name="summary">
            <Input placeholder="摘要（可选）" />
          </Form.Item>
          <Form.Item label="详情" name="description">
            <Input.TextArea rows={4} placeholder="需求详情（可选）" />
          </Form.Item>
          <Form.Item label="预算类型" name="budgetType">
            <Select allowClear options={PRICE_TYPE_OPTIONS} placeholder="选择预算类型" />
          </Form.Item>
          <Form.Item label="预算下限（元）" name="budgetMinYuan">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="如 5 万" />
          </Form.Item>
          <Form.Item label="预算上限（元）" name="budgetMaxYuan">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="如 20 万" />
          </Form.Item>
          <Form.Item label="合作方式" name="cooperationModes">
            <Select mode="multiple" allowClear options={COOPERATION_OPTIONS} placeholder="选择合作方式" />
          </Form.Item>
          <Form.Item label="交付周期" name="deliveryPeriod">
            <Select allowClear options={DELIVERY_OPTIONS} placeholder="选择交付周期" />
          </Form.Item>
          <Form.Item label="地区编码" name="regionCode">
            <Input placeholder="地区编码（6 位 adcode）" />
          </Form.Item>
          <Form.Item label="产业标签（逗号分隔）" name="industryTags">
            <Input placeholder="如：新材料, 数字化" />
          </Form.Item>
          <Form.Item label="关键词（逗号分隔）" name="keywords">
            <Input placeholder="如：检测, 算法" />
          </Form.Item>
          <Form.Item label="内容状态" name="status">
            <Select options={CONTENT_STATUS_OPTIONS} />
          </Form.Item>
          <Form.Item label="审核状态" name="auditStatus">
            <Select options={AUDIT_STATUS_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
