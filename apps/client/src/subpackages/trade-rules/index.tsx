import { View, Text } from '@tarojs/components';
import React, { useCallback, useEffect, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { apiGet } from '../../lib/api';
import { fenToYuan } from '../../lib/money';
import { PageHeader, SectionHeader, Spacer, Surface, TipBanner } from '../../ui/layout';
import { Tag } from '../../ui/nutui';
import { ErrorCard, LoadingCard } from '../../ui/StateCards';

type TradeRulesConfig = components['schemas']['TradeRulesConfig'];
type PayoutCondition = components['schemas']['PayoutCondition'];
type PayoutMethod = components['schemas']['PayoutMethod'];

function percent(v?: number): string {
  if (v === undefined || v === null) return '—';
  return `${(v * 100).toFixed(2)}%`;
}

function yuan(v?: number): string {
  if (v === undefined || v === null) return '—';
  return `¥${fenToYuan(v)}`;
}

function payoutConditionLabel(v?: PayoutCondition): string {
  if (!v) return '—';
  if (v === 'TRANSFER_COMPLETED_CONFIRMED') return '权属变更完成确认后放款';
  return String(v);
}

function payoutMethodLabel(v?: PayoutMethod): string {
  if (!v) return '—';
  if (v === 'WECHAT') return '微信打款';
  if (v === 'MANUAL') return '线下人工';
  return String(v);
}

export default function TradeRulesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TradeRulesConfig | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<TradeRulesConfig>('/public/config/trade-rules');
      setData(d);
    } catch (e: any) {
      setError(e?.message || '加载失败');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View className="container">
      <PageHeader title="交易规则" subtitle="订金、佣金、退款窗口等关键规则以平台配置为准" />
      <Spacer />

      {loading ? (
        <LoadingCard text="加载规则…" />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : data ? (
        <View>
          <TipBanner tone="info" title="规则摘要">
            订金按成交价比例计算（含上/下限）；佣金由卖家承担；尾款由平台托管，默认在“权属变更完成确认”后放款。
          </TipBanner>

          <Spacer size={12} />

          <Surface>
            <View className="row-between">
              <SectionHeader title="订金" subtitle="订金用于锁定意向与启动跟单服务" density="compact" />
              <Tag type="primary" plain round>
                托管
              </Tag>
            </View>
            <Spacer size={8} />
            <View className="list-item">
              <Text className="muted">订金比例</Text>
              <Text className="text-strong">{percent(data.depositRate)}</Text>
            </View>
            <View className="list-item">
              <Text className="muted">订金区间</Text>
              <Text className="text-strong">{`${yuan(data.depositMinFen)} - ${yuan(data.depositMaxFen)}`}</Text>
            </View>
            <View className="list-item">
              <Text className="muted">面议订金</Text>
              <Text className="text-strong">{yuan(data.depositFixedForNegotiableFen)}</Text>
            </View>
            <Spacer size={8} />
            <Text className="text-caption break-word">
              订金金额 = 成交价 × 比例，并遵守上/下限；面议按固定订金收取。
            </Text>
          </Surface>

          <Spacer size={12} />

          <Surface>
            <SectionHeader title="退款窗口" subtitle="用于“系统秒退”的时间范围" density="compact" />
            <Spacer size={8} />
            <View className="list-item">
              <Text className="muted">时间窗口</Text>
              <Text className="text-strong">{data.autoRefundWindowMinutes} 分钟</Text>
            </View>
          </Surface>

          <Spacer size={12} />

          <Surface>
            <View className="row-between">
              <SectionHeader title="佣金" subtitle="卖家承担，随结算扣除" density="compact" />
              <Tag type="success" plain round>
                卖家承担
              </Tag>
            </View>
            <Spacer size={8} />
            <View className="list-item">
              <Text className="muted">佣金比例</Text>
              <Text className="text-strong">{percent(data.commissionRate)}</Text>
            </View>
            <View className="list-item">
              <Text className="muted">佣金区间</Text>
              <Text className="text-strong">{`${yuan(data.commissionMinFen)} - ${yuan(data.commissionMaxFen)}`}</Text>
            </View>
          </Surface>

          <Spacer size={12} />

          <Surface>
            <SectionHeader title="里程碑与放款" subtitle="关键节点作为凭证归档" density="compact" />
            <Spacer size={8} />
            <View className="list-item">
              <Text className="muted">补材料期限</Text>
              <Text className="text-strong">{data.sellerMaterialDeadlineBusinessDays} 个工作日</Text>
            </View>
            <View className="list-item">
              <Text className="muted">签合同期限</Text>
              <Text className="text-strong">{data.contractSignedDeadlineBusinessDays} 个工作日</Text>
            </View>
            <View className="list-item">
              <Text className="muted">权属变更 SLA</Text>
              <Text className="text-strong">{data.transferCompletedSlaDays} 天</Text>
            </View>
            <Spacer size={8} />
            <View className="list-item">
              <Text className="muted">放款条件</Text>
              <Text className="text-strong">{payoutConditionLabel(data.payoutCondition)}</Text>
            </View>
            <View className="list-item">
              <Text className="muted">默认放款方式</Text>
              <Text className="text-strong">{payoutMethodLabel(data.payoutMethodDefault)}</Text>
            </View>
            <View className="list-item">
              <Text className="muted">超时自动放款</Text>
              <Text className="text-strong">{data.autoPayoutOnTimeout ? '开启' : '关闭'}</Text>
            </View>
          </Surface>

          <Spacer size={12} />

          <Surface>
            <Text className="text-caption break-word">
              说明：合同线下签署完成后回到平台支付尾款；默认需“权属变更完成确认”后才放款给卖家。实际执行以平台配置与合同约定为准。
            </Text>
          </Surface>
        </View>
      ) : (
        <Surface>
          <Text className="muted">无数据</Text>
        </Surface>
      )}
    </View>
  );
}
