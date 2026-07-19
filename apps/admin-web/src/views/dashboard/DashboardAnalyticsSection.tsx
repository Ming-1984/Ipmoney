import { Alert, Card, Empty, Segmented, Space, Statistic, Tag, Typography } from 'antd';
import { AppstoreOutlined, FieldTimeOutlined, PieChartOutlined, RiseOutlined, TeamOutlined } from '@ant-design/icons';
import React, { useId, useMemo } from 'react';

import { fenToYuan } from '../../lib/format';

export type DashboardAnalysisFocus = 'overview' | 'trade' | 'ops' | 'service';

export type DashboardAnalysisRange = {
  start: string;
  end: string;
  days: number;
  label: string;
};

export type DashboardTrendPoint = {
  key: string;
  label: string;
  value: number;
};

export type DashboardDistributionItem = {
  key: string;
  label: string;
  value: number;
};

export type DashboardAnalysisData = {
  range: DashboardAnalysisRange;
  orders30d: DashboardTrendPoint[];
  completedOrders30d: DashboardTrendPoint[];
  dealAmount30d: DashboardTrendPoint[];
  patentTypes: DashboardDistributionItem[];
  orderStatuses: DashboardDistributionItem[];
};

export type DashboardOperationsSnapshot = {
  pendingVerifications: number | null;
  pendingListings: number | null;
  unassignedConversations: number | null;
  openCases: number | null;
};

type Props = {
  data: DashboardAnalysisData | null;
  focus: DashboardAnalysisFocus;
  onFocusChange: (value: DashboardAnalysisFocus) => void;
  rangeDays: number;
  onRangeDaysChange: (value: number) => void;
  loading: boolean;
  hasOrderAccess: boolean;
  hasListingAccess: boolean;
  roleLabel: string;
  operations: DashboardOperationsSnapshot;
};

const RANGE_OPTIONS = [7, 30, 90, 180] as const;

const FOCUS_META: Record<
  DashboardAnalysisFocus,
  {
    label: string;
    tone: string;
    icon: React.ReactNode;
    description: string;
  }
> = {
  overview: {
    label: '综合',
    tone: 'blue',
    icon: <AppstoreOutlined />,
    description: '同时看趋势和结构分布。',
  },
  trade: {
    label: '交易',
    tone: 'green',
    icon: <RiseOutlined />,
    description: '优先看成交节奏和订单走势。',
  },
  ops: {
    label: '结构',
    tone: 'gold',
    icon: <PieChartOutlined />,
    description: '优先看专利结构和订单状态。',
  },
  service: {
    label: '协同',
    tone: 'purple',
    icon: <TeamOutlined />,
    description: '优先看协同压力与未分配事项。',
  },
};

const SERIES_COLORS = {
  orders: '#1677ff',
  completed: '#52c41a',
  amount: '#fa8c16',
  patentTypes: '#13c2c2',
  orderStatuses: '#722ed1',
};

function formatCount(value: number): string {
  return Number(value || 0).toLocaleString('zh-CN');
}

function formatMoneyFen(value: number): string {
  return `¥${fenToYuan(value || 0)}`;
}

function sumPoints(points: DashboardTrendPoint[]): number {
  return points.reduce((acc, item) => acc + Number(item.value || 0), 0);
}

function peakPoints(points: DashboardTrendPoint[]): number {
  return points.reduce((acc, item) => Math.max(acc, Number(item.value || 0)), 0);
}

function Sparkline({
  points,
  stroke,
}: {
  points: DashboardTrendPoint[];
  stroke: string;
}) {
  const gradientId = useId().replace(/:/g, '-');
  const geometry = useMemo(() => {
    const values = points.map((item) => Math.max(0, Number(item.value || 0)));
    const max = Math.max(1, ...values);
    const min = 0;
    const width = 320;
    const height = 92;
    const paddingX = 10;
    const paddingY = 10;
    const innerWidth = width - paddingX * 2;
    const innerHeight = height - paddingY * 2;
    const step = values.length > 1 ? innerWidth / (values.length - 1) : 0;
    const coords = values.map((value, index) => {
      const x = paddingX + step * index;
      const ratio = max === min ? 0 : (value - min) / (max - min);
      const y = paddingY + innerHeight - ratio * innerHeight;
      return { x, y, value };
    });
    const line = coords.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
    const area = coords.length ? `M ${paddingX} ${paddingY + innerHeight} L ${line} L ${paddingX + innerWidth} ${paddingY + innerHeight} Z` : '';
    return { coords, line, area, width, height };
  }, [points]);

  if (points.length === 0) {
    return (
      <div style={{ minHeight: 112, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography.Text type="secondary">暂无趋势数据</Typography.Text>
      </div>
    );
  }

  return (
    <svg viewBox={`0 0 ${geometry.width} ${geometry.height}`} width="100%" height={geometry.height} role="img" aria-label="trend chart">
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={geometry.area} fill={`url(#${gradientId})`} />
      <polyline fill="none" stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" points={geometry.line} />
      {geometry.coords.map((point, index) => (
        <circle
          key={`${point.x}-${point.y}-${index}`}
          cx={point.x}
          cy={point.y}
          r={2.8}
          fill={stroke}
          opacity={index === geometry.coords.length - 1 ? 1 : 0.9}
        />
      ))}
    </svg>
  );
}

function TrendCard({
  title,
  subtitle,
  points,
  color,
  loading,
  highlighted,
  money,
  rangeLabel,
}: {
  title: string;
  subtitle: string;
  points: DashboardTrendPoint[];
  color: string;
  loading: boolean;
  highlighted: boolean;
  money?: boolean;
  rangeLabel: string;
}) {
  const hasPoints = points.length > 0;
  const total = hasPoints ? sumPoints(points) : null;
  const peak = hasPoints ? peakPoints(points) : null;
  const latest = hasPoints ? points[points.length - 1].value : null;

  return (
    <Card
      size="small"
      loading={loading}
      style={
        highlighted
          ? {
              borderColor: color,
              boxShadow: `0 0 0 1px ${color}22`,
              height: '100%',
            }
          : { height: '100%' }
      }
    >
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        <Space style={{ width: '100%', justifyContent: 'space-between', alignItems: 'flex-start' }} wrap>
          <div>
            <Typography.Text strong>{title}</Typography.Text>
            <div>
              <Typography.Text type="secondary">{subtitle}</Typography.Text>
            </div>
          </div>
          <Statistic value={total === null ? '-' : money ? formatMoneyFen(total) : formatCount(total)} />
        </Space>
        <Sparkline points={points} stroke={color} />
        <Space size={8} wrap>
          <Tag color={highlighted ? 'blue' : 'default'}>{rangeLabel}</Tag>
          <Tag color="green">峰值 {peak === null ? '-' : money ? formatMoneyFen(peak) : formatCount(peak)}</Tag>
          <Tag color="cyan">最新 {latest === null ? '-' : money ? formatMoneyFen(latest) : formatCount(latest)}</Tag>
        </Space>
      </Space>
    </Card>
  );
}

function DistributionCard({
  title,
  subtitle,
  items,
  color,
  loading,
  highlighted,
  rangeLabel,
}: {
  title: string;
  subtitle: string;
  items: DashboardDistributionItem[];
  color: string;
  loading: boolean;
  highlighted: boolean;
  rangeLabel: string;
}) {
  const total = items.reduce((acc, item) => acc + Number(item.value || 0), 0);
  const hasItems = items.length > 0;

  return (
    <Card
      size="small"
      loading={loading}
      style={
        highlighted
          ? {
              borderColor: color,
              boxShadow: `0 0 0 1px ${color}22`,
              height: '100%',
            }
          : { height: '100%' }
      }
    >
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        <Space style={{ width: '100%', justifyContent: 'space-between', alignItems: 'flex-start' }} wrap>
          <div>
            <Typography.Text strong>{title}</Typography.Text>
            <div>
              <Typography.Text type="secondary">{subtitle}</Typography.Text>
            </div>
          </div>
          <Statistic value={hasItems ? formatCount(total) : '-'} />
        </Space>
        <Tag color={highlighted ? 'blue' : 'default'}>{rangeLabel}</Tag>
        {hasItems ? (
          <Space direction="vertical" size={10} style={{ width: '100%' }}>
            {items.map((item, index) => {
              const percent = total > 0 ? Math.max(0, Math.min(100, (Number(item.value || 0) / total) * 100)) : 0;
              return (
                <div key={item.key}>
                  <Space style={{ width: '100%', justifyContent: 'space-between' }} align="start">
                    <Typography.Text>{item.label}</Typography.Text>
                    <Typography.Text strong>{formatCount(Number(item.value || 0))}</Typography.Text>
                  </Space>
                  <div
                    style={{
                      marginTop: 6,
                      height: 8,
                      borderRadius: 999,
                      background: 'rgba(5, 5, 5, 0.06)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${percent}%`,
                        height: '100%',
                        borderRadius: 999,
                        background: index % 2 === 0 ? color : '#8c8c8c',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </Space>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无分布数据" />
        )}
      </Space>
    </Card>
  );
}

export function DashboardAnalyticsSection({
  data,
  focus,
  onFocusChange,
  rangeDays,
  onRangeDaysChange,
  loading,
  hasOrderAccess,
  hasListingAccess,
  roleLabel,
  operations,
}: Props) {
  const rangeLabel = data?.range?.label ? data.range.label : `近${rangeDays}天`;
  const focusMeta = FOCUS_META[focus];

  const focusOptions = useMemo(
    () =>
      (Object.entries(FOCUS_META) as Array<[DashboardAnalysisFocus, (typeof FOCUS_META)[DashboardAnalysisFocus]]>)
        .filter(([key]) => {
          if (key === 'trade') return hasOrderAccess;
          if (key === 'ops') return hasListingAccess;
          if (key === 'service') return hasOrderAccess || hasListingAccess;
          return true;
        })
        .map(([key, meta]) => ({
          value: key,
          label: (
            <Space size={6}>
              {meta.icon}
              <span>{meta.label}</span>
            </Space>
          ),
        })),
    [hasListingAccess, hasOrderAccess],
  );

  const orderedCards = useMemo(() => {
    const trendCards = [
      {
        key: 'orders',
        kind: 'trend' as const,
        title: '订单数量趋势',
        subtitle: '按创建时间统计全部订单',
        points: data?.orders30d || [],
        color: SERIES_COLORS.orders,
        money: false,
      },
      {
        key: 'completed',
        kind: 'trend' as const,
        title: '已完成订单趋势',
        subtitle: '按创建时间统计已完成订单',
        points: data?.completedOrders30d || [],
        color: SERIES_COLORS.completed,
        money: false,
      },
      {
        key: 'amount',
        kind: 'trend' as const,
        title: '累计成交额趋势',
        subtitle: '按创建时间统计已完成订单成交额',
        points: data?.dealAmount30d || [],
        color: SERIES_COLORS.amount,
        money: true,
      },
    ];

    const distributionCards = [
      {
        key: 'patentTypes',
        kind: 'distribution' as const,
        title: '专利类型分布',
        subtitle: '按当前时间范围统计专利创建结构',
        items: data?.patentTypes || [],
        color: SERIES_COLORS.patentTypes,
      },
      {
        key: 'orderStatuses',
        kind: 'distribution' as const,
        title: '订单状态分布',
        subtitle: '按当前时间范围统计订单状态结构',
        items: data?.orderStatuses || [],
        color: SERIES_COLORS.orderStatuses,
      },
    ];

    const byFocus: Record<DashboardAnalysisFocus, string[]> = {
      overview: ['orders', 'completed', 'amount', 'patentTypes', 'orderStatuses'],
      trade: ['amount', 'completed', 'orders', 'orderStatuses', 'patentTypes'],
      ops: ['patentTypes', 'orderStatuses', 'orders', 'completed', 'amount'],
      service: ['orderStatuses', 'orders', 'completed', 'amount', 'patentTypes'],
    };

    const merged = [...trendCards, ...distributionCards]
      .filter((item) => {
        if (item.kind === 'trend') return hasOrderAccess;
        if (item.key === 'patentTypes') return hasListingAccess;
        if (item.key === 'orderStatuses') return hasOrderAccess;
        return true;
      })
      .sort((a, b) => byFocus[focus].indexOf(a.key) - byFocus[focus].indexOf(b.key));

    return merged;
  }, [data, focus, hasListingAccess, hasOrderAccess]);

  const focusDescription = useMemo(() => {
    if (focus === 'service') {
      return `待审核认证 ${formatCount(operations.pendingVerifications ?? 0)}，待审核上架 ${formatCount(operations.pendingListings ?? 0)}，未分配会话 ${formatCount(
        operations.unassignedConversations ?? 0,
      )}，待处理工单 ${formatCount(operations.openCases ?? 0)}。`;
    }
    return focusMeta.description;
  }, [focus, focusMeta.description, operations]);

  const visibleCards = orderedCards.length > 0 ? orderedCards : [];
  const highlightKey =
    focus === 'trade'
      ? 'amount'
      : focus === 'ops'
        ? 'patentTypes'
        : focus === 'service'
          ? 'orderStatuses'
          : hasOrderAccess
            ? 'completed'
            : 'patentTypes';

  if (!hasOrderAccess && !hasListingAccess) {
    return null;
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between', alignItems: 'flex-start' }} wrap>
        <div>
          <Typography.Title level={4} style={{ marginTop: 0, marginBottom: 4 }}>
            业务分析
          </Typography.Title>
          <Space size={6} align="center" wrap>
            <FieldTimeOutlined />
            <Typography.Text type="secondary">按 {rangeLabel} 查看趋势和结构分布。</Typography.Text>
          </Space>
          <div style={{ marginTop: 6 }}>
            <Tag color="purple">{roleLabel}</Tag>
          </div>
        </div>
        <Space wrap>
          <Segmented
            value={rangeDays}
            options={RANGE_OPTIONS.map((value) => ({ value, label: `${value}天` }))}
            onChange={(value) => onRangeDaysChange(Number(value))}
          />
          <Segmented value={focus} options={focusOptions} onChange={(value) => onFocusChange(value as DashboardAnalysisFocus)} />
        </Space>
      </Space>

      <Alert type="info" showIcon message={`${focusMeta.label}视角`} description={focusDescription} />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 16,
          alignItems: 'stretch',
        }}
      >
        {visibleCards.map((card) => {
          if (card.kind === 'trend') {
            return (
              <TrendCard
                key={card.key}
                title={card.title}
                subtitle={card.subtitle}
                points={card.points}
                color={card.color}
                loading={loading}
                highlighted={card.key === highlightKey}
                money={card.money}
                rangeLabel={rangeLabel}
              />
            );
          }
          return (
            <DistributionCard
              key={card.key}
              title={card.title}
              subtitle={card.subtitle}
              items={card.items}
              color={card.color}
              loading={loading}
              highlighted={card.key === highlightKey}
              rangeLabel={rangeLabel}
            />
          );
        })}
      </div>
    </Space>
  );
}
