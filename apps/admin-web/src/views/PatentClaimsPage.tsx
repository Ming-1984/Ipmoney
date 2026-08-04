import { Button, Card, Descriptions, Drawer, Input, Select, Space, Table, Tag, Typography, message } from 'antd';
import React, { useCallback, useEffect, useState } from 'react';

import { apiGet, apiPost } from '../lib/api';
import { formatTimeSmart } from '../lib/format';
import { normalizeUserFacingText } from '../lib/userFacingText';
import { RequestErrorAlert } from '../ui/RequestState';
import { confirmActionWithReason } from '../ui/confirm';

type ClaimStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

type ClaimItem = {
  id: string;
  patentId: string;
  patentTitle?: string | null;
  patentApplicationNoDisplay?: string | null;
  patentApplicationNoNorm?: string | null;
  applicantUserId: string;
  applicantDisplayName?: string | null;
  status: ClaimStatus;
  claimReason?: string | null;
  evidenceFileIds?: string[];
  reviewerUserId?: string | null;
  reviewerDisplayName?: string | null;
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
  if (status === 'PENDING') return <Tag color="gold">待审核</Tag>;
  return <Tag>状态待确认</Tag>;
}

function displayClaimText(value: unknown, fallback = '待确认'): string {
  return normalizeUserFacingText(value) || fallback;
}

function materialCountText(row: ClaimItem): string {
  return `${row.evidenceFileIds?.length || 0} 份`;
}

function materialIds(row: ClaimItem): string[] {
  return Array.from(new Set((row.evidenceFileIds || []).map((item) => String(item || '').trim()).filter(Boolean)));
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
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTarget, setDetailTarget] = useState<ClaimItem | null>(null);

  const openMaterial = useCallback(async (fileId: string) => {
    const normalizedFileId = String(fileId || '').trim();
    if (!normalizedFileId) {
      message.warning('材料文件编号为空');
      return;
    }
    const previewWindow = window.open('about:blank', '_blank');
    if (previewWindow) previewWindow.opener = null;
    try {
      const temp = await apiPost<{ url: string }>(`/files/${normalizedFileId}/temporary-access`, {
        scope: 'preview',
      });
      if (!temp?.url) throw new Error('empty preview url');
      if (previewWindow) {
        previewWindow.location.href = temp.url;
      } else {
        window.open(temp.url, '_blank', 'noopener,noreferrer');
      }
    } catch (e: any) {
      if (previewWindow) previewWindow.close();
      message.error(e?.message || '打开材料失败');
    }
  }, []);

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
      const applicantName = displayClaimText(row.applicantDisplayName, '申请人待确认');
      const { ok, reason } = await confirmActionWithReason({
        title: '确认通过认领？',
        content: `通过后将把该专利记录归属到申请人 ${applicantName}。`,
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
        setDetailOpen(false);
        setDetailTarget(null);
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
        setDetailOpen(false);
        setDetailTarget(null);
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
            placeholder="搜索（认领理由/专利记录编号）"
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
            {
              title: '认领摘要',
              width: 360,
              render: (_, row) => (
                <Space direction="vertical" size={2}>
                  <Typography.Text>{displayClaimText(row.applicantDisplayName, '申请人待确认')}</Typography.Text>
                  <Typography.Text type="secondary">专利记录：{displayClaimText(row.patentId)}</Typography.Text>
                  <Typography.Text type="secondary">{displayClaimText(row.claimReason, '暂无认领说明')}</Typography.Text>
                  <Typography.Text type="secondary" copyable={{ text: row.id }}>
                    认领单号：{row.id}
                  </Typography.Text>
                </Space>
              ),
            },
            { title: '状态', dataIndex: 'status', width: 100, render: (v: ClaimStatus) => statusTag(v) },
            { title: '证据材料', render: (_, row) => materialCountText(row), width: 110 },
            { title: '提交时间', dataIndex: 'submittedAt', width: 160, render: (v: string) => formatTimeSmart(v) },
            {
              title: '审核人',
              width: 220,
              render: (_, row) => displayClaimText(row.reviewerDisplayName, '待处理'),
            },
            { title: '审核时间', dataIndex: 'reviewedAt', width: 160, render: (v: string | null | undefined) => (v ? formatTimeSmart(v) : '-') },
            { title: '审核备注', dataIndex: 'reviewComment', width: 200, render: (v: string | null | undefined) => displayClaimText(v) },
            {
              title: '操作',
              width: 230,
              render: (_, row) => (
                <Space>
                  <Button
                    size="small"
                    onClick={() => {
                      setDetailTarget(row);
                      setDetailOpen(true);
                    }}
                  >
                    详情
                  </Button>
                  {row.status === 'PENDING' ? (
                    <>
                      <Button size="small" type="primary" onClick={() => void approve(row)}>
                        通过
                      </Button>
                      <Button size="small" danger onClick={() => void reject(row)}>
                        驳回
                      </Button>
                    </>
                  ) : (
                    <Typography.Text type="secondary">已处理</Typography.Text>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Drawer
        title="认领详情"
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetailTarget(null);
        }}
        width={640}
        destroyOnClose
      >
        {detailTarget ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Descriptions size="small" column={1} bordered>
              <Descriptions.Item label="认领单号">
                <Typography.Text copyable={{ text: detailTarget.id }}>{detailTarget.id}</Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="专利记录编号">
                <Typography.Text copyable={{ text: detailTarget.patentId }}>{detailTarget.patentId}</Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="专利名称">{displayClaimText(detailTarget.patentTitle)}</Descriptions.Item>
              <Descriptions.Item label="申请号">
                {displayClaimText(detailTarget.patentApplicationNoDisplay || detailTarget.patentApplicationNoNorm)}
              </Descriptions.Item>
              <Descriptions.Item label="申请人">
                {displayClaimText(detailTarget.applicantDisplayName, '申请人待确认')}
              </Descriptions.Item>
              <Descriptions.Item label="认领状态">{statusTag(detailTarget.status)}</Descriptions.Item>
              <Descriptions.Item label="提交时间">{formatTimeSmart(detailTarget.submittedAt)}</Descriptions.Item>
              <Descriptions.Item label="材料数量">{materialCountText(detailTarget)}</Descriptions.Item>
              <Descriptions.Item label="认领理由">
                <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                  {displayClaimText(detailTarget.claimReason, '暂无认领说明')}
                </Typography.Paragraph>
              </Descriptions.Item>
              <Descriptions.Item label="审核人">{displayClaimText(detailTarget.reviewerDisplayName, '待处理')}</Descriptions.Item>
              <Descriptions.Item label="审核时间">
                {detailTarget.reviewedAt ? formatTimeSmart(detailTarget.reviewedAt) : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="审核备注">{displayClaimText(detailTarget.reviewComment)}</Descriptions.Item>
            </Descriptions>
            <div>
              <Typography.Text strong>上传材料</Typography.Text>
              <div style={{ marginTop: 8 }}>
                {materialIds(detailTarget).length ? (
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    {materialIds(detailTarget).map((fileId, index) => (
                      <Space key={fileId} wrap>
                        <Typography.Text>
                          材料 {index + 1}
                        </Typography.Text>
                        <Typography.Text copyable={{ text: fileId }} type="secondary">
                          {fileId}
                        </Typography.Text>
                        <Button size="small" onClick={() => void openMaterial(fileId)}>
                          查看
                        </Button>
                      </Space>
                    ))}
                  </Space>
                ) : (
                  <Typography.Text type="secondary">暂无上传材料。</Typography.Text>
                )}
              </div>
            </div>
            {detailTarget.status === 'PENDING' ? (
              <Space>
                <Button type="primary" onClick={() => void approve(detailTarget)}>
                  通过
                </Button>
                <Button danger onClick={() => void reject(detailTarget)}>
                  驳回
                </Button>
              </Space>
            ) : null}
          </Space>
        ) : null}
      </Drawer>
    </Space>
  );
}
