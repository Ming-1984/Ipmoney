import {
  Alert,
  Button,
  Card,
  Col,
  List,
  Progress,
  Row,
  Space,
  Statistic,
  Tag,
  Typography,
  message,
} from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type { components } from '@ipmoney/api-types';

import { apiGet } from '../lib/api';
import { fenToYuan, formatTimeSmart } from '../lib/format';

type PagedUserVerification = components['schemas']['PagedUserVerification'];
type PagedListing = components['schemas']['PagedListing'];
type PagedOrder = components['schemas']['PagedOrder'];
type PagedConversationSummary = components['schemas']['PagedConversationSummary'];
type PagedCase = components['schemas']['PagedCase'];
type FinanceSummary = components['schemas']['FinanceReportSummary'];
type HealthResponse = { ok?: boolean; checks?: Record<string, { ok?: boolean; error?: string }> };
type SessionInfo = { permissions?: string[] };
type MetricValue = number | null;

type DashboardState = {
  pendingVerifications: MetricValue;
  pendingListings: MetricValue;
  ordersTotal: MetricValue;
  unassignedConversations: MetricValue;
  openCases: MetricValue;
  finance?: FinanceSummary | null;
  healthOk?: boolean;
  healthChecks?: Record<string, { ok?: boolean; error?: string }>;
};

const defaultState: DashboardState = {
  pendingVerifications: null,
  pendingListings: null,
  ordersTotal: null,
  unassignedConversations: null,
  openCases: null,
  finance: null,
  healthOk: false,
  healthChecks: {},
};

function can(permissionSet: Set<string>, permission: string): boolean {
  return permissionSet.has('*') || permissionSet.has(permission);
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<DashboardState>(defaultState);
  const [permissionSet, setPermissionSet] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string>('');

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

      const results = await Promise.allSettled([
        canVerificationRead ? apiGet<PagedUserVerification>('/admin/user-verifications', { status: 'PENDING', page: 1, pageSize: 1 }) : Promise.resolve(null),
        canListingRead ? apiGet<PagedListing>('/admin/listings', { auditStatus: 'PENDING', page: 1, pageSize: 1 }) : Promise.resolve(null),
        canOrderRead ? apiGet<PagedOrder>('/orders', { page: 1, pageSize: 1 }) : Promise.resolve(null),
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
        pendingVerifications: canVerificationRead ? 0 : null,
        pendingListings: canListingRead ? 0 : null,
        ordersTotal: canOrderRead ? 0 : null,
        unassignedConversations: canConversationManage ? 0 : null,
        openCases: canCaseManage ? 0 : null,
        finance: canReportRead ? null : null,
        healthOk: false,
        healthChecks: {},
      };

      const [verRes, listingRes, orderRes, convRes, caseRes, financeRes, healthRes] = results;
      if (canVerificationRead) {
        if (verRes.status === 'fulfilled') next.pendingVerifications = Number(verRes.value?.page?.total || 0);
        else errors.push('认证审核');
      }
      if (canListingRead) {
        if (listingRes.status === 'fulfilled') next.pendingListings = Number(listingRes.value?.page?.total || 0);
        else errors.push('上架审核');
      }
      if (canOrderRead) {
        if (orderRes.status === 'fulfilled') next.ordersTotal = Number(orderRes.value?.page?.total || 0);
        else errors.push('订单统计');
      }
      if (canConversationManage) {
        if (convRes.status === 'fulfilled') next.unassignedConversations = Number(convRes.value?.page?.total || 0);
        else errors.push('平台会话');
      }
      if (canCaseManage) {
        if (caseRes.status === 'fulfilled') next.openCases = Number(caseRes.value?.page?.total || 0);
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
        const msg = `部分指标加载失败：${errors.join('、')}`;
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

  const coreStats = useMemo(
    () => [
      {
        key: 'pending-verification',
        title: '待审核认证',
        value: state.pendingVerifications,
        to: '/verifications',
        permission: 'verification.read',
      },
      {
        key: 'pending-listing',
        title: '待审核上架',
        value: state.pendingListings,
        to: '/listings',
        permission: 'listing.read',
      },
      {
        key: 'unassigned-conv',
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
    ],
    [state.openCases, state.pendingListings, state.pendingVerifications, state.unassignedConversations],
  );

  const quickActions = useMemo(
    () =>
      [
        { label: '认证审核', to: '/verifications', tone: 'processing' as const, permission: 'verification.read' },
        { label: '上架审核', to: '/listings', tone: 'gold' as const, permission: 'listing.read' },
        { label: '平台会话', to: '/conversations/platform', tone: 'cyan' as const, permission: 'conversation.platform.manage' },
        { label: '专利批量运营', to: '/patents/operations', tone: 'green' as const, permission: 'patent.import' },
        { label: '\u9996\u9875\u8fd0\u8425\u914d\u7f6e', to: '/config/home-landing', tone: 'purple' as const, permission: 'config.manage' },
        { label: '账号权限', to: '/rbac', tone: 'blue' as const, permission: 'rbac.manage' },
        { label: '审计日志', to: '/audit-logs', tone: 'default' as const, permission: 'auditLog.read' },
      ].filter((item) => can(permissionSet, item.permission)),
    [permissionSet],
  );

  const payoutRate = Number(state.finance?.payoutSuccessRate || 0);
  const refundRate = Number(state.finance?.refundRate || 0);
  const healthItems = Object.entries(state.healthChecks || {});
  const canViewFinance = can(permissionSet, 'report.read');

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <div>
            <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 0 }}>
              运营仪表盘
            </Typography.Title>
            <Typography.Text type="secondary">聚合审核、会话、工单与财务关键指标，支持值班快速分派。</Typography.Text>
          </div>
          <Space>
            {lastUpdatedAt ? <Tag color="blue">更新于 {formatTimeSmart(lastUpdatedAt)}</Tag> : null}
            <Button onClick={() => void load()} loading={loading}>
              刷新
            </Button>
          </Space>
        </Space>
      </Card>

      {error ? <Alert type="warning" showIcon message={error} /> : null}

      <Row gutter={[16, 16]}>
        {coreStats.map((item) => {
          const allowed = can(permissionSet, item.permission);
          const displayValue = item.value == null ? '-' : item.value;
          return (
            <Col key={item.key} xs={24} sm={12} lg={6}>
              <Card
                hoverable={allowed}
                loading={loading}
                onClick={() => {
                  if (allowed) navigate(item.to);
                }}
                style={{ cursor: allowed ? 'pointer' : 'not-allowed' }}
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
            {!canViewFinance ? (
              <Typography.Text type="secondary">当前角色无财务报表查看权限。</Typography.Text>
            ) : state.finance ? (
              <Space direction="vertical" size={14} style={{ width: '100%' }}>
                <Row gutter={[16, 12]}>
                  <Col span={12}>
                    <Statistic title="成交金额" value={`¥${fenToYuan(state.finance.dealAmountFen || 0)}`} />
                  </Col>
                  <Col span={12}>
                    <Statistic title="佣金收入" value={`¥${fenToYuan(state.finance.commissionAmountFen || 0)}`} />
                  </Col>
                  <Col span={12}>
                    <Statistic title="订单总量" value={state.finance.ordersTotal || 0} />
                  </Col>
                </Row>
                <div>
                  <Typography.Text>放款成功率</Typography.Text>
                  <Progress percent={Number((payoutRate * 100).toFixed(2))} status={payoutRate >= 0.95 ? 'success' : 'active'} />
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
            )}
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card loading={loading} title="快捷操作">
            <List
              dataSource={quickActions}
              renderItem={(item) => (
                <List.Item
                  actions={[
                    <Button key={`${item.label}-go`} type="link" onClick={() => navigate(item.to)}>
                      进入
                    </Button>,
                  ]}
                >
                  <Space>
                    <Tag color={item.tone}>{item.label}</Tag>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24}>
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
                        {!status?.ok && status?.error ? <Typography.Text type="secondary">{status.error}</Typography.Text> : null}
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
  );
}
