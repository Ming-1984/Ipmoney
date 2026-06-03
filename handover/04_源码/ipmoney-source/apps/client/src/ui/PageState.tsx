import React from 'react';

import type { PageAccessState } from '../lib/guard';
import { goLogin, goOnboarding } from '../lib/guard';
import { STATE_COPY } from './copy';
import { AuditPendingCard, EmptyCard, ErrorCard, LoadingCard, LoginUnlockCard, PermissionCard } from './StateCards';

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
    // Unify "need-login" UX across the app (ignore per-page overrides).
    return <LoginUnlockCard onAction={goLogin} />;
  }
  if (access.state === 'need-onboarding') {
    return (
      <PermissionCard
        title={STATE_COPY.permission.needOnboarding.title}
        message={props.onboardingMessage || STATE_COPY.permission.needOnboarding.message}
        actionText={STATE_COPY.permission.needOnboarding.actionText}
        onAction={goOnboarding}
      />
    );
  }
  if (access.state === 'audit-pending') {
    return (
      <AuditPendingCard
        title={STATE_COPY.permission.auditPending.title}
        message={props.pendingMessage || STATE_COPY.permission.auditPending.message}
        actionText={STATE_COPY.permission.auditPending.actionText}
        onAction={goOnboarding}
      />
    );
  }
  if (access.state === 'audit-rejected') {
    return (
      <AuditPendingCard
        title={STATE_COPY.permission.auditRejected.title}
        message={props.rejectedMessage || STATE_COPY.permission.auditRejected.message}
        actionText={STATE_COPY.permission.auditRejected.actionText}
        onAction={goOnboarding}
      />
    );
  }
  return (
    <AuditPendingCard
      title={STATE_COPY.permission.auditRequired.title}
      message={props.auditRequiredMessage || STATE_COPY.permission.auditRequired.message}
      actionText={STATE_COPY.permission.auditRequired.actionText}
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
  emptyImage?: string;
  onRetry?: () => void;
  onEmptyAction?: () => void;
  loadingText?: string;
  children: React.ReactNode;
}) {
  if (props.access.state !== 'ok') return <AccessGate access={props.access} />;

  if (props.loading) return <LoadingCard text={props.loadingText} />;
  if (props.error) return <ErrorCard message={props.error} onRetry={props.onRetry} />;
  if (props.empty) {
    return (
      <EmptyCard
        title={props.emptyTitle}
        message={props.emptyMessage}
        actionText={props.emptyActionText}
        onAction={props.onEmptyAction}
        image={props.emptyImage}
      />
    );
  }
  return <>{props.children}</>;
}
