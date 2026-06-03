import { Button, Card, DatePicker, Descriptions, Space, Typography, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

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
  const [error, setError] = useState<unknown | null>(null);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [range, setRange] = useState<any>(null);

  const rangeParams = useMemo(() => {
    if (!range || !range[0] || !range[1]) return {};
    return {
      start: range[0].toISOString(),
      end: range[1].toISOString(),
    };
  }, [range]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const d = await apiGet<FinanceSummary>('/admin/reports/finance/summary', rangeParams);
      setSummary(d);
    } catch (e: any) {
      setError(e);
      message.error(e?.message || '加载失败');
      setSummary(null);
    }
  }, [rangeParams]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card className="admin-reports-page">
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
          <RangePicker value={range} onChange={(v) => setRange(v)} />
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
                const res = await apiPost<ExportResult>(
                  '/admin/reports/finance/export',
                  {
                    ...rangeParams,
                    reason: reason || undefined,
                  },
                  { idempotencyKey: `report-export-${Date.now()}`, retry: 1 },
                );
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
