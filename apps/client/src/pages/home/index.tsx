import { View, Text, Image, Input, Swiper, SwiperItem } from '@tarojs/components';
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
import iconFiveStarBadge from '../../assets/icons/icon-five-star-badge.svg';
import iconShield from '../../assets/icons/icon-shield-orange.svg';
import iconTrending from '../../assets/icons/icon-trending-red.svg';
import iconMapGreen from '../../assets/icons/icon-map-green.svg';
import iconNotification from '../../assets/icons/icon-notification.svg';

// Home quick entry icons (provided by you in repo root, copied into assets)
import homeIconInventors from '../../assets/icons/home/home-inventors.svg';
import homeIconTechManager from '../../assets/icons/home/home-tech-manager.svg';
import homeIconDesignPatent from '../../assets/icons/home/home-design-patent.svg';
import homeIconInventionPatent from '../../assets/icons/home/home-invention-patent.svg';
import homeIconUtilityPatent from '../../assets/icons/home/home-utility-patent.svg';
import homeIconAchievement from '../../assets/icons/home/home-achievement.svg';
import logoGif from '../../assets/brand/logo.optim2.gif';
import logoPng from '../../assets/brand/logo.png';
import { STORAGE_KEYS } from '../../constants';
import { getToken, onAuthChanged } from '../../lib/auth';
import { apiGet } from '../../lib/api';
import { getDetailCache, setDetailCache } from '../../lib/detailCache';
import { syncFavorites } from '../../lib/favorites';
import { fetchHomeAnnouncements, type PublicHomeAnnouncementItem } from '../../lib/homeAnnouncements';
import { buildHomeBannerItems, type BannerConfig, type HomeBannerItem } from '../../lib/homeBannerConfig';
import type { ListingTopic } from '../../lib/listingTopics';
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

type PatentZoneEntry = {
  key: string;
  title: string;
  desc: string;
  icon: string;
  bgImage: string;
  tone: string;
  onClick: () => void;
};

const HOME_FAVORITES_SYNC_DELAY_MS = 800;
const HOME_LISTINGS_CACHE_SCOPE = 'home-listings';
const HomeBanner = React.memo(function HomeBanner({ items }: { items: HomeBannerItem[] }) {
  if (!items.length) return null;
  const shouldAutoplay = items.length > 1;

  return (
    <View className="home-banner">
      <Swiper
        className="home-banner-swiper"
        circular={shouldAutoplay}
        indicatorDots={shouldAutoplay}
        autoplay={shouldAutoplay}
        interval={3000}
        duration={520}
      >
        {items.map((item, index) => (
          <SwiperItem key={item.id}>
            <View
              className="home-banner-item"
              onClick={() =>
                Taro.navigateTo({
                  url: `/subpackages/media/video-preview/index?i=${index}`,
                })
              }
            >
              <Image src={item.cover} mode="aspectFill" className="home-banner-img" lazyLoad />
              <View className="home-banner-overlay">
                <Text className="home-banner-caption">点击观看</Text>
              </View>
            </View>
          </SwiperItem>
        ))}
      </Swiper>
    </View>
  );
});
export default function HomePage() {
  const initialAuthed = Boolean(getToken());
  const initialListings = getDetailCache<PagedListingSummary>(
    HOME_LISTINGS_CACHE_SCOPE,
    initialAuthed ? 'recommend' : 'newest',
  );

  const [loading, setLoading] = useState(!initialListings);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PagedListingSummary | null>(initialListings);
  const [recommendMode, setRecommendMode] = useState<'RECOMMEND' | 'NEWEST'>(
    initialAuthed ? 'RECOMMEND' : 'NEWEST',
  );
  const [isAuthed, setIsAuthed] = useState(initialAuthed);
  const [keyword, setKeyword] = useState('');
  const [announcements, setAnnouncements] = useState<PublicHomeAnnouncementItem[]>([]);
  const [activeAnnouncementIndex, setActiveAnnouncementIndex] = useState(0);
  const [bannerItems, setBannerItems] = useState<HomeBannerItem[]>(() => buildHomeBannerItems());

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

  const loadAnnouncements = useCallback(async () => {
    try {
      const next = await fetchHomeAnnouncements();
      setAnnouncements(next);
    } catch {
      // Announcement loading should never block the homepage core experience.
      setAnnouncements([]);
    }
  }, []);

  const loadBanner = useCallback(async () => {
    try {
      const banner = await apiGet<BannerConfig>('/public/config/banner');
      setBannerItems(buildHomeBannerItems(banner));
    } catch {
      // keep fallback banner when config request fails
    }
  }, []);

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
    void loadAnnouncements();
  }, [loadAnnouncements]);

  useEffect(() => {
    void loadBanner();
  }, [loadBanner]);

  useEffect(() => {
    if (announcements.length <= 1) return undefined;
    const timer = setInterval(() => {
      setActiveAnnouncementIndex((prev) => (prev + 1) % announcements.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [announcements.length]);

  useEffect(() => {
    if (!getToken()) return;
    const timer = setTimeout(() => {
      syncFavorites().catch(() => {});
    }, HOME_FAVORITES_SYNC_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  const items = useMemo(() => data?.items || [], [data?.items]);

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

  const goInventors = useCallback(() => Taro.navigateTo({ url: '/subpackages/inventors/index' }), []);
  const goPatentMap = useCallback(() => Taro.navigateTo({ url: '/subpackages/patent-map/index' }), []);
  const goTechManagers = useCallback(() => Taro.switchTab({ url: '/pages/tech-managers/index' }), []);
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
  const goTopicSearch = useCallback((listingTopic: ListingTopic) => {
    Taro.setStorageSync(STORAGE_KEYS.searchPrefill, {
      tab: 'LISTING',
      listingTopic,
      reset: true,
    });
    Taro.navigateTo({ url: '/subpackages/search/index' });
  }, []);
  const goAchievementSearch = useCallback(() => {
    Taro.setStorageSync(STORAGE_KEYS.searchPrefill, { tab: 'ACHIEVEMENT', reset: true });
    Taro.navigateTo({ url: '/subpackages/search/index' });
  }, []);

  const goAnnouncements = useCallback(() => {
    Taro.navigateTo({ url: '/subpackages/home-announcements/index' });
  }, []);

  const quickEntries: QuickEntry[] = useMemo(
    () => [
      { key: 'design-patent', label: '外观专利', icon: homeIconDesignPatent, onClick: goDesignPatents },
      { key: 'invention-patent', label: '发明专利', icon: homeIconInventionPatent, onClick: goInventionPatents },
      { key: 'utility-patent', label: '实用新型', icon: homeIconUtilityPatent, onClick: goUtilityPatents },
      { key: 'five-star', label: '五星专利', icon: iconFiveStarBadge, onClick: () => goTopicSearch('FIVE_STAR') },
      { key: 'inventor', label: '发明人榜', icon: homeIconInventors, onClick: goInventors },
      { key: 'patent-map', label: '专利地图', icon: iconMapGreen, onClick: goPatentMap },
      { key: 'tech-manager', label: '技术经理', icon: homeIconTechManager, onClick: goTechManagers },
      { key: 'achievement', label: '成果展示', icon: homeIconAchievement, onClick: goAchievementSearch },
    ],
    [
      goDesignPatents,
      goInventors,
      goPatentMap,
      goInventionPatents,
      goUtilityPatents,
      goTopicSearch,
      goTechManagers,
      goAchievementSearch,
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
        onClick: () => goTopicSearch('HIGH_TECH_RETIRED'),
      },
      {
        key: 'sleeping',
        title: '沉睡专利',
        desc: '转让次数为 0 的专利',
        icon: iconActivity,
        bgImage: bgZoneSleeping,
        tone: 'tone-blue',
        onClick: () => goTopicSearch('SLEEPING'),
      },
      {
        key: 'award-winning',
        title: '获奖专利',
        desc: '平台标记的获奖专利',
        icon: iconTrending,
        bgImage: bgZoneAward,
        tone: 'tone-green',
        onClick: () => goTopicSearch('AWARD_WINNING'),
      },
      {
        key: 'open-license',
        title: '开放许可',
        desc: '交易方式为许可',
        icon: iconAward,
        bgImage: bgZoneOpenLicense,
        tone: 'tone-teal',
        onClick: () => goTopicSearch('OPEN_LICENSE'),
      },
    ],
    [goTopicSearch],
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
          <Text className="home-hero-tag">0风险交易</Text>
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

      {announcements.length ? (
        <View className="home-announcement-bar" onClick={goAnnouncements}>
          <View className="home-announcement-bar-icon">
            <Image src={iconNotification} svg mode="aspectFit" className="home-announcement-bar-icon-img" />
          </View>
          <View className="home-announcement-bar-text">
            <Text className="home-announcement-bar-title">
              {announcements[activeAnnouncementIndex]?.title || announcements[0]?.title || ''}
            </Text>
          </View>
        </View>
      ) : null}

      <HomeBanner items={bannerItems} />

      <View className="home-quick">
        {quickEntries.map((entry) => (
          <View
            key={entry.key}
            className={`home-quick-item home-quick-item-${entry.key}`}
            onClick={entry.onClick}
          >
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
