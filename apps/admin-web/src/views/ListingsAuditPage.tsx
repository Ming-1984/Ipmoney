import { Button, Card, Modal, Space, Table, Typography, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { apiGet, apiPost } from '../lib/api';

type AuditStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type ListingStatus = 'DRAFT' | 'ACTIVE' | 'OFF_SHELF' | 'SOLD';

type Listing = {
  id: string;
  title: string;
  auditStatus: AuditStatus;
  status: ListingStatus;
  depositAmountFen: number;
  priceType: 'FIXED' | 'NEGOTIABLE';
  priceAmountFen?: number;
  tradeMode: 'ASSIGNMENT' | 'LICENSE';
  createdAt: string;
  sellerUserId?: string;
};

type PagedListing = {
  items: Listing[];
  page: { page: number; pageSize: number; total: number };
};

function fenToYuan(fen?: number): string {
  if (fen === undefined || fen === null) return '-';
  return (fen / 100).toFixed(2);
}

export function ListingsAuditPage() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PagedListing | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiGet<PagedListing>('/admin/listings', {
        auditStatus: 'PENDING',
        page: 1,
        pageSize: 10,
      });
      setData(d);
    } catch (e: any) {
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
            上架审核（演示）
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            演示审核通过/驳回与留痕（原因输入）。
          </Typography.Paragraph>
        </div>

        <Table<Listing>
          rowKey="id"
          loading={loading}
          dataSource={rows}
          pagination={false}
          columns={[
            { title: '标题', dataIndex: 'title' },
            { title: '类型', dataIndex: 'tradeMode' },
            {
              title: '价格',
              key: 'price',
              render: (_, r) =>
                r.priceType === 'NEGOTIABLE' ? '面议' : `¥${fenToYuan(r.priceAmountFen)}（固定）`,
            },
            { title: '订金', dataIndex: 'depositAmountFen', render: (v) => `¥${fenToYuan(v)}` },
            { title: '状态', dataIndex: 'status' },
            { title: '审核状态', dataIndex: 'auditStatus' },
            { title: '创建时间', dataIndex: 'createdAt' },
            {
              title: '操作',
              key: 'actions',
              render: (_, r) => (
                <Space>
                  <Button
                    type="primary"
                    onClick={async () => {
                      try {
                        await apiPost(`/admin/listings/${r.id}/approve`, {});
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
                    onClick={async () => {
                      const reason = await new Promise<string | null>((resolve) => {
                        let value = '';
                        Modal.confirm({
                          title: '驳回原因',
                          content: (
                            <textarea
                              style={{ width: '100%', minHeight: 96 }}
                              placeholder="请输入驳回原因（演示）"
                              onChange={(e) => {
                                value = e.target.value;
                              }}
                            />
                          ),
                          okText: '驳回',
                          cancelText: '取消',
                          onOk: () => resolve(value || '不符合规范（演示）'),
                          onCancel: () => resolve(null),
                        });
                      });
                      if (!reason) return;
                      try {
                        await apiPost(`/admin/listings/${r.id}/reject`, { reason });
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
              ),
            },
          ]}
        />

        <Button onClick={load}>刷新</Button>
      </Space>
    </Card>
  );
}
