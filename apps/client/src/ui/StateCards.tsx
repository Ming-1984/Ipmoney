import { View, Text, Image } from '@tarojs/components';
import React from 'react';

import { Button } from './nutui';
import { STATE_COPY } from './copy';
import { StateIllustration } from './layout/StateIllustration';
import fortuneGod from '../assets/illustrations/fortune-god.svg';

export function LoadingCard(props: { text?: string }) {
  const text = props.text || STATE_COPY.loading.title;
  return (
    <View className="card card-state">
      <View className="row" style={{ gap: '16rpx', alignItems: 'flex-start' }}>
        <StateIllustration kind="loading" size="md" />
        <View className="min-w-0" style={{ flex: 1 }}>
          <Text className="text-card-title">{text}</Text>
          <View style={{ height: '6rpx' }} />
          <Text className="text-caption">{STATE_COPY.loading.subtitle}</Text>
        </View>
      </View>
      <View style={{ height: '14rpx' }} />
      <View className="loading-bar" />
    </View>
  );
}

export function ErrorCard(props: { title?: string; message?: string; onRetry?: () => void }) {
  return (
    <View className="card card-state">
      <View className="row" style={{ gap: '16rpx', alignItems: 'flex-start' }}>
        <StateIllustration kind="error" size="md" />
        <View className="min-w-0" style={{ flex: 1 }}>
          <Text className="text-title">{props.title || STATE_COPY.error.title}</Text>
          <View style={{ height: '8rpx' }} />
          <Text className="text-subtitle">{props.message || STATE_COPY.error.message}</Text>
        </View>
      </View>
      {props.onRetry ? (
        <>
          <View style={{ height: '12rpx' }} />
          <Button variant="ghost" onClick={props.onRetry}>
            {STATE_COPY.error.retryText}
          </Button>
        </>
      ) : null}
    </View>
  );
}

export function EmptyCard(props: {
  title?: string;
  message?: string;
  actionText?: string;
  onAction?: () => void;
  image?: string;
}) {
  const actionText = props.actionText && props.actionText !== STATE_COPY.empty.actionText ? props.actionText : undefined;
  return (
    <View className={`card card-state ${props.image ? 'card-state-empty' : ''}`}>
      {props.image ? (
        <View className="state-empty-hero">
          <Image className="state-empty-ill" src={props.image} svg mode="aspectFit" />
          <Text className="text-title">{props.title || STATE_COPY.empty.title}</Text>
          <View style={{ height: '8rpx' }} />
          <Text className="text-subtitle">{props.message || STATE_COPY.empty.message}</Text>
        </View>
      ) : (
        <View className="row" style={{ gap: '16rpx', alignItems: 'flex-start' }}>
          <StateIllustration kind="empty" size="md" />
          <View className="min-w-0" style={{ flex: 1 }}>
            <Text className="text-title">{props.title || STATE_COPY.empty.title}</Text>
            <View style={{ height: '8rpx' }} />
            <Text className="text-subtitle">{props.message || STATE_COPY.empty.message}</Text>
          </View>
        </View>
      )}
      {actionText && props.onAction ? (
        <>
          <View style={{ height: '12rpx' }} />
          <Button onClick={props.onAction}>{actionText}</Button>
        </>
      ) : null}
    </View>
  );
}

export function PermissionCard(props: { title?: string; message?: string; actionText?: string; onAction?: () => void }) {
  return (
    <View className="card card-state">
      <View className="row" style={{ gap: '16rpx', alignItems: 'flex-start' }}>
        <StateIllustration kind="permission" size="md" />
        <View className="min-w-0" style={{ flex: 1 }}>
          <Text className="text-title">{props.title || STATE_COPY.permission.needLogin.title}</Text>
          <View style={{ height: '8rpx' }} />
          <Text className="text-subtitle">{props.message || STATE_COPY.permission.needLogin.message}</Text>
        </View>
      </View>
      {props.actionText && props.onAction ? (
        <>
          <View style={{ height: '12rpx' }} />
          <Button onClick={props.onAction}>{props.actionText}</Button>
        </>
      ) : null}
    </View>
  );
}

export function LoginUnlockCard(props: { onAction?: () => void; message?: string }) {
  return (
    <View className="login-unlock-state">
      <View className="login-unlock-center">
        <Image className="login-unlock-ill" src={fortuneGod} svg mode="aspectFit" />
        <Text className="login-unlock-text">{props.message || '登录解锁专利点金台'}</Text>
      </View>
      {props.onAction ? (
        <View className="login-unlock-actions">
          <Button className="login-unlock-btn" onClick={props.onAction}>
            立即登录
          </Button>
        </View>
      ) : null}
    </View>
  );
}

export function AuditPendingCard(props: { title?: string; message?: string; actionText?: string; onAction?: () => void }) {
  return (
    <View className="card card-state">
      <View className="row" style={{ gap: '16rpx', alignItems: 'flex-start' }}>
        <StateIllustration kind="audit" size="md" />
        <View className="min-w-0" style={{ flex: 1 }}>
          <Text className="text-title">{props.title || STATE_COPY.permission.auditPending.title}</Text>
          <View style={{ height: '8rpx' }} />
          <Text className="text-subtitle">{props.message || STATE_COPY.permission.auditPending.message}</Text>
        </View>
      </View>
      {props.actionText && props.onAction ? (
        <>
          <View style={{ height: '12rpx' }} />
          <Button variant="ghost" onClick={props.onAction}>
            {props.actionText}
          </Button>
        </>
      ) : null}
    </View>
  );
}

export function MissingParamCard(props: { title?: string; message?: string; actionText?: string; onAction?: () => void }) {
  return (
    <View className="card card-state">
      <View className="row" style={{ gap: '16rpx', alignItems: 'flex-start' }}>
        <StateIllustration kind="missing" size="md" />
        <View className="min-w-0" style={{ flex: 1 }}>
          <Text className="text-title">{props.title || STATE_COPY.missing.title}</Text>
          <View style={{ height: '8rpx' }} />
          <Text className="text-subtitle">{props.message || STATE_COPY.missing.message}</Text>
        </View>
      </View>
      {props.onAction ? (
        <>
          <View style={{ height: '12rpx' }} />
          <Button variant="ghost" onClick={props.onAction}>
            {props.actionText || STATE_COPY.missing.actionText}
          </Button>
        </>
      ) : null}
    </View>
  );
}
