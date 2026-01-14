import { View, Text } from '@tarojs/components';
import React, { useCallback, useEffect, useState } from 'react';

import type { components } from '@ipmoney/api-types';

import { apiGet } from '../../lib/api';
import { PageHeader, Spacer, Surface } from '../../ui/layout';
import { ErrorCard, LoadingCard } from '../../ui/StateCards';

type TradeRulesConfig = components['schemas']['TradeRulesConfig'];

function fenToYuan(fen?: number): string {
  if (fen === undefined || fen === null) return '-';
  return (fen / 100).toFixed(2);
}

function percent(v?: number): string {
  if (v === undefined || v === null) return '-';
  return `${(v * 100).toFixed(2)}%`;
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
      <PageHeader title="交易规则" subtitle="前台可查看订金、佣金与退款窗口等关键规则（以后台配置为准）" />
      <Spacer />

      {loading ? (
        <LoadingCard text="加载规则…" />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : data ? (
        <View>
          <Surface>
            <Text className="text-card-title">订金</Text>
            <View style={{ height: '10rpx' }} />
            <View className="list-item">
              <Text className="muted">订金比例</Text>
              <Text className="text-strong">{percent(data.depositRate)}</Text>
            </View>
            <View className="list-item">
              <Text className="muted">订金下限</Text>
              <Text className="text-strong">¥{fenToYuan(data.depositMinFen)}</Text>
            </View>
            <View className="list-item">
              <Text className="muted">订金上限</Text>
              <Text className="text-strong">¥{fenToYuan(data.depositMaxFen)}</Text>
            </View>
            <View className="list-item">
              <Text className="muted">面议订金固定值</Text>
              <Text className="text-strong">¥{fenToYuan(data.depositFixedForNegotiableFen)}</Text>
            </View>
          </Surface>

          <View style={{ height: '16rpx' }} />

          <Surface>
            <Text className="text-card-title">退款窗口</Text>
            <View style={{ height: '10rpx' }} />
            <View className="list-item">
              <Text className="muted">自动退款时间窗</Text>
              <Text className="text-strong">{data.autoRefundWindowMinutes} 分钟</Text>
            </View>
          </Surface>

          <View style={{ height: '16rpx' }} />

          <Surface>
            <Text className="text-card-title">佣金（卖家承担）</Text>
            <View style={{ height: '10rpx' }} />
            <View className="list-item">
              <Text className="muted">默认比例</Text>
              <Text className="text-strong">{percent(data.commissionRate)}</Text>
            </View>
            <View className="list-item">
              <Text className="muted">下限</Text>
              <Text className="text-strong">¥{fenToYuan(data.commissionMinFen)}</Text>
            </View>
            <View className="list-item">
              <Text className="muted">上限</Text>
              <Text className="text-strong">¥{fenToYuan(data.commissionMaxFen)}</Text>
            </View>
          </Surface>

          <View style={{ height: '16rpx' }} />

          <Surface>
            <Text className="text-card-title">里程碑与放款</Text>
            <View style={{ height: '10rpx' }} />
            <View className="list-item">
              <Text className="muted">卖家补材料（工作日）</Text>
              <Text className="text-strong">{data.sellerMaterialDeadlineBusinessDays} 天</Text>
            </View>
            <View className="list-item">
              <Text className="muted">合同签署（工作日）</Text>
              <Text className="text-strong">{data.contractSignedDeadlineBusinessDays} 天</Text>
            </View>
            <View className="list-item">
              <Text className="muted">变更完成 SLA</Text>
              <Text className="text-strong">{data.transferCompletedSlaDays} 天</Text>
            </View>
            <View className="list-item">
              <Text className="muted">托管放款条件</Text>
              <Text className="text-strong">{data.payoutCondition}</Text>
            </View>
          </Surface>

          <View style={{ height: '16rpx' }} />

          <Surface>
            <Text className="muted">
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
