import { Button, Card, Descriptions, Divider, Drawer, Form, Input, Modal, Select, Space, Table, Tag, Typography, Upload, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { apiGet, apiPost, apiUploadFile } from '../lib/api';
import { formatTimeSmart } from '../lib/format';
import { normalizeUserFacingText } from '../lib/userFacingText';
import { AuditHint, RequestErrorAlert } from '../ui/RequestState';
import { confirmActionWithReason } from '../ui/confirm';

type CaseType = 'FOLLOWUP' | 'REFUND' | 'DISPUTE';
type CaseStatus = 'OPEN' | 'IN_PROGRESS' | 'CLOSED';

type CaseSummary = {
  id: string;
  title: string;
  type: CaseType;
  status: CaseStatus;
  orderId?: string;
  requesterName?: string;
  assigneeName?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  createdAt: string;
  updatedAt?: string;
  dueAt?: string;
  slaStatus?: 'ON_TIME' | 'OVERDUE';
};

type CaseNote = {
  id: string;
  authorName: string | null;
  content: string;
  createdAt: string;
};

type CaseDetail = CaseSummary & {
  description?: string;
  assigneeId?: string;
  notes?: CaseNote[];
  evidenceFiles?: { id: string; name: string; url?: string }[];
};

type PagedCases = {
  items: CaseSummary[];
  page: { page: number; pageSize: number; total: number };
};

type RbacUser = {
  id: string;
  name: string;
  roleIds: string[];
};

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

const statusOptions: { value: CaseStatus | ''; label: string }[] = [
  { value: '', label: '全部状态' },
  { value: 'OPEN', label: '待处理' },
  { value: 'IN_PROGRESS', label: '处理中' },
  { value: 'CLOSED', label: '已关闭' },
];

const typeOptions: { value: CaseType | ''; label: string }[] = [
  { value: '', label: '全部类型' },
  { value: 'FOLLOWUP', label: '订单跟单' },
  { value: 'REFUND', label: '退款争议' },
  { value: 'DISPUTE', label: '交易争议' },
];

const createTypeOptions = typeOptions.filter((opt) => opt.value) as { value: CaseType; label: string }[];

const priorityOptions: { value: 'LOW' | 'MEDIUM' | 'HIGH'; label: string }[] = [
  { value: 'LOW', label: '低' },
  { value: 'MEDIUM', label: '中' },
  { value: 'HIGH', label: '高' },
];

function caseTypeLabel(type?: CaseType | null): string {
  if (type === 'FOLLOWUP') return '订单跟单';
  if (type === 'REFUND') return '退款争议';
  if (type === 'DISPUTE') return '交易争议';
  return '类型待确认';
}

function priorityLabel(priority?: 'LOW' | 'MEDIUM' | 'HIGH' | null): string {
  if (priority === 'LOW') return '低';
  if (priority === 'MEDIUM') return '中';
  if (priority === 'HIGH') return '高';
  return '待确认';
}

function caseStatusActionLabel(status: CaseStatus): string {
  if (status === 'OPEN') return '待处理';
  if (status === 'IN_PROGRESS') return '处理中';
  if (status === 'CLOSED') return '已关闭';
  return '待确认';
}

function statusTag(status: CaseStatus) {
  if (status === 'CLOSED') return <Tag color="default">已关闭</Tag>;
  if (status === 'IN_PROGRESS') return <Tag color="blue">处理中</Tag>;
  return <Tag color="gold">待处理</Tag>;
}

function displayCaseText(value: unknown, fallback = '-'): string {
  return normalizeUserFacingText(value) || fallback;
}

export function CasesPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [data, setData] = useState<PagedCases | null>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<CaseStatus | ''>('');
  const [type, setType] = useState<CaseType | ''>('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm] = Form.useForm();

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [assignees, setAssignees] = useState<RbacUser[]>([]);
  const [roleNameMap, setRoleNameMap] = useState<Record<string, string>>({});
  const [noteInput, setNoteInput] = useState('');
  const [slaDueAt, setSlaDueAt] = useState('');
  const [evidenceUploading, setEvidenceUploading] = useState(false);
  const loadSeqRef = useRef(0);
  const detailSeqRef = useRef(0);
  const detailIdRef = useRef<string | null>(null);
  const detailSessionRef = useRef(0);
  const createSeqRef = useRef(0);
  const detailActionSeqRef = useRef(0);
  const evidenceUploadSeqRef = useRef(0);

  useEffect(() => {
    createSeqRef.current += 1;
  }, [createOpen]);

  const load = useCallback(async (opts?: { page?: number; pageSize?: number }) => {
    const nextPage = opts?.page ?? page;
    const nextPageSize = opts?.pageSize ?? pageSize;
    const seq = ++loadSeqRef.current;
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<PagedCases>('/admin/cases', {
        q: q.trim() || undefined,
        status: status || undefined,
        type: type || undefined,
        page: nextPage,
        pageSize: nextPageSize,
      });
      if (seq !== loadSeqRef.current) return;
      setData(d);
    } catch (e: any) {
      if (seq !== loadSeqRef.current) return;
      setError(e);
      message.error(e?.message || '加载失败');
      setData(null);
    } finally {
      if (seq !== loadSeqRef.current) return;
      setLoading(false);
    }
  }, [page, pageSize, q, status, type]);

  const loadAssignees = useCallback(async () => {
    try {
      const [usersRes, rolesRes] = await Promise.all([
        apiGet<{ items?: any[] }>('/admin/rbac/users', { scope: 'STAFF' }),
        apiGet<{ items?: any[] }>('/admin/rbac/roles').catch(() => ({ items: [] as any[] })),
      ]);

      const nextRoleNameMap: Record<string, string> = {};
      const roleItems = Array.isArray(rolesRes?.items) ? rolesRes.items : [];
      for (const rawRole of roleItems) {
        const roleId = typeof rawRole?.id === 'string' ? rawRole.id : '';
        const roleName = typeof rawRole?.name === 'string' ? rawRole.name.trim() : '';
        if (roleId && roleName) nextRoleNameMap[roleId] = roleName;
      }
      setRoleNameMap(nextRoleNameMap);

      const next: RbacUser[] = (Array.isArray(usersRes?.items) ? usersRes.items : []).flatMap((raw) => {
        const id = typeof raw?.id === 'string' ? raw.id : '';
        if (!id) return [];
        const displayName = typeof raw?.name === 'string' && raw.name.trim().length ? raw.name.trim() : id;
        return [
          {
            id,
            name: displayName,
            roleIds: normalizeStringArray(raw?.roleIds),
          },
        ];
      });
      setAssignees(next);
    } catch {
      setAssignees([]);
      setRoleNameMap({});
    }
  }, []);

  useEffect(() => {
    void load();
    void loadAssignees();
  }, [load, loadAssignees]);

  const handleSearch = useCallback(() => {
    setPage(1);
    void load({ page: 1 });
  }, [load]);

  const rows = useMemo(() => data?.items || [], [data?.items]);
  const formatAssigneeLabel = useCallback(
    (user: RbacUser, separator = ' / ') => {
      const roles = normalizeStringArray(user.roleIds).map((roleId) => roleNameMap[roleId] || roleId);
      return roles.length ? `${user.name}（${roles.join(separator)}）` : user.name;
    },
    [roleNameMap],
  );
  const createAssigneeOptions = useMemo(
    () =>
      assignees.map((u) => ({
        value: u.id,
        label: formatAssigneeLabel(u, ' / '),
      })),
    [assignees, formatAssigneeLabel],
  );
  const detailAssigneeOptions = useMemo(
    () =>
      assignees.map((u) => ({
        value: u.id,
        label: formatAssigneeLabel(u, '、'),
      })),
    [assignees, formatAssigneeLabel],
  );

  const openDetail = useCallback(async (id: string) => {
    const seq = ++detailSeqRef.current;
    const session = ++detailSessionRef.current;
    detailIdRef.current = id;
    setDetailOpen(true);
    setDetailLoading(true);
    setDetail(null);
    setNoteInput('');
    setSlaDueAt('');
    try {
      const d = await apiGet<CaseDetail>(`/admin/cases/${id}`);
      if (seq !== detailSeqRef.current || detailIdRef.current !== id || detailSessionRef.current !== session) return;
      setDetail(d);
      setSlaDueAt(d.dueAt || '');
    } catch (e: any) {
      if (seq !== detailSeqRef.current || detailIdRef.current !== id || detailSessionRef.current !== session) return;
      setDetailOpen(false);
      message.error(e?.message || '加载详情失败');
    } finally {
      if (seq !== detailSeqRef.current || detailIdRef.current !== id || detailSessionRef.current !== session) return;
      setDetailLoading(false);
    }
  }, []);

  return (
    <Card className="admin-cases-page">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Typography.Title level={3} style={{ marginTop: 0 }}>
            客服工单/争议处理
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            用于订单跟单、退款争议与交易争议的闭环管理。
          </Typography.Paragraph>
        </div>

        {error ? (
          <RequestErrorAlert error={error} onRetry={load} />
        ) : (
          <AuditHint text="工单涉及资金与纠纷处理，操作需留痕并可追溯。" />
        )}

        <Space wrap size={12}>
          <Input
            value={q}
            style={{ width: 260 }}
            placeholder="关键词（订单号/标题/用户）"
            allowClear
            onChange={(e) => setQ(e.target.value)}
            onPressEnter={handleSearch}
          />
          <Select
            value={type}
            style={{ width: 180 }}
            placeholder="工单类型"
            onChange={(v) => setType((v as CaseType) || '')}
            options={typeOptions}
          />
          <Select
            value={status}
            style={{ width: 180 }}
            placeholder="状态"
            onChange={(v) => setStatus((v as CaseStatus) || '')}
            options={statusOptions}
          />
          <Button onClick={handleSearch}>查询</Button>
          <Button
            type="primary"
            onClick={() => {
              createForm.resetFields();
              createForm.setFieldsValue({ type: 'FOLLOWUP', priority: 'MEDIUM' });
              setCreateOpen(true);
            }}
          >
            新建工单
          </Button>
        </Space>

        <Table<CaseSummary>
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
            { title: '工单号', dataIndex: 'id' },
            { title: '类型', dataIndex: 'type', render: (value) => caseTypeLabel(value) },
            { title: '标题', dataIndex: 'title', render: (value) => normalizeUserFacingText(value) || '未命名工单' },
            { title: '状态', dataIndex: 'status', render: (_, r) => statusTag(r.status) },
            { title: '订单号', dataIndex: 'orderId', render: (v) => displayCaseText(v) },
            { title: '跟单客服', dataIndex: 'assigneeName', render: (v) => displayCaseText(v) },
            {
              title: 'SLA',
              dataIndex: 'slaStatus',
              render: (_, r) =>
                r.dueAt ? (
                  <Space size={6}>
                    <Tag color={r.slaStatus === 'OVERDUE' ? 'red' : 'green'}>
                      {r.slaStatus === 'OVERDUE' ? '已逾期' : '正常'}
                    </Tag>
                    <Typography.Text type="secondary">{formatTimeSmart(r.dueAt)}</Typography.Text>
                  </Space>
                ) : (
                  <Typography.Text type="secondary">-</Typography.Text>
                ),
            },
            { title: '创建时间', dataIndex: 'createdAt', render: (v) => formatTimeSmart(v) },
            {
              title: '操作',
              key: 'actions',
              render: (_, r) => (
                <Space>
                  <Button onClick={() => void openDetail(r.id)}>详情</Button>
                </Space>
              ),
            },
          ]}
        />

        <Modal
          open={createOpen}
          title="新建工单"
          destroyOnClose
          onCancel={() => {
            setCreateOpen(false);
            createForm.resetFields();
          }}
          onOk={async () => {
            const requestSeq = ++createSeqRef.current;
            try {
              const v = await createForm.validateFields();
              if (createSeqRef.current !== requestSeq || !createOpen) return;
              const { ok } = await confirmActionWithReason({
                title: '确认创建工单？',
                content: '新工单将进入待处理状态，可在详情中继续分派与跟进。',
                okText: '创建',
                reasonLabel: '原因/备注（建议填写）',
              });
              if (!ok) return;
              if (createSeqRef.current !== requestSeq || !createOpen) return;
              await apiPost('/admin/cases', {
                title: v.title?.trim(),
                type: v.type,
                priority: v.priority,
                requesterName: v.requesterName?.trim() || undefined,
                description: v.description?.trim() || undefined,
                orderId: v.orderId?.trim() || undefined,
                assigneeId: v.assigneeId || undefined,
                dueAt: v.dueAt?.trim() || undefined,
              });
              if (createSeqRef.current !== requestSeq || !createOpen) return;
              message.success('已创建');
              setCreateOpen(false);
              createForm.resetFields();
              void load();
            } catch (e: any) {
              if (e?.errorFields) return;
              if (createSeqRef.current !== requestSeq || !createOpen) return;
              message.error(e?.message || '创建失败');
            }
          }}
        >
          <Form form={createForm} layout="vertical">
            <Form.Item label="工单标题" name="title" rules={[{ required: true, message: '请输入工单标题' }]}>
              <Input placeholder="例：订单跟单 / 退款争议" />
            </Form.Item>
            <Form.Item label="类型" name="type" rules={[{ required: true, message: '请选择工单类型' }]}>
              <Select options={createTypeOptions} />
            </Form.Item>
            <Form.Item label="优先级" name="priority">
              <Select options={priorityOptions} />
            </Form.Item>
            <Form.Item label="发起人" name="requesterName">
              <Input placeholder="留空则不设置发起人名称" />
            </Form.Item>
            <Form.Item label="关联订单ID" name="orderId">
              <Input placeholder="订单ID（可选）" />
            </Form.Item>
            <Form.Item label="跟单客服" name="assigneeId">
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                options={createAssigneeOptions}
                placeholder="可选"
              />
            </Form.Item>
            <Form.Item label="SLA 截止（ISO）" name="dueAt">
              <Input placeholder="YYYY-MM-DD 或 YYYY-MM-DDTHH:mm:ss" />
            </Form.Item>
            <Form.Item label="描述" name="description">
              <Input.TextArea rows={3} placeholder="问题描述/处理要点" />
            </Form.Item>
          </Form>
        </Modal>
      </Space>

      <Drawer
        title={normalizeUserFacingText(detail?.title) ? `工单详情：${normalizeUserFacingText(detail?.title)}` : '工单详情'}
        open={detailOpen}
        onClose={() => {
          detailSeqRef.current += 1;
          detailSessionRef.current += 1;
          detailActionSeqRef.current += 1;
          evidenceUploadSeqRef.current += 1;
          detailIdRef.current = null;
          setDetailOpen(false);
          setDetailLoading(false);
          setEvidenceUploading(false);
          setDetail(null);
          setNoteInput('');
          setSlaDueAt('');
        }}
        width={640}
        destroyOnClose
      >
        {detailLoading ? (
          <Typography.Text type="secondary">加载详情中...</Typography.Text>
        ) : detail ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Descriptions size="small" bordered column={2}>
              <Descriptions.Item label="工单号">{detail.id}</Descriptions.Item>
              <Descriptions.Item label="类型">{caseTypeLabel(detail.type)}</Descriptions.Item>
              <Descriptions.Item label="状态">{statusTag(detail.status)}</Descriptions.Item>
              <Descriptions.Item label="订单号">{displayCaseText(detail.orderId)}</Descriptions.Item>
              <Descriptions.Item label="发起人">{displayCaseText(detail.requesterName)}</Descriptions.Item>
              <Descriptions.Item label="跟单客服">{displayCaseText(detail.assigneeName)}</Descriptions.Item>
              <Descriptions.Item label="优先级">{priorityLabel(detail.priority)}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{formatTimeSmart(detail.createdAt)}</Descriptions.Item>
              <Descriptions.Item label="SLA 截止">
                {detail.dueAt ? formatTimeSmart(detail.dueAt) : '待确认'}
              </Descriptions.Item>
              <Descriptions.Item label="SLA 状态">
                {detail.slaStatus ? (
                  <Tag color={detail.slaStatus === 'OVERDUE' ? 'red' : 'green'}>
                    {detail.slaStatus === 'OVERDUE' ? '已逾期' : '正常'}
                  </Tag>
                ) : (
                  '待确认'
                )}
              </Descriptions.Item>
            </Descriptions>

            <div>
              <Typography.Text strong>描述</Typography.Text>
              <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
                {normalizeUserFacingText(detail.description) || '暂无描述'}
              </Typography.Paragraph>
            </div>

            <div>
              <Typography.Text strong>分配客服</Typography.Text>
              <Space style={{ marginTop: 8 }}>
                <Select
                  style={{ width: 240 }}
                  showSearch
                  optionFilterProp="label"
                  placeholder="选择客服/运营"
                  options={detailAssigneeOptions}
                  value={detail.assigneeId || undefined}
                  onChange={async (v) => {
                    const targetCaseId = detail.id;
                    const session = detailSessionRef.current;
                    const { ok, reason } = await confirmActionWithReason({
                      title: '确认分配客服？',
                      content: '分配后该客服将负责跟进与闭环。',
                      okText: '确认分配',
                      reasonLabel: '分配原因（建议填写）',
                    });
                    if (!ok) return;
                    const requestSeq = ++detailActionSeqRef.current;
                    try {
                      const next = await apiPost<CaseDetail>(`/admin/cases/${detail.id}/assign`, {
                        assigneeId: v,
                        reason: reason || undefined,
                      });
                      if (
                        detailActionSeqRef.current !== requestSeq ||
                        detailIdRef.current !== targetCaseId ||
                        detailSessionRef.current !== session
                      ) {
                        return;
                      }
                      setDetail(next);
                      message.success('已分配');
                      void load();
                    } catch (e: any) {
                      if (
                        detailActionSeqRef.current !== requestSeq ||
                        detailIdRef.current !== targetCaseId ||
                        detailSessionRef.current !== session
                      ) {
                        return;
                      }
                      message.error(e?.message || '分配失败');
                    }
                  }}
                />
              </Space>
            </div>

            <Divider />

            <div>
              <Typography.Text strong>SLA 截止时间</Typography.Text>
              <Space style={{ marginTop: 8 }}>
                <Input
                  value={slaDueAt}
                  onChange={(e) => setSlaDueAt(e.target.value)}
                  style={{ width: 280 }}
                  placeholder="ISO8601（例：2026-02-20T00:00:00Z）"
                />
                <Button
                  onClick={async () => {
                    const targetCaseId = detail.id;
                    const session = detailSessionRef.current;
                    const { ok, reason } = await confirmActionWithReason({
                      title: '确认更新 SLA？',
                      content: '更新后将影响逾期判断与提醒策略。',
                      okText: '确认更新',
                      reasonLabel: '备注（建议填写）',
                    });
                    if (!ok) return;
                    const requestSeq = ++detailActionSeqRef.current;
                    try {
                      const next = await apiPost<CaseDetail>(`/admin/cases/${detail.id}/sla`, {
                        dueAt: slaDueAt || undefined,
                        reason: reason || undefined,
                      });
                      if (
                        detailActionSeqRef.current !== requestSeq ||
                        detailIdRef.current !== targetCaseId ||
                        detailSessionRef.current !== session
                      ) {
                        return;
                      }
                      setDetail(next);
                      message.success('已更新');
                    } catch (e: any) {
                      if (
                        detailActionSeqRef.current !== requestSeq ||
                        detailIdRef.current !== targetCaseId ||
                        detailSessionRef.current !== session
                      ) {
                        return;
                      }
                      message.error(e?.message || '更新失败');
                    }
                  }}
                >
                  更新 SLA
                </Button>
              </Space>
            </div>

            <Divider />

            <div>
              <Typography.Text strong>证据/附件</Typography.Text>
              <Space style={{ marginTop: 8 }} wrap>
                <Upload
                  showUploadList={false}
                  customRequest={async (options) => {
                    const targetCaseId = detail.id;
                    const session = detailSessionRef.current;
                    const requestSeq = ++evidenceUploadSeqRef.current;
                    setEvidenceUploading(true);
                    try {
                      const fo = await apiUploadFile(options.file as File, 'CASE_EVIDENCE');
                      if (
                        evidenceUploadSeqRef.current !== requestSeq ||
                        detailIdRef.current !== targetCaseId ||
                        detailSessionRef.current !== session
                      ) {
                        return;
                      }
                      const next = await apiPost<CaseDetail>(`/admin/cases/${detail.id}/evidence`, {
                        fileId: fo.id,
                        fileName: (options.file as File)?.name,
                        url: fo.url,
                      });
                      if (
                        evidenceUploadSeqRef.current !== requestSeq ||
                        detailIdRef.current !== targetCaseId ||
                        detailSessionRef.current !== session
                      ) {
                        return;
                      }
                      setDetail(next);
                      message.success('已上传');
                      options.onSuccess?.(fo as any);
                    } catch (e: any) {
                      if (
                        evidenceUploadSeqRef.current !== requestSeq ||
                        detailIdRef.current !== targetCaseId ||
                        detailSessionRef.current !== session
                      ) {
                        return;
                      }
                      options.onError?.(e);
                      message.error(e?.message || '上传失败');
                    } finally {
                      if (
                        evidenceUploadSeqRef.current !== requestSeq ||
                        detailIdRef.current !== targetCaseId ||
                        detailSessionRef.current !== session
                      ) {
                        return;
                      }
                      setEvidenceUploading(false);
                    }
                  }}
                >
                  <Button loading={evidenceUploading}>上传证据</Button>
                </Upload>
              </Space>
              <Space direction="vertical" size={8} style={{ width: '100%', marginTop: 12 }}>
                {(detail.evidenceFiles || []).map((file) => (
                  <Card key={file.id} size="small">
                    <Space direction="vertical" size={4}>
                      <Typography.Text>{displayCaseText(file.name, '附件待补充')}</Typography.Text>
                      {file.url ? (
                        <a href={file.url} target="_blank" rel="noreferrer">
                          查看附件
                        </a>
                      ) : (
                        <Typography.Text type="secondary">{file.id}</Typography.Text>
                      )}
                    </Space>
                  </Card>
                ))}
                {!detail.evidenceFiles?.length ? (
                  <Typography.Text type="secondary">暂无证据附件。</Typography.Text>
                ) : null}
              </Space>
            </div>

            <Divider />

            <div>
              <Typography.Text strong>状态流转</Typography.Text>
              <Space style={{ marginTop: 8 }} wrap>
                {(['OPEN', 'IN_PROGRESS', 'CLOSED'] as CaseStatus[]).map((s) => (
                  <Button
                    key={s}
                    onClick={async () => {
                      const targetCaseId = detail.id;
                      const session = detailSessionRef.current;
                      const { ok, reason } = await confirmActionWithReason({
                        title: '确认更新工单状态？',
                        content: `变更为 ${s} 将记录审计留痕。`,
                        okText: '确认变更',
                        reasonLabel: '备注（建议填写）',
                      });
                      if (!ok) return;
                      const requestSeq = ++detailActionSeqRef.current;
                      try {
                        const next = await apiPost<CaseDetail>(`/admin/cases/${detail.id}/status`, {
                          status: s,
                          remark: reason || undefined,
                        });
                        if (
                          detailActionSeqRef.current !== requestSeq ||
                          detailIdRef.current !== targetCaseId ||
                          detailSessionRef.current !== session
                        ) {
                          return;
                        }
                        setDetail(next);
                        message.success('已更新');
                        void load();
                      } catch (e: any) {
                        if (
                          detailActionSeqRef.current !== requestSeq ||
                          detailIdRef.current !== targetCaseId ||
                          detailSessionRef.current !== session
                        ) {
                          return;
                        }
                        message.error(e?.message || '更新失败');
                      }
                    }}
                  >
                    设为{caseStatusActionLabel(s)}
                  </Button>
                ))}
              </Space>
            </div>

            <div>
              <Typography.Text strong>备注/进展</Typography.Text>
              <Space direction="vertical" size={8} style={{ width: '100%', marginTop: 8 }}>
                <Input.TextArea
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="记录处理进展/证据来源/沟通结果等"
                  rows={3}
                />
                <Button
                  type="primary"
                  disabled={!noteInput.trim()}
                  onClick={async () => {
                    const targetCaseId = detail.id;
                    const session = detailSessionRef.current;
                    const requestSeq = ++detailActionSeqRef.current;
                    try {
                      const next = await apiPost<CaseDetail>(`/admin/cases/${detail.id}/notes`, {
                        note: noteInput.trim(),
                      });
                      if (
                        detailActionSeqRef.current !== requestSeq ||
                        detailIdRef.current !== targetCaseId ||
                        detailSessionRef.current !== session
                      ) {
                        return;
                      }
                      setDetail(next);
                      setNoteInput('');
                    } catch (e: any) {
                      if (
                        detailActionSeqRef.current !== requestSeq ||
                        detailIdRef.current !== targetCaseId ||
                        detailSessionRef.current !== session
                      ) {
                        return;
                      }
                      message.error(e?.message || '保存失败');
                    }
                  }}
                >
                  添加备注
                </Button>
              </Space>
              <Space direction="vertical" size={8} style={{ width: '100%', marginTop: 12 }}>
                {(detail.notes || []).map((note) => (
                  <Card key={note.id} size="small">
                    <Typography.Text strong>{displayCaseText(note.authorName)}</Typography.Text>
                    <Typography.Paragraph style={{ marginBottom: 4 }}>
                      {displayCaseText(note.content, '未填写')}
                    </Typography.Paragraph>
                    <Typography.Text type="secondary">{formatTimeSmart(note.createdAt)}</Typography.Text>
                  </Card>
                ))}
              </Space>
            </div>
          </Space>
        ) : (
          <Typography.Text type="secondary">暂无可展示的工单详情。</Typography.Text>
        )}
      </Drawer>
    </Card>
  );
}
