import { Button, Card, Drawer, Input, InputNumber, Select, Space, Table, Tag, Typography, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type { components } from '@ipmoney/api-types';

import { apiGet, apiPatch } from '../lib/api';
import { formatTimeSmart } from '../lib/format';
import { verificationStatusLabel, verificationTypeLabel } from '../lib/labels';
import { RequestErrorAlert } from '../ui/RequestState';

type TechManagerSummary = components['schemas']['TechManagerSummary'];
type PagedTechManagerSummary = components['schemas']['PagedTechManagerSummary'];
type VerificationStatus = components['schemas']['VerificationStatus'];
type TechManagerUpdateRequest = components['schemas']['TechManagerUpdateRequest'];

export function TechManagersPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [data, setData] = useState<PagedTechManagerSummary | null>(null);
  const [q, setQ] = useState('');
  const [regionCode, setRegionCode] = useState('');
  const [status, setStatus] = useState<VerificationStatus | ''>('');

  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TechManagerSummary | null>(null);
  const [intro, setIntro] = useState('');
  const [serviceTagsInput, setServiceTagsInput] = useState('');
  const [featuredRank, setFeaturedRank] = useState<number | null>(null);
  const [featuredUntil, setFeaturedUntil] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<PagedTechManagerSummary>('/admin/tech-managers', {
        q: q.trim() || undefined,
        regionCode: regionCode.trim() || undefined,
        verificationStatus: status || undefined,
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
  }, [q, regionCode, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => data?.items || [], [data?.items]);

  const openEdit = useCallback((r: TechManagerSummary) => {
    setEditTarget(r);
    setIntro(r.intro || '');
    setServiceTagsInput((r.serviceTags || []).join('，'));
    setFeaturedRank(null);
    setFeaturedUntil('');
    setEditOpen(true);
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editTarget) return;
    if (saving) return;
    const tags = serviceTagsInput
      .split(/[,，]/)
      .map((t) => t.trim())
      .filter(Boolean);
    const payload: TechManagerUpdateRequest = {
      ...(intro.trim() ? { intro: intro.trim() } : {}),
      ...(tags.length ? { serviceTags: tags } : {}),
      ...(featuredRank !== null ? { featuredRank } : {}),
      ...(featuredUntil.trim() ? { featuredUntil: featuredUntil.trim() } : {}),
    };

    setSaving(true);
    try {
      await apiPatch(`/admin/tech-managers/${editTarget.userId}`, payload, {
        idempotencyKey: `tech-manager-${editTarget.userId}-${Date.now()}`,
      });
      message.success('已保存');
      setEditOpen(false);
      void load();
    } catch (e: any) {
      message.error(e?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  }, [editTarget, featuredRank, featuredUntil, intro, load, saving, serviceTagsInput]);

  return (
    <Card>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Typography.Title level={3} style={{ marginTop: 0 }}>
            技术经理人
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            技术经理人展示与服务标签维护，支持排序/推荐配置。
          </Typography.Paragraph>
        </div>

        {error ? <RequestErrorAlert error={error} onRetry={load} /> : null}

        <Space wrap size={12}>
          <Input
            value={q}
            style={{ width: 220 }}
            placeholder="关键词（姓名/机构/擅长方向）"
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
            value={status}
            style={{ width: 160 }}
            placeholder="认证状态"
            onChange={(v) => setStatus((v as VerificationStatus) || '')}
            options={[
              { value: '', label: '全部状态' },
              { value: 'PENDING', label: '待审核' },
              { value: 'APPROVED', label: '已通过' },
              { value: 'REJECTED', label: '已驳回' },
            ]}
          />
          <Button onClick={load}>查询</Button>
        </Space>

        <Table<TechManagerSummary>
          rowKey="userId"
          loading={loading}
          dataSource={rows}
          pagination={false}
          columns={[
            { title: '姓名', dataIndex: 'displayName', render: (v) => v || '-' },
            { title: '类型', dataIndex: 'verificationType', render: (v) => verificationTypeLabel(v) },
            {
              title: '认证状态',
              dataIndex: 'verificationStatus',
              render: (v) => <Tag>{verificationStatusLabel(v)}</Tag>,
            },
            { title: '地区', dataIndex: 'regionCode', render: (v) => v || '-' },
            {
              title: '服务标签',
              dataIndex: 'serviceTags',
              render: (tags: string[]) =>
                tags?.length ? (
                  <Space wrap>
                    {tags.slice(0, 4).map((t) => (
                      <Tag key={t}>{t}</Tag>
                    ))}
                  </Space>
                ) : (
                  '-'
                ),
            },
            {
              title: '统计',
              key: 'stats',
              render: (_, r) => {
                const stats = r.stats;
                const consult = stats?.consultCount ?? 0;
                const deal = stats?.dealCount ?? 0;
                const rating = stats?.ratingScore ?? '-';
                const ratingCount = stats?.ratingCount ?? 0;
                return `咨询 ${consult} · 成交 ${deal} · 评分 ${rating} (${ratingCount})`;
              },
            },
            { title: '认证时间', dataIndex: 'verifiedAt', render: (v) => (v ? formatTimeSmart(v) : '-') },
            {
              title: '操作',
              key: 'actions',
              render: (_, r) => (
                <Space>
                  <Button onClick={() => openEdit(r)}>编辑</Button>
                </Space>
              ),
            },
          ]}
        />

        <Button onClick={load}>刷新</Button>
      </Space>

      <Drawer
        title={editTarget?.displayName ? `编辑：${editTarget.displayName}` : '编辑技术经理人'}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        width={560}
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
              <Typography.Text strong>简介</Typography.Text>
              <Input.TextArea
                value={intro}
                onChange={(e) => setIntro(e.target.value)}
                placeholder="服务简介（2000 字以内）"
                autoSize={{ minRows: 3, maxRows: 6 }}
                style={{ marginTop: 8 }}
              />
            </div>

            <div>
              <Typography.Text strong>服务标签</Typography.Text>
              <Input
                value={serviceTagsInput}
                onChange={(e) => setServiceTagsInput(e.target.value)}
                placeholder="用逗号分隔，例如：技术转移，政策申报，尽调"
                style={{ marginTop: 8 }}
              />
            </div>

            <div>
              <Typography.Text strong>推荐排序</Typography.Text>
              <InputNumber
                value={featuredRank ?? undefined}
                onChange={(v) => setFeaturedRank(typeof v === 'number' ? v : null)}
                min={0}
                style={{ width: 200, marginTop: 8 }}
              />
            </div>

            <div>
              <Typography.Text strong>推荐有效期</Typography.Text>
              <Input
                value={featuredUntil}
                onChange={(e) => setFeaturedUntil(e.target.value)}
                placeholder="ISO8601，例如 2026-12-31T00:00:00Z"
                style={{ marginTop: 8 }}
              />
            </div>

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
