import { Button, Card, Form, Input, Modal, Select, Space, Table, Tag, Typography, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { apiGet, apiPatch, apiPost } from '../lib/api';
import { formatTimeSmart } from '../lib/format';
import { displayAdminTitle, normalizeUserFacingText } from '../lib/userFacingText';
import { RequestErrorAlert } from '../ui/RequestState';
import { confirmActionWithReason } from '../ui/confirm';

type PatentType = 'INVENTION' | 'UTILITY_MODEL' | 'DESIGN';
type LegalStatus = 'PENDING' | 'GRANTED' | 'EXPIRED' | 'INVALIDATED' | 'UNKNOWN';
type SourcePrimary = 'USER' | 'ADMIN' | 'PROVIDER';

type Patent = {
  id: string;
  jurisdiction: 'CN';
  applicationNoNorm: string;
  applicationNoDisplay?: string;
  patentNoDisplay?: string;
  publicationNoDisplay?: string;
  grantPublicationNoDisplay?: string;
  patentType: PatentType;
  title: string;
  abstract?: string;
  inventorNames?: string[];
  assigneeNames?: string[];
  applicantNames?: string[];
  filingDate?: string;
  publicationDate?: string;
  grantDate?: string;
  legalStatus?: LegalStatus;
  sourcePrimary?: SourcePrimary;
  sourceUpdatedAt?: string;
  createdAt: string;
  updatedAt: string;
};

type PagedPatent = {
  items: Patent[];
  page: { page: number; pageSize: number; total: number };
};

type PatentNormalizeResponse = {
  inputType: 'APPLICATION_NO' | 'PATENT_NO' | 'PUBLICATION_NO';
  applicationNoNorm?: string;
  applicationNoDisplay?: string;
  patentNoDisplay?: string;
  publicationNoDisplay?: string;
  kindCode?: string;
  patentType?: PatentType;
  warnings?: string[];
};

type PatentFormValues = {
  applicationNoNorm?: string;
  applicationNoDisplay?: string;
  patentType?: PatentType;
  title?: string;
  abstract?: string;
  filingDate?: string;
  publicationDate?: string;
  grantDate?: string;
  legalStatus?: LegalStatus | '';
  sourcePrimary?: SourcePrimary | '';
  sourceUpdatedAt?: string;
  inventorNamesText?: string;
  assigneeNamesText?: string;
  applicantNamesText?: string;
};

type ModalMode = 'create' | 'edit';

const patentTypeOptions: Array<{ value: PatentType; label: string }> = [
  { value: 'INVENTION', label: '发明' },
  { value: 'UTILITY_MODEL', label: '实用新型' },
  { value: 'DESIGN', label: '外观设计' },
];

const legalStatusOptions: Array<{ value: LegalStatus | ''; label: string }> = [
  { value: '', label: '全部状态' },
  { value: 'PENDING', label: '审查中' },
  { value: 'GRANTED', label: '已授权' },
  { value: 'EXPIRED', label: '已失效' },
  { value: 'INVALIDATED', label: '已无效' },
  { value: 'UNKNOWN', label: '状态待确认' },
];

const sourcePrimaryOptions: Array<{ value: SourcePrimary; label: string }> = [
  { value: 'ADMIN', label: '后台录入' },
  { value: 'USER', label: '用户上传' },
  { value: 'PROVIDER', label: '外部数据源' },
];

function sourcePrimaryLabel(value?: SourcePrimary | null): string {
  if (value === 'ADMIN') return '后台录入';
  if (value === 'USER') return '用户上传';
  if (value === 'PROVIDER') return '外部数据源';
  return '来源待确认';
}

function patentNormalizeInputTypeLabel(value?: PatentNormalizeResponse['inputType'] | null): string {
  if (value === 'APPLICATION_NO') return '申请号';
  if (value === 'PATENT_NO') return '专利号';
  if (value === 'PUBLICATION_NO') return '公开号';
  return '号码类型待确认';
}

function parseNames(text?: string): string[] {
  const values = String(text || '')
    .split(/[\n,，;；、]/g)
    .map((item) => item.trim())
    .filter(Boolean);
  return Array.from(new Set(values));
}

function namesToText(values?: string[]): string {
  return (values || []).join('\n');
}

function typeTag(value: PatentType) {
  if (value === 'DESIGN') return <Tag color="purple">外观设计</Tag>;
  if (value === 'UTILITY_MODEL') return <Tag color="blue">实用新型</Tag>;
  return <Tag color="gold">发明</Tag>;
}

function legalStatusTag(value?: LegalStatus) {
  if (value === 'GRANTED') return <Tag color="green">已授权</Tag>;
  if (value === 'PENDING') return <Tag color="gold">审查中</Tag>;
  if (value === 'EXPIRED') return <Tag color="default">已失效</Tag>;
  if (value === 'INVALIDATED') return <Tag color="red">已无效</Tag>;
  if (value === 'UNKNOWN') return <Tag>状态待确认</Tag>;
  return <Typography.Text type="secondary">-</Typography.Text>;
}

function renderPatentNumber(value?: string, fallback?: string): string {
  return normalizeUserFacingText(value) || normalizeUserFacingText(fallback) || '-';
}

function patentIdentifiersText(row: Patent): string {
  const parts = [
    `申请号：${renderPatentNumber(row.applicationNoDisplay, row.applicationNoNorm)}`,
    row.publicationNoDisplay ? `公开号：${renderPatentNumber(row.publicationNoDisplay)}` : '',
    row.patentNoDisplay ? `专利号：${renderPatentNumber(row.patentNoDisplay)}` : '',
    row.grantPublicationNoDisplay ? `授权公告号：${renderPatentNumber(row.grantPublicationNoDisplay)}` : '',
  ].filter(Boolean);
  return parts.length ? parts.join(' / ') : '-';
}

export function PatentsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [data, setData] = useState<PagedPatent | null>(null);
  const [page, setPage] = useState(1);
  const [draftQ, setDraftQ] = useState('');
  const [draftPatentType, setDraftPatentType] = useState<PatentType | ''>('');
  const [draftLegalStatus, setDraftLegalStatus] = useState<LegalStatus | ''>('');
  const [draftSourcePrimary, setDraftSourcePrimary] = useState<SourcePrimary | ''>('');
  const [appliedQ, setAppliedQ] = useState('');
  const [appliedPatentType, setAppliedPatentType] = useState<PatentType | ''>('');
  const [appliedLegalStatus, setAppliedLegalStatus] = useState<LegalStatus | ''>('');
  const [appliedSourcePrimary, setAppliedSourcePrimary] = useState<SourcePrimary | ''>('');

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [editingPatentId, setEditingPatentId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [normalizeResult, setNormalizeResult] = useState<PatentNormalizeResponse | null>(null);
  const [form] = Form.useForm<PatentFormValues>();
  const loadSeqRef = useRef(0);
  const detailSeqRef = useRef(0);
  const editingPatentIdRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<PagedPatent>('/admin/patents', {
        q: appliedQ.trim() || undefined,
        patentType: appliedPatentType || undefined,
        legalStatus: appliedLegalStatus || undefined,
        sourcePrimary: appliedSourcePrimary || undefined,
        page,
        pageSize: 20,
      });
      if (seq !== loadSeqRef.current) return;
      setData(d);
    } catch (e: any) {
      if (seq !== loadSeqRef.current) return;
      setError(e);
      setData(null);
      message.error(e?.message || '加载失败');
    } finally {
      if (seq !== loadSeqRef.current) return;
      setLoading(false);
    }
  }, [appliedLegalStatus, appliedPatentType, appliedQ, appliedSourcePrimary, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyFilters = useCallback(() => {
    setPage(1);
    setAppliedQ(draftQ);
    setAppliedPatentType(draftPatentType);
    setAppliedLegalStatus(draftLegalStatus);
    setAppliedSourcePrimary(draftSourcePrimary);
  }, [draftLegalStatus, draftPatentType, draftQ, draftSourcePrimary]);

  const resetFilters = useCallback(() => {
    setPage(1);
    setDraftQ('');
    setDraftPatentType('');
    setDraftLegalStatus('');
    setDraftSourcePrimary('');
    setAppliedQ('');
    setAppliedPatentType('');
    setAppliedLegalStatus('');
    setAppliedSourcePrimary('');
  }, []);

  const rows = useMemo(() => data?.items || [], [data?.items]);

  const openCreate = useCallback(() => {
    detailSeqRef.current += 1;
    editingPatentIdRef.current = null;
    setModalMode('create');
    setEditingPatentId(null);
    setNormalizeResult(null);
    form.resetFields();
    form.setFieldsValue({ sourcePrimary: 'ADMIN' });
    setModalOpen(true);
  }, [form]);

  const openEdit = useCallback(
    async (patentId: string) => {
      const seq = ++detailSeqRef.current;
      editingPatentIdRef.current = patentId;
      setModalMode('edit');
      setEditingPatentId(patentId);
      setNormalizeResult(null);
      form.resetFields();
      setDetailLoading(true);
      setModalOpen(true);
      try {
        const detail = await apiGet<Patent>(`/admin/patents/${patentId}`);
        if (seq !== detailSeqRef.current || editingPatentIdRef.current !== patentId) return;
        form.setFieldsValue({
          applicationNoDisplay: detail.applicationNoDisplay || '',
          patentType: detail.patentType,
          title: detail.title,
          abstract: detail.abstract || '',
          filingDate: detail.filingDate || '',
          publicationDate: detail.publicationDate || '',
          grantDate: detail.grantDate || '',
          legalStatus: detail.legalStatus || '',
          sourcePrimary: detail.sourcePrimary || '',
          sourceUpdatedAt: detail.sourceUpdatedAt || '',
          inventorNamesText: namesToText(detail.inventorNames),
          assigneeNamesText: namesToText(detail.assigneeNames),
          applicantNamesText: namesToText(detail.applicantNames),
        });
      } catch (e: any) {
        if (seq !== detailSeqRef.current || editingPatentIdRef.current !== patentId) return;
        message.error(e?.message || '加载专利详情失败');
        setModalOpen(false);
      } finally {
        if (seq !== detailSeqRef.current || editingPatentIdRef.current !== patentId) return;
        setDetailLoading(false);
      }
    },
    [form],
  );

  const handleNormalize = useCallback(async () => {
    const values = form.getFieldsValue();
    const raw = String(values.applicationNoNorm || '').trim();
    if (!raw) {
      message.warning('请先填写申请号/专利号/公开号');
      return;
    }

    try {
      const normalized = await apiPost<PatentNormalizeResponse>('/patents/normalize', { raw });
      setNormalizeResult(normalized);
      const patch: Partial<PatentFormValues> = {};
      if (normalized.applicationNoNorm) patch.applicationNoNorm = normalized.applicationNoNorm;
      if (normalized.applicationNoDisplay) patch.applicationNoDisplay = normalized.applicationNoDisplay;
      if (normalized.patentType && !form.getFieldValue('patentType')) {
        patch.patentType = normalized.patentType;
      }
      form.setFieldsValue(patch);
      message.success('号码规范化完成');
    } catch (e: any) {
      message.error(e?.message || '号码规范化失败');
    }
  }, [form]);

  const handleSubmit = useCallback(async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      if (modalMode === 'create') {
        const applicationNoNorm = String(values.applicationNoNorm || '').trim();
        const title = String(values.title || '').trim();
        if (!applicationNoNorm || !title || !values.patentType) {
          message.error('请先补齐必填项');
          return;
        }

        const payload: Record<string, unknown> = {
          applicationNoNorm,
          patentType: values.patentType,
          title,
          sourcePrimary: values.sourcePrimary || 'ADMIN',
        };

        const applicationNoDisplay = String(values.applicationNoDisplay || '').trim();
        if (applicationNoDisplay) payload.applicationNoDisplay = applicationNoDisplay;

        const abstractText = String(values.abstract || '').trim();
        if (abstractText) payload.abstract = abstractText;

        const filingDate = String(values.filingDate || '').trim();
        const publicationDate = String(values.publicationDate || '').trim();
        const grantDate = String(values.grantDate || '').trim();
        const legalStatusValue = values.legalStatus || undefined;
        const sourceUpdatedAt = String(values.sourceUpdatedAt || '').trim();

        if (filingDate) payload.filingDate = filingDate;
        if (publicationDate) payload.publicationDate = publicationDate;
        if (grantDate) payload.grantDate = grantDate;
        if (legalStatusValue) payload.legalStatus = legalStatusValue;
        if (sourceUpdatedAt) payload.sourceUpdatedAt = sourceUpdatedAt;

        const inventorNames = parseNames(values.inventorNamesText);
        const assigneeNames = parseNames(values.assigneeNamesText);
        const applicantNames = parseNames(values.applicantNamesText);
        if (inventorNames.length) payload.inventorNames = inventorNames;
        if (assigneeNames.length) payload.assigneeNames = assigneeNames;
        if (applicantNames.length) payload.applicantNames = applicantNames;

        const { ok, reason } = await confirmActionWithReason({
          title: '确认创建专利主数据？',
          content: '创建后会进入后台专利主数据库，并用于挂牌与详情展示。',
          okText: '创建',
          reasonLabel: '变更原因（建议填写）',
        });
        if (!ok) return;
        if (reason) payload.reason = reason;

        await apiPost('/admin/patents', payload, { idempotencyKey: `admin-patent-create-${Date.now()}` });
        message.success('已创建专利主数据');
      } else {
        if (!editingPatentId || !values.patentType || !String(values.title || '').trim()) {
          message.error('缺少必要参数，无法保存');
          return;
        }

        const applicationNoDisplay = String(values.applicationNoDisplay || '').trim();
        const abstractText = String(values.abstract || '').trim();
        const filingDate = String(values.filingDate || '').trim();
        const publicationDate = String(values.publicationDate || '').trim();
        const grantDate = String(values.grantDate || '').trim();
        const sourceUpdatedAt = String(values.sourceUpdatedAt || '').trim();

        const payload: Record<string, unknown> = {
          applicationNoDisplay: applicationNoDisplay || null,
          patentType: values.patentType,
          title: String(values.title || '').trim(),
          abstract: abstractText || null,
          filingDate: filingDate || null,
          publicationDate: publicationDate || null,
          grantDate: grantDate || null,
          legalStatus: values.legalStatus || null,
          sourceUpdatedAt: sourceUpdatedAt || null,
          inventorNames: parseNames(values.inventorNamesText),
          assigneeNames: parseNames(values.assigneeNamesText),
          applicantNames: parseNames(values.applicantNamesText),
        };

        payload.sourcePrimary = values.sourcePrimary || null;

        const { ok, reason } = await confirmActionWithReason({
          title: '确认更新专利主数据？',
          content: '更新后将影响挂牌详情与后台检索结果。',
          okText: '保存',
          reasonLabel: '变更原因（建议填写）',
        });
        if (!ok) return;
        if (reason) payload.reason = reason;

        await apiPatch(`/admin/patents/${editingPatentId}`, payload, {
          idempotencyKey: `admin-patent-update-${editingPatentId}-${Date.now()}`,
        });
        message.success('已更新专利主数据');
      }

      setModalOpen(false);
      void load();
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error(e?.message || '保存失败');
    } finally {
      setSubmitting(false);
    }
  }, [editingPatentId, form, load, modalMode]);

  return (
    <Card className="admin-patents-page">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Typography.Title level={3} style={{ marginTop: 0 }}>
            专利主数据管理
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            维护后台专利主数据（录入/更新），并支持号码规范化校验。批量导入、认领审核、平台咨询在专用运营页面。
          </Typography.Paragraph>
        </div>

        <Space wrap>
          <Button onClick={() => navigate('/patents/operations')}>去批量运营</Button>
          <Button onClick={() => navigate('/patents/claims')}>去认领审核</Button>
          <Button onClick={() => navigate('/conversations/platform')}>去平台咨询会话</Button>
        </Space>

        {error ? <RequestErrorAlert error={error} onRetry={load} /> : null}

        <Space wrap size={12}>
          <Input
            value={draftQ}
            style={{ width: 260 }}
            placeholder="关键词（标题/申请号/权利人）"
            allowClear
            onChange={(e) => setDraftQ(e.target.value)}
            onPressEnter={applyFilters}
          />
          <Select
            value={draftPatentType}
            style={{ width: 180 }}
            placeholder="专利类型"
            onChange={(v) => setDraftPatentType((v as PatentType) || '')}
            options={[{ value: '', label: '全部类型' }, ...patentTypeOptions]}
          />
          <Select
            value={draftLegalStatus}
            style={{ width: 180 }}
            placeholder="法律状态"
            onChange={(v) => setDraftLegalStatus((v as LegalStatus) || '')}
            options={legalStatusOptions}
          />
          <Select
            value={draftSourcePrimary}
            style={{ width: 180 }}
            placeholder="数据来源"
            onChange={(v) => setDraftSourcePrimary((v as SourcePrimary) || '')}
            options={[{ value: '', label: '全部来源' }, ...sourcePrimaryOptions]}
          />
          <Button onClick={applyFilters}>查询</Button>
          <Button onClick={resetFilters}>
            重置
          </Button>
          <Button type="primary" onClick={openCreate}>
            新建专利
          </Button>
        </Space>

        <Table<Patent>
          rowKey="id"
          loading={loading}
          dataSource={rows}
          pagination={{
            current: data?.page.page || page,
            pageSize: data?.page.pageSize || 20,
            total: data?.page.total || 0,
            onChange: (next) => setPage(next),
          }}
          columns={[
            {
              title: '专利名称',
              dataIndex: 'title',
              ellipsis: true,
              render: (v: string, row: Patent) => (
                <Space direction="vertical" size={2}>
                  <Typography.Text>{displayAdminTitle(v, '未命名专利')}</Typography.Text>
                  <Typography.Text type="secondary">{patentIdentifiersText(row)}</Typography.Text>
                </Space>
              ),
            },
            {
              title: '类型',
              dataIndex: 'patentType',
              width: 120,
              render: (v: PatentType) => typeTag(v),
            },
            {
              title: '法律状态',
              dataIndex: 'legalStatus',
              width: 120,
              render: (v?: LegalStatus) => legalStatusTag(v),
            },
            {
              title: '权利人/申请人',
              key: 'parties',
              ellipsis: true,
              render: (_, r) => {
                const assignee = (r.assigneeNames || []).join('、');
                const applicant = (r.applicantNames || []).join('、');
                const text = assignee || applicant;
                return text ? text : '-';
              },
            },
            {
              title: '更新时间',
              dataIndex: 'updatedAt',
              width: 150,
              render: (v: string) => formatTimeSmart(v),
            },
            {
              title: '来源',
              dataIndex: 'sourcePrimary',
              width: 120,
              render: (v?: SourcePrimary) => sourcePrimaryLabel(v),
            },
            {
              title: '操作',
              key: 'actions',
              width: 120,
              render: (_, r) => (
                <Space>
                  <Button onClick={() => void openEdit(r.id)}>编辑</Button>
                </Space>
              ),
            },
          ]}
        />
      </Space>

      <Modal
        title={modalMode === 'create' ? '新建专利主数据' : '编辑专利主数据'}
        open={modalOpen}
        onCancel={() => {
          detailSeqRef.current += 1;
          editingPatentIdRef.current = null;
          setModalOpen(false);
        }}
        onOk={() => void handleSubmit()}
        okText={modalMode === 'create' ? '创建' : '保存'}
        confirmLoading={submitting}
        width={760}
        destroyOnClose
      >
        <Form form={form} layout="vertical" disabled={detailLoading || submitting}>
          {modalMode === 'create' ? (
            <>
              <Form.Item
                label="申请号（标准格式）"
                name="applicationNoNorm"
                rules={[{ required: true, message: '请输入申请号（标准格式）' }]}
              >
                <Input placeholder="如：2023113409720" />
              </Form.Item>
              <Space style={{ marginBottom: 12 }} wrap>
                <Button onClick={() => void handleNormalize()}>号码规范化</Button>
                {normalizeResult?.inputType ? (
                  <Typography.Text type="secondary">
                    识别类型：{patentNormalizeInputTypeLabel(normalizeResult.inputType)}
                    {normalizeResult.kindCode ? `（分类代码 ${normalizeResult.kindCode}）` : ''}
                  </Typography.Text>
                ) : null}
              </Space>
            </>
          ) : null}

          <Form.Item label="申请号展示值" name="applicationNoDisplay">
            <Input placeholder="如：202311340972.0（可选）" />
          </Form.Item>

          <Space style={{ width: '100%' }} size={12} wrap>
            <Form.Item
              label="专利类型"
              name="patentType"
              rules={[{ required: true, message: '请选择专利类型' }]}
              style={{ minWidth: 180, marginBottom: 12 }}
            >
              <Select options={patentTypeOptions} />
            </Form.Item>
            <Form.Item label="法律状态" name="legalStatus" style={{ minWidth: 180, marginBottom: 12 }}>
              <Select options={legalStatusOptions} />
            </Form.Item>
            <Form.Item label="来源" name="sourcePrimary" style={{ minWidth: 180, marginBottom: 12 }}>
              <Select allowClear options={sourcePrimaryOptions} />
            </Form.Item>
          </Space>

          <Form.Item label="专利名称" name="title" rules={[{ required: true, message: '请输入专利名称' }]}>
            <Input placeholder="请输入专利名称" />
          </Form.Item>

          <Form.Item label="摘要" name="abstract">
            <Input.TextArea rows={3} placeholder="专利摘要（可选）" />
          </Form.Item>

          <Space style={{ width: '100%' }} size={12} wrap>
            <Form.Item label="申请日" name="filingDate" style={{ minWidth: 180, marginBottom: 12 }}>
              <Input placeholder="YYYY-MM-DD" />
            </Form.Item>
            <Form.Item label="公开日" name="publicationDate" style={{ minWidth: 180, marginBottom: 12 }}>
              <Input placeholder="YYYY-MM-DD" />
            </Form.Item>
            <Form.Item label="授权日" name="grantDate" style={{ minWidth: 180, marginBottom: 12 }}>
              <Input placeholder="YYYY-MM-DD" />
            </Form.Item>
          </Space>

          <Form.Item label="来源更新时间" name="sourceUpdatedAt">
            <Input placeholder="如：2026-02-16T10:00:00Z（可选）" />
          </Form.Item>

          <Form.Item label="发明人（逗号/分号/换行分隔）" name="inventorNamesText">
            <Input.TextArea rows={2} placeholder="张三\n李四" />
          </Form.Item>
          <Form.Item label="权利人（逗号/分号/换行分隔）" name="assigneeNamesText">
            <Input.TextArea rows={2} placeholder="某某科技有限公司" />
          </Form.Item>
          <Form.Item label="申请人（逗号/分号/换行分隔）" name="applicantNamesText">
            <Input.TextArea rows={2} placeholder="某某研究院" />
          </Form.Item>

          {normalizeResult?.warnings?.length ? (
            <Typography.Text type="warning">规范化提醒：{normalizeResult.warnings.join('；')}</Typography.Text>
          ) : null}
        </Form>
      </Modal>
    </Card>
  );
}
