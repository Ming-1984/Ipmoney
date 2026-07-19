import {
  Alert,
  Button,
  Card,
  Col,
  Collapse,
  List,
  Progress,
  Row,
  Segmented,
  Space,
  Statistic,
  Tag,
  Typography,
  message,
} from 'antd';
import { AppstoreOutlined, ArrowRightOutlined, ReloadOutlined, SettingOutlined } from '@ant-design/icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type { components } from '@ipmoney/api-types';

import { apiGet } from '../lib/api';
import { fenToYuan, formatTimeSmart } from '../lib/format';

type PagedUserVerification = components['schemas']['PagedUserVerification'];
type PagedListing = components['schemas']['PagedListing'];
type PagedConversationSummary = components['schemas']['PagedConversationSummary'];
type PagedCase = components['schemas']['PagedCase'];
type FinanceSummary = components['schemas']['FinanceReportSummary'];
type HealthResponse = { ok?: boolean; checks?: Record<string, { ok?: boolean; error?: string }> };
type SessionInfo = { permissions?: string[] };

type ShowcaseSummaryResponse = {
  overview?: {
    patentsTotal?: number | null;
    techManagersApprovedTotal?: number | null;
    ordersTotal?: number | null;
    completedOrdersTotal?: number | null;
    completedDealAmountFen?: number | null;
  } | null;
};

type MetricValue = number | null;
type DashboardViewMode = 'showcase' | 'ops';

type DashboardState = {
  showcase: {
    patentsTotal: MetricValue;
    techManagersApprovedTotal: MetricValue;
    ordersTotal: MetricValue;
    completedOrdersTotal: MetricValue;
    completedDealAmountFen: MetricValue;
  };
  pendingVerifications: MetricValue;
  pendingListings: MetricValue;
  unassignedConversations: MetricValue;
  openCases: MetricValue;
  finance: FinanceSummary | null;
  healthOk: boolean;
  healthChecks: Record<string, { ok?: boolean; error?: string }>;
};

const DASHBOARD_MODE_KEY = 'admin.dashboard.viewMode';
const OPS_PANEL_KEY = 'ops-workbench';

const defaultState: DashboardState = {
  showcase: {
    patentsTotal: null,
    techManagersApprovedTotal: null,
    ordersTotal: null,
    completedOrdersTotal: null,
    completedDealAmountFen: null,
  },
  pendingVerifications: null,
  pendingListings: null,
  unassignedConversations: null,
  openCases: null,
  finance: null,
  healthOk: false,
  healthChecks: {},
};

const VIEW_MODE_OPTIONS: Array<{ value: DashboardViewMode; label: React.ReactNode }> = [
  {
    value: 'showcase',
    label: (
      <Space size={6}>
        <AppstoreOutlined />
        <span>展示视图</span>
      </Space>
    ),
  },
  {
    value: 'ops',
    label: (
      <Space size={6}>
        <SettingOutlined />
        <span>运营视图</span>
      </Space>
    ),
  },
] as const;

function can(permissionSet: Set<string>, permission: string): boolean {
  return permissionSet.has('*') || permissionSet.has(permission);
}

function toMetricValue(value: unknown): MetricValue {
  if (value === undefined || value === null) return null;
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatCount(value: MetricValue): string {
  return value === null ? '-' : value.toLocaleString('zh-CN');
}

function formatFenValue(value: MetricValue): string {
  return value === null ? '-' : `¥${fenToYuan(value)}`;
}

function readInitialMode(): DashboardViewMode {
  if (typeof window === 'undefined') return 'showcase';
  const stored = window.localStorage.getItem(DASHBOARD_MODE_KEY);
  return stored === 'ops' ? 'ops' : 'showcase';
}

function isOpsPanelOpen(next: string | string[] | undefined): boolean {
  if (Array.isArray(next)) return next.includes(OPS_PANEL_KEY);
  return next === OPS_PANEL_KEY;
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<DashboardState>(defaultState);
  const [permissionSet, setPermissionSet] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string>('');
  const [viewMode, setViewMode] = useState<DashboardViewMode>(readInitialMode);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(DASHBOARD_MODE_KEY, viewMode);
  }, [viewMode]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const session = await apiGet<SessionInfo>('/auth/session');
      const perms = new Set(session?.permissions || []);
      setPermissionSet(perms);

      const canVerificationRead = can(perms, 'verification.read');
      const canListingRead = can(perms, 'listing.read');
      const canOrderRead = can(perms, 'order.read');
      const canConversationManage = can(perms, 'conversation.platform.manage');
      const canCaseManage = can(perms, 'case.manage');
      const canReportRead = can(perms, 'report.read');
      const needsShowcaseSummary = canListingRead || canVerificationRead || canOrderRead;

      const results = await Promise.allSettled([
        needsShowcaseSummary ? apiGet<ShowcaseSummaryResponse>('/admin/dashboard/showcase-summary') : Promise.resolve(null),
        canVerificationRead ? apiGet<PagedUserVerification>('/admin/user-verifications', { status: 'PENDING', page: 1, pageSize: 1 }) : Promise.resolve(null),
        canListingRead ? apiGet<PagedListing>('/admin/listings', { auditStatus: 'PENDING', page: 1, pageSize: 1 }) : Promise.resolve(null),
        canConversationManage
          ? apiGet<PagedConversationSummary>('/admin/conversations/platform', {
              assigned: 'UNASSIGNED',
              page: 1,
              pageSize: 1,
            })
          : Promise.resolve(null),
        canCaseManage ? apiGet<PagedCase>('/admin/cases', { status: 'OPEN', page: 1, pageSize: 1 }) : Promise.resolve(null),
        canReportRead ? apiGet<FinanceSummary>('/admin/reports/finance/summary') : Promise.resolve(null),
        apiGet<HealthResponse>('/health'),
      ]);

      const errors: string[] = [];
      const next: DashboardState = {
        ...defaultState,
        showcase: { ...defaultState.showcase },
        healthChecks: {},
      };

      const [summaryRes, verRes, listingRes, convRes, caseRes, financeRes, healthRes] = results;

      if (summaryRes.status === 'fulfilled' && summaryRes.value) {
        const overview = summaryRes.value.overview || {};
        next.showcase = {
          patentsTotal: toMetricValue(overview.patentsTotal),
          techManagersApprovedTotal: toMetricValue(overview.techManagersApprovedTotal),
          ordersTotal: toMetricValue(overview.ordersTotal),
          completedOrdersTotal: toMetricValue(overview.completedOrdersTotal),
          completedDealAmountFen: toMetricValue(overview.completedDealAmountFen),
        };
      } else if (needsShowcaseSummary) {
        errors.push('展示摘要');
      }

      if (canVerificationRead) {
        if (verRes.status === 'fulfilled') next.pendingVerifications = toMetricValue(verRes.value?.page?.total);
        else errors.push('认证审核');
      }
      if (canListingRead) {
        if (listingRes.status === 'fulfilled') next.pendingListings = toMetricValue(listingRes.value?.page?.total);
        else errors.push('上架审核');
      }
      if (canConversationManage) {
        if (convRes.status === 'fulfilled') next.unassignedConversations = toMetricValue(convRes.value?.page?.total);
        else errors.push('平台会话');
      }
      if (canCaseManage) {
        if (caseRes.status === 'fulfilled') next.openCases = toMetricValue(caseRes.value?.page?.total);
        else errors.push('工单统计');
      }
      if (canReportRead) {
        if (financeRes.status === 'fulfilled') next.finance = financeRes.value;
        else errors.push('财务报表');
      }

      if (healthRes.status === 'fulfilled') {
        next.healthOk = Boolean(healthRes.value?.ok);
        next.healthChecks = healthRes.value?.checks || {};
      } else {
        errors.push('健康检查');
        next.healthOk = false;
        next.healthChecks = {};
      }

      setState(next);
      setLastUpdatedAt(new Date().toISOString());

      if (errors.length > 0) {
        const msg = `部分数据加载失败：${errors.join('、')}`;
        setError(msg);
        message.warning(msg);
      }
    } catch (e: any) {
      const msg = e?.message || '仪表盘加载失败';
      setError(msg);
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const showcaseCards = useMemo(
    () =>
      [
        {
          key: 'patents-total',
          title: '专利数量',
          value: state.showcase.patentsTotal,
          permission: 'listing.read',
          formatter: formatCount,
        },
        {
          key: 'tech-managers-approved-total',
          title: '已认证技术经理人',
          value: state.showcase.techManagersApprovedTotal,
          permission: 'verification.read',
          formatter: formatCount,
        },
        {
          key: 'orders-total',
          title: '订单数量',
          value: state.showcase.ordersTotal,
          permission: 'order.read',
          formatter: formatCount,
        },
        {
          key: 'completed-orders-total',
          title: '已成交订单',
          value: state.showcase.completedOrdersTotal,
          permission: 'order.read',
          formatter: formatCount,
        },
        {
          key: 'completed-deal-amount',
          title: '累计成交额',
          value: state.showcase.completedDealAmountFen,
          permission: 'order.read',
          formatter: formatFenValue,
        },
      ].filter((item) => can(permissionSet, item.permission)),
    [permissionSet, state.showcase],
  );

  const operationCards = useMemo(
    () =>
      [
        {
          key: 'pending-verifications',
          title: '待审核认证',
          value: state.pendingVerifications,
          to: '/verifications',
          permission: 'verification.read',
        },
        {
          key: 'pending-listings',
          title: '待审核上架',
          value: state.pendingListings,
          to: '/listings',
          permission: 'listing.read',
        },
        {
          key: 'unassigned-conversations',
          title: '未分配会话',
          value: state.unassignedConversations,
          to: '/conversations/platform',
          permission: 'conversation.platform.manage',
        },
        {
          key: 'open-cases',
          title: '待处理工单',
          value: state.openCases,
          to: '/cases',
          permission: 'case.manage',
        },
      ].filter((item) => can(permissionSet, item.permission)),
    [permissionSet, state.openCases, state.pendingListings, state.pendingVerifications, state.unassignedConversations],
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

  const payoutRate = Number(state.finance?.payoutSuccessRate ?? 0);
  const refundRate = Number(state.finance?.refundRate ?? 0);
  const healthItems = Object.entries(state.healthChecks || {});
  const opsCollapseActiveKey = viewMode === 'ops' ? [OPS_PANEL_KEY] : [];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card>
        <Space style={{ width: '100%', justifyContent: 'space-between', alignItems: 'flex-start' }} wrap>
          <div>
            <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 4 }}>
              平台数据看板
            </Typography.Title>
            <Typography.Text type="secondary">平台规模、交易成果与运营状态统一呈现。</Typography.Text>
          </div>
          <Space wrap>
            <Segmented
              value={viewMode}
              options={VIEW_MODE_OPTIONS}
              onChange={(next) => {
                setViewMode(next as DashboardViewMode);
              }}
            />
            <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>
              刷新
            </Button>
          </Space>
        </Space>
        <Space style={{ marginTop: 12 }} wrap>
          {lastUpdatedAt ? <Tag color="blue">更新于 {formatTimeSmart(lastUpdatedAt)}</Tag> : null}
          {error ? <Tag color="orange">部分数据加载失败</Tag> : null}
        </Space>
      </Card>

      {error ? <Alert type="warning" showIcon message={error} /> : null}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          alignItems: 'stretch',
        }}
      >
        {showcaseCards.map((item) => (
          <Card key={item.key} size="small" loading={loading} style={{ height: '100%' }}>
            <Statistic title={item.title} value={item.formatter(item.value)} />
          </Card>
        ))}
      </div>

      <Card title="快捷操作" loading={loading}>
        <List
          dataSource={quickActions}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button key={`${item.label}-go`} type="link" icon={<ArrowRightOutlined />} onClick={() => navigate(item.to)}>
                  进入
                </Button>,
              ]}
            >
              <Tag color={item.tone}>{item.label}</Tag>
            </List.Item>
          )}
        />
      </Card>

      <Collapse
        activeKey={opsCollapseActiveKey}
        onChange={(next) => {
          setViewMode(isOpsPanelOpen(next) ? 'ops' : 'showcase');
        }}
        items={[
          {
            key: OPS_PANEL_KEY,
            label: '内部运营工作区',
            children: (
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Row gutter={[16, 16]}>
                  {operationCards.map((item) => {
                    const allowed = can(permissionSet, item.permission);
                    const displayValue = formatCount(item.value);
                    return (
                      <Col key={item.key} xs={24} sm={12} lg={6}>
                        <Card
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
                  })}
                </Row>

                <Row gutter={[16, 16]}>
                  <Col xs={24} xl={14}>
                    <Card loading={loading} title="资金与履约">
                      {can(permissionSet, 'report.read') ? (
                        state.finance ? (
                          <Space direction="vertical" size={14} style={{ width: '100%' }}>
                            <Row gutter={[16, 12]}>
                              <Col span={12}>
                                <Statistic title="成交金额" value={`¥${fenToYuan(state.finance.dealAmountFen ?? 0)}`} />
                              </Col>
                              <Col span={12}>
                                <Statistic title="佣金收入" value={`¥${fenToYuan(state.finance.commissionAmountFen ?? 0)}`} />
                              </Col>
                              <Col span={12}>
                                <Statistic title="订单总量" value={state.finance.ordersTotal ?? 0} />
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
                    <Card loading={loading} title="系统健康">
                      <Space direction="vertical" size={10} style={{ width: '100%' }}>
                        <Alert
                          type={state.healthOk ? 'success' : 'error'}
                          showIcon
                          message={state.healthOk ? '服务健康状态正常' : '服务健康状态异常，请尽快排查'}
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
    </Space>
  );
}
