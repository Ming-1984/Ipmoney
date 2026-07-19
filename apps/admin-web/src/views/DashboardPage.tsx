import { Alert, Button, Card, Col, Collapse, List, Progress, Row, Segmented, Space, Statistic, Tag, Typography, message } from 'antd';
import {
  ArrowRightOutlined,
  CheckSquareOutlined,
  DollarOutlined,
  FileTextOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  MessageOutlined,
  ShoppingCartOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type { components } from '@ipmoney/api-types';
import { apiGet } from '../lib/api';
import { isSuperAdminSession, type AdminSessionInfo } from '../lib/adminSession';
import { fenToYuan, formatTimeSmart } from '../lib/format';
import { normalizeUserFacingText } from '../lib/userFacingText';
import { useLiveNoticePush, type LiveNotice } from '../ui/liveNotices';
import type { DashboardAnalysisData, DashboardDistributionItem, DashboardOperationsSnapshot, DashboardTrendPoint } from './dashboard/DashboardAnalyticsSection';

type FinanceSummary = components['schemas']['FinanceReportSummary'];
type HealthResponse = { ok?: boolean; checks?: Record<string, { ok?: boolean; error?: string }> };

type DashboardSummaryResponse = {
  overview?: {
    patentsTotal?: number | null;
    techManagersApprovedTotal?: number | null;
    ordersTotal?: number | null;
    completedOrdersTotal?: number | null;
    completedDealAmountFen?: number | null;
  } | null;
  operations?: DashboardOperationsSnapshot | null;
  trends?: Pick<DashboardAnalysisData, 'range' | 'orders30d' | 'completedOrders30d' | 'dealAmount30d'> | null;
  distribution?: Pick<DashboardAnalysisData, 'patentTypes' | 'orderStatuses'> | null;
};

type MetricValue = number | null;

type DashboardLiveOrderItem = {
  id: string;
  listingTitle?: string | null;
  buyerDisplayName?: string | null;
  sellerDisplayName?: string | null;
  createdAt: string;
};

type DashboardLiveConversationItem = {
  id: string;
  contentType?: string | null;
  contentTitle?: string | null;
  listingTitle?: string | null;
  counterpart?: {
    displayName?: string | null;
    nickname?: string | null;
  } | null;
  createdAt: string;
};

type DashboardOrdersFeedResponse = {
  items?: DashboardLiveOrderItem[] | null;
};

type DashboardConversationsFeedResponse = {
  items?: DashboardLiveConversationItem[] | null;
};

const RANGE_KEY = 'admin.dashboard.analysisRangeDays';
const RANGE_OPTIONS = [7, 30, 90, 180] as const;
const CHART_COLORS = ['#ff6a00', '#ffb020', '#ff8f3d', '#f45b5b', '#13c2c2', '#722ed1'];
const LIVE_NOTICE_PAGE_SIZE = 10;
const QUICK_ACTIONS_PANEL_KEY = 'quick-actions';
const OPS_PANEL_KEY = 'ops-workbench';

function can(permissionSet: Set<string>, permission: string): boolean {
  return permissionSet.has('*') || permissionSet.has(permission);
}

function toMetricValue(value: unknown): MetricValue {
  if (value === undefined || value === null) return null;
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function toNumber(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatCount(value: MetricValue): string {
  return value === null ? '-' : value.toLocaleString('zh-CN');
}

function formatFenValue(value: MetricValue): string {
  return value === null ? '-' : fenToYuan(value, { digits: 0 });
}

function readStoredRangeDays(): number {
  if (typeof window === 'undefined') return 30;
  const raw = Number(window.localStorage.getItem(RANGE_KEY));
  return RANGE_OPTIONS.includes(raw as (typeof RANGE_OPTIONS)[number]) ? raw : 30;
}

function latestCreatedAt(items: Array<{ createdAt?: string | null }>): string {
  return items.reduce((latest, item) => {
    const createdAt = String(item.createdAt || '');
    return createdAt > latest ? createdAt : latest;
  }, '');
}

function conversationFeedLabel(contentType?: string | null): string {
  const normalized = String(contentType || '').trim().toUpperCase();
  if (normalized === 'SUPPORT') return '客服会话';
  if (normalized === 'DISPUTE') return '争议会话';
  if (normalized === 'MAINTENANCE') return '年费会话';
  if (normalized === 'ACHIEVEMENT') return '成果会话';
  if (normalized === 'TECH_MANAGER') return '经理人会话';
  if (normalized === 'LISTING') return '咨询会话';
  return '新会话';
}

function buildOrderNotice(item: DashboardLiveOrderItem): LiveNotice {
  const listingTitle = normalizeUserFacingText(item.listingTitle) || '新订单';
  const buyer = normalizeUserFacingText(item.buyerDisplayName);
  const seller = normalizeUserFacingText(item.sellerDisplayName);
  const summary = [listingTitle, buyer ? `买方 ${buyer}` : '', seller ? `卖方 ${seller}` : '', formatTimeSmart(item.createdAt)]
    .filter(Boolean)
    .join(' · ');

  return {
    id: `order-${item.id}`,
    kind: 'order',
    title: '新订单',
    summary,
    href: `/orders/${item.id}`,
    createdAt: item.createdAt,
    icon: <ShoppingCartOutlined />,
  };
}

function buildConversationNotice(item: DashboardLiveConversationItem): LiveNotice {
  const title = normalizeUserFacingText(item.contentTitle) || normalizeUserFacingText(item.listingTitle) || '新会话';
  const counterpart =
    normalizeUserFacingText(item.counterpart?.displayName) || normalizeUserFacingText(item.counterpart?.nickname) || '待确认对象';
  const summary = [conversationFeedLabel(item.contentType), title, counterpart, formatTimeSmart(item.createdAt)]
    .filter(Boolean)
    .join(' · ');

  return {
    id: `conversation-${item.id}`,
    kind: 'conversation',
    title: '新会话',
    summary,
    href: '/conversations/platform',
    createdAt: item.createdAt,
    icon: <MessageOutlined />,
  };
}

function selectAxisLabels(points: DashboardTrendPoint[]) {
  if (points.length <= 8) return points;
  const step = Math.max(1, Math.ceil(points.length / 6));
  return points.filter((_, index) => index % step === 0 || index === points.length - 1);
}

function MetricCard({
  title,
  value,
  suffix,
  icon,
}: {
  title: string;
  value: string;
  suffix?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="ipm-showcase-metric-card">
      <div className="ipm-showcase-metric-icon">{icon}</div>
      <div className="ipm-showcase-metric-content">
        <span>{title}</span>
        <strong>
          {value}
          {suffix ? <small>{suffix}</small> : null}
        </strong>
      </div>
    </div>
  );
}

function BarChart({
  points,
  color,
  money,
}: {
  points: DashboardTrendPoint[];
  color: string;
  money?: boolean;
}) {
  const gradientId = useId().replace(/:/g, '-');
  const geometry = useMemo(() => {
    const values = points.map((item) => Math.max(0, toNumber(item.value)));
    const max = Math.max(1, ...values);
    const width = 520;
    const height = 250;
    const padding = { top: 18, right: 18, bottom: 42, left: 54 };
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;
    const slotWidth = innerWidth / Math.max(1, values.length);
    const barWidth = values.length <= 1 ? Math.min(48, Math.max(18, innerWidth * 0.38)) : Math.max(1.5, Math.min(16, slotWidth * 0.72));
    const bars = values.map((value, index) => {
      const x = padding.left + slotWidth * index + (slotWidth - barWidth) / 2;
      const barHeight = (value / max) * innerHeight;
      const y = padding.top + innerHeight - barHeight;
      return { barHeight, value, width: barWidth, x, y };
    });
    const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
      value: Math.round(max * ratio),
      y: padding.top + innerHeight - ratio * innerHeight,
    }));
    return { bars, height, innerHeight, innerWidth, max, padding, slotWidth, width, yTicks };
  }, [points]);
  const axisLabels = selectAxisLabels(points);

  if (points.length === 0) {
    return (
      <div className="ipm-showcase-chart-empty">
        <Typography.Text type="secondary">暂无统计数据</Typography.Text>
      </div>
    );
  }

  return (
    <svg viewBox={`0 0 ${geometry.width} ${geometry.height}`} width="100%" height="100%" role="img" aria-label="bar chart">
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.03" />
        </linearGradient>
      </defs>
      {geometry.yTicks.map((tick) => (
        <g key={tick.y}>
          <line
            x1={geometry.padding.left}
            x2={geometry.padding.left + geometry.innerWidth}
            y1={tick.y}
            y2={tick.y}
            className="ipm-showcase-grid-line"
          />
          <text x={geometry.padding.left - 10} y={tick.y + 4} textAnchor="end" className="ipm-showcase-axis-text">
            {money ? (tick.value / 1000000).toFixed(1) : tick.value.toLocaleString('zh-CN')}
          </text>
        </g>
      ))}
      {geometry.bars.map((bar, index) => (
        <rect
          key={`${bar.x}-${bar.y}-${index}`}
          x={bar.x}
          y={bar.y}
          width={bar.width}
          height={Math.max(0, bar.barHeight)}
          rx={3}
          fill={`url(#${gradientId})`}
        />
      ))}
      {axisLabels.map((point) => {
        const index = points.findIndex((item) => item.key === point.key);
        const x = geometry.padding.left + geometry.slotWidth * Math.max(0, index) + geometry.slotWidth / 2;
        return (
          <text key={point.key} x={x} y={geometry.height - 14} textAnchor="middle" className="ipm-showcase-axis-text">
            {point.label}
          </text>
        );
      })}
    </svg>
  );
}

function TrendPanel({
  title,
  legend,
  points,
  color,
  money,
}: {
  title: string;
  legend: string;
  points: DashboardTrendPoint[];
  color: string;
  money?: boolean;
}) {
  return (
    <div className="ipm-showcase-panel ipm-showcase-trend-panel">
      <div className="ipm-showcase-panel-head">
        <Typography.Title level={4}>{title}</Typography.Title>
        <span className="ipm-showcase-legend-mark" style={{ background: color }} />
        <Typography.Text type="secondary">{legend}</Typography.Text>
      </div>
      <div className="ipm-showcase-chart-wrap">
        <BarChart points={points} color={color} money={money} />
      </div>
    </div>
  );
}

function DonutChart({
  items,
  total,
  label,
}: {
  items: DashboardDistributionItem[];
  total: number;
  label: string;
}) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const itemTotal = items.reduce((acc, item) => acc + toNumber(item.value), 0);
  let offset = 0;

  if (items.length === 0 || itemTotal <= 0) {
    return <div className="ipm-showcase-donut-empty">暂无</div>;
  }

  return (
    <svg viewBox="0 0 132 132" width="180" height="180" role="img" aria-label="distribution chart">
      <circle cx="66" cy="66" r={radius} fill="none" stroke="rgba(15, 23, 42, 0.08)" strokeWidth="20" />
      {items.map((item, index) => {
        const value = toNumber(item.value);
        const length = (value / itemTotal) * circumference;
        const dashOffset = -offset;
        offset += length;
        return (
          <circle
            key={item.key}
            cx="66"
            cy="66"
            r={radius}
            fill="none"
            stroke={CHART_COLORS[index % CHART_COLORS.length]}
            strokeWidth="20"
            strokeDasharray={`${length} ${circumference - length}`}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 66 66)"
          />
        );
      })}
      <text x="66" y="63" textAnchor="middle" className="ipm-showcase-donut-total">
        {formatCount(total)}
      </text>
      <text x="66" y="82" textAnchor="middle" className="ipm-showcase-donut-label">
        {label}
      </text>
    </svg>
  );
}

function DistributionPanel({
  title,
  total,
  totalLabel,
  nameLabel,
  unitLabel,
  items,
}: {
  title: string;
  total: number;
  totalLabel: string;
  nameLabel: string;
  unitLabel: string;
  items: DashboardDistributionItem[];
}) {
  const itemTotal = items.reduce((acc, item) => acc + toNumber(item.value), 0);

  return (
    <div className="ipm-showcase-panel ipm-showcase-distribution-panel">
      <div className="ipm-showcase-panel-head">
        <Typography.Title level={4}>{title}</Typography.Title>
      </div>
      <div className="ipm-showcase-distribution-body">
        <DonutChart items={items} total={total} label={totalLabel} />
        <div className="ipm-showcase-distribution-table">
          <div className="ipm-showcase-table-head">
            <span>{nameLabel}</span>
            <span>数量（{unitLabel}）</span>
            <span>占比</span>
          </div>
          {items.length > 0 ? (
            items.map((item, index) => {
              const value = toNumber(item.value);
              const percent = itemTotal > 0 ? `${((value / itemTotal) * 100).toFixed(1)}%` : '-';
              return (
                <div className="ipm-showcase-table-row" key={item.key}>
                  <span>
                    <i style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />
                    {item.label}
                  </span>
                  <strong>{formatCount(value)}</strong>
                  <strong>{percent}</strong>
                </div>
              );
            })
          ) : (
            <Typography.Text type="secondary">暂无分布数据</Typography.Text>
          )}
          {items.length > 0 ? (
            <div className="ipm-showcase-table-total">
              <span>合计</span>
              <strong>{formatCount(itemTotal)}</strong>
              <strong>100%</strong>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const dataCenterRef = useRef<HTMLDivElement | null>(null);
  const pushLiveNotices = useLiveNoticePush();
  const refreshInFlightRef = useRef(false);
  const liveFeedInFlightRef = useRef(false);
  const liveOrderSeededRef = useRef(false);
  const liveConversationSeededRef = useRef(false);
  const latestOrderCreatedAtRef = useRef('');
  const latestConversationCreatedAtRef = useRef('');
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);
  const [financeSummary, setFinanceSummary] = useState<FinanceSummary | null>(null);
  const [healthOk, setHealthOk] = useState(false);
  const [healthChecks, setHealthChecks] = useState<Record<string, { ok?: boolean; error?: string }>>({});
  const [permissionSet, setPermissionSet] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string>('');
  const [rangeDays, setRangeDays] = useState<number>(readStoredRangeDays);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(RANGE_KEY, String(rangeDays));
  }, [rangeDays]);

  useEffect(() => {
    const syncFullscreen = () => {
      setIsFullscreen(document.fullscreenElement === dataCenterRef.current);
    };
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isFullscreen && !document.fullscreenElement) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFullscreen]);

  const load = useCallback(async (options?: { quiet?: boolean }) => {
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const sessionRes = await apiGet<AdminSessionInfo>('/auth/session');
      const nextPermissions = new Set(sessionRes?.permissions || []);
      if (isSuperAdminSession(sessionRes)) nextPermissions.add('*');
      setPermissionSet(nextPermissions);

      const canVerificationRead = can(nextPermissions, 'verification.read');
      const canListingRead = can(nextPermissions, 'listing.read');
      const canOrderRead = can(nextPermissions, 'order.read');
      const canConversationManage = can(nextPermissions, 'conversation.platform.manage');
      const canCaseManage = can(nextPermissions, 'case.manage');
      const canReportRead = can(nextPermissions, 'report.read');
      const needsDashboardSummary = canVerificationRead || canListingRead || canOrderRead || canConversationManage || canCaseManage;

      const [summaryRes, financeRes, healthRes] = await Promise.allSettled([
        needsDashboardSummary ? apiGet<DashboardSummaryResponse>('/admin/dashboard/showcase-summary', { days: rangeDays }) : Promise.resolve(null),
        canReportRead ? apiGet<FinanceSummary>('/admin/reports/finance/summary') : Promise.resolve(null),
        apiGet<HealthResponse>('/health'),
      ]);

      const errors: string[] = [];

      if (summaryRes.status === 'fulfilled') {
        setSummary(summaryRes.value || null);
      } else {
        setSummary(null);
        if (needsDashboardSummary) errors.push('展示摘要');
      }

      if (financeRes.status === 'fulfilled') {
        setFinanceSummary(financeRes.value || null);
      } else {
        setFinanceSummary(null);
        if (canReportRead) errors.push('财务报表');
      }

      if (healthRes.status === 'fulfilled') {
        setHealthOk(Boolean(healthRes.value?.ok));
        setHealthChecks(healthRes.value?.checks || {});
      } else {
        setHealthOk(false);
        setHealthChecks({});
        errors.push('健康检查');
      }

      setLastUpdatedAt(new Date().toISOString());

      if (errors.length > 0) {
        const msg = `部分数据加载失败：${errors.join('、')}`;
        setError(msg);
        if (!options?.quiet) {
          message.warning(msg);
        }
      }
    } catch (e: any) {
      const msg = e?.message || '数据中心加载失败';
      setError(msg);
      if (!options?.quiet) {
        message.error(msg);
      }
    } finally {
      setLoading(false);
      refreshInFlightRef.current = false;
    }
  }, [rangeDays]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const refreshSilently = () => {
      if (document.visibilityState !== 'visible') return;
      void load({ quiet: true });
    };

    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void load({ quiet: true });
    }, 60_000);

    document.addEventListener('visibilitychange', refreshSilently);
    window.addEventListener('focus', refreshSilently);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshSilently);
      window.removeEventListener('focus', refreshSilently);
    };
  }, [load]);

  const refreshLiveFeed = useCallback(
    async (options?: { quiet?: boolean }) => {
      if (liveFeedInFlightRef.current) return;
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;

      const canOrderRead = can(permissionSet, 'order.read');
      const canConversationManage = can(permissionSet, 'conversation.platform.manage');
      if (!canOrderRead && !canConversationManage) return;

      liveFeedInFlightRef.current = true;
      try {
        const [orderRes, conversationRes] = await Promise.all([
          canOrderRead ? apiGet<DashboardOrdersFeedResponse>('/admin/orders', { page: 1, pageSize: LIVE_NOTICE_PAGE_SIZE }) : Promise.resolve(null),
          canConversationManage
            ? apiGet<DashboardConversationsFeedResponse>('/admin/conversations/platform', { page: 1, pageSize: LIVE_NOTICE_PAGE_SIZE })
            : Promise.resolve(null),
        ]);

        const nextNotices: LiveNotice[] = [];

        if (canOrderRead) {
          const orderItems = orderRes?.items || [];
          const newestOrderCreatedAt = orderItems[0]?.createdAt || '';
          if (!liveOrderSeededRef.current) {
            latestOrderCreatedAtRef.current = newestOrderCreatedAt;
            liveOrderSeededRef.current = true;
          } else {
            const freshOrders = orderItems.filter((item) => String(item.createdAt || '') > latestOrderCreatedAtRef.current);
            if (freshOrders.length > 0) {
              nextNotices.push(...freshOrders.slice().reverse().map((item) => buildOrderNotice(item)));
            }
            if (newestOrderCreatedAt > latestOrderCreatedAtRef.current) {
              latestOrderCreatedAtRef.current = newestOrderCreatedAt;
            }
          }
        }

        if (canConversationManage) {
          const conversationItems = conversationRes?.items || [];
          const newestConversationCreatedAt = latestCreatedAt(conversationItems);
          if (!liveConversationSeededRef.current) {
            latestConversationCreatedAtRef.current = newestConversationCreatedAt;
            liveConversationSeededRef.current = true;
          } else {
            const freshConversations = conversationItems
              .filter((item) => String(item.createdAt || '') > latestConversationCreatedAtRef.current)
              .sort((a, b) => {
                const timeDiff = a.createdAt.localeCompare(b.createdAt);
                if (timeDiff !== 0) return timeDiff;
                return a.id.localeCompare(b.id);
              });
            if (freshConversations.length > 0) {
              nextNotices.push(...freshConversations.map((item) => buildConversationNotice(item)));
            }
            if (newestConversationCreatedAt > latestConversationCreatedAtRef.current) {
              latestConversationCreatedAtRef.current = newestConversationCreatedAt;
            }
          }
        }

        if (nextNotices.length > 0) {
          nextNotices.sort((a, b) => {
            const timeDiff = a.createdAt.localeCompare(b.createdAt);
            if (timeDiff !== 0) return timeDiff;
            return a.id.localeCompare(b.id);
          });
          pushLiveNotices(nextNotices);
        }
      } catch {
        if (!options?.quiet) {
          // keep the reminder layer quiet; the main summary already surfaces errors
        }
      } finally {
        liveFeedInFlightRef.current = false;
      }
    },
    [permissionSet, pushLiveNotices],
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const canPollLiveFeed = can(permissionSet, 'order.read') || can(permissionSet, 'conversation.platform.manage');
    if (!canPollLiveFeed) return;

    const refreshSilently = () => {
      if (document.visibilityState !== 'visible') return;
      void refreshLiveFeed({ quiet: true });
    };

    const timer = window.setInterval(refreshSilently, 15_000);
    document.addEventListener('visibilitychange', refreshSilently);
    window.addEventListener('focus', refreshSilently);
    refreshSilently();

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshSilently);
      window.removeEventListener('focus', refreshSilently);
    };
  }, [permissionSet, refreshLiveFeed]);

  const toggleFullscreen = useCallback(async () => {
    const target = dataCenterRef.current;
    if (!target) return;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      if (target.requestFullscreen) {
        await target.requestFullscreen();
        return;
      }
      setIsFullscreen((prev) => !prev);
    } catch {
      setIsFullscreen((prev) => !prev);
    }
  }, []);

  const analysisData = useMemo<DashboardAnalysisData | null>(() => {
    if (!summary?.trends || !summary?.distribution) return null;
    return {
      ...summary.trends,
      ...summary.distribution,
    };
  }, [summary]);

  const hasOrderAccess = can(permissionSet, 'order.read');
  const hasListingAccess = can(permissionSet, 'listing.read');
  const hasVerificationAccess = can(permissionSet, 'verification.read');
  const hasReportAccess = can(permissionSet, 'report.read');

  const operations: DashboardOperationsSnapshot = summary?.operations || {
    pendingVerifications: null,
    pendingListings: null,
    unassignedConversations: null,
    openCases: null,
  };

  const metricCards = useMemo(
    () =>
      [
        {
          key: 'completed-deal-amount',
          title: '累计成交额',
          value: formatFenValue(toMetricValue(summary?.overview?.completedDealAmountFen)),
          suffix: '元',
          permission: 'order.read',
          icon: <DollarOutlined />,
        },
        {
          key: 'patents-total',
          title: '专利总量',
          value: formatCount(toMetricValue(summary?.overview?.patentsTotal)),
          suffix: '件',
          permission: 'listing.read',
          icon: <FileTextOutlined />,
        },
        {
          key: 'tech-managers-approved-total',
          title: '技术经理人数量',
          value: formatCount(toMetricValue(summary?.overview?.techManagersApprovedTotal)),
          suffix: '人',
          permission: 'verification.read',
          icon: <TeamOutlined />,
        },
        {
          key: 'orders-total',
          title: '订单总量',
          value: formatCount(toMetricValue(summary?.overview?.ordersTotal)),
          suffix: '单',
          permission: 'order.read',
          icon: <ShoppingCartOutlined />,
        },
        {
          key: 'completed-orders-total',
          title: '已完成订单数',
          value: formatCount(toMetricValue(summary?.overview?.completedOrdersTotal)),
          suffix: '单',
          permission: 'order.read',
          icon: <CheckSquareOutlined />,
        },
      ].filter((item) => can(permissionSet, item.permission)),
    [permissionSet, summary],
  );

  const quickActions = useMemo(
    () =>
      [
        { label: '认证审核', to: '/verifications', tone: 'processing' as const, permission: 'verification.read' },
        { label: '上架审核', to: '/listings', tone: 'gold' as const, permission: 'listing.read' },
        { label: '平台会话', to: '/conversations/platform', tone: 'cyan' as const, permission: 'conversation.platform.manage' },
        { label: '专利批量运营', to: '/patents/operations', tone: 'green' as const, permission: 'patent.import' },
        { label: '成果/经理人导入', to: '/imports/bulk', tone: 'volcano' as const, permission: 'patent.import' },
        { label: '首页展示内容', to: '/config/home-landing', tone: 'purple' as const, permission: 'config.manage' },
        { label: '账号权限', to: '/rbac', tone: 'blue' as const, permission: 'rbac.manage' },
        { label: '订单管理', to: '/orders', tone: 'default' as const, permission: 'order.read' },
      ].filter((item) => can(permissionSet, item.permission)),
    [permissionSet],
  );

  const operationCards = useMemo(
    () =>
      [
        {
          key: 'pending-verifications',
          title: '待审核认证',
          value: operations.pendingVerifications ?? null,
          to: '/verifications',
          permission: 'verification.read',
        },
        {
          key: 'pending-listings',
          title: '待审核上架',
          value: operations.pendingListings ?? null,
          to: '/listings',
          permission: 'listing.read',
        },
        {
          key: 'unassigned-conversations',
          title: '未分配会话',
          value: operations.unassignedConversations ?? null,
          to: '/conversations/platform',
          permission: 'conversation.platform.manage',
        },
        {
          key: 'open-cases',
          title: '待处理工单',
          value: operations.openCases ?? null,
          to: '/cases',
          permission: 'case.manage',
        },
      ].filter((item) => can(permissionSet, item.permission)),
    [operations, permissionSet],
  );

  const payoutRate = Number(financeSummary?.payoutSuccessRate ?? 0);
  const refundRate = Number(financeSummary?.refundRate ?? 0);
  const healthItems = Object.entries(healthChecks || {});

  const ordersTrend = hasOrderAccess ? analysisData?.orders30d || [] : [];
  const completedTrend = hasOrderAccess ? analysisData?.completedOrders30d || [] : [];
  const amountTrend = hasOrderAccess ? analysisData?.dealAmount30d || [] : [];
  const orderStatusItems = hasOrderAccess ? analysisData?.orderStatuses || [] : [];
  const patentTypeItems = hasListingAccess ? analysisData?.patentTypes || [] : [];
  const orderDistributionTotal = orderStatusItems.reduce((acc, item) => acc + toNumber(item.value), 0);
  const patentDistributionTotal = patentTypeItems.reduce((acc, item) => acc + toNumber(item.value), 0);

  return (
    <div className="ipm-showcase-page" aria-busy={loading}>
      <div
        ref={dataCenterRef}
        className={`ipm-showcase-data-center${isFullscreen ? ' ipm-showcase-data-center-fullscreen' : ''}`}
      >
        <div className="ipm-showcase-header">
          <div />
          <Typography.Title level={2}>平台成果总览</Typography.Title>
          <Space className="ipm-showcase-actions" wrap>
            {lastUpdatedAt ? <Tag color="orange">更新于 {formatTimeSmart(lastUpdatedAt)}</Tag> : null}
            <Button icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />} onClick={() => void toggleFullscreen()}>
              {isFullscreen ? '退出全屏' : '全屏展示'}
            </Button>
          </Space>
        </div>

        {error ? <Alert type="warning" showIcon message={error} /> : null}

        <div className="ipm-showcase-range-row">
          <Segmented
            value={rangeDays}
            options={RANGE_OPTIONS.map((value) => ({ value, label: `${value}天` }))}
            onChange={(value) => setRangeDays(Number(value))}
          />
        </div>

        <div className="ipm-showcase-metrics">
          {metricCards.map((item) => (
            <MetricCard key={item.key} title={item.title} value={item.value} suffix={item.suffix} icon={item.icon} />
          ))}
        </div>

        <div className="ipm-showcase-trends">
          <TrendPanel title="订单数量统计" legend="订单数量（单）" points={ordersTrend} color="#ff6a00" />
          <TrendPanel title="已完成订单统计" legend="已完成订单数（单）" points={completedTrend} color="#ff7a1a" />
          <TrendPanel title="成交额统计" legend="成交额（万元）" points={amountTrend} color="#ff8f3d" money />
        </div>

        <div className="ipm-showcase-distributions">
          <DistributionPanel
            title="订单状态分布"
            total={orderDistributionTotal}
            totalLabel="订单总量"
            nameLabel="状态"
            unitLabel="单"
            items={orderStatusItems}
          />
          <DistributionPanel
            title="专利类型分布"
            total={patentDistributionTotal}
            totalLabel="专利总量"
            nameLabel="类型"
            unitLabel="件"
            items={patentTypeItems}
          />
        </div>
      </div>

      <div className="ipm-dashboard-page">
        <Collapse
          className="ipm-dashboard-collapse ipm-dashboard-collapse-quick"
          bordered={false}
          items={[
            {
              key: QUICK_ACTIONS_PANEL_KEY,
              label: '快捷入口',
              children:
                quickActions.length > 0 ? (
                  <div className="ipm-dashboard-quick-actions-grid">
                    {quickActions.map((item) => (
                      <button key={item.label} type="button" className="ipm-dashboard-quick-action" onClick={() => navigate(item.to)}>
                        <Tag color={item.tone}>{item.label}</Tag>
                        <ArrowRightOutlined />
                      </button>
                    ))}
                  </div>
                ) : (
                  <Typography.Text type="secondary">暂无快捷入口。</Typography.Text>
                ),
            },
          ]}
        />

        <Collapse
          className="ipm-dashboard-collapse ipm-dashboard-collapse-ops"
          bordered={false}
          items={[
            {
              key: OPS_PANEL_KEY,
              label: '仪表台内容',
              children: (
                <Space direction="vertical" size={16} style={{ width: '100%' }}>
                  <Row gutter={[16, 16]}>
                    {operationCards.length > 0 ? (
                      operationCards.map((item) => {
                        const allowed = can(permissionSet, item.permission);
                        const displayValue = formatCount(item.value);
                        return (
                          <Col key={item.key} xs={24} sm={12} lg={6}>
                            <Card
                              className="ipm-dashboard-panel"
                              loading={loading}
                              hoverable={allowed}
                              onClick={() => {
                                if (allowed) navigate(item.to);
                              }}
                              style={{ cursor: allowed ? 'pointer' : 'default' }}
                            >
                              <Statistic title={item.title} value={displayValue} />
                              {!allowed ? <Tag color="default">无权限</Tag> : null}
                            </Card>
                          </Col>
                        );
                      })
                    ) : (
                      <Col span={24}>
                        <Typography.Text type="secondary">暂无可查看的运营数据。</Typography.Text>
                      </Col>
                    )}
                  </Row>

                  <Row gutter={[16, 16]}>
                    <Col xs={24} xl={14}>
                      <Card className="ipm-dashboard-panel" loading={loading} title="资金与履约">
                        {hasReportAccess ? (
                          financeSummary ? (
                            <Space direction="vertical" size={14} style={{ width: '100%' }}>
                              <Row gutter={[16, 12]}>
                                <Col span={12}>
                                  <Statistic title="成交金额" value={`¥${fenToYuan(financeSummary.dealAmountFen ?? 0)}`} />
                                </Col>
                                <Col span={12}>
                                  <Statistic title="佣金收入" value={`¥${fenToYuan(financeSummary.commissionAmountFen ?? 0)}`} />
                                </Col>
                                <Col span={12}>
                                  <Statistic title="订单总量" value={financeSummary.ordersTotal ?? 0} />
                                </Col>
                              </Row>
                              <div>
                                <Typography.Text>放款成功率</Typography.Text>
                                <Progress
                                  percent={Number((payoutRate * 100).toFixed(2))}
                                  status={payoutRate >= 0.95 ? 'success' : 'active'}
                                />
                              </div>
                              <div>
                                <Typography.Text>退款率</Typography.Text>
                                <Progress
                                  percent={Number((refundRate * 100).toFixed(2))}
                                  status={refundRate <= 0.05 ? 'success' : refundRate <= 0.12 ? 'normal' : 'exception'}
                                />
                              </div>
                            </Space>
                          ) : (
                            <Typography.Text type="secondary">暂无财务指标数据。</Typography.Text>
                          )
                        ) : (
                          <Typography.Text type="secondary">当前角色无财务报表查看权限。</Typography.Text>
                        )}
                      </Card>
                    </Col>
                    <Col xs={24} xl={10}>
                      <Card className="ipm-dashboard-panel" loading={loading} title="系统健康">
                        <Space direction="vertical" size={10} style={{ width: '100%' }}>
                          <Alert
                            type={healthOk ? 'success' : 'error'}
                            showIcon
                            message={healthOk ? '服务健康状态正常' : '服务健康状态异常，请尽快排查'}
                          />
                          {healthItems.length > 0 ? (
                            <List
                              size="small"
                              dataSource={healthItems}
                              renderItem={([name, status]) => (
                                <List.Item>
                                  <Space>
                                    <Tag color={status?.ok ? 'green' : 'red'}>{status?.ok ? 'OK' : 'FAIL'}</Tag>
                                    <Typography.Text>{name}</Typography.Text>
                                    {!status?.ok && status?.error ? (
                                      <Typography.Text type="secondary">{status.error}</Typography.Text>
                                    ) : null}
                                  </Space>
                                </List.Item>
                              )}
                            />
                          ) : (
                            <Typography.Text type="secondary">暂无详细探针信息。</Typography.Text>
                          )}
                        </Space>
                      </Card>
                    </Col>
                  </Row>
                </Space>
              ),
            },
          ]}
        />
      </div>

      {!hasOrderAccess && !hasListingAccess && !hasVerificationAccess ? (
        <Alert type="info" showIcon message="当前角色暂无平台成果数据查看权限。" />
      ) : null}
    </div>
  );
}
