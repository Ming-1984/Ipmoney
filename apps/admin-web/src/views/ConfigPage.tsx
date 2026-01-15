import { Button, Card, Form, InputNumber, Space, Switch, Typography, message } from 'antd';
import React, { useCallback, useEffect, useState } from 'react';

import { apiGet, apiPut } from '../lib/api';
import { fenToYuanNumber, yuanToFen } from '../lib/format';
import { confirmActionWithReason } from '../ui/confirm';

type TradeRulesConfig = {
  version: number;
  depositRate: number;
  depositMinFen: number;
  depositMaxFen: number;
  depositFixedForNegotiableFen: number;
  autoRefundWindowMinutes: number;
  sellerMaterialDeadlineBusinessDays: number;
  contractSignedDeadlineBusinessDays: number;
  transferCompletedSlaDays: number;
  commissionRate: number;
  commissionMinFen: number;
  commissionMaxFen: number;
  payoutCondition: 'TRANSFER_COMPLETED_CONFIRMED';
  payoutMethodDefault: 'MANUAL' | 'WECHAT';
  autoPayoutOnTimeout: boolean;
};

type RecommendationConfig = {
  enabled: boolean;
  timeDecayHalfLifeHours: number;
  dedupeWindowHours: number;
  weights: {
    time: number;
    view: number;
    favorite: number;
    consult: number;
    region: number;
    user: number;
  };
  featuredBoost: { province: number; city: number };
  updatedAt?: string;
};

export function ConfigPage() {
  const [loading, setLoading] = useState(false);
  const [tradeForm] = Form.useForm();
  const [recForm] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const trade = await apiGet<TradeRulesConfig>('/admin/config/trade-rules');
      tradeForm.setFieldsValue({
        ...trade,
        depositMinYuan: fenToYuanNumber(trade.depositMinFen),
        depositMaxYuan: fenToYuanNumber(trade.depositMaxFen),
        depositFixedForNegotiableYuan: fenToYuanNumber(trade.depositFixedForNegotiableFen),
        commissionMinYuan: fenToYuanNumber(trade.commissionMinFen),
        commissionMaxYuan: fenToYuanNumber(trade.commissionMaxFen),
      });

      const rec = await apiGet<RecommendationConfig>('/admin/config/recommendation');
      recForm.setFieldsValue(rec);
    } catch (e: any) {
      message.error(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [recForm, tradeForm]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card loading={loading}>
        <Typography.Title level={3} style={{ marginTop: 0 }}>
          交易规则配置
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          默认：卖家承担佣金；尾款在线上托管支付；放款默认人工确认。
        </Typography.Paragraph>

        <Form form={tradeForm} layout="vertical">
          <Space wrap size={16}>
            <Form.Item label="订金比例（0-1）" name="depositRate" style={{ width: 220 }}>
              <InputNumber min={0} max={1} step={0.01} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="订金最小值（元）" name="depositMinYuan" style={{ width: 220 }}>
              <InputNumber min={0} step={100} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="订金最大值（元）" name="depositMaxYuan" style={{ width: 220 }}>
              <InputNumber min={0} step={100} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              label="面议订金固定值（元）"
              name="depositFixedForNegotiableYuan"
              style={{ width: 220 }}
            >
              <InputNumber min={0} step={100} style={{ width: '100%' }} />
            </Form.Item>
          </Space>

          <Space wrap size={16}>
            <Form.Item
              label="自动退款窗口（分钟）"
              name="autoRefundWindowMinutes"
              style={{ width: 220 }}
            >
              <InputNumber min={0} step={1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              label="卖家补材料时限（工作日）"
              name="sellerMaterialDeadlineBusinessDays"
              style={{ width: 220 }}
            >
              <InputNumber min={1} step={1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              label="合同签署时限（工作日）"
              name="contractSignedDeadlineBusinessDays"
              style={{ width: 220 }}
            >
              <InputNumber min={1} step={1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              label="变更 SLA（天）"
              name="transferCompletedSlaDays"
              style={{ width: 220 }}
            >
              <InputNumber min={1} step={1} style={{ width: '100%' }} />
            </Form.Item>
          </Space>

          <Space wrap size={16}>
            <Form.Item label="佣金比例（0-1）" name="commissionRate" style={{ width: 220 }}>
              <InputNumber min={0} max={1} step={0.01} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="佣金最小值（元）" name="commissionMinYuan" style={{ width: 220 }}>
              <InputNumber min={0} step={100} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="佣金最大值（元）" name="commissionMaxYuan" style={{ width: 220 }}>
              <InputNumber min={0} step={100} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              label="允许超时自动放款"
              name="autoPayoutOnTimeout"
              valuePropName="checked"
              style={{ width: 220 }}
            >
              <Switch />
            </Form.Item>
          </Space>

          <Button
            type="primary"
            onClick={async () => {
              const v = tradeForm.getFieldsValue(true);
              const { ok } = await confirmActionWithReason({
                title: '确认保存交易规则？',
                content: '该操作会影响订金/佣金/退款窗口等关键参数；建议填写变更原因并留痕。',
                okText: '保存',
                reasonLabel: '变更原因（必填）',
                reasonPlaceholder: '例：按合同口径调整订金比例；运营阶段策略变更；法务要求等。',
                reasonRequired: true,
              });
              if (!ok) return;
              const payload = {
                depositRate: v.depositRate,
                depositMinFen: yuanToFen(v.depositMinYuan),
                depositMaxFen: yuanToFen(v.depositMaxYuan),
                depositFixedForNegotiableFen: yuanToFen(v.depositFixedForNegotiableYuan),
                autoRefundWindowMinutes: v.autoRefundWindowMinutes,
                sellerMaterialDeadlineBusinessDays: v.sellerMaterialDeadlineBusinessDays,
                contractSignedDeadlineBusinessDays: v.contractSignedDeadlineBusinessDays,
                transferCompletedSlaDays: v.transferCompletedSlaDays,
                commissionRate: v.commissionRate,
                commissionMinFen: yuanToFen(v.commissionMinYuan),
                commissionMaxFen: yuanToFen(v.commissionMaxYuan),
                payoutCondition: 'TRANSFER_COMPLETED_CONFIRMED',
                payoutMethodDefault: 'MANUAL',
                autoPayoutOnTimeout: Boolean(v.autoPayoutOnTimeout),
              };
              try {
                await apiPut<TradeRulesConfig>('/admin/config/trade-rules', payload);
                message.success('已保存');
                void load();
              } catch (e: any) {
                message.error(e?.message || '保存失败');
              }
            }}
          >
            保存交易规则
          </Button>
        </Form>
      </Card>

      <Card loading={loading}>
        <Typography.Title level={3} style={{ marginTop: 0 }}>
          推荐配置（猜你喜欢）
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          权重可按运营策略/数据效果调整。
        </Typography.Paragraph>

        <Form form={recForm} layout="vertical">
          <Space wrap size={16}>
            <Form.Item
              label="启用推荐"
              name="enabled"
              valuePropName="checked"
              style={{ width: 220 }}
            >
              <Switch />
            </Form.Item>
            <Form.Item
              label="时间衰减半衰期（小时）"
              name="timeDecayHalfLifeHours"
              style={{ width: 220 }}
            >
              <InputNumber min={1} step={1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="去重窗口（小时）" name="dedupeWindowHours" style={{ width: 220 }}>
              <InputNumber min={0} step={1} style={{ width: '100%' }} />
            </Form.Item>
          </Space>

          <Typography.Text strong>权重（weights）</Typography.Text>
          <Space wrap size={16} style={{ marginTop: 8 }}>
            {(['time', 'view', 'favorite', 'consult', 'region', 'user'] as const).map((k) => (
              <Form.Item key={k} label={k} name={['weights', k]} style={{ width: 180 }}>
                <InputNumber min={0} step={0.5} style={{ width: '100%' }} />
              </Form.Item>
            ))}
          </Space>

          <Typography.Text strong>地域特色加权（featuredBoost）</Typography.Text>
          <Space wrap size={16} style={{ marginTop: 8 }}>
            <Form.Item label="省级" name={['featuredBoost', 'province']} style={{ width: 220 }}>
              <InputNumber min={0} step={0.5} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="市级" name={['featuredBoost', 'city']} style={{ width: 220 }}>
              <InputNumber min={0} step={0.5} style={{ width: '100%' }} />
            </Form.Item>
          </Space>

          <Button
            type="primary"
            onClick={async () => {
              const v = recForm.getFieldsValue(true);
              const { ok } = await confirmActionWithReason({
                title: '确认保存推荐配置？',
                content: '该操作会影响首页/搜索的推荐排序；建议填写变更原因并留痕。',
                okText: '保存',
                reasonLabel: '变更原因（必填）',
                reasonPlaceholder: '例：提高地域权重；降低时间衰减；活动期调权等。',
                reasonRequired: true,
              });
              if (!ok) return;
              try {
                await apiPut<RecommendationConfig>('/admin/config/recommendation', v);
                message.success('已保存');
                void load();
              } catch (e: any) {
                message.error(e?.message || '保存失败');
              }
            }}
          >
            保存推荐配置
          </Button>
        </Form>
      </Card>
    </Space>
  );
}
