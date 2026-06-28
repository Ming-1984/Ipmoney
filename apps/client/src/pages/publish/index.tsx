import { View, Text, Image } from '@tarojs/components';
import { useDidShow } from '@tarojs/taro';
import React, { useCallback, useMemo, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import iconShield from '../../assets/icons/icon-shield-orange.svg';
import iconDraftPen from '../../assets/icons/icon-draft-pen-gray.svg';

import { apiGet } from '../../lib/api';
import { usePageAccess } from '../../lib/guard';
import { safeOpenPage } from '../../lib/navigation';
import { AccessGate } from '../../ui/PageState';
import { Surface } from '../../ui/layout';
import publishLockedArt from '../../assets/illustrations/publish-locked.png';

type PagedListing = components['schemas']['PagedListing'];
type PagedAchievement = components['schemas']['PagedAchievementSummary'];

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

const WEAPP_DEBUG = process.env.NODE_ENV !== 'production' && process.env.TARO_ENV === 'weapp';

function svgDataUri(svg: string) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const PUBLISH_PATENT_ICON = svgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
  <path d="M7 3.5h7.6L18 6.9v13.6H6V4.5a1 1 0 0 1 1-1Z" stroke="#FF5F00" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="M14.6 3.5v3.4H18" stroke="#FF5F00" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M9 14.5h5.8" stroke="#FF5F00" stroke-width="1.8" stroke-linecap="round"/>
</svg>
`);

const PUBLISH_ACHIEVEMENT_ICON = svgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
  <path d="M12 16.8v-1.4c0-.8.4-1.4 1.1-1.8a5.2 5.2 0 1 0-6.3-5.1" stroke="#FF5F00" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M9.2 19h5.6" stroke="#FF5F00" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M10.3 21.2h3.4" stroke="#FF5F00" stroke-width="1.8" stroke-linecap="round"/>
</svg>
`);

function reportWeappDebug(title: string, detail?: unknown) {
  if (!WEAPP_DEBUG) return;
  console.error(`[weapp-debug] ${title}`, detail);
}

async function openPublishPage(url: string, title: string) {
  try {
    await safeOpenPage(url);
  } catch (error) {
    reportWeappDebug(`${title}跳转失败`, error);
  }
}

export default function PublishPage() {
  const access = usePageAccess('approved-required');
  const [listingDraftCount, setListingDraftCount] = useState(0);
  const [achievementDraftCount, setAchievementDraftCount] = useState(0);

  const refreshDraftCount = useCallback(async () => {
    if (access.state !== 'ok') {
      setListingDraftCount(0);
      setAchievementDraftCount(0);
      return;
    }
    try {
      const [listings, achievements] = await Promise.all([
        apiGet<PagedListing>('/listings', { status: 'DRAFT', page: 1, pageSize: 1 }),
        apiGet<PagedAchievement>('/achievements', { status: 'DRAFT', page: 1, pageSize: 1 }),
      ]);
      setListingDraftCount(Number(listings?.page?.total || 0));
      setAchievementDraftCount(Number(achievements?.page?.total || 0));
    } catch (error) {
      reportWeappDebug('草稿数量加载失败', error);
      setListingDraftCount(0);
      setAchievementDraftCount(0);
    }
  }, [access.state]);

  useDidShow(() => {
    void refreshDraftCount();
  });

  const publishItems = useMemo<PublishCard[]>(
    () => [
      {
        key: 'patent',
        title: '发布专利交易',
        desc: '发明 / 实用 / 外观',
        icon: PUBLISH_PATENT_ICON,
        tone: 'tone-orange',
        onClick: () => {
          void openPublishPage('/subpackages/publish/patent/index', '发布专利');
        },
      },
      {
        key: 'achievement',
        title: '发布专利成果',
        desc: '成果展示 / 案例',
        icon: PUBLISH_ACHIEVEMENT_ICON,
        tone: 'tone-orange',
        onClick: () => {
          void openPublishPage('/subpackages/publish/achievement/index', '发布成果');
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
        icon: PUBLISH_PATENT_ICON,
        tone: 'tone-orange',
        onClick: () => {
          void openPublishPage('/subpackages/my-listings/index', '我的专利');
        },
      },
      {
        key: 'achievements',
        title: '我的专利成果',
        icon: PUBLISH_ACHIEVEMENT_ICON,
        tone: 'tone-orange',
        onClick: () => {
          void openPublishPage('/subpackages/my-achievements/index', '我的成果');
        },
      },
    ],
    [],
  );

  const draftCount = listingDraftCount + achievementDraftCount;
  const draftLabel = draftCount ? `未完成 ${draftCount} 条` : '暂无未完成';
  const openDraftBox = useCallback(() => {
    const target =
      listingDraftCount || !achievementDraftCount
        ? '/subpackages/my-listings/index?status=DRAFT'
        : '/subpackages/my-achievements/index?status=DRAFT';
    void openPublishPage(target, '草稿箱');
  }, [achievementDraftCount, listingDraftCount]);

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
        <View className="publish-content">
          <Text className="publish-subtitle">选择您要发布的类型</Text>

          <View className="publish-auth-banner">
            <View className="publish-auth-left">
              <Image className="publish-auth-icon" src={iconShield} svg mode="aspectFit" />
              <Text className="publish-auth-text">主体认证已通过</Text>
            </View>
            <Text className="publish-auth-badge">正常</Text>
          </View>

          <View className="publish-grid">
            {publishItems.map((item) => (
              <View key={item.key} className={`publish-card ${item.tone}`} onClick={item.onClick}>
                <View className="publish-card-icon">
                  <Image className="publish-card-icon-img" src={item.icon} svg mode="aspectFit" />
                </View>
                <View className="publish-card-text">
                  <Text className="publish-card-title">{item.title}</Text>
                  <Text className="publish-card-desc">{item.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          <Surface className="publish-draft-card" padding="md" onClick={openDraftBox} hoverClass="publish-draft-card-hover">
            <View className="publish-draft-left">
              <View className="publish-draft-icon">
                <Image className="publish-draft-icon-img" src={iconDraftPen} svg mode="aspectFit" />
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
            发布即代表您同意
            <Text className="publish-footnote-link">《平台知识产权保护公约》</Text>
            。严禁发布虚假、侵权或违法违规内容。
          </Text>
        </View>
      )}
    </View>
  );
}
