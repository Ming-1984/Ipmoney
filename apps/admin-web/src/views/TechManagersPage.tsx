import { Button, Card, Descriptions, Drawer, Input, InputNumber, Select, Space, Table, Tag, Typography, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type { components } from '@ipmoney/api-types';

import { apiGet, apiPatch } from '../lib/api';
import { formatTimeSmart } from '../lib/format';
import { verificationStatusLabel, verificationTypeLabel } from '../lib/labels';
import { ImageUrlUploadField } from '../ui/ImageUrlUploadField';
import { RequestErrorAlert } from '../ui/RequestState';

type TechManagerSummary = components['schemas']['TechManagerSummary'];
type PagedTechManagerSummary = components['schemas']['PagedTechManagerSummary'];
type VerificationStatus = components['schemas']['VerificationStatus'];
type TechManagerUpdateRequest = components['schemas']['TechManagerUpdateRequest'];

function splitCommaText(text: string): string[] {
  return text
    .split(/[,，]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

type MissingFilterValue = '' | 'true' | 'false';

export function TechManagersPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [data, setData] = useState<PagedTechManagerSummary | null>(null);

  const [q, setQ] = useState('');
  const [regionCode, setRegionCode] = useState('');
  const [status, setStatus] = useState<VerificationStatus | ''>('');

  const [missingIntro, setMissingIntro] = useState<MissingFilterValue>('');
  const [missingContact, setMissingContact] = useState<MissingFilterValue>('');
  const [missingRating, setMissingRating] = useState<MissingFilterValue>('');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TechManagerSummary | null>(null);
  const [intro, setIntro] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [serviceTagsInput, setServiceTagsInput] = useState('');
  const [position, setPosition] = useState('');
  const [organization, setOrganization] = useState('');
  const [serviceDirectionsInput, setServiceDirectionsInput] = useState('');
  const [workHighlights, setWorkHighlights] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [featuredRank, setFeaturedRank] = useState<number | null>(null);
  const [featuredUntil, setFeaturedUntil] = useState('');
  const [ratingScore, setRatingScore] = useState<number | null>(null);
  const [ratingCount, setRatingCount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [batchRatingScore, setBatchRatingScore] = useState<number | null>(null);
  const [batchRatingCount, setBatchRatingCount] = useState<number | null>(null);
  const [batchSaving, setBatchSaving] = useState(false);

  const load = useCallback(
    async (opts?: { page?: number; pageSize?: number }) => {
      const nextPage = opts?.page ?? page;
      const nextPageSize = opts?.pageSize ?? pageSize;
      setLoading(true);
      setError(null);
      try {
        const d = await apiGet<PagedTechManagerSummary>('/admin/tech-managers', {
          q: q.trim() || undefined,
          regionCode: regionCode.trim() || undefined,
          verificationStatus: status || undefined,
          missingIntro: missingIntro || undefined,
          missingContact: missingContact || undefined,
          missingRating: missingRating || undefined,
          page: nextPage,
          pageSize: nextPageSize,
        });
        setData(d);
      } catch (e: any) {
        setError(e);
        setData(null);
        message.error(e?.message || '加载技术经理列表失败');
      } finally {
        setLoading(false);
      }
    },
    [missingContact, missingIntro, missingRating, page, pageSize, q, regionCode, status],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const handleSearch = useCallback(() => {
    setPage(1);
    void load({ page: 1 });
  }, [load]);

  const rows = useMemo(() => (data?.items || []) as TechManagerSummary[], [data?.items]);

  const openEdit = useCallback((record: TechManagerSummary) => {
    setEditTarget(record);
    setIntro(record.intro || '');
    setAvatarUrl(record.avatarUrl || '');
    setServiceTagsInput((record.serviceTags || []).join('，'));
    setPosition(record.position || '');
    setOrganization(record.organization || '');
    setServiceDirectionsInput((record.serviceDirections || []).join('，'));
    setWorkHighlights(record.workHighlights || '');
    setContactName(record.contactName || '');
    setContactPhone(record.contactPhone || '');
    setFeaturedRank(null);
    setFeaturedUntil('');
    setRatingScore(typeof record.stats?.ratingScore === 'number' ? record.stats.ratingScore : null);
    setRatingCount(typeof record.stats?.ratingCount === 'number' ? record.stats.ratingCount : null);
    setEditOpen(true);
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editTarget || saving) return;
    const payload: TechManagerUpdateRequest = {
      intro: intro.trim() || undefined,
      avatarUrl: avatarUrl.trim() || null,
      serviceTags: splitCommaText(serviceTagsInput),
      position: position.trim() || null,
      organization: organization.trim() || null,
      serviceDirections: splitCommaText(serviceDirectionsInput),
      workHighlights: workHighlights.trim() || null,
      contactName: contactName.trim() || null,
      contactPhone: contactPhone.trim() || null,
      ...(featuredRank !== null ? { featuredRank } : {}),
      ...(featuredUntil.trim() ? { featuredUntil: featuredUntil.trim() } : {}),
      ...(ratingScore !== null ? { ratingScore } : {}),
      ...(ratingCount !== null ? { ratingCount } : {}),
    };
    setSaving(true);
    try {
      await apiPatch(`/admin/tech-managers/${editTarget.userId}`, payload, {
        idempotencyKey: `admin-tech-manager-update-${editTarget.userId}-${Date.now()}`,
      });
      message.success('保存成功');
      setEditOpen(false);
      await load();
    } catch (e: any) {
      message.error(e?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  }, [
    avatarUrl,
    contactName,
    contactPhone,
    editTarget,
    featuredRank,
    featuredUntil,
    intro,
    load,
    organization,
    position,
    ratingCount,
    ratingScore,
    saving,
    serviceDirectionsInput,
    serviceTagsInput,
    workHighlights,
  ]);

  const missingFilterOptions = [
    { value: '', label: '全部' },
    { value: 'true', label: '仅缺失' },
    { value: 'false', label: '仅已填写' },
  ];

  const applyBatchRating = useCallback(async () => {
    if (!selectedRowKeys.length) {
      message.warning('请先选择要更新评分的技术经理人');
      return;
    }
    if (batchRatingScore === null || batchRatingCount === null) {
      message.warning('请先填写综合评分与评分人数');
      return;
    }
    if (batchRatingCount === 0 && batchRatingScore > 0) {
      message.warning('评分人数为 0 时，综合评分必须为 0');
      return;
    }
    setBatchSaving(true);
    try {
      const result = await apiPatch<{ updatedCount?: number }>('/admin/tech-managers/batch/rating', {
        techManagerIds: selectedRowKeys,
        ratingScore: batchRatingScore,
        ratingCount: batchRatingCount,
      });
      const updatedCount = Number(result?.updatedCount ?? selectedRowKeys.length);
      message.success(`批量评分已更新：${updatedCount} 人`);
      setSelectedRowKeys([]);
      await load();
    } catch (e: any) {
      message.error(e?.message || '批量评分更新失败');
    } finally {
      setBatchSaving(false);
    }
  }, [batchRatingCount, batchRatingScore, load, selectedRowKeys]);

  return (
    <Card className="admin-tech-managers-page">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Typography.Title level={3} style={{ marginTop: 0 }}>
            技术经理管理
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            维护技术经理展示资料、联系方式、评分信息，并支持按“缺失数据”快速筛选补齐。
          </Typography.Paragraph>
        </div>

        {error ? <RequestErrorAlert error={error} onRetry={load} /> : null}

        <Space wrap size={12}>
          <Input
            value={q}
            style={{ width: 220 }}
            placeholder="关键词（姓名/机构/方向）"
            allowClear
            onChange={(e) => setQ(e.target.value)}
            onPressEnter={handleSearch}
          />
          <Input
            value={regionCode}
            style={{ width: 160 }}
            placeholder="地区编码"
            allowClear
            inputMode="numeric"
            onChange={(e) => setRegionCode(e.target.value)}
            onPressEnter={handleSearch}
          />
          <Select
            value={status}
            style={{ width: 150 }}
            placeholder="认证状态"
            onChange={(v) => setStatus((v as VerificationStatus) || '')}
            options={[
              { value: '', label: '全部状态' },
              { value: 'PENDING', label: '待审核' },
              { value: 'APPROVED', label: '已通过' },
              { value: 'REJECTED', label: '已驳回' },
            ]}
          />
          <Select
            value={missingIntro}
            style={{ width: 160 }}
            placeholder="简介完整度"
            onChange={(v) => setMissingIntro((v as MissingFilterValue) || '')}
            options={missingFilterOptions}
          />
          <Select
            value={missingContact}
            style={{ width: 180 }}
            placeholder="联系方式完整度"
            onChange={(v) => setMissingContact((v as MissingFilterValue) || '')}
            options={missingFilterOptions}
          />
          <Select
            value={missingRating}
            style={{ width: 160 }}
            placeholder="评分完整度"
            onChange={(v) => setMissingRating((v as MissingFilterValue) || '')}
            options={missingFilterOptions}
          />
          <Button type="primary" onClick={handleSearch}>
            查询
          </Button>
          <Button
            onClick={() => {
              setQ('');
              setRegionCode('');
              setStatus('');
              setMissingIntro('');
              setMissingContact('');
              setMissingRating('');
              setSelectedRowKeys([]);
              setPage(1);
              void load({ page: 1 });
            }}
          >
            重置
          </Button>
        </Space>

        <Space wrap size={12}>
          <Tag color={selectedRowKeys.length ? 'processing' : 'default'}>已选 {selectedRowKeys.length} 人</Tag>
          <InputNumber
            value={batchRatingScore ?? undefined}
            onChange={(v) => setBatchRatingScore(typeof v === 'number' ? v : null)}
            min={0}
            max={5}
            step={0.1}
            precision={1}
            placeholder="批量综合评分"
            style={{ width: 160 }}
          />
          <InputNumber
            value={batchRatingCount ?? undefined}
            onChange={(v) => setBatchRatingCount(typeof v === 'number' ? v : null)}
            min={0}
            precision={0}
            placeholder="批量评分人数"
            style={{ width: 160 }}
          />
          <Button type="primary" onClick={() => void applyBatchRating()} loading={batchSaving}>
            批量更新评分
          </Button>
        </Space>

        <Table<TechManagerSummary>
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
            { title: '姓名', dataIndex: 'displayName', render: (v) => v || '-' },
            { title: '认证类型', dataIndex: 'verificationType', render: (v) => verificationTypeLabel(v) },
            {
              title: '认证状态',
              dataIndex: 'verificationStatus',
              render: (v) => <Tag>{verificationStatusLabel(v)}</Tag>,
            },
            { title: '机构', dataIndex: 'organization', render: (v) => v || '-' },
            { title: '职位', dataIndex: 'position', render: (v) => v || '-' },
            {
              title: '简介',
              dataIndex: 'intro',
              render: (v) => (v && String(v).trim() ? <span>{String(v).slice(0, 26)}</span> : <Tag color="orange">缺失</Tag>),
            },
            {
              title: '联系方式',
              key: 'contact',
              render: (_, r) => {
                const name = String(r.contactName || '').trim();
                const phone = String(r.contactPhone || '').trim();
                if (!name && !phone) return <Tag color="orange">缺失</Tag>;
                return `${name || '-'} / ${phone || '-'}`;
              },
            },
            {
              title: '评分',
              key: 'stats',
              render: (_, r) => {
                const stats = r.stats;
                const count = stats?.ratingCount ?? 0;
                const score = typeof stats?.ratingScore === 'number' ? stats.ratingScore.toFixed(1) : '0.0';
                if (count <= 0) return <Tag color="orange">暂无评分</Tag>;
                return `${score} (${count})`;
              },
            },
            { title: '认证时间', dataIndex: 'verifiedAt', render: (v) => (v ? formatTimeSmart(v) : '-') },
            {
              title: '操作',
              key: 'actions',
              render: (_, r) => (
                <Button size="small" onClick={() => openEdit(r)}>
                  编辑
                </Button>
              ),
            },
          ]}
        />

        <Button onClick={() => void load()}>刷新</Button>
      </Space>

      <Drawer
        title={editTarget?.displayName ? `编辑技术经理：${editTarget.displayName}` : '编辑技术经理'}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        width={720}
        destroyOnClose
      >
        {editTarget ? (
          <Space direction="vertical" size={14} style={{ width: '100%' }}>
            <Descriptions size="small" column={1} bordered>
              <Descriptions.Item label="用户ID">{editTarget.userId}</Descriptions.Item>
              <Descriptions.Item label="认证类型">{verificationTypeLabel(editTarget.verificationType)}</Descriptions.Item>
              <Descriptions.Item label="认证状态">{verificationStatusLabel(editTarget.verificationStatus)}</Descriptions.Item>
              <Descriptions.Item label="地区">{editTarget.regionCode || '-'}</Descriptions.Item>
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

            <div>
              <Typography.Text strong>服务标签</Typography.Text>
              <Input
                value={serviceTagsInput}
                onChange={(e) => setServiceTagsInput(e.target.value)}
                placeholder="多个标签用逗号分隔"
                style={{ marginTop: 8 }}
              />
            </div>

            <div>
              <Typography.Text strong>服务方向</Typography.Text>
              <Input
                value={serviceDirectionsInput}
                onChange={(e) => setServiceDirectionsInput(e.target.value)}
                placeholder="多个方向用逗号分隔"
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
                  onChange={(v) => setFeaturedRank(typeof v === 'number' ? v : null)}
                  min={0}
                  style={{ width: '100%', marginTop: 8 }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <Typography.Text strong>推荐有效期</Typography.Text>
                <Input
                  value={featuredUntil}
                  onChange={(e) => setFeaturedUntil(e.target.value)}
                  placeholder="ISO8601，例如 2026-12-31T00:00:00Z"
                  style={{ marginTop: 8 }}
                />
              </div>
            </Space>

            <Space style={{ width: '100%' }} size={16} align="start">
              <div style={{ flex: 1 }}>
                <Typography.Text strong>综合评分</Typography.Text>
                <InputNumber
                  value={ratingScore ?? undefined}
                  onChange={(v) => setRatingScore(typeof v === 'number' ? v : null)}
                  min={0}
                  max={5}
                  step={0.1}
                  precision={1}
                  style={{ width: '100%', marginTop: 8 }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <Typography.Text strong>评分人数</Typography.Text>
                <InputNumber
                  value={ratingCount ?? undefined}
                  onChange={(v) => setRatingCount(typeof v === 'number' ? v : null)}
                  min={0}
                  precision={0}
                  style={{ width: '100%', marginTop: 8 }}
                />
              </div>
            </Space>

            <Space>
              <Button onClick={() => setEditOpen(false)}>取消</Button>
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
