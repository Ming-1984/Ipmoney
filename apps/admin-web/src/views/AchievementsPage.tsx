import { Button, Card, Descriptions, Drawer, Form, Input, Select, Space, Table, Tag, Typography, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { apiGet, apiPatch, apiPost } from '../lib/api';
import { formatTimeSmart } from '../lib/format';
import { displayAdminInfo, displayAdminTitle, formatRegionCodeDisplay, normalizeUserFacingText } from '../lib/userFacingText';
import { auditStatusLabel, contentStatusLabel } from '../lib/labels';
import { ImageUrlUploadField } from '../ui/ImageUrlUploadField';
import { RequestErrorAlert } from '../ui/RequestState';
import { confirmActionWithReason } from '../ui/confirm';

type AuditStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type ContentStatus = 'DRAFT' | 'ACTIVE' | 'OFF_SHELF';
type ContentSource = 'USER' | 'ADMIN' | 'PLATFORM';
type AchievementMaturity = 'CONCEPT' | 'PROTOTYPE' | 'PILOT' | 'MASS_PRODUCTION' | 'COMMERCIALIZED' | 'OTHER';

type AchievementItem = {
  id: string;
  title: string;
  summary?: string | null;
  source?: ContentSource;
  externalId?: string | null;
  sourceRawCategory?: string | null;
  sourceRawStatus?: string | null;
  sourceBatch?: string | null;
  sourceRawRegion?: string | null;
  sourceOrgName?: string | null;
  maturity?: AchievementMaturity | null;
  regionCode?: string | null;
  industryTags?: string[];
  coverUrl?: string | null;
  coverFileId?: string | null;
  auditStatus: AuditStatus;
  status: ContentStatus;
  createdAt: string;
};

type PagedAchievements = {
  items: AchievementItem[];
  page: { page: number; pageSize: number; total: number };
};

type AchievementEdit = AchievementItem & {
  description?: string | null;
  keywords?: string[];
  cooperationModes?: string[];
};

type AchievementMaterial = {
  id: string;
  fileName?: string | null;
  mimeType?: string | null;
  moderationStatus?: string | null;
  moderationLabel?: string | null;
  moderationReason?: string | null;
  createdAt: string;
};

const SOURCE_OPTIONS: Array<{ value: ContentSource; label: string }> = [
  { value: 'ADMIN', label: '后台录入' },
  { value: 'PLATFORM', label: '平台导入' },
  { value: 'USER', label: '用户发布' },
];

function achievementSourceLabel(value?: ContentSource | null): string {
  if (value === 'ADMIN') return '后台录入';
  if (value === 'PLATFORM') return '平台导入';
  if (value === 'USER') return '用户发布';
  return '来源待确认';
}

const MATURITY_OPTIONS: Array<{ value: AchievementMaturity; label: string }> = [
  { value: 'CONCEPT', label: '概念验证' },
  { value: 'PROTOTYPE', label: '原型开发' },
  { value: 'PILOT', label: '中试验证' },
  { value: 'MASS_PRODUCTION', label: '量产准备' },
  { value: 'COMMERCIALIZED', label: '已商业化' },
  { value: 'OTHER', label: '其他' },
];

function splitTags(input: string): string[] {
  return input
    .split(/[,\uff0c]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function achievementStatusText(row: AchievementItem): string {
  if (row.auditStatus === 'REJECTED') return '已驳回';
  if (row.status === 'DRAFT') return '草稿';
  if (row.auditStatus === 'PENDING') return '待审核';
  if (row.status === 'ACTIVE') return '已上架';
  if (row.status === 'OFF_SHELF') return '已下架';
  return contentStatusLabel(row.status);
}

function achievementActionMode(row: AchievementItem): 'REVIEW' | 'OFF_SHELF' | 'PUBLISH' | 'NONE' {
  if (row.auditStatus === 'PENDING') return 'REVIEW';
  if (row.status === 'ACTIVE') return 'OFF_SHELF';
  if (row.status === 'OFF_SHELF') return 'PUBLISH';
  if (row.auditStatus === 'APPROVED') return 'PUBLISH';
  return 'NONE';
}

export function AchievementsPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [data, setData] = useState<PagedAchievements | null>(null);
  const [q, setQ] = useState('');
  const [auditStatus, setAuditStatus] = useState<AuditStatus | ''>('');
  const [status, setStatus] = useState<ContentStatus | ''>('');
  const [source, setSource] = useState<ContentSource | ''>('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [active, setActive] = useState<AchievementEdit | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [materials, setMaterials] = useState<AchievementMaterial[]>([]);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [maturity, setMaturity] = useState<AchievementMaturity | ''>('');
  const [regionCode, setRegionCode] = useState('');
  const [industryTagsInput, setIndustryTagsInput] = useState('');
  const [keywordsInput, setKeywordsInput] = useState('');
  const [cooperationModesInput, setCooperationModesInput] = useState('');
  const [coverFileId, setCoverFileId] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [editSource, setEditSource] = useState<ContentSource>('ADMIN');
  const [sourceRawCategory, setSourceRawCategory] = useState('');
  const [sourceRawStatus, setSourceRawStatus] = useState('');
  const [sourceBatch, setSourceBatch] = useState('');
  const [sourceRawRegion, setSourceRawRegion] = useState('');
  const [sourceOrgName, setSourceOrgName] = useState('');
  const [externalId, setExternalId] = useState('');
  const loadSeqRef = useRef(0);
  const detailSeqRef = useRef(0);
  const detailIdRef = useRef<string | null>(null);

  const rows = useMemo(() => data?.items || [], [data?.items]);
  const loadAchievementContext = useCallback(async (id: string) => {
    const [detail, mat] = await Promise.all([
      apiGet<AchievementEdit>(`/admin/achievements/${id}`),
      apiGet<{ items?: AchievementMaterial[] }>(`/admin/achievements/${id}/materials`),
    ]);
    return { detail, materials: mat?.items || [] };
  }, []);

  const load = useCallback(async (opts?: { page?: number; pageSize?: number }) => {
    const nextPage = opts?.page ?? page;
    const nextPageSize = opts?.pageSize ?? pageSize;
    const seq = ++loadSeqRef.current;
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<PagedAchievements>('/admin/achievements', {
        q: q.trim() || undefined,
        auditStatus: auditStatus || undefined,
        status: status || undefined,
        source: source || undefined,
        page: nextPage,
        pageSize: nextPageSize,
      });
      if (seq !== loadSeqRef.current) return;
      setData(d);
    } catch (e: any) {
      if (seq !== loadSeqRef.current) return;
      setError(e);
      setData(null);
      message.error(e?.message || '加载成果列表失败');
    } finally {
      if (seq !== loadSeqRef.current) return;
      setLoading(false);
    }
  }, [auditStatus, page, pageSize, q, source, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSearch = useCallback(() => {
    setPage(1);
    void load({ page: 1 });
  }, [load]);

  const resetEditor = () => {
    setTitle('');
    setSummary('');
    setDescription('');
    setMaturity('');
    setRegionCode('');
    setIndustryTagsInput('');
    setKeywordsInput('');
    setCooperationModesInput('');
    setCoverFileId('');
    setCoverUrl('');
    setEditSource('ADMIN');
    setSourceRawCategory('');
    setSourceRawStatus('');
    setSourceBatch('');
    setSourceRawRegion('');
    setSourceOrgName('');
    setExternalId('');
  };

  const openCreate = () => {
    detailSeqRef.current += 1;
    detailIdRef.current = null;
    setActive(null);
    resetEditor();
    setDrawerOpen(true);
  };

  const openEdit = async (id: string) => {
    const seq = ++detailSeqRef.current;
    detailIdRef.current = id;
    try {
      const detail = await apiGet<AchievementEdit>(`/admin/achievements/${id}`);
      if (seq !== detailSeqRef.current || detailIdRef.current !== id) return;
      setActive(detail);
      setTitle(normalizeUserFacingText(detail.title));
      setSummary(normalizeUserFacingText(detail.summary));
      setDescription(normalizeUserFacingText(detail.description));
      setMaturity((detail.maturity || '') as AchievementMaturity | '');
      setRegionCode(detail.regionCode || '');
      setIndustryTagsInput((detail.industryTags || []).join('，'));
      setKeywordsInput((detail.keywords || []).join('，'));
      setCooperationModesInput((detail.cooperationModes || []).join('，'));
      setCoverFileId(detail.coverFileId || '');
      setCoverUrl(detail.coverUrl || '');
      setEditSource((detail.source || 'ADMIN') as ContentSource);
      setSourceRawCategory(detail.sourceRawCategory || '');
      setSourceRawStatus(detail.sourceRawStatus || '');
      setSourceBatch(detail.sourceBatch || '');
      setSourceRawRegion(detail.sourceRawRegion || '');
      setSourceOrgName(detail.sourceOrgName || '');
      setExternalId(detail.externalId || '');
      setDrawerOpen(true);
    } catch (e: any) {
      if (seq !== detailSeqRef.current || detailIdRef.current !== id) return;
      message.error(e?.message || '加载成果详情失败');
    }
  };

  const openDetail = useCallback(async (id: string) => {
    const seq = ++detailSeqRef.current;
    detailIdRef.current = id;
    try {
      const [detail, mat] = await Promise.all([
        apiGet<AchievementEdit>(`/admin/achievements/${id}`),
        apiGet<{ items?: AchievementMaterial[] }>(`/admin/achievements/${id}/materials`),
      ]);
      if (seq !== detailSeqRef.current || detailIdRef.current !== id) return;
      setActive(detail);
      setMaterials(mat?.items || []);
      setDetailOpen(true);
    } catch (e: any) {
      if (seq !== detailSeqRef.current || detailIdRef.current !== id) return;
      message.error(e?.message || '加载成果详情失败');
    }
  }, []);

  useEffect(() => {
    if (!detailOpen || !active?.id) return;
    void (async () => {
      try {
        const mat = await apiGet<{ items?: AchievementMaterial[] }>(`/admin/achievements/${active.id}/materials`);
        setMaterials(mat?.items || []);
      } catch (e: any) {
        message.error(e?.message || '加载成果材料失败');
      }
    })();
  }, [active?.id, detailOpen]);

  const materialHasRejected = useMemo(
    () => materials.some((item) => String(item.moderationStatus || '').trim().toUpperCase() === 'REJECTED'),
    [materials],
  );

  const save = useCallback(async () => {
    const payload: Record<string, any> = {
      title: title.trim(),
      summary: summary.trim() || null,
      description: description.trim() || null,
      maturity: maturity || null,
      regionCode: regionCode.trim() || null,
      industryTags: splitTags(industryTagsInput),
      keywords: splitTags(keywordsInput),
      cooperationModes: splitTags(cooperationModesInput),
      coverFileId: coverFileId.trim() || null,
      source: editSource,
      sourceRawCategory: sourceRawCategory.trim() || null,
      sourceRawStatus: sourceRawStatus.trim() || null,
      sourceBatch: sourceBatch.trim() || null,
      sourceRawRegion: sourceRawRegion.trim() || null,
      sourceOrgName: sourceOrgName.trim() || null,
      externalId: externalId.trim() || null,
    };
    if (!payload.title) {
      message.warning('请先填写成果标题');
      return;
    }
    setSaving(true);
    try {
      if (active?.id) {
        await apiPatch(`/admin/achievements/${active.id}`, payload, {
          idempotencyKey: `admin-achievement-update-${active.id}-${Date.now()}`,
        });
      } else {
        await apiPost('/admin/achievements', payload, {
          idempotencyKey: `admin-achievement-create-${Date.now()}`,
        });
      }
      message.success('保存成功');
      setDrawerOpen(false);
      await load();
    } catch (e: any) {
      message.error(e?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  }, [
    active?.id,
    cooperationModesInput,
    coverFileId,
    description,
    editSource,
    externalId,
    industryTagsInput,
    keywordsInput,
    load,
    maturity,
    regionCode,
    sourceBatch,
    sourceOrgName,
    sourceRawCategory,
    sourceRawRegion,
    sourceRawStatus,
    summary,
    title,
  ]);

  const doPublish = useCallback(
    async (id: string) => {
      const context = await loadAchievementContext(id);
      const titleText = normalizeUserFacingText(context.detail?.title) || id;
      const { ok, reason } = await confirmActionWithReason({
        title: '确认通过成果审核？',
        content: (
          <Space direction="vertical" size={4}>
            <Typography.Text>成果：{titleText}</Typography.Text>
            <Typography.Text type="secondary">系统会一并处理当前待审核的成果材料。</Typography.Text>
          </Space>
        ),
        okText: '通过',
        reasonLabel: '审核备注（可选）',
        reasonPlaceholder: '可填写通过原因或备注，便于审计和后续对账。',
      });
      if (!ok) return;
      const targetMaterialList = context.materials;
      const hasRejected = targetMaterialList.some((item) => String(item.moderationStatus || '').trim().toUpperCase() === 'REJECTED');
      if (hasRejected) {
        const blocked = targetMaterialList
          .filter((item) => String(item.moderationStatus || '').trim().toUpperCase() === 'REJECTED')
          .map((item) => `${item.fileName || item.id}${item.moderationReason ? `：${item.moderationReason}` : ''}`)
          .join('；');
        message.error(blocked ? `当前成果材料存在驳回项：${blocked}` : '当前成果材料存在驳回项，不能通过审核');
        return;
      }
      setPublishing(true);
      try {
        await apiPost(
          `/admin/achievements/${id}/approve`,
          { reason: reason || undefined },
          { idempotencyKey: `admin-achievement-approve-${id}-${Date.now()}` },
        );
        message.success('已发布');
        await load();
      } catch (e: any) {
        message.error(e?.message || '通过审核失败');
      } finally {
        setPublishing(false);
      }
    },
    [active?.title, load, materials],
  );

  const doReject = useCallback(
    async (id: string) => {
      const context = await loadAchievementContext(id);
      const titleText = normalizeUserFacingText(context.detail?.title) || id;
      const { ok, reason } = await confirmActionWithReason({
        title: '确认驳回成果审核？',
        content: `成果：${titleText}`,
        okText: '驳回',
        reasonRequired: true,
        reasonLabel: '驳回原因',
        reasonPlaceholder: '请填写驳回原因，便于提交人修改后重新审核。',
        danger: true,
      });
      if (!ok) return;
      if (!reason) {
        message.error('驳回必须填写原因');
        return;
      }
      setPublishing(true);
      try {
        await apiPost(`/admin/achievements/${id}/reject`, { reason }, { idempotencyKey: `admin-achievement-reject-${id}-${Date.now()}` });
        message.success('成果已驳回');
        await load();
      } catch (e: any) {
        message.error(e?.message || '驳回审核失败');
      } finally {
        setPublishing(false);
      }
    },
    [loadAchievementContext, load],
  );

  const doOffShelf = useCallback(
    async (id: string) => {
      setPublishing(true);
      try {
        await apiPost(`/admin/achievements/${id}/off-shelf`, {}, { idempotencyKey: `admin-achievement-off-${id}-${Date.now()}` });
        message.success('已下架');
        await load();
      } catch (e: any) {
        message.error(e?.message || '下架失败');
      } finally {
        setPublishing(false);
      }
    },
    [load],
  );

  return (
    <Card className="admin-achievements-page">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Typography.Title level={3} style={{ marginTop: 0 }}>
            成果管理
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            管理平台成果展示内容，支持来源治理字段维护、发布下架和封面上传。
          </Typography.Paragraph>
        </div>

        {error ? <RequestErrorAlert error={error} onRetry={load} /> : null}

        <Space wrap size={12}>
          <Input
            value={q}
            style={{ width: 220 }}
            placeholder="关键词（标题/摘要）"
            allowClear
            onChange={(e) => setQ(e.target.value)}
            onPressEnter={handleSearch}
          />
          <Select
            value={auditStatus}
            style={{ width: 160 }}
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
            onChange={(v) => setStatus((v as ContentStatus) || '')}
            options={[
              { value: '', label: '全部上架状态' },
              { value: 'DRAFT', label: '草稿' },
              { value: 'ACTIVE', label: '上架中' },
              { value: 'OFF_SHELF', label: '已下架' },
            ]}
          />
          <Select
            value={source}
            style={{ width: 160 }}
            onChange={(v) => setSource((v as ContentSource) || '')}
            options={[{ value: '', label: '全部来源' }, ...SOURCE_OPTIONS]}
          />
          <Button type="primary" onClick={handleSearch}>
            查询
          </Button>
          <Button onClick={openCreate}>新建成果</Button>
        </Space>

        <Table<AchievementItem>
          rowKey="id"
          loading={loading}
          dataSource={rows}
          pagination={{
            current: data?.page.page || page,
            pageSize: data?.page.pageSize || pageSize,
            total: data?.page.total || 0,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            onChange: (nextPage, nextPageSize) => {
              const normalizedPageSize = nextPageSize || pageSize;
              if (normalizedPageSize !== pageSize) {
                setPageSize(normalizedPageSize);
                setPage(1);
                return;
              }
              setPage(nextPage);
            },
          }}
          columns={[
            { title: '标题', dataIndex: 'title', ellipsis: true, render: (value) => displayAdminTitle(value, '成果标题待确认') },
            {
              title: '来源',
              dataIndex: 'source',
              width: 120,
              render: (v: ContentSource | undefined) => displayAdminInfo(achievementSourceLabel(v)),
            },
            { title: '外部来源编号', dataIndex: 'externalId', width: 120, render: (v) => displayAdminInfo(v) },
            { title: '来源批次', dataIndex: 'sourceBatch', width: 120, render: (v) => displayAdminInfo(v) },
            {
              title: '审核状态',
              dataIndex: 'auditStatus',
              width: 120,
              render: (v: AuditStatus) => <Tag>{auditStatusLabel(v)}</Tag>,
            },
            {
              title: '上架状态',
              dataIndex: 'status',
              width: 120,
              render: (_, row) => <Tag>{achievementStatusText(row)}</Tag>,
            },
            { title: '创建时间', dataIndex: 'createdAt', width: 180, render: (v) => formatTimeSmart(v) },
            {
              title: '操作',
              key: 'actions',
              width: 260,
              render: (_, row) => (
                <Space>
                  <Button size="small" onClick={() => void openEdit(row.id)}>
                    编辑
                  </Button>
                  <Button size="small" onClick={() => void openDetail(row.id)}>
                    详情
                  </Button>
                  {achievementActionMode(row) === 'REVIEW' ? (
                    <>
                      <Button size="small" type="primary" loading={publishing} onClick={() => void doPublish(row.id)}>
                        通过
                      </Button>
                      <Button size="small" danger loading={publishing} onClick={() => void doReject(row.id)}>
                        驳回
                      </Button>
                    </>
                  ) : achievementActionMode(row) === 'OFF_SHELF' ? (
                    <Button size="small" loading={publishing} onClick={() => void doOffShelf(row.id)}>
                      下架
                    </Button>
                  ) : achievementActionMode(row) === 'PUBLISH' ? (
                    <Button size="small" type="primary" loading={publishing} onClick={() => void doPublish(row.id)}>
                      上架
                    </Button>
                  ) : null}
                </Space>
              ),
            },
          ]}
        />

        <Button onClick={() => void load()}>刷新</Button>
      </Space>

      <Drawer
        title={active?.id ? `编辑成果：${normalizeUserFacingText(active.title) || '成果标题待确认'}` : '新建成果'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={780}
        destroyOnClose
      >
        <Form layout="vertical">
          <Form.Item label="成果标题" required>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="请输入成果标题" />
          </Form.Item>

          <Form.Item label="成果摘要">
            <Input.TextArea value={summary} onChange={(e) => setSummary(e.target.value)} autoSize={{ minRows: 2, maxRows: 5 }} />
          </Form.Item>

          <Form.Item label="成果说明">
            <Input.TextArea value={description} onChange={(e) => setDescription(e.target.value)} autoSize={{ minRows: 3, maxRows: 8 }} />
          </Form.Item>

          <Space style={{ width: '100%' }} size={16} align="start">
            <Form.Item label="成熟度" style={{ flex: 1 }}>
              <Select
                value={maturity}
                onChange={(v) => setMaturity((v as AchievementMaturity) || '')}
                options={[{ value: '', label: '未设置' }, ...MATURITY_OPTIONS]}
              />
            </Form.Item>
            <Form.Item label="地区" style={{ flex: 1 }}>
              <Input
                value={regionCode}
                onChange={(e) => setRegionCode(e.target.value)}
                placeholder="可填写地区名称或地区代码"
              />
            </Form.Item>
          </Space>

          <Form.Item label="行业标签（逗号分隔）">
            <Input value={industryTagsInput} onChange={(e) => setIndustryTagsInput(e.target.value)} placeholder="如 新能源，生物医药" />
          </Form.Item>
          <Form.Item label="关键词（逗号分隔）">
            <Input value={keywordsInput} onChange={(e) => setKeywordsInput(e.target.value)} />
          </Form.Item>
          <Form.Item label="合作方式（逗号分隔）">
            <Input value={cooperationModesInput} onChange={(e) => setCooperationModesInput(e.target.value)} />
          </Form.Item>

          <Typography.Text strong>封面图</Typography.Text>
          <div style={{ marginTop: 8, marginBottom: 16 }}>
            <ImageUrlUploadField
              value={coverUrl}
              uploadPurpose="ACHIEVEMENT_COVER"
              maxSizeMb={10}
              allowUrlInput={false}
              placeholder="上传或填写封面图片地址"
              onChange={(next) => setCoverUrl(next)}
              onUploaded={async (uploaded) => {
                setCoverFileId(uploaded.id);
                setCoverUrl(uploaded.url);
              }}
            />
            <Button
              danger
              style={{ marginTop: 8 }}
              onClick={() => {
                setCoverFileId('');
                setCoverUrl('');
              }}
            >
              清除封面
            </Button>
          </div>

          <Typography.Title level={5}>来源治理</Typography.Title>
          <Space style={{ width: '100%' }} size={16} align="start">
            <Form.Item label="来源类型" style={{ flex: 1 }}>
              <Select value={editSource} onChange={(v) => setEditSource(v as ContentSource)} options={SOURCE_OPTIONS} />
            </Form.Item>
            <Form.Item label="外部来源编号" style={{ flex: 1 }}>
              <Input value={externalId} onChange={(e) => setExternalId(e.target.value)} placeholder="如 外部成果编号" />
            </Form.Item>
          </Space>

          <Space style={{ width: '100%' }} size={16} align="start">
            <Form.Item label="原始分类" style={{ flex: 1 }}>
              <Input value={sourceRawCategory} onChange={(e) => setSourceRawCategory(e.target.value)} />
            </Form.Item>
            <Form.Item label="原始状态" style={{ flex: 1 }}>
              <Input value={sourceRawStatus} onChange={(e) => setSourceRawStatus(e.target.value)} />
            </Form.Item>
          </Space>

          <Space style={{ width: '100%' }} size={16} align="start">
            <Form.Item label="导入批次" style={{ flex: 1 }}>
              <Input value={sourceBatch} onChange={(e) => setSourceBatch(e.target.value)} />
            </Form.Item>
            <Form.Item label="原始地区" style={{ flex: 1 }}>
              <Input value={sourceRawRegion} onChange={(e) => setSourceRawRegion(e.target.value)} />
            </Form.Item>
          </Space>

          <Form.Item label="原始机构名称">
            <Input value={sourceOrgName} onChange={(e) => setSourceOrgName(e.target.value)} />
          </Form.Item>

          <Space>
            <Button onClick={() => setDrawerOpen(false)}>取消</Button>
            <Button type="primary" loading={saving} onClick={() => void save()}>
              保存
            </Button>
          </Space>
        </Form>
      </Drawer>

      <Drawer
        title={`成果详情：${normalizeUserFacingText(active?.title) || '成果标题待确认'}`}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={860}
        destroyOnClose
      >
        {active ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="标题" span={2}>
                {displayAdminTitle(active.title, '成果标题待确认')}
              </Descriptions.Item>
              <Descriptions.Item label="审核状态">
                <Tag>{auditStatusLabel(active.auditStatus)}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="上架状态">
                <Tag>{achievementStatusText(active)}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="来源">{displayAdminInfo(achievementSourceLabel(active.source))}</Descriptions.Item>
              <Descriptions.Item label="地区">{displayAdminInfo(formatRegionCodeDisplay(active.regionCode))}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{formatTimeSmart(active.createdAt)}</Descriptions.Item>
              <Descriptions.Item label="外部编号">{displayAdminInfo(active.externalId)}</Descriptions.Item>
              <Descriptions.Item label="来源批次">{displayAdminInfo(active.sourceBatch)}</Descriptions.Item>
              <Descriptions.Item label="来源机构" span={2}>
                {displayAdminInfo(active.sourceOrgName)}
              </Descriptions.Item>
            </Descriptions>

            <Typography.Text strong>成果材料</Typography.Text>
            {materialHasRejected ? (
              <Typography.Text type="danger">有成果材料已被驳回，当前不能通过。</Typography.Text>
            ) : null}
            {materials.length ? (
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                {materials.map((item) => (
                  <Card key={item.id} size="small" style={{ width: '100%' }}>
                    <Space direction="vertical" size={4} style={{ width: '100%' }}>
                      <Space wrap>
                        <Typography.Text strong>{displayAdminTitle(item.fileName || item.id, '成果材料')}</Typography.Text>
                        <Tag>{String(item.moderationStatus || 'NOT_REQUIRED').toUpperCase()}</Tag>
                      </Space>
                      <Typography.Text type="secondary">{item.mimeType || '未知类型'}</Typography.Text>
                      {item.moderationReason ? <Typography.Text type="danger">原因：{displayAdminInfo(item.moderationReason)}</Typography.Text> : null}
                    </Space>
                  </Card>
                ))}
              </Space>
            ) : (
              <Typography.Text type="secondary">暂无可展示的成果材料。</Typography.Text>
            )}

            <Space>
              {active.auditStatus === 'PENDING' ? (
                <>
                  <Button type="primary" loading={publishing} onClick={() => void doPublish(active.id)}>
                    通过
                  </Button>
                  <Button danger loading={publishing} onClick={() => void doReject(active.id)}>
                    驳回
                  </Button>
                </>
              ) : active.status === 'ACTIVE' ? (
                <Button loading={publishing} onClick={() => void doOffShelf(active.id)}>
                  下架
                </Button>
              ) : active.status === 'OFF_SHELF' ? (
                <Button type="primary" loading={publishing} onClick={() => void doPublish(active.id)}>
                  上架
                </Button>
              ) : null}
            </Space>
          </Space>
        ) : null}
      </Drawer>
    </Card>
  );
}
