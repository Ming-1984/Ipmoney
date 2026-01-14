import React from 'react';

import type { PageAccessState } from '../lib/guard';
import { goLogin, goOnboarding } from '../lib/guard';
import { AuditPendingCard, EmptyCard, ErrorCard, LoadingCard, PermissionCard } from './StateCards';

export function AccessGate(props: {
  access: PageAccessState;
  loginMessage?: string;
  onboardingMessage?: string;
  pendingMessage?: string;
  rejectedMessage?: string;
  auditRequiredMessage?: string;
}) {
  const access = props.access;
  if (access.state === 'ok') return null;

  if (access.state === 'need-login') {
    return <PermissionCard title="需要登录" message={props.loginMessage || '登录后才能继续。'} actionText="去登录" onAction={goLogin} />;
  }
  if (access.state === 'need-onboarding') {
    return (
      <PermissionCard
        title="需要选择身份"
        message={props.onboardingMessage || '完成身份选择后才能继续。'}
        actionText="去选择"
        onAction={goOnboarding}
      />
    );
  }
  if (access.state === 'audit-pending') {
    return (
      <AuditPendingCard
        title="资料审核中"
        message={props.pendingMessage || '审核通过后才能继续。'}
        actionText="查看进度"
        onAction={goOnboarding}
      />
    );
  }
  if (access.state === 'audit-rejected') {
    return (
      <AuditPendingCard
        title="资料已驳回"
        message={props.rejectedMessage || '请重新提交资料，审核通过后才能继续。'}
        actionText="重新提交"
        onAction={goOnboarding}
      />
    );
  }
  return (
    <AuditPendingCard
      title="需要认证"
      message={props.auditRequiredMessage || '完成认证并审核通过后才能继续。'}
      actionText="去认证"
      onAction={goOnboarding}
    />
  );
}

export function PageState(props: {
  access: PageAccessState;
  loading: boolean;
  error?: string | null;
  empty?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
  emptyActionText?: string;
  onRetry?: () => void;
  onEmptyAction?: () => void;
  loadingText?: string;
  children: React.ReactNode;
}) {
  if (props.access.state !== 'ok') return <AccessGate access={props.access} />;

  if (props.loading) return <LoadingCard text={props.loadingText} />;
  if (props.error) return <ErrorCard message={props.error} onRetry={props.onRetry} />;
  if (props.empty) {
    return <EmptyCard title={props.emptyTitle} message={props.emptyMessage} actionText={props.emptyActionText} onAction={props.onEmptyAction} />;
  }
  return <>{props.children}</>;
}
