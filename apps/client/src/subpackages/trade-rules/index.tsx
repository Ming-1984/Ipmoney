import { View, Text } from '@tarojs/components';
import React, { useCallback, useEffect, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { apiGet } from '../../lib/api';
import { getDetailCache, setDetailCache } from '../../lib/detailCache';
import { fenToYuan } from '../../lib/money';
import { PageHeader, Spacer, Surface } from '../../ui/layout';
import { Tag } from '../../ui/nutui';
import { ErrorCard, LoadingCard } from '../../ui/StateCards';

type TradeRulesConfig = components['schemas']['TradeRulesConfig'];
type PayoutCondition = components['schemas']['PayoutCondition'];
type PayoutMethod = components['schemas']['PayoutMethod'];
const TRADE_RULES_CACHE_SCOPE = 'trade-rules';
const TRADE_RULES_CACHE_KEY = 'config';

function percent(v?: number): string {
  if (v === undefined || v === null) return '—';
  return `${(v * 100).toFixed(2)}%`;
}

function yuan(v?: number): string {
  if (v === undefined || v === null) return '—';
  return `¥${fenToYuan(v)}`;
}

function RuleHeader(props: { index: string; title: string; note?: string; tag?: string }) {
  return (
    <View className="trade-rules-section-header">
      <Text className="trade-rules-section-index">{props.index}</Text>
      <View className="trade-rules-section-title-wrap">
        <Text className="trade-rules-section-title">{props.title}</Text>
        {props.note ? <Text className="trade-rules-section-note">{props.note}</Text> : null}
      </View>
      {props.tag ? (
        <Tag type="primary" plain round>
          {props.tag}
        </Tag>
      ) : null}
      <Text className="trade-rules-section-chevron" />
    </View>
  );
}

function RuleRow(props: { label: string; value: string; note?: string; highlight?: boolean; milestone?: boolean }) {
  return (
    <View className={`trade-rules-row ${props.milestone ? 'trade-rules-row-milestone' : ''}`}>
      <View className="trade-rules-row-label-wrap">
        {props.milestone ? <Text className="trade-rules-row-dot" /> : null}
        <View className="trade-rules-row-texts">
          <Text className="trade-rules-row-label">{props.label}</Text>
          {props.note ? <Text className="trade-rules-row-note">{props.note}</Text> : null}
        </View>
      </View>
      <Text className={`trade-rules-row-value ${props.highlight ? 'trade-rules-row-value-highlight' : ''}`}>{props.value}</Text>
    </View>
  );
}

function payoutConditionLabel(v?: PayoutCondition): string {
  if (!v) return '—';
  if (v === 'TRANSFER_COMPLETED_CONFIRMED') return '权属变更完成确认后放款';
  return '放款条件待确认';
}

function payoutMethodLabel(v?: PayoutMethod): string {
  if (!v) return '—';
  if (v === 'WECHAT') return '微信打款';
  if (v === 'MANUAL') return '线下人工';
  return '放款方式待确认';
}

export default function TradeRulesPage() {
  const initialCachedData = getDetailCache<TradeRulesConfig>(TRADE_RULES_CACHE_SCOPE, TRADE_RULES_CACHE_KEY);
  const [loading, setLoading] = useState(!initialCachedData);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TradeRulesConfig | null>(initialCachedData);

  const load = useCallback(async (options?: { silent?: boolean }) => {
    const silent = Boolean(options?.silent);
    const cached = getDetailCache<TradeRulesConfig>(TRADE_RULES_CACHE_SCOPE, TRADE_RULES_CACHE_KEY);
    const hasCached = Boolean(cached);
    if (cached) {
      setData(cached);
      if (!silent) {
        setLoading(false);
        setError(null);
      }
    } else if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const d = await apiGet<TradeRulesConfig>('/public/config/trade-rules');
      setData(d);
      setDetailCache(TRADE_RULES_CACHE_SCOPE, TRADE_RULES_CACHE_KEY, d);
      if (!silent) setError(null);
    } catch (e: any) {
      if (!hasCached) {
        setError(e?.message || '加载失败');
        setData(null);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View className="container trade-rules-page">
      <PageHeader title="交易规则" subtitle="订金、佣金、退款窗口等关键规则以平台配置为准" />
      <Spacer />

      {loading ? (
        <LoadingCard text="加载规则…" />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : data ? (
        <View className="trade-rules-content">
          <View className="summary-banner">
            <Text className="summary-banner__label">规则摘要</Text>
            <Text className="summary-banner__text">
              订金按成交价比例计算（含上/下限）；佣金由卖家承担；尾款由平台托管，默认在「权属变更完成确认」后放款。
            </Text>
            <View className="summary-stats">
              <View className="summary-stat-item">
                <Text className="summary-stat-item__value">{percent(data.depositRate)}</Text>
                <Text className="summary-stat-item__label">订金比例</Text>
              </View>
              <View className="summary-stat-item">
                <Text className="summary-stat-item__value">{percent(data.commissionRate)}</Text>
                <Text className="summary-stat-item__label">佣金比例</Text>
              </View>
              <View className="summary-stat-item">
                <Text className="summary-stat-item__value">{data.autoRefundWindowMinutes}min</Text>
                <Text className="summary-stat-item__label">退款窗口</Text>
              </View>
            </View>
          </View>

          <Spacer size={12} />

          <Surface>
            <RuleHeader index="01" title="订金" note="订金用于锁定意向与启动跟单服务" tag="托管" />
            <View className="trade-rules-section-body">
              <RuleRow label="订金比例" value={percent(data.depositRate)} highlight />
              <RuleRow label="面议订金" value={yuan(data.depositFixedForNegotiableFen)} />
              <RuleRow label="订金区间" note="成交价 × 比例，遵守上/下限" value={`${yuan(data.depositMinFen)} - ${yuan(data.depositMaxFen)}`} />
            </View>
          </Surface>

          <Spacer size={12} />

          <Surface>
            <RuleHeader index="02" title="退款窗口" />
            <View className="trade-rules-section-body">
              <RuleRow label="系统秒退时间窗口" note="支付完成后开始计时" value={`${data.autoRefundWindowMinutes} 分钟`} highlight />
            </View>
          </Surface>

          <Spacer size={12} />

          <Surface>
            <RuleHeader index="03" title="佣金" tag="卖家承担" />
            <View className="trade-rules-section-body">
              <RuleRow label="佣金比例" value={percent(data.commissionRate)} highlight />
              <RuleRow label="佣金区间" value={`${yuan(data.commissionMinFen)} - ${yuan(data.commissionMaxFen)}`} />
              <RuleRow label="扣除方式" value="随结算自动扣除" />
            </View>
          </Surface>

          <Spacer size={12} />

          <Surface>
            <RuleHeader index="04" title="里程碑与放款" />
            <View className="trade-rules-section-body">
              <Text className="trade-rules-sub-label">关键节点</Text>
              <RuleRow label="补材料期限" value={`${data.sellerMaterialDeadlineBusinessDays} 个工作日`} milestone />
              <RuleRow label="签合同期限" value={`${data.contractSignedDeadlineBusinessDays} 个工作日`} milestone />
              <RuleRow label="权属变更 SLA" value={`${data.transferCompletedSlaDays} 天`} milestone />
              <Text className="trade-rules-sub-label">放款设置</Text>
              <RuleRow label="放款条件" value={payoutConditionLabel(data.payoutCondition)} highlight />
              <RuleRow label="默认放款方式" value={payoutMethodLabel(data.payoutMethodDefault)} />
              <RuleRow label="超时自动放款" value={data.autoPayoutOnTimeout ? '开启' : '已关闭'} />
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
