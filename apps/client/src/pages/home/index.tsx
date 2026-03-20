import { View, Text, Image, Swiper, SwiperItem, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';


// Feature zone background images (poster cards in "特色专区")
import bgZoneSleeping from '../../assets/home/zones/zone-sleeping.jpg';
import bgZoneHighTechRetired from '../../assets/home/zones/zone-high-tech-retired.jpg';
import bgZoneOpenLicense from '../../assets/home/zones/zone-open-license.jpg';
// Reuse existing poster until a dedicated "获奖专利" asset is provided.
import bgZoneAward from '../../assets/home/zones/zone-award.jpg';
import iconSearch from '../../assets/icons/icon-search-gray.svg';
import iconActivity from '../../assets/icons/icon-activity-blue.svg';
import iconAward from '../../assets/icons/icon-award-teal.svg';
import iconShield from '../../assets/icons/icon-shield-orange.svg';
import iconTrending from '../../assets/icons/icon-trending-red.svg';

// Home quick entry icons (provided by you in repo root, copied into assets)
import homeIconInventors from '../../assets/icons/home/home-inventors.svg';
import homeIconPatentMap from '../../assets/icons/home/home-patent-map.svg';
import homeIconAchievement from '../../assets/icons/home/home-achievement.svg';
import homeIconTechManager from '../../assets/icons/home/home-tech-manager.svg';
import homeIconDesignPatent from '../../assets/icons/home/home-design-patent.svg';
import homeIconAnnouncements from '../../assets/icons/home/home-announcements.svg';
import logoGif from '../../assets/brand/logo.optim2.gif';
import logoPng from '../../assets/brand/logo.png';
import promoCertificateGif from '../../assets/home/promo-certificate.optim3.gif';
import promoCertificatePng from '../../assets/home/promo-certificate.png';
import { STORAGE_KEYS } from '../../constants';
import { getToken, onAuthChanged } from '../../lib/auth';
import { apiGet } from '../../lib/api';
import { getDetailCache, setDetailCache } from '../../lib/detailCache';
import { syncFavorites } from '../../lib/favorites';
import { EmptyCard, ErrorCard } from '../../ui/StateCards';
import { toast } from '../../ui/nutui';
import { ListingCard } from '../../ui/ListingCard';
import { ListingListSkeleton } from '../../ui/ListingSkeleton';
import GifImage from '../../ui/GifImage';

type PagedListingSummary = components['schemas']['PagedListingSummary'];
type ListingSummary = components['schemas']['ListingSummary'];

type QuickEntry = {
  key: string;
  label: string;
  icon: string;
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
  bgImage: string;
  tone: string;
  onClick: () => void;
};

const HOME_ANNOUNCEMENTS_DELAY_MS = 500;
const HOME_FAVORITES_SYNC_DELAY_MS = 800;
const HOME_LISTINGS_CACHE_SCOPE = 'home-listings';
const HOME_ANNOUNCEMENTS_CACHE_SCOPE = 'home-announcements';

const HomeBanner = React.memo(function HomeBanner() {
  return (
    <View className="home-banner">
      <View className="home-banner-item">
        <GifImage
          src={promoCertificateGif}
          fallbackSrc={promoCertificatePng}
          deferOnWeapp
          deferMs={1600}
          lazyLoad
          mode="aspectFill"
          className="home-banner-img"
        />
      </View>
    </View>
  );
});

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
  const initialAuthed = Boolean(getToken());
  const initialListings = getDetailCache<PagedListingSummary>(
    HOME_LISTINGS_CACHE_SCOPE,
    initialAuthed ? 'recommend' : 'newest',
  );
  const initialAnnouncements = getDetailCache<PagedAnnouncements>(HOME_ANNOUNCEMENTS_CACHE_SCOPE, 'top6');

  const [loading, setLoading] = useState(!initialListings);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PagedListingSummary | null>(initialListings);
  const [recommendMode, setRecommendMode] = useState<'RECOMMEND' | 'NEWEST'>(
    initialAuthed ? 'RECOMMEND' : 'NEWEST',
  );
  const [isAuthed, setIsAuthed] = useState(initialAuthed);
  const [keyword, setKeyword] = useState('');
  const [announcementLoading, setAnnouncementLoading] = useState(!initialAnnouncements);
  const [announcementError, setAnnouncementError] = useState<string | null>(null);
  const [announcements, setAnnouncements] = useState<PagedAnnouncements | null>(initialAnnouncements);

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

  useEffect(() => onAuthChanged(() => setIsAuthed(Boolean(getToken()))), []);

  const load = useCallback(async () => {
    const cacheKey = isAuthed ? 'recommend' : 'newest';
    const cached = getDetailCache<PagedListingSummary>(HOME_LISTINGS_CACHE_SCOPE, cacheKey);
    if (cached) {
      setData(cached);
      setRecommendMode(isAuthed ? 'RECOMMEND' : 'NEWEST');
      setLoading(false);
      setError(null);
    } else {
      // Keep previous list visible when switching mode to avoid skeleton flash.
      setError(null);
    }
    try {
      if (isAuthed) {
        const d = await apiGet<PagedListingSummary>('/me/recommendations/listings', {
          page: 1,
          pageSize: 5,
        });
        setData(d);
        setRecommendMode('RECOMMEND');
        setDetailCache(HOME_LISTINGS_CACHE_SCOPE, 'recommend', d);
      } else {
        const d = await apiGet<PagedListingSummary>('/search/listings', {
          sortBy: 'NEWEST',
          page: 1,
          pageSize: 5,
        });
        setData(d);
        setRecommendMode('NEWEST');
        setDetailCache(HOME_LISTINGS_CACHE_SCOPE, 'newest', d);
      }
    } catch (e: any) {
      if (!cached) {
        setError(e?.message || '加载失败');
        setData(null);
      }
    } finally {
      setLoading(false);
    }
  }, [isAuthed]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!getToken()) return;
    const timer = setTimeout(() => {
      syncFavorites().catch(() => {});
    }, HOME_FAVORITES_SYNC_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  const loadAnnouncements = useCallback(async () => {
    const cached = getDetailCache<PagedAnnouncements>(HOME_ANNOUNCEMENTS_CACHE_SCOPE, 'top6');
    if (cached) {
      setAnnouncements(cached);
      setAnnouncementLoading(false);
      setAnnouncementError(null);
    } else {
      setAnnouncementLoading(true);
      setAnnouncementError(null);
    }
    try {
      const d = await apiGet<PagedAnnouncements>('/public/announcements', { page: 1, pageSize: 6 });
      setAnnouncements(d);
      setDetailCache(HOME_ANNOUNCEMENTS_CACHE_SCOPE, 'top6', d);
    } catch (e: any) {
      if (!cached) {
        setAnnouncements(null);
        setAnnouncementError(e?.message || '加载失败');
      }
    } finally {
      setAnnouncementLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadAnnouncements();
    }, HOME_ANNOUNCEMENTS_DELAY_MS);
    return () => clearTimeout(timer);
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
    Taro.navigateTo({ url: '/subpackages/search/index' });
  }, []);

  const goMap = useCallback(() => Taro.navigateTo({ url: '/subpackages/patent-map/index' }), []);
  const goInventors = useCallback(() => Taro.navigateTo({ url: '/subpackages/inventors/index' }), []);
  const goTechManagers = useCallback(() => Taro.switchTab({ url: '/pages/tech-managers/index' }), []);
  const goAchievements = useCallback(() => {
    Taro.setStorageSync(STORAGE_KEYS.searchPrefill, { tab: 'ACHIEVEMENT', reset: true });
    Taro.navigateTo({ url: '/subpackages/search/index' });
  }, []);
  const goPatentExplore = useCallback(() => {
    Taro.setStorageSync(STORAGE_KEYS.searchPrefill, { tab: 'LISTING', reset: true });
    Taro.navigateTo({ url: '/subpackages/search/index' });
  }, []);
  const goDesignPatents = useCallback(() => {
    Taro.setStorageSync(STORAGE_KEYS.searchPrefill, {
      tab: 'LISTING',
      patentType: 'DESIGN',
      reset: true,
    });
    Taro.navigateTo({ url: '/subpackages/search/index' });
  }, []);
  const goInventionPatents = useCallback(() => {
    Taro.setStorageSync(STORAGE_KEYS.searchPrefill, {
      tab: 'LISTING',
      patentType: 'INVENTION',
      reset: true,
    });
    Taro.navigateTo({ url: '/subpackages/search/index' });
  }, []);
  const goUtilityPatents = useCallback(() => {
    Taro.setStorageSync(STORAGE_KEYS.searchPrefill, {
      tab: 'LISTING',
      patentType: 'UTILITY_MODEL',
      reset: true,
    });
    Taro.navigateTo({ url: '/subpackages/search/index' });
  }, []);
  const goFiveStarPatents = useCallback(() => {
    toast('五星专利口径待定');
  }, []);
  const goAnnouncements = useCallback(() => Taro.navigateTo({ url: '/subpackages/announcements/index' }), []);
  const goSleepingPatent = useCallback(() => {
    Taro.setStorageSync(STORAGE_KEYS.searchPrefill, {
      tab: 'LISTING',
      transferCountMin: 0,
      transferCountMax: 0,
      reset: true,
    });
    Taro.navigateTo({ url: '/subpackages/search/index' });
  }, []);
  const goHighTechRetired = useCallback(() => {
    Taro.setStorageSync(STORAGE_KEYS.searchPrefill, {
      tab: 'LISTING',
      listingTopic: 'HIGH_TECH_RETIRED',
      reset: true,
    });
    Taro.navigateTo({ url: '/subpackages/search/index' });
  }, []);
  const goAwardWinning = useCallback(() => {
    Taro.setStorageSync(STORAGE_KEYS.searchPrefill, {
      tab: 'LISTING',
      listingTopic: 'AWARD_WINNING',
      reset: true,
    });
    Taro.navigateTo({ url: '/subpackages/search/index' });
  }, []);
  const goOpenLicense = useCallback(() => {
    Taro.setStorageSync(STORAGE_KEYS.searchPrefill, {
      tab: 'LISTING',
      tradeMode: 'LICENSE',
      reset: true,
    });
    Taro.navigateTo({ url: '/subpackages/search/index' });
  }, []);

  const quickEntries: QuickEntry[] = useMemo(
    () => [
      { key: 'design-patent', label: '外观专利', icon: homeIconDesignPatent, onClick: goDesignPatents },
      { key: 'invention-patent', label: '发明专利', icon: homeIconAchievement, onClick: goInventionPatents },
      { key: 'utility-model', label: '实用新型', icon: homeIconPatentMap, onClick: goUtilityPatents },
      { key: 'tech-manager', label: '技术经理', icon: homeIconTechManager, onClick: goTechManagers },
      { key: 'inventor', label: '发明人榜', icon: homeIconInventors, onClick: goInventors },
      { key: 'five-star', label: '五星专利', icon: homeIconAnnouncements, onClick: goFiveStarPatents },
    ],
    [
      goDesignPatents,
      goFiveStarPatents,
      goInventionPatents,
      goInventors,
      goTechManagers,
      goUtilityPatents,
    ],
  );

  const patentZoneEntries: PatentZoneEntry[] = useMemo(
    () => [
      {
        key: 'retired',
        title: '退役专利',
        desc: '平台审核通过的退役专利',
        icon: iconShield,
        bgImage: bgZoneHighTechRetired,
        tone: 'tone-orange',
        onClick: goHighTechRetired,
      },
      {
        key: 'sleeping',
        title: '沉睡专利',
        desc: '转让次数为 0 的专利',
        icon: iconActivity,
        bgImage: bgZoneSleeping,
        tone: 'tone-blue',
        onClick: goSleepingPatent,
      },
      {
        key: 'award-winning',
        title: '获奖专利',
        desc: '平台标记的获奖专利',
        icon: iconTrending,
        bgImage: bgZoneAward,
        tone: 'tone-green',
        onClick: goAwardWinning,
      },
      {
        key: 'open-license',
        title: '开放许可',
        desc: '交易方式为许可',
        icon: iconAward,
        bgImage: bgZoneOpenLicense,
        tone: 'tone-teal',
        onClick: goOpenLicense,
      },
    ],
    [goAwardWinning, goHighTechRetired, goOpenLicense, goSleepingPatent],
  );

  return (
    <View className="home-page">
      <View className="home-hero" style={heroStyle}>
        <View className="home-hero-top">
          <View className="home-hero-brand">
            <View className="home-hero-logo">
              <GifImage
                src={logoGif}
                fallbackSrc={logoPng}
                deferOnWeapp
                deferMs={1200}
                mode="aspectFill"
                className="home-hero-logo-img"
              />
            </View>
            <View className="home-hero-text">
              <Text className="home-hero-title">IPMONEY</Text>
              <Text className="home-hero-subtitle">专利 & 商标交易</Text>
            </View>
          </View>
        </View>

        <View className="home-hero-tags">
          <Text className="home-hero-tag">0元专利托管</Text>
          <Text className="home-hero-tag">0元代办过户</Text>
          <Text className="home-hero-tag">0元风险交易</Text>
        </View>

        <View className="home-search">
          <Image src={iconSearch} svg mode="aspectFit" className="home-search-icon" />
          <Input
            className="home-search-input"
            value={keyword}
            onInput={(e) => setKeyword(e.detail.value)}
            onFocus={() => goSearch()}
            onConfirm={() => goSearch(keyword)}
            placeholder="开始寻找被你发现的IP"
            placeholderClass="home-search-placeholder"
          />
          <View className="home-search-btn" onClick={() => goSearch(keyword)}>
            <Text>搜索</Text>
          </View>
        </View>
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
            <View key={entry.key} className={`home-zone-card ${entry.tone}`} onClick={entry.onClick}>
              <Image src={entry.bgImage} mode="aspectFill" className="home-zone-bg" lazyLoad />
              <View className="home-zone-scrim" />

              <View className="home-zone-content">
                <Text className="home-zone-title">{entry.title}</Text>
                <Text className="home-zone-desc">{entry.desc}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View className="home-section home-marquee-section">
        <View className="home-marquee-card">
          {announcementLoading ? (
            <Text className="home-marquee-placeholder">加载中…</Text>
          ) : announcementError ? (
            <Text className="home-marquee-placeholder">{announcementError}</Text>
          ) : announcementItems.length ? (
            <Swiper className="home-marquee-swiper" autoplay circular vertical interval={4000}>
              {announcementItems.slice(0, 3).map((item) => (
                <SwiperItem key={item.id}>
                  <View className="home-marquee-item" onClick={goAnnouncements}>
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

      <HomeBanner />

      <View className="home-quick">
        {quickEntries.map((entry) => (
          <View key={entry.key} className="home-quick-item" onClick={entry.onClick}>
            <View className="home-quick-icon">
              <Image src={entry.icon} svg mode="aspectFit" className="home-quick-icon-img" />
            </View>
            <Text className="home-quick-label">{entry.label}</Text>
          </View>
        ))}
      </View>

      <View className="home-section">
        <View className="home-section-header">
          <View className="home-section-title-wrap">
            <View className="home-section-accent" />
            <Text className="home-section-title">
              {recommendMode === 'RECOMMEND' ? '高价值低金额' : '最新专利'}
            </Text>
          </View>
        </View>

        {loading ? (
          <ListingListSkeleton count={3} />
        ) : error ? (
          <ErrorCard message={error} onRetry={load} />
        ) : !items.length ? (
          <EmptyCard
            message={recommendMode === 'RECOMMEND' ? '暂无推荐内容' : '暂无最新内容'}
            actionText="刷新"
            onAction={load}
          />
        ) : (
          <View className="search-card-list">
            {items.map((it: ListingSummary) => (
              <ListingCard
                key={it.id}
                item={it}
                favorited={false}
                onClick={() => {
                  Taro.navigateTo({ url: `/subpackages/listing/detail/index?listingId=${it.id}` });
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
