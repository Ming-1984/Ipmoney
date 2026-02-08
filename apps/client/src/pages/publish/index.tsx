import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useMemo } from 'react';
import './index.scss';

import iconPublishPatent from '../../assets/icons/icon-publish-patent.svg';
import iconPublishArtwork from '../../assets/icons/icon-publish-artwork.svg';
import iconPublishDemand from '../../assets/icons/icon-publish-demand.svg';
import iconPublishAchievement from '../../assets/icons/icon-publish-achievement.svg';
import iconShield from '../../assets/icons/icon-shield-orange.svg';
import iconCategory from '../../assets/icons/icon-category-gray.svg';

import { usePageAccess } from '../../lib/guard';
import { AccessGate } from '../../ui/PageState';
import { Surface } from '../../ui/layout';
import publishLockedArt from '../../assets/illustrations/publish-locked.png';

type PublishCard = {
  key: string;
  title: string;
  desc: string;
  icon: string;
  tone: string;
  onClick: () => void;
};

type ManageCard = {
  key: string;
  title: string;
  icon: string;
  tone: string;
  onClick: () => void;
};

export default function PublishPage() {
  const access = usePageAccess('approved-required');

  const publishItems = useMemo<PublishCard[]>(
    () => [
      {
        key: 'patent',
        title: '发布专利交易',
        desc: '发明/实用/外观',
        icon: iconPublishPatent,
        tone: 'tone-orange',
        onClick: () => {
          Taro.navigateTo({ url: '/pages/publish/patent/index' });
        },
      },
      {
        key: 'artwork',
        title: '发布书画专区',
        desc: '艺术作品交易',
        icon: iconPublishArtwork,
        tone: 'tone-purple',
        onClick: () => {
          Taro.navigateTo({ url: '/pages/publish/artwork/index' });
        },
      },
      {
        key: 'demand',
        title: '发布产学研需求',
        desc: '技术/人才/资金',
        icon: iconPublishDemand,
        tone: 'tone-blue',
        onClick: () => {
          Taro.navigateTo({ url: '/pages/publish/demand/index' });
        },
      },
      {
        key: 'achievement',
        title: '发布成果展示',
        desc: '案例/转化成果',
        icon: iconPublishAchievement,
        tone: 'tone-green',
        onClick: () => {
          Taro.navigateTo({ url: '/pages/publish/achievement/index' });
        },
      },
    ],
    [],
  );

  const manageItems = useMemo<ManageCard[]>(
    () => [
      {
        key: 'listings',
        title: '我的专利',
        icon: iconPublishPatent,
        tone: 'tone-blue',
        onClick: () => {
          Taro.navigateTo({ url: '/pages/my-listings/index' });
        },
      },
      {
        key: 'artworks',
        title: '我的书画',
        icon: iconPublishArtwork,
        tone: 'tone-purple',
        onClick: () => {
          Taro.navigateTo({ url: '/pages/my-artworks/index' });
        },
      },
      {
        key: 'demands',
        title: '技术需求',
        icon: iconPublishDemand,
        tone: 'tone-orange',
        onClick: () => {
          Taro.navigateTo({ url: '/pages/my-demands/index' });
        },
      },
      {
        key: 'achievements',
        title: '成果案例',
        icon: iconPublishAchievement,
        tone: 'tone-green',
        onClick: () => {
          Taro.navigateTo({ url: '/pages/my-achievements/index' });
        },
      },
    ],
    [],
  );

  const draftCount = 0;
  const draftLabel = draftCount ? `未完成 ${draftCount} 条` : '暂无未完成';

  return (
    <View className={`container publish-page ${access.state !== 'ok' ? 'publish-page-locked' : ''}`}>
      {access.state !== 'ok' ? (
        <View className="page-locked">
          {access.state === 'need-login' ? (
            <View className="publish-locked">
              <Image className="publish-locked-ill" src={publishLockedArt} mode="aspectFit" />
              <Text className="publish-locked-text">登录IPMONEY，发布专利赚金豆！</Text>
            </View>
          ) : (
            <AccessGate access={access} />
          )}
        </View>
      ) : (
        <View>
          <View className="publish-header">
            <Text className="publish-title">发布中心</Text>
            <Text className="publish-subtitle">选择您要发布的类型</Text>
          </View>

          <View className="publish-auth-banner">
            <View className="publish-auth-left">
              <Image className="publish-auth-icon" src={iconShield} svg mode="aspectFit" />
              <Text className="publish-auth-text">主体认证已通过</Text>
            </View>
            <Text className="publish-auth-badge">正常</Text>
          </View>

          <View className="publish-grid">
            {publishItems.map((item) => (
              <View key={item.key} className={`publish-card publish-card--wide ${item.tone}`} onClick={item.onClick}>
                <View className="publish-card-left">
                  <Text className="publish-card-title">{item.title}</Text>
                  <Text className="publish-card-desc">{item.desc}</Text>
                </View>
                <Image className="publish-card-deco" src={item.icon} svg mode="aspectFit" />
              </View>
            ))}
          </View>

          <Surface className="publish-draft-card" padding="md">
            <View className="publish-draft-left">
              <View className="publish-draft-icon">
                <Image className="publish-draft-icon-img" src={iconCategory} svg mode="aspectFit" />
              </View>
              <View>
                <Text className="publish-draft-title">草稿箱</Text>
                <Text className="publish-draft-desc">{draftLabel}</Text>
              </View>
            </View>
            <View className="publish-draft-right">
              <Text className={`publish-draft-badge ${draftCount ? 'is-active' : ''}`}>{draftCount}</Text>
              <Text className="publish-draft-arrow">›</Text>
            </View>
          </Surface>

          <Surface className="publish-manage-card" padding="md">
            <View className="publish-section-header">
              <Text className="publish-section-title">发布管理</Text>
            </View>
            <View className="publish-manage-grid">
              {manageItems.map((item) => (
                <View key={item.key} className="publish-manage-item" onClick={item.onClick}>
                  <View className={`publish-manage-icon ${item.tone}`}>
                    <Image className="publish-manage-icon-img" src={item.icon} svg mode="aspectFit" />
                  </View>
                  <Text className="publish-manage-title">{item.title}</Text>
                </View>
              ))}
            </View>
          </Surface>

          <Text className="publish-footnote">
            发布即代表您同意《平台知识产权保护公约》。严禁发布虚假、侵权或违法违规内容。
          </Text>
        </View>
      )}
    </View>
  );
}
