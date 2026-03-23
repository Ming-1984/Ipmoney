import { Button, Card, Input, Select, Space, Table, Tag, Typography, message } from 'antd';
import React, { useCallback, useEffect, useState } from 'react';

import { apiGet, apiPost } from '../lib/api';
import { formatTimeSmart } from '../lib/format';
import { RequestErrorAlert } from '../ui/RequestState';
import { confirmActionWithReason } from '../ui/confirm';

type ClaimStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

type ClaimItem = {
  id: string;
  patentId: string;
  applicantUserId: string;
  status: ClaimStatus;
  claimReason?: string | null;
  evidenceFileIds?: string[];
  reviewerUserId?: string | null;
  reviewComment?: string | null;
  submittedAt: string;
  reviewedAt?: string | null;
};

type Paged<T> = { items: T[]; page: { page: number; pageSize: number; total: number } };

const statusOptions: Array<{ value: ClaimStatus | ''; label: string }> = [
  { value: '', label: '全部状态' },
  { value: 'PENDING', label: '待审核' },
  { value: 'APPROVED', label: '已通过' },
  { value: 'REJECTED', label: '已驳回' },
];

function statusTag(status: ClaimStatus) {
  if (status === 'APPROVED') return <Tag color="green">已通过</Tag>;
  if (status === 'REJECTED') return <Tag color="red">已驳回</Tag>;
  return <Tag color="gold">待审核</Tag>;
}

export function PatentClaimsPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [data, setData] = useState<Paged<ClaimItem> | null>(null);
  const [page, setPage] = useState(1);
  const [draftStatus, setDraftStatus] = useState<ClaimStatus | ''>('PENDING');
  const [draftQ, setDraftQ] = useState('');
  const [appliedStatus, setAppliedStatus] = useState<ClaimStatus | ''>('PENDING');
  const [appliedQ, setAppliedQ] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<Paged<ClaimItem>>('/admin/patent-claims', {
        page,
        pageSize: 20,
        status: appliedStatus || undefined,
        q: appliedQ.trim() || undefined,
      });
      setData(res);
    } catch (e: any) {
      setError(e);
      setData(null);
      message.error(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [appliedQ, appliedStatus, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyFilters = useCallback(() => {
    setPage(1);
    setAppliedQ(draftQ);
    setAppliedStatus(draftStatus);
  }, [draftQ, draftStatus]);

  const resetFilters = useCallback(() => {
    setPage(1);
    setDraftQ('');
    setDraftStatus('PENDING');
    setAppliedQ('');
    setAppliedStatus('PENDING');
  }, []);

  const approve = useCallback(
    async (row: ClaimItem) => {
      const { ok, reason } = await confirmActionWithReason({
        title: '确认通过认领？',
        content: `专利 ${row.patentId} 将归属给 ${row.applicantUserId}`,
        okText: '通过',
        reasonLabel: '审核备注（可选）',
      });
      if (!ok) return;
      try {
        await apiPost(
          `/admin/patent-claims/${row.id}/approve`,
          { reviewComment: reason || undefined },
          { idempotencyKey: `admin-claim-approve-${row.id}-${Date.now()}` },
        );
        message.success('认领已通过');
        void load();
      } catch (e: any) {
        message.error(e?.message || '通过失败');
      }
    },
    [load],
  );

  const reject = useCallback(
    async (row: ClaimItem) => {
      const { ok, reason } = await confirmActionWithReason({
        title: '确认驳回认领？',
        content: `认领单 ${row.id} 将被驳回`,
        okText: '驳回',
        reasonRequired: true,
        reasonLabel: '驳回原因',
        danger: true,
      });
      if (!ok) return;
      if (!reason) return message.error('驳回必须填写原因');
      try {
        await apiPost(
          `/admin/patent-claims/${row.id}/reject`,
          { reviewComment: reason },
          { idempotencyKey: `admin-claim-reject-${row.id}-${Date.now()}` },
        );
        message.success('认领已驳回');
        void load();
      } catch (e: any) {
        message.error(e?.message || '驳回失败');
      }
    },
    [load],
  );

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card>
        <Typography.Title level={3} style={{ marginTop: 0 }}>
          专利归属认领审核
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          审核用户认领请求；通过后会自动将专利归属到申请用户，并同步 OWNER 咨询路由。
        </Typography.Paragraph>
        {error ? <RequestErrorAlert error={error} onRetry={load} /> : null}
        <Space wrap style={{ marginBottom: 12 }}>
          <Input
            value={draftQ}
            allowClear
            style={{ width: 320 }}
            placeholder="搜索（认领理由/专利ID）"
            onChange={(e) => setDraftQ(e.target.value)}
            onPressEnter={applyFilters}
          />
          <Select
            value={draftStatus}
            style={{ width: 180 }}
            options={statusOptions}
            onChange={(v) => setDraftStatus((v as ClaimStatus) || '')}
          />
          <Button type="primary" onClick={applyFilters}>
            查询
          </Button>
          <Button onClick={resetFilters}>
            重置
          </Button>
          <Button onClick={() => void load()}>刷新</Button>
        </Space>
        <Table<ClaimItem>
          rowKey="id"
          loading={loading}
          dataSource={data?.items || []}
          pagination={{
            current: data?.page.page || page,
            pageSize: data?.page.pageSize || 20,
            total: data?.page.total || 0,
            onChange: (next) => setPage(next),
          }}
          columns={[
            { title: '认领单ID', dataIndex: 'id', width: 230 },
            { title: '专利ID', dataIndex: 'patentId', width: 230 },
            { title: '申请用户ID', dataIndex: 'applicantUserId', width: 230 },
            { title: '状态', dataIndex: 'status', width: 100, render: (v: ClaimStatus) => statusTag(v) },
            { title: '认领说明', dataIndex: 'claimReason', render: (v: string | null | undefined) => v || '-' },
            { title: '证据文件数', render: (_, row) => row.evidenceFileIds?.length || 0, width: 110 },
            { title: '提交时间', dataIndex: 'submittedAt', width: 160, render: (v: string) => formatTimeSmart(v) },
            { title: '审核人', dataIndex: 'reviewerUserId', width: 220, render: (v: string | null | undefined) => v || '-' },
            { title: '审核时间', dataIndex: 'reviewedAt', width: 160, render: (v: string | null | undefined) => (v ? formatTimeSmart(v) : '-') },
            { title: '审核备注', dataIndex: 'reviewComment', width: 200, render: (v: string | null | undefined) => v || '-' },
            {
              title: '操作',
              width: 170,
              render: (_, row) =>
                row.status === 'PENDING' ? (
                  <Space>
                    <Button size="small" type="primary" onClick={() => void approve(row)}>
                      通过
                    </Button>
                    <Button size="small" danger onClick={() => void reject(row)}>
                      驳回
                    </Button>
                  </Space>
                ) : (
                  <Typography.Text type="secondary">已处理</Typography.Text>
                ),
            },
          ]}
        />
      </Card>
    </Space>
  );
}
