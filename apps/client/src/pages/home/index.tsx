import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React from 'react';

import { API_BASE_URL } from '../../constants';

export default function HomePage() {
  return (
    <View className="container">
      <View className="card">
        <Text style={{ fontSize: '40rpx', fontWeight: 700 }}>专利变金豆矿</Text>
        <View style={{ height: '12rpx' }} />
        <Text className="muted">P0 演示骨架（Mock 驱动） · API: {API_BASE_URL}</Text>
      </View>

      <View style={{ height: '16rpx' }} />

      <View
        className="card btn-ghost"
        onClick={() => {
          Taro.navigateTo({ url: '/pages/feeds/index' });
        }}
      >
        <Text>去信息流（猜你喜欢）</Text>
      </View>

      <View style={{ height: '16rpx' }} />

      <View className="card">
        <Text style={{ fontWeight: 600 }}>入口（示例）</Text>
        <View style={{ height: '12rpx' }} />
        <View
          className="btn-primary"
          onClick={() => {
            Taro.navigateTo({ url: '/pages/onboarding/choose-identity/index' });
          }}
        >
          <Text>首次进入：选择身份注册</Text>
        </View>

        <View style={{ height: '12rpx' }} />

        <View
          className="btn-ghost"
          onClick={() => {
            Taro.navigateTo({ url: '/pages/patent-map/index' });
          }}
        >
          <Text>区域产业专利地图</Text>
        </View>

        <View style={{ height: '12rpx' }} />

        <View
          className="btn-ghost"
          onClick={() => {
            Taro.switchTab({ url: '/pages/search/index' });
          }}
        >
          <Text>去检索（游客可用）</Text>
        </View>

        <View style={{ height: '12rpx' }} />

        <View
          className="btn-ghost"
          onClick={() => {
            Taro.navigateTo({ url: '/pages/inventors/index' });
          }}
        >
          <Text>发明人榜（公开）</Text>
        </View>
      </View>
    </View>
  );
}
