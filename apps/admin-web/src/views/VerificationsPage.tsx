import { Button, Card, Space, Table, Tag, Typography, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { apiGet, apiPost } from '../lib/api';
import { RequestErrorAlert, AuditHint } from '../ui/RequestState';
import { confirmAction } from '../ui/confirm';

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

function statusTag(status: VerificationStatus) {
  if (status === 'APPROVED') return <Tag color="green">已通过</Tag>;
  if (status === 'REJECTED') return <Tag color="red">已驳回</Tag>;
  return <Tag color="orange">待审核</Tag>;
}

export function VerificationsPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PagedUserVerification | null>(null);

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
      const msg = e?.message || '加载失败';
      setError(msg);
      message.error(msg);
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
            演示：支持切换 Mock 场景（happy/empty/error/edge），并展示待审核→通过/驳回的操作闭环。
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
            { title: '类型', dataIndex: 'type' },
            {
              title: '状态',
              dataIndex: 'status',
              render: (_, r) => statusTag(r.status),
            },
            { title: '地区', dataIndex: 'regionCode' },
            { title: '提交时间', dataIndex: 'submittedAt' },
            {
              title: '操作',
              key: 'actions',
              render: (_, r) => {
                const disabled = r.status !== 'PENDING';
                return (
                  <Space>
                     <Button
                       type="primary"
                       disabled={disabled}
                       onClick={async () => {
                         const ok = await confirmAction({
                           title: '确认通过该认证？',
                           content: '通过后，该主体可在小程序端展示；该操作应记录审计留痕。',
                           okText: '通过',
                         });
                         if (!ok) return;
                         try {
                           await apiPost<UserVerification>(
                             `/admin/user-verifications/${r.id}/approve`,
                             {
                               comment: '通过（演示）',
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
                         const ok = await confirmAction({
                           title: '确认驳回该认证？',
                           content: '驳回后该主体无法在小程序端展示；建议填写原因并留痕。',
                           okText: '驳回',
                           danger: true,
                         });
                         if (!ok) return;
                         try {
                           await apiPost<UserVerification>(
                             `/admin/user-verifications/${r.id}/reject`,
                             {
                               reason: '材料不完整（演示）',
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
    </Card>
  );
}
