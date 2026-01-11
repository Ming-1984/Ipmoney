import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React from 'react';

import { requireLogin } from '../../lib/guard';

export default function SearchPage() {
  return (
    <View className="container">
      <View className="card">
        <Text style={{ fontSize: '34rpx', fontWeight: 700 }}>专利交易检索</Text>
        <View style={{ height: '8rpx' }} />
        <Text className="muted">游客可搜索/看列表/看详情；收藏/咨询/下单需登录。</Text>
      </View>

      <View style={{ height: '16rpx' }} />

      <View
        className="card btn-primary"
        onClick={() => {
          Taro.navigateTo({ url: '/pages/login/index' });
        }}
      >
        <Text>去登录（演示）</Text>
      </View>

      <View style={{ height: '16rpx' }} />

      <View
        className="card btn-ghost"
        onClick={() => {
          if (!requireLogin()) return;
          Taro.showToast({ title: '收藏/咨询入口（待接 IM/工单）', icon: 'none' });
        }}
      >
        <Text>收藏/咨询（需登录）</Text>
      </View>
    </View>
  );
}

