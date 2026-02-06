import { Button, Card, Descriptions, Divider, Drawer, Space, Table, Tag, Typography, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { apiGet, apiPost } from '../lib/api';
import { formatTimeSmart } from '../lib/format';
import { verificationTypeLabel } from '../lib/labels';
import { RequestErrorAlert, AuditHint } from '../ui/RequestState';
import { confirmActionWithReason } from '../ui/confirm';

type VerificationType =
  | 'PERSON'
  | 'COMPANY'
  | 'ACADEMY'
  | 'GOVERNMENT'
  | 'ASSOCIATION'
  | 'TECH_MANAGER';
type VerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

type UserVerification = {
  id: string;
  userId: string;
  type: VerificationType;
  status: VerificationStatus;
  displayName?: string;
  contactName?: string;
  contactPhoneMasked?: string;
  regionCode?: string;
  submittedAt: string;
  reviewedAt?: string;
  reviewComment?: string;
};

type PagedUserVerification = {
  items: UserVerification[];
  page: { page: number; pageSize: number; total: number };
};

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

function statusTag(status: VerificationStatus) {
  if (status === 'APPROVED') return <Tag color="green">已通过</Tag>;
  if (status === 'REJECTED') return <Tag color="red">已驳回</Tag>;
  return <Tag color="orange">待审核</Tag>;
}

export function VerificationsPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [data, setData] = useState<PagedUserVerification | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [active, setActive] = useState<UserVerification | null>(null);
  const [materials, setMaterials] = useState<AuditMaterial[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<PagedUserVerification>('/admin/user-verifications', {
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
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => data?.items || [], [data?.items]);

  return (
    <Card>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Typography.Title level={3} style={{ marginTop: 0 }}>
            认证审核
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            用于审核用户身份资料；通过后可在小程序端展示，并具备交易/咨询等权限。
          </Typography.Paragraph>
        </div>

        {error ? <RequestErrorAlert error={error} onRetry={load} /> : <AuditHint text="通过/驳回将影响小程序端机构展示；建议二次确认并记录原因。" />}

        <Table<UserVerification>
          rowKey="id"
          loading={loading}
          dataSource={rows}
          pagination={false}
          columns={[
            { title: '主体名称', dataIndex: 'displayName' },
            { title: '类型', dataIndex: 'type', render: (v) => verificationTypeLabel(v) },
            {
              title: '状态',
              dataIndex: 'status',
              render: (_, r) => statusTag(r.status),
            },
            { title: '地区', dataIndex: 'regionCode' },
            { title: '提交时间', dataIndex: 'submittedAt', render: (v) => formatTimeSmart(v) },
            {
              title: '操作',
              key: 'actions',
              render: (_, r) => {
                const disabled = r.status !== 'PENDING';
                return (
                  <Space>
                    <Button
                      onClick={async () => {
                        setActive(r);
                        setDetailOpen(true);
                        try {
                          const [m, logs] = await Promise.all([
                            apiGet<{ items: AuditMaterial[] }>(`/admin/user-verifications/${r.id}/materials`),
                            apiGet<{ items: AuditLog[] }>(`/admin/user-verifications/${r.id}/audit-logs`),
                          ]);
                          setMaterials(m.items || []);
                          setAuditLogs(logs.items || []);
                        } catch (e: any) {
                          message.error(e?.message || '加载材料/审核记录失败');
                        }
                      }}
                    >
                      详情
                    </Button>
                     <Button
                       type="primary"
                       disabled={disabled}
                       onClick={async () => {
                         const { ok, reason } = await confirmActionWithReason({
                           title: '确认通过该认证？',
                           content: '通过后，该主体可在小程序端展示；该操作应记录审计留痕。',
                           okText: '通过',
                           defaultReason: '通过',
                           reasonLabel: '审批备注（建议填写）',
                           reasonHint: '建议写明核验点：主体信息、联系人、材料完整性等。',
                         });
                         if (!ok) return;
                         try {
                           await apiPost<UserVerification>(
                             `/admin/user-verifications/${r.id}/approve`,
                             {
                               comment: reason || '通过',
                            },
                          );
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
                           title: '确认驳回该认证？',
                           content: '驳回后该主体无法交易/咨询；驳回原因会对提交者可见。',
                           okText: '驳回',
                           danger: true,
                           reasonLabel: '驳回原因',
                           reasonPlaceholder: '例：主体证明材料不清晰；联系人/手机号不一致；缺少盖章文件等。',
                           reasonRequired: true,
                         });
                         if (!ok) return;
                         try {
                           await apiPost<UserVerification>(
                             `/admin/user-verifications/${r.id}/reject`,
                             {
                               reason: reason || '材料不完整',
                            },
                          );
                          message.success('已驳回');
                          void load();
                        } catch (e: any) {
                          message.error(e?.message || '操作失败');
                        }
                      }}
                    >
                      驳回
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
        title={active?.displayName ? `认证详情：${active.displayName}` : '认证详情'}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={560}
        destroyOnClose
      >
        {active ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Descriptions size="small" column={1} bordered>
              <Descriptions.Item label="认证ID">{active.id}</Descriptions.Item>
              <Descriptions.Item label="主体名称">{active.displayName || '-'}</Descriptions.Item>
              <Descriptions.Item label="类型">{verificationTypeLabel(active.type)}</Descriptions.Item>
              <Descriptions.Item label="状态">{statusTag(active.status)}</Descriptions.Item>
              <Descriptions.Item label="地区">{active.regionCode || '-'}</Descriptions.Item>
              <Descriptions.Item label="提交时间">{formatTimeSmart(active.submittedAt)}</Descriptions.Item>
              <Descriptions.Item label="审核时间">
                {active.reviewedAt ? formatTimeSmart(active.reviewedAt) : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="审核备注">{active.reviewComment || '-'}</Descriptions.Item>
            </Descriptions>

            <Divider />

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

            <Divider />

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
          </Space>
        ) : null}
      </Drawer>
    </Card>
  );
}
