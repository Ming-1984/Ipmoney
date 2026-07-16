import { Button, Card, Descriptions, Drawer, Input, InputNumber, Select, Space, Table, Tag, Typography, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type { components } from '@ipmoney/api-types';
import { TECH_MANAGER_BADGE_DEFINITIONS, type TechManagerBadgeCode, type TechManagerBadgeMode } from '@ipmoney/shared';

import { apiGet, apiPatch } from '../lib/api';
import { formatTimeSmart } from '../lib/format';
import { formatRegionCodeDisplay, normalizeUserFacingText } from '../lib/userFacingText';
import { verificationStatusLabel, verificationTypeLabel } from '../lib/labels';
import { ImageUrlUploadField } from '../ui/ImageUrlUploadField';
import { RequestErrorAlert } from '../ui/RequestState';

type TechManagerBadge = {
  code: TechManagerBadgeCode;
  name: string;
  category: string;
  sortOrder: number;
  styleToken?: string;
};

type TechManagerSummary = components['schemas']['AdminTechManagerSummary'] & {
  badges?: TechManagerBadge[];
};
type PagedTechManagerSummary = components['schemas']['PagedAdminTechManagerSummary'];
type VerificationStatus = components['schemas']['VerificationStatus'];
type TechManagerUpdateRequest = components['schemas']['TechManagerUpdateRequest'] & {
  badgeCodes?: TechManagerBadgeCode[];
};
type TechManagerEditorUpdateRequest = Omit<TechManagerUpdateRequest, 'intro' | 'featuredUntil' | 'avatarUrl'> & {
  intro?: string | null;
  avatarUrl?: string | null;
  position?: string | null;
  organization?: string | null;
  experienceLabel?: string | null;
  levelLabel?: string | null;
  workHighlights?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  featuredUntil?: string | null;
  badgeCodes?: TechManagerBadgeCode[];
};
type TechManagerEditorSummary = TechManagerSummary & {
  featuredRank?: number | null;
  featuredUntil?: string | null;
};
type MissingFilterValue = '' | 'true' | 'false';

const BADGE_OPTIONS = TECH_MANAGER_BADGE_DEFINITIONS.map((item) => ({
  value: item.code,
  label: item.name,
}));

const BADGE_MODE_OPTIONS: Array<{ value: TechManagerBadgeMode; label: string }> = [
  { value: 'REPLACE', label: '覆盖标签' },
  { value: 'APPEND', label: '追加标签' },
  { value: 'REMOVE', label: '移除标签' },
];

const filterFieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};

type FilterFieldProps = {
  label: string;
  children: React.ReactNode;
};

function FilterField({ label, children }: FilterFieldProps) {
  return (
    <div style={filterFieldStyle}>
      <Typography.Text type="secondary" style={{ fontSize: 12, lineHeight: '20px' }}>
        {label}
      </Typography.Text>
      {children}
    </div>
  );
}

function splitCommaText(text: string): string[] {
  return text
    .split(/[,\uff0c]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function renderMissingTag() {
  return <Tag color="orange">缺失</Tag>;
}

function displayFieldText(value: unknown, fallback = '未设置'): string {
  return normalizeUserFacingText(value) || fallback;
}

function isSuspectExperienceLabel(value: unknown): boolean {
  const normalized = normalizeUserFacingText(value);
  if (!normalized) return false;
  return [
    /^1\s*年?/u,
    /^一\s*年?/u,
    /^从业\s*1\s*年?/u,
    /^从业\s*一\s*年?/u,
    /^1\s*年(?:经验|从业经验|服务经验)?$/u,
    /^一\s*年(?:经验|从业经验|服务经验)?$/u,
  ].some((pattern) => pattern.test(normalized));
}

function renderBadges(badges?: TechManagerBadge[]) {
  if (!Array.isArray(badges) || !badges.length) return <Tag color="default">未设置标签</Tag>;
  return (
    <>
      {badges.map((badge) => (
        <Tag key={badge.code} color={badge.category === 'STATUS' ? 'blue' : 'gold'}>
          {badge.name}
        </Tag>
      ))}
    </>
  );
}

export function TechManagersPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [data, setData] = useState<PagedTechManagerSummary | null>(null);

  const [q, setQ] = useState('');
  const [regionCode, setRegionCode] = useState('');
  const [status, setStatus] = useState<VerificationStatus | ''>('');
  const [missingIntro, setMissingIntro] = useState<MissingFilterValue>('');
  const [missingContact, setMissingContact] = useState<MissingFilterValue>('');
  const [missingExperienceLabel, setMissingExperienceLabel] = useState<MissingFilterValue>('');
  const [missingLevelLabel, setMissingLevelLabel] = useState<MissingFilterValue>('');
  const [suspectExperienceLabel, setSuspectExperienceLabel] = useState<MissingFilterValue>('');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TechManagerEditorSummary | null>(null);
  const [intro, setIntro] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [serviceTagsInput, setServiceTagsInput] = useState('');
  const [position, setPosition] = useState('');
  const [organization, setOrganization] = useState('');
  const [experienceLabel, setExperienceLabel] = useState('');
  const [levelLabel, setLevelLabel] = useState('');
  const [serviceDirectionsInput, setServiceDirectionsInput] = useState('');
  const [workHighlights, setWorkHighlights] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [featuredRank, setFeaturedRank] = useState<number | null>(null);
  const [featuredUntil, setFeaturedUntil] = useState('');
  const [badgeCodes, setBadgeCodes] = useState<TechManagerBadgeCode[]>([]);
  const [saving, setSaving] = useState(false);

  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [batchBadgeCodes, setBatchBadgeCodes] = useState<TechManagerBadgeCode[]>([]);
  const [batchMode, setBatchMode] = useState<TechManagerBadgeMode>('REPLACE');
  const [batchSaving, setBatchSaving] = useState(false);

  const load = useCallback(
    async (opts?: { page?: number; pageSize?: number }) => {
      const nextPage = opts?.page ?? page;
      const nextPageSize = opts?.pageSize ?? pageSize;
      setLoading(true);
      setError(null);
      try {
        const next = await apiGet<PagedTechManagerSummary>('/admin/tech-managers', {
          q: q.trim() || undefined,
          regionCode: regionCode.trim() || undefined,
          verificationStatus: status || undefined,
          missingIntro: missingIntro || undefined,
          missingContact: missingContact || undefined,
          missingExperienceLabel: missingExperienceLabel || undefined,
          missingLevelLabel: missingLevelLabel || undefined,
          suspectExperienceLabel: suspectExperienceLabel || undefined,
          page: nextPage,
          pageSize: nextPageSize,
        });
        setData(next);
      } catch (err: any) {
        setError(err);
        setData(null);
        message.error(err?.message || '加载技术经理人列表失败');
      } finally {
        setLoading(false);
      }
    },
    [missingContact, missingExperienceLabel, missingIntro, missingLevelLabel, page, pageSize, q, regionCode, status, suspectExperienceLabel],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => (data?.items || []) as TechManagerEditorSummary[], [data?.items]);

  const openEdit = useCallback((record: TechManagerEditorSummary) => {
    setEditTarget(record);
    setIntro(normalizeUserFacingText(record.intro));
    setAvatarUrl(record.avatarUrl || '');
    setServiceTagsInput((record.serviceTags || []).join('，'));
    setPosition(normalizeUserFacingText(record.position));
    setOrganization(normalizeUserFacingText(record.organization));
    setExperienceLabel(normalizeUserFacingText(record.experienceLabel));
    setLevelLabel(normalizeUserFacingText(record.levelLabel));
    setServiceDirectionsInput((record.serviceDirections || []).join('，'));
    setWorkHighlights(normalizeUserFacingText(record.workHighlights));
    setContactName(normalizeUserFacingText(record.contactName));
    setContactPhone(normalizeUserFacingText(record.contactPhone));
    setFeaturedRank(typeof record.featuredRank === 'number' ? record.featuredRank : null);
    setFeaturedUntil(record.featuredUntil || '');
    setBadgeCodes((record.badges || []).map((item) => item.code as TechManagerBadgeCode));
    setEditOpen(true);
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editTarget || saving) return;
    const payload: TechManagerEditorUpdateRequest = {
      intro: intro.trim() || null,
      avatarUrl: avatarUrl.trim() || null,
      serviceTags: splitCommaText(serviceTagsInput),
      position: position.trim() || null,
      organization: organization.trim() || null,
      experienceLabel: experienceLabel.trim() || null,
      levelLabel: levelLabel.trim() || null,
      serviceDirections: splitCommaText(serviceDirectionsInput),
      workHighlights: workHighlights.trim() || null,
      contactName: contactName.trim() || null,
      contactPhone: contactPhone.trim() || null,
      badgeCodes,
      ...(featuredRank !== null ? { featuredRank } : {}),
      featuredUntil: featuredUntil.trim() || null,
    };

    setSaving(true);
    try {
      await apiPatch(`/admin/tech-managers/${editTarget.userId}`, payload, {
        idempotencyKey: `admin-tech-manager-update-${editTarget.userId}-${Date.now()}`,
      });
      message.success('保存成功');
      setEditOpen(false);
      await load();
    } catch (err: any) {
      message.error(err?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  }, [
    avatarUrl,
    badgeCodes,
    contactName,
    contactPhone,
    editTarget,
    experienceLabel,
    featuredRank,
    featuredUntil,
    intro,
    levelLabel,
    load,
    organization,
    position,
    saving,
    serviceDirectionsInput,
    serviceTagsInput,
    workHighlights,
  ]);

  const applyBatchBadges = useCallback(async () => {
    if (!selectedRowKeys.length) {
      message.warning('请先选择要更新标签的技术经理人');
      return;
    }
    if (!batchBadgeCodes.length) {
      message.warning('请至少选择一个标签');
      return;
    }

    setBatchSaving(true);
    try {
      const result = await apiPatch<{ updatedCount?: number }>('/admin/tech-managers/batch/badges', {
        techManagerIds: selectedRowKeys,
        badgeCodes: batchBadgeCodes,
        mode: batchMode,
      });
      message.success(`批量标签已更新：${Number(result?.updatedCount ?? selectedRowKeys.length)} 人`);
      setSelectedRowKeys([]);
      await load();
    } catch (err: any) {
      message.error(err?.message || '批量标签更新失败');
    } finally {
      setBatchSaving(false);
    }
  }, [batchBadgeCodes, batchMode, load, selectedRowKeys]);

  const resetFilters = useCallback(() => {
    setQ('');
    setRegionCode('');
    setStatus('');
    setMissingIntro('');
    setMissingContact('');
    setMissingExperienceLabel('');
    setMissingLevelLabel('');
    setSuspectExperienceLabel('');
    setSelectedRowKeys([]);
    setPageSize(20);
    setPage(1);
  }, []);

  const missingFilterOptions = [
    { value: '', label: '全部' },
    { value: 'true', label: '仅缺失' },
    { value: 'false', label: '仅已填写' },
  ];

  return (
    <Card className="admin-tech-managers-page">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Typography.Title level={3} style={{ marginTop: 0 }}>
            技术经理人管理
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            统一维护技术经理人的公开展示信息、联系资料、从业信息、等级标签与荣誉标签。
          </Typography.Paragraph>
        </div>

        {error ? <RequestErrorAlert error={error} onRetry={load} /> : null}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <FilterField label="关键词">
            <Input
              value={q}
              style={{ width: 240 }}
              placeholder="搜索姓名、机构、方向或标签"
              allowClear
              onChange={(e) => setQ(e.target.value)}
              onPressEnter={() => {
                setPage(1);
                void load({ page: 1 });
              }}
            />
          </FilterField>
          <FilterField label="地区">
            <Input
              value={regionCode}
              style={{ width: 160 }}
              placeholder="地区名称或代码"
              allowClear
              inputMode="numeric"
              onChange={(e) => setRegionCode(e.target.value)}
              onPressEnter={() => {
                setPage(1);
                void load({ page: 1 });
              }}
            />
          </FilterField>
          <FilterField label="认证状态">
            <Select
              value={status}
              style={{ width: 150 }}
              placeholder="认证状态"
              onChange={(value) => setStatus((value as VerificationStatus) || '')}
              options={[
                { value: '', label: '全部状态' },
                { value: 'PENDING', label: '待审核' },
                { value: 'APPROVED', label: '已通过' },
                { value: 'REJECTED', label: '已驳回' },
              ]}
            />
          </FilterField>
          <FilterField label="简介">
            <Select
              value={missingIntro}
              style={{ width: 160 }}
              placeholder="简介完整度"
              onChange={(value) => setMissingIntro((value as MissingFilterValue) || '')}
              options={missingFilterOptions}
            />
          </FilterField>
          <FilterField label="联系方式">
            <Select
              value={missingContact}
              style={{ width: 160 }}
              placeholder="联系完整度"
              onChange={(value) => setMissingContact((value as MissingFilterValue) || '')}
              options={missingFilterOptions}
            />
          </FilterField>
          <FilterField label="从业信息">
            <Select
              value={missingExperienceLabel}
              style={{ width: 160 }}
              placeholder="从业信息"
              onChange={(value) => setMissingExperienceLabel((value as MissingFilterValue) || '')}
              options={missingFilterOptions}
            />
          </FilterField>
          <FilterField label="等级标签">
            <Select
              value={missingLevelLabel}
              style={{ width: 160 }}
              placeholder="等级标签"
              onChange={(value) => setMissingLevelLabel((value as MissingFilterValue) || '')}
              options={missingFilterOptions}
            />
          </FilterField>
          <FilterField label="从业信息异常">
            <Select
              value={suspectExperienceLabel}
              style={{ width: 180 }}
              placeholder="异常从业信息"
              onChange={(value) => setSuspectExperienceLabel((value as MissingFilterValue) || '')}
              options={[
                { value: '', label: '全部' },
                { value: 'true', label: '仅异常值' },
                { value: 'false', label: '排除异常值' },
              ]}
            />
          </FilterField>
          <Space size={12}>
            <Button
              type="primary"
              onClick={() => {
                setPage(1);
                void load({ page: 1 });
              }}
            >
              查询
            </Button>
            <Button onClick={resetFilters}>重置</Button>
          </Space>
        </div>

        <Space wrap size={12}>
          <Tag color={selectedRowKeys.length ? 'processing' : 'default'}>已选 {selectedRowKeys.length} 人</Tag>
          <Select<TechManagerBadgeCode[]>
            mode="multiple"
            value={batchBadgeCodes}
            onChange={(value) => setBatchBadgeCodes(value as TechManagerBadgeCode[])}
            options={BADGE_OPTIONS}
            style={{ minWidth: 320 }}
            placeholder="批量选择荣誉标签"
          />
          <Select<TechManagerBadgeMode>
            value={batchMode}
            onChange={(value) => setBatchMode(value)}
            options={BADGE_MODE_OPTIONS}
            style={{ width: 140 }}
          />
          <Button type="primary" loading={batchSaving} onClick={() => void applyBatchBadges()}>
            批量设置标签
          </Button>
        </Space>

        <Table<TechManagerEditorSummary>
          rowKey="userId"
          loading={loading}
          dataSource={rows}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys as string[]),
          }}
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
            { title: '姓名', dataIndex: 'displayName', render: (value) => displayFieldText(value) },
            { title: '认证类型', dataIndex: 'verificationType', render: (value) => verificationTypeLabel(value) },
            {
              title: '认证状态',
              dataIndex: 'verificationStatus',
              render: (value) => <Tag>{verificationStatusLabel(value)}</Tag>,
            },
            { title: '机构', dataIndex: 'organization', render: (value) => (normalizeUserFacingText(value) ? value : renderMissingTag()) },
            { title: '职位', dataIndex: 'position', render: (value) => (normalizeUserFacingText(value) ? value : renderMissingTag()) },
            {
              title: '从业信息',
              dataIndex: 'experienceLabel',
              render: (value) => {
                const text = normalizeUserFacingText(value);
                if (!text) return renderMissingTag();
                return isSuspectExperienceLabel(text) ? <Tag color="volcano">{text}</Tag> : text;
              },
            },
            {
              title: '等级标签',
              dataIndex: 'levelLabel',
              render: (value) =>
                normalizeUserFacingText(value) ? <Tag color="blue">{normalizeUserFacingText(value)}</Tag> : renderMissingTag(),
            },
            {
              title: '荣誉标签',
              key: 'badges',
              render: (_, record) => renderBadges(record.badges),
            },
            {
              title: '简介',
              dataIndex: 'intro',
              render: (value) => (normalizeUserFacingText(value) ? <span>{normalizeUserFacingText(value).slice(0, 26)}</span> : renderMissingTag()),
            },
            {
              title: '联系方式',
              key: 'contact',
              render: (_, record) => {
                const name = normalizeUserFacingText(record.contactName);
                const phone = normalizeUserFacingText(record.contactPhone);
                if (!name && !phone) return renderMissingTag();
                return [name, phone].filter(Boolean).join(' / ');
              },
            },
            { title: '认证时间', dataIndex: 'verifiedAt', render: (value) => (value ? formatTimeSmart(value) : '待确认') },
            {
              title: '操作',
              key: 'actions',
              render: (_, record) => (
                <Button size="small" onClick={() => openEdit(record)}>
                  编辑
                </Button>
              ),
            },
          ]}
        />

        <Button onClick={() => void load()}>刷新</Button>
      </Space>

      <Drawer
        title={editTarget?.displayName ? `编辑技术经理人：${editTarget.displayName}` : '编辑技术经理人'}
        open={editOpen}
        onClose={() => {
          setEditOpen(false);
          setEditTarget(null);
        }}
        width={720}
        destroyOnClose
      >
        {editTarget ? (
          <Space direction="vertical" size={14} style={{ width: '100%' }}>
            <Descriptions size="small" column={1} bordered>
              <Descriptions.Item label="技术经理人">{displayFieldText(editTarget.displayName)}</Descriptions.Item>
              <Descriptions.Item label="认证类型">{verificationTypeLabel(editTarget.verificationType)}</Descriptions.Item>
              <Descriptions.Item label="认证状态">{verificationStatusLabel(editTarget.verificationStatus)}</Descriptions.Item>
              <Descriptions.Item label="地区">{formatRegionCodeDisplay(editTarget.regionCode)}</Descriptions.Item>
            </Descriptions>

            <div>
              <Typography.Text strong>头像</Typography.Text>
              <div style={{ marginTop: 8 }}>
                <ImageUrlUploadField
                  value={avatarUrl}
                  uploadPurpose="ADMIN_AVATAR"
                  maxSizeMb={5}
                  placeholder="上传或填写头像 URL"
                  onChange={(next) => setAvatarUrl(next)}
                />
              </div>
            </div>

            <div>
              <Typography.Text strong>荣誉标签</Typography.Text>
              <div style={{ marginTop: 8 }}>
                <Select<TechManagerBadgeCode[]>
                  mode="multiple"
                  value={badgeCodes}
                  onChange={(value) => setBadgeCodes(value as TechManagerBadgeCode[])}
                  options={BADGE_OPTIONS}
                  style={{ width: '100%' }}
                  placeholder="请选择荣誉标签"
                />
              </div>
            </div>

            <div>
              <Typography.Text strong>个人简介</Typography.Text>
              <Input.TextArea
                value={intro}
                onChange={(e) => setIntro(e.target.value)}
                autoSize={{ minRows: 2, maxRows: 6 }}
                style={{ marginTop: 8 }}
              />
            </div>

            <Space style={{ width: '100%' }} size={16} align="start">
              <div style={{ flex: 1 }}>
                <Typography.Text strong>职位</Typography.Text>
                <Input value={position} onChange={(e) => setPosition(e.target.value)} style={{ marginTop: 8 }} />
              </div>
              <div style={{ flex: 1 }}>
                <Typography.Text strong>任职机构</Typography.Text>
                <Input value={organization} onChange={(e) => setOrganization(e.target.value)} style={{ marginTop: 8 }} />
              </div>
            </Space>

            <Space style={{ width: '100%' }} size={16} align="start">
              <div style={{ flex: 1 }}>
                <Typography.Text strong>从业信息</Typography.Text>
                <Input
                  value={experienceLabel}
                  onChange={(e) => setExperienceLabel(e.target.value)}
                  placeholder="例如：10年成果转化服务经验"
                  style={{ marginTop: 8 }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <Typography.Text strong>等级标签</Typography.Text>
                <Input
                  value={levelLabel}
                  onChange={(e) => setLevelLabel(e.target.value)}
                  placeholder="例如：资深顾问"
                  style={{ marginTop: 8 }}
                />
              </div>
            </Space>

            <div>
              <Typography.Text strong>服务标签</Typography.Text>
              <Input
                value={serviceTagsInput}
                onChange={(e) => setServiceTagsInput(e.target.value)}
                placeholder="多个标签请用逗号分隔"
                style={{ marginTop: 8 }}
              />
            </div>

            <div>
              <Typography.Text strong>服务方向</Typography.Text>
              <Input
                value={serviceDirectionsInput}
                onChange={(e) => setServiceDirectionsInput(e.target.value)}
                placeholder="多个方向请用逗号分隔"
                style={{ marginTop: 8 }}
              />
            </div>

            <div>
              <Typography.Text strong>工作亮点</Typography.Text>
              <Input.TextArea
                value={workHighlights}
                onChange={(e) => setWorkHighlights(e.target.value)}
                autoSize={{ minRows: 3, maxRows: 8 }}
                style={{ marginTop: 8 }}
              />
            </div>

            <Space style={{ width: '100%' }} size={16} align="start">
              <div style={{ flex: 1 }}>
                <Typography.Text strong>联系人</Typography.Text>
                <Input value={contactName} onChange={(e) => setContactName(e.target.value)} style={{ marginTop: 8 }} />
              </div>
              <div style={{ flex: 1 }}>
                <Typography.Text strong>联系电话</Typography.Text>
                <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} style={{ marginTop: 8 }} />
              </div>
            </Space>

            <Space style={{ width: '100%' }} size={16} align="start">
              <div style={{ flex: 1 }}>
                <Typography.Text strong>推荐排序</Typography.Text>
                <InputNumber
                  value={featuredRank ?? undefined}
                  onChange={(value) => setFeaturedRank(typeof value === 'number' ? value : null)}
                  min={0}
                  style={{ width: '100%', marginTop: 8 }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <Typography.Text strong>推荐有效期</Typography.Text>
                <Input
                  value={featuredUntil}
                  onChange={(e) => setFeaturedUntil(e.target.value)}
                  placeholder="例如 2026-12-31T00:00:00Z"
                  style={{ marginTop: 8 }}
                />
              </div>
            </Space>

            <Space>
              <Button
                onClick={() => {
                  setEditOpen(false);
                  setEditTarget(null);
                }}
              >
                取消
              </Button>
              <Button type="primary" loading={saving} onClick={() => void saveEdit()}>
                保存
              </Button>
            </Space>
          </Space>
        ) : null}
      </Drawer>
    </Card>
  );
}
