import { View, Text, Image, Swiper, SwiperItem, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import logoGif from '../../assets/brand/logo.gif';
import promoCertificateGif from '../../assets/home/promo-certificate.gif';
import iconSearch from '../../assets/icons/icon-search-gray.svg';
import iconActivity from '../../assets/icons/icon-activity-blue.svg';
import iconTrending from '../../assets/icons/icon-trending-red.svg';
import iconUser from '../../assets/icons/icon-user-purple.svg';
import iconMap from '../../assets/icons/icon-map-green.svg';
import iconPalette from '../../assets/icons/icon-palette-orange.svg';
import iconBriefcase from '../../assets/icons/icon-briefcase-indigo.svg';
import iconAward from '../../assets/icons/icon-award-teal.svg';
import iconShield from '../../assets/icons/icon-shield-orange.svg';
import { STORAGE_KEYS } from '../../constants';
import { getToken } from '../../lib/auth';
import { apiGet } from '../../lib/api';
import { syncFavorites } from '../../lib/favorites';
import { EmptyCard, ErrorCard } from '../../ui/StateCards';
import { toast } from '../../ui/nutui';
import { ListingCard } from '../../ui/ListingCard';

type PagedListingSummary = components['schemas']['PagedListingSummary'];
type ListingSummary = components['schemas']['ListingSummary'];

type QuickEntry = {
  key: string;
  label: string;
  icon: string;
  iconBg: string;
  onClick: () => void;
};

type AnnouncementSummary = {
  id: string;
  title: string;
  publisherName?: string;
  publishedAt?: string;
  issueNo?: string;
  tags?: string[];
  summary?: string;
};

type PagedAnnouncements = {
  items: AnnouncementSummary[];
  page?: { page: number; pageSize: number; total: number };
};

type PatentZoneEntry = {
  key: string;
  title: string;
  desc: string;
  icon: string;
  tone: string;
  onClick: () => void;
};

function formatDate(value?: string): string {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function HomePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PagedListingSummary | null>(null);
  const [keyword, setKeyword] = useState('');
  const [announcementLoading, setAnnouncementLoading] = useState(true);
  const [announcementError, setAnnouncementError] = useState<string | null>(null);
  const [announcements, setAnnouncements] = useState<PagedAnnouncements | null>(null);

  const statusBarHeight = useMemo(() => {
    if (process.env.TARO_ENV !== 'weapp') return 0;
    try {
      return Taro.getSystemInfoSync().statusBarHeight || 0;
    } catch {
      return 0;
    }
  }, []);

  const heroStyle = useMemo(() => {
    if (process.env.TARO_ENV !== 'weapp') return undefined;
    const top = statusBarHeight ? statusBarHeight + 8 : 8;
    return { paddingTop: `${top}px` };
  }, [statusBarHeight]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<PagedListingSummary>('/search/listings', {
        sortBy: 'NEWEST',
        page: 1,
        pageSize: 5,
      });
      setData(d);
    } catch (e: any) {
      setError(e?.message || '加载失败');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!getToken()) return;
    syncFavorites().catch(() => {});
  }, []);

  const loadAnnouncements = useCallback(async () => {
    setAnnouncementLoading(true);
    setAnnouncementError(null);
    try {
      const d = await apiGet<PagedAnnouncements>('/public/announcements', { page: 1, pageSize: 6 });
      setAnnouncements(d);
    } catch (e: any) {
      setAnnouncements(null);
      setAnnouncementError(e?.message || '加载失败');
    } finally {
      setAnnouncementLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAnnouncements();
  }, [loadAnnouncements]);

  const items = useMemo(() => data?.items || [], [data?.items]);
  const announcementItems = useMemo(() => announcements?.items || [], [announcements?.items]);

  const goSearch = useCallback((value?: string) => {
    const q = typeof value === 'string' ? value.trim() : '';
    if (typeof value === 'string' && !q) {
      toast('请输入关键词');
      return;
    }
    if (q) {
      Taro.setStorageSync(STORAGE_KEYS.searchPrefill, { q, tab: 'LISTING' });
    }
    Taro.navigateTo({ url: '/pages/search/index' });
  }, []);

  const goMap = useCallback(() => Taro.navigateTo({ url: '/pages/patent-map/index' }), []);
  const goInventors = useCallback(() => Taro.navigateTo({ url: '/pages/inventors/index' }), []);
  const goArtworks = useCallback(() => {
    Taro.setStorageSync(STORAGE_KEYS.searchPrefill, { tab: 'ARTWORK', reset: true });
    Taro.navigateTo({ url: '/pages/search/index' });
  }, []);
  const goAchievements = useCallback(() => {
    Taro.setStorageSync(STORAGE_KEYS.searchPrefill, { tab: 'ACHIEVEMENT', reset: true });
    Taro.navigateTo({ url: '/pages/search/index' });
  }, []);
  const goPatentExplore = useCallback(() => {
    Taro.setStorageSync(STORAGE_KEYS.searchPrefill, { tab: 'LISTING', reset: true });
    Taro.navigateTo({ url: '/pages/search/index' });
  }, []);
  const goDemandSearch = useCallback(() => {
    Taro.setStorageSync(STORAGE_KEYS.searchPrefill, { tab: 'DEMAND', reset: true });
    Taro.navigateTo({ url: '/pages/search/index' });
  }, []);
  const goTechManagers = useCallback(() => Taro.switchTab({ url: '/pages/tech-managers/index' }), []);
  const goAnnouncements = useCallback(() => Taro.navigateTo({ url: '/pages/announcements/index' }), []);
  const goAnnouncementDetail = useCallback((id: string) => {
    Taro.navigateTo({ url: `/pages/announcements/detail/index?announcementId=${id}` });
  }, []);
  const goClusterPicker = useCallback(() => Taro.navigateTo({ url: '/pages/cluster-picker/index' }), []);
  const goSleepingPatent = useCallback(() => {
    Taro.setStorageSync(STORAGE_KEYS.searchPrefill, {
      tab: 'LISTING',
      transferCountMin: 0,
      transferCountMax: 0,
      reset: true,
    });
    Taro.navigateTo({ url: '/pages/search/index' });
  }, []);
  const goHighTechRetired = useCallback(() => {
    Taro.setStorageSync(STORAGE_KEYS.searchPrefill, {
      tab: 'LISTING',
      listingTopic: 'HIGH_TECH_RETIRED',
      reset: true,
    });
    Taro.navigateTo({ url: '/pages/search/index' });
  }, []);
  const goOpenLicense = useCallback(() => {
    Taro.setStorageSync(STORAGE_KEYS.searchPrefill, {
      tab: 'LISTING',
      tradeMode: 'LICENSE',
      reset: true,
    });
    Taro.navigateTo({ url: '/pages/search/index' });
  }, []);

  const quickEntries: QuickEntry[] = useMemo(
    () => [
      { key: 'inventor', label: '发明人榜', icon: iconTrending, iconBg: 'bg-red', onClick: goInventors },
      { key: 'manager', label: '技术经理人', icon: iconUser, iconBg: 'bg-purple', onClick: goTechManagers },
      { key: 'map', label: '专利地图', icon: iconMap, iconBg: 'bg-green', onClick: goMap },
      { key: 'art', label: '书画专区', icon: iconPalette, iconBg: 'bg-orange', onClick: goArtworks },
      { key: 'demand', label: '产学研需求', icon: iconBriefcase, iconBg: 'bg-indigo', onClick: goDemandSearch },
      { key: 'achievement', label: '成果转化', icon: iconAward, iconBg: 'bg-teal', onClick: goAchievements },
    ],
    [goAchievements, goArtworks, goDemandSearch, goInventors, goMap, goTechManagers],
  );

  const patentZoneEntries: PatentZoneEntry[] = useMemo(
    () => [
      {
        key: 'sleeping',
        title: '沉睡专利',
        desc: '转让次数为 0 的专利',
        icon: iconActivity,
        tone: 'tone-blue',
        onClick: goSleepingPatent,
      },
      {
        key: 'high-tech-retired',
        title: '高新退役',
        desc: '审核通过的优质专利',
        icon: iconShield,
        tone: 'tone-orange',
        onClick: goHighTechRetired,
      },
      {
        key: 'cluster',
        title: '产业集群',
        desc: '按集群标签聚合展示',
        icon: iconMap,
        tone: 'tone-green',
        onClick: goClusterPicker,
      },
      {
        key: 'open-license',
        title: '开放许可',
        desc: '交易方式为许可',
        icon: iconAward,
        tone: 'tone-teal',
        onClick: goOpenLicense,
      },
    ],
    [goClusterPicker, goHighTechRetired, goOpenLicense, goSleepingPatent],
  );

  return (
    <View className="home-page">
      <View className="home-hero" style={heroStyle}>
        <View className="home-hero-top">
          <View className="home-hero-brand">
            <View className="home-hero-logo">
              <Image src={logoGif} mode="aspectFit" className="home-hero-logo-img" />
            </View>
            <View className="home-hero-text">
              <Text className="home-hero-title">IPMONEY</Text>
              <Text className="home-hero-subtitle">专利 & 书画交易</Text>
            </View>
          </View>
        </View>

        <View className="home-search">
          <Image src={iconSearch} svg mode="aspectFit" className="home-search-icon" />
          <Input
            className="home-search-input"
            value={keyword}
            onInput={(e) => setKeyword(e.detail.value)}
            onFocus={() => goSearch()}
            onConfirm={() => goSearch(keyword)}
            placeholder="搜索专利、书画、专家…"
            placeholderClass="home-search-placeholder"
          />
          <View className="home-search-btn" onClick={() => goSearch(keyword)}>
            <Text>搜索</Text>
          </View>
        </View>
      </View>

      <View className="home-quick">
        {quickEntries.map((entry) => (
          <View key={entry.key} className="home-quick-item" onClick={entry.onClick}>
            <View className={`home-quick-icon ${entry.iconBg}`}>
              <Image src={entry.icon} svg mode="aspectFit" className="home-quick-icon-img" />
            </View>
            <Text className="home-quick-label">{entry.label}</Text>
          </View>
        ))}
      </View>

      <View className="home-section home-marquee-section">
        <View className="home-section-header">
          <View className="home-section-title-wrap">
            <View className="home-section-accent" />
            <Text className="home-section-title">公告</Text>
          </View>
          <Text className="home-section-more" onClick={goAnnouncements}>
            全部
          </Text>
        </View>
        <View className="home-marquee-card">
          {announcementLoading ? (
            <Text className="home-marquee-placeholder">加载中…</Text>
          ) : announcementError ? (
            <Text className="home-marquee-placeholder">{announcementError}</Text>
          ) : announcementItems.length ? (
            <Swiper className="home-marquee-swiper" autoplay circular vertical interval={4000}>
              {announcementItems.slice(0, 6).map((item) => (
                <SwiperItem key={item.id}>
                  <View className="home-marquee-item" onClick={() => goAnnouncementDetail(item.id)}>
                    <View className="home-marquee-tag">
                      <Text>公告</Text>
                    </View>
                    <Text className="home-marquee-title clamp-1">{item.title}</Text>
                    <Text className="home-marquee-date">{formatDate(item.publishedAt)}</Text>
                  </View>
                </SwiperItem>
              ))}
            </Swiper>
          ) : (
            <Text className="home-marquee-placeholder">暂无公告</Text>
          )}
        </View>
      </View>

      <View className="home-banner">
        <Swiper className="home-banner-swiper" indicatorDots autoplay={false} circular>
          <SwiperItem>
            <View className="home-banner-item">
              <Image src={promoCertificateGif} mode="aspectFill" className="home-banner-img" />
            </View>
          </SwiperItem>
        </Swiper>
      </View>

      <View className="home-section">
        <View className="home-section-header">
          <View className="home-section-title-wrap">
            <View className="home-section-accent" />
            <Text className="home-section-title">特色专区</Text>
          </View>
          <Text className="home-section-more" onClick={goPatentExplore}>
            更多
          </Text>
        </View>
        <View className="home-zone-grid">
          {patentZoneEntries.map((entry) => (
            <View key={entry.key} className="home-zone-card" onClick={entry.onClick}>
              <View className={`home-zone-icon ${entry.tone}`}>
                <Image src={entry.icon} svg mode="aspectFit" className="home-zone-icon-img" />
              </View>
              <Text className="home-zone-title">{entry.title}</Text>
              <Text className="home-zone-desc">{entry.desc}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className="home-section">
        <View className="home-section-header">
          <Text className="home-section-title">最新专利</Text>
        </View>

        {loading ? (
          <View className="home-loading">加载中…</View>
        ) : error ? (
          <ErrorCard message={error} onRetry={load} />
        ) : !items.length ? (
          <EmptyCard message="暂无推荐内容" actionText="刷新" onAction={load} />
        ) : (
          <View className="search-card-list">
            {items.map((it: ListingSummary) => (
              <ListingCard
                key={it.id}
                item={it}
                favorited={false}
                onClick={() => {
                  Taro.navigateTo({ url: `/pages/listing/detail/index?listingId=${it.id}` });
                }}
                onFavorite={() => {}}
                onConsult={() => {}}
              />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}
