import { View, Text } from '@tarojs/components';
import React from 'react';

import { Button } from './nutui';

export function LoadingCard(props: { text?: string }) {
  const text = props.text || '加载中…';
  return (
    <View className="card card-state">
      <View className="row">
        <View className="brand-mark brand-mark-sm" />
        <View style={{ width: '12rpx' }} />
        <View style={{ flex: 1 }}>
          <Text className="text-card-title">{text}</Text>
          <View style={{ height: '6rpx' }} />
          <Text className="text-caption">正在挖掘数据金豆矿脉…</Text>
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
      <Text className="text-title">{props.title || '加载失败'}</Text>
      <View style={{ height: '8rpx' }} />
      <Text className="text-subtitle">{props.message || '请稍后重试'}</Text>
      {props.onRetry ? (
        <>
          <View style={{ height: '12rpx' }} />
          <Button variant="ghost" onClick={props.onRetry}>
            重试
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
}) {
  return (
    <View className="card card-state">
      <Text className="text-title">{props.title || '暂无数据'}</Text>
      {props.message ? (
        <>
          <View style={{ height: '8rpx' }} />
          <Text className="text-subtitle">{props.message}</Text>
        </>
      ) : null}
      {props.actionText && props.onAction ? (
        <>
          <View style={{ height: '12rpx' }} />
          <Button onClick={props.onAction}>{props.actionText}</Button>
        </>
      ) : null}
    </View>
  );
}

export function PermissionCard(props: { title?: string; message?: string; actionText?: string; onAction?: () => void }) {
  return (
    <View className="card card-state">
      <Text className="text-title">{props.title || '需要登录'}</Text>
      <View style={{ height: '8rpx' }} />
      <Text className="text-subtitle">{props.message || '该操作需要登录后才能继续。'}</Text>
      {props.actionText && props.onAction ? (
        <>
          <View style={{ height: '12rpx' }} />
          <Button onClick={props.onAction}>{props.actionText}</Button>
        </>
      ) : null}
    </View>
  );
}

export function AuditPendingCard(props: { title?: string; message?: string; actionText?: string; onAction?: () => void }) {
  return (
    <View className="card card-state">
      <Text className="text-title">{props.title || '资料审核中'}</Text>
      <View style={{ height: '8rpx' }} />
      <Text className="text-subtitle">{props.message || '审核通过后将解锁发布能力。'}</Text>
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
