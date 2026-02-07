import { Button, Card, DatePicker, Descriptions, Space, Typography, message } from 'antd';
import React, { useCallback, useEffect, useState } from 'react';

import { apiGet, apiPost } from '../lib/api';
import { fenToYuan } from '../lib/format';
import { RequestErrorAlert } from '../ui/RequestState';
import { confirmActionWithReason } from '../ui/confirm';

const { RangePicker } = DatePicker;

type FinanceSummary = {
  range: { start: string; end: string };
  dealAmountFen: number;
  commissionAmountFen: number;
  refundRate: number;
  payoutSuccessRate: number;
  ordersTotal: number;
};

type ExportResult = { exportUrl: string };

export function ReportsPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<FinanceSummary>('/admin/reports/finance/summary');
      setSummary(d);
    } catch (e: any) {
      setError(e);
      message.error(e?.message || '加载失败');
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Typography.Title level={3} style={{ marginTop: 0 }}>
            报表导出
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            统计成交额、佣金、退款率与放款成功率；支持导出报表。
          </Typography.Paragraph>
        </div>

        {error ? <RequestErrorAlert error={error} onRetry={load} /> : null}

        <Space wrap size={12}>
          <RangePicker />
          <Button onClick={load}>刷新统计</Button>
          <Button
            type="primary"
            onClick={async () => {
              const { ok, reason } = await confirmActionWithReason({
                title: '确认导出报表？',
                content: '导出会生成报表文件并记录审计留痕。',
                okText: '导出',
                reasonLabel: '导出原因（建议填写）',
              });
              if (!ok) return;
              try {
                const res = await apiPost<ExportResult>('/admin/reports/finance/export', {
                  reason: reason || undefined,
                });
                message.success('已生成导出文件');
                if (res?.exportUrl) window.open(res.exportUrl, '_blank', 'noreferrer');
              } catch (e: any) {
                message.error(e?.message || '导出失败');
              }
            }}
          >
            导出报表
          </Button>
        </Space>

        {summary ? (
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="统计区间">
              {summary.range.start} ~ {summary.range.end}
            </Descriptions.Item>
            <Descriptions.Item label="订单数">{summary.ordersTotal}</Descriptions.Item>
            <Descriptions.Item label="成交额">¥{fenToYuan(summary.dealAmountFen)}</Descriptions.Item>
            <Descriptions.Item label="佣金收入">¥{fenToYuan(summary.commissionAmountFen)}</Descriptions.Item>
            <Descriptions.Item label="退款率">{(summary.refundRate * 100).toFixed(2)}%</Descriptions.Item>
            <Descriptions.Item label="放款成功率">
              {(summary.payoutSuccessRate * 100).toFixed(2)}%
            </Descriptions.Item>
          </Descriptions>
        ) : null}
      </Space>
    </Card>
  );
}
