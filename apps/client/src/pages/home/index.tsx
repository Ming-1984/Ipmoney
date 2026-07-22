import { View, Text, Image, Input } from '@tarojs/components';
import Taro, { useDidHide, useDidShow, usePullDownRefresh, useReachBottom } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';


import iconSearch from '../../assets/icons/icon-search-gray.svg';
import iconMapGreen from '../../assets/icons/icon-map-green.svg';
import iconNotification from '../../assets/icons/icon-notification.svg';

// Home quick entry icons (provided by you in repo root, copied into assets)
import homeIconInventors from '../../assets/icons/home/home-inventors.svg';
import homeIconTechManager from '../../assets/icons/home/home-tech-manager.svg';
import homeIconDesignPatent from '../../assets/icons/home/home-design-patent.svg';
import homeIconInventionPatent from '../../assets/icons/home/home-invention-patent.svg';
import homeIconOrganization from '../../assets/icons/home/home-organization.svg';
import homeIconUtilityPatent from '../../assets/icons/home/home-utility-patent.svg';
import homeIconAchievement from '../../assets/icons/home/home-achievement.svg';
import logoPng from '../../assets/brand/logo.png';
import bannerFallbackCover from '../../assets/home/promo-certificate.png';
import { STORAGE_KEYS } from '../../constants';
import { getToken, onAuthChanged } from '../../lib/auth';
import { apiGet, apiPost } from '../../lib/api';
import { getDetailCache, setDetailCache } from '../../lib/detailCache';
import { displayTitleOrFallback, normalizeDisplayText } from '../../lib/displayText';
import { ensureApproved } from '../../lib/guard';
import { favorite, getFavoriteListingIds, syncFavorites, unfavorite } from '../../lib/favorites';
import {
  fetchHomeLandingConfig,
  normalizeHomeLandingConfig,
  type HomeLandingConfig,
} from '../../lib/homeLandingConfig';
import {
  executeHomeLandingAction,
  HOME_ZONE_TONES,
  resolveHomeLandingZoneImage,
} from '../../lib/homeLandingFeatured';
import { fetchHomeAnnouncements, type PublicHomeAnnouncementItem } from '../../lib/homeAnnouncements';
import { fetchHomeStats, type PublicHomeStats } from '../../lib/homeStats';
import { EmptyCard, ErrorCard } from '../../ui/StateCards';
import { PullToRefresh, toast } from '../../ui/nutui';
import { ListingCard } from '../../ui/ListingCard';
import { ListingListSkeleton } from '../../ui/ListingSkeleton';
import { ListFooter } from '../../ui/ListFooter';

type PagedListingSummary = components['schemas']['PagedListingSummary'];
type ListingSummary = components['schemas']['ListingSummary'];
type ListingPageInfo = NonNullable<PagedListingSummary['page']>;
type QuickEntry = {
  key: string;
  label: string;
  icon: string;
  onClick: () => void;
};

type HomePlatformStat = {
  key: string;
  value: string;
  label: string;
};

type HomePlatformStatDef = {
  key: string;
  label: string;
  readValue: (stats: PublicHomeStats | null) => number | undefined;
};

type PatentZoneEntry = {
  id: string;
  title: string;
  subtitle: string;
  bgImage: string;
  tone: string;
  onClick: () => void;
};
type Conversation = { id: string };

const HOME_FAVORITES_SYNC_DELAY_MS = 800;
const HOME_LISTINGS_CACHE_SCOPE = 'home-listings';
const HOME_RECOMMEND_PAGE_SIZE = 10;
type HomeRecommendMode = 'RECOMMEND' | 'NEWEST';
const HOME_SPOTLIGHT_CTA_TEXT = '点击查看';
const HOME_SPOTLIGHT_INLINE_ACTION_PATTERN = /(点击查看|立即查看|去查看|查看详情|点击了解|立即了解|去了解)/;
const HOME_PLATFORM_STAT_DEFS: HomePlatformStatDef[] = [
  { key: 'patents', label: '总专利数量', readValue: (stats) => stats?.patentsTotal },
  { key: 'tech-managers', label: '技术经理人', readValue: (stats) => stats?.techManagersTotal },
  { key: 'users', label: '已注册用户', readValue: (stats) => stats?.registeredUsersTotal },
  { key: 'deals', label: '已完成服务', readValue: (stats) => stats?.completedDealsTotal },
];

function hasInlineSpotlightActionCopy(...values: Array<string | undefined>): boolean {
  return values.some((value) => {
    const text = normalizeDisplayText(value);
    return Boolean(text) && HOME_SPOTLIGHT_INLINE_ACTION_PATTERN.test(text);
  });
}

function formatHomeStatValue(value: number | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '--';
}

const HomeHeroSpotlight = React.memo(function HomeHeroSpotlight({ config }: { config: HomeLandingConfig['heroSpotlight'] }) {
  const [imageSrc, setImageSrc] = useState('');

  useEffect(() => {
    setImageSrc(String(config.imageUrl || '').trim());
  }, [config.imageUrl]);

  if (!config.enabled || !imageSrc) return null;

  const title = normalizeDisplayText(config.title);
  const subtitle = normalizeDisplayText(config.subtitle);
  const canOpen = Boolean(config.actionPayload?.tab);
  const showCta = canOpen && !hasInlineSpotlightActionCopy(title, subtitle);

  return (
    <View
      className={`home-spotlight${canOpen ? ' is-clickable' : ''}`}
      onClick={() => {
        if (!canOpen) return;
        executeHomeLandingAction('SEARCH_PREFILL', config.actionPayload);
      }}
    >
      <Image
        src={imageSrc}
        mode="aspectFill"
        className="home-spotlight-img"
        lazyLoad
        onError={() => {
          if (imageSrc === bannerFallbackCover) return;
          setImageSrc(bannerFallbackCover);
        }}
      />
      {title || subtitle || canOpen ? (
        <View className="home-spotlight-overlay">
          <View className="home-spotlight-copy">
            {title ? <Text className="home-spotlight-title">{title}</Text> : null}
            {subtitle ? <Text className="home-spotlight-subtitle">{subtitle}</Text> : null}
          </View>
          {showCta ? <Text className="home-spotlight-cta">{HOME_SPOTLIGHT_CTA_TEXT}</Text> : null}
        </View>
      ) : null}
    </View>
  );
});
export default function HomePage() {
  const initialAuthed = Boolean(getToken());
  const initialRecommendListings = getDetailCache<PagedListingSummary>(HOME_LISTINGS_CACHE_SCOPE, 'recommend');
  const initialNewestListings = getDetailCache<PagedListingSummary>(HOME_LISTINGS_CACHE_SCOPE, 'newest');
  const initialListings = initialAuthed
    ? initialRecommendListings || initialNewestListings
    : initialNewestListings;
  const initialRecommendMode: HomeRecommendMode =
    initialAuthed && initialRecommendListings ? 'RECOMMEND' : 'NEWEST';

  const [loading, setLoading] = useState(!initialListings);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ListingSummary[]>(() => initialListings?.items || []);
  const [pageInfo, setPageInfo] = useState<ListingPageInfo | null>(() => (initialListings?.page as ListingPageInfo) || null);
  const [lastCount, setLastCount] = useState<number>(() => initialListings?.items?.length || 0);
  const [recommendMode, setRecommendMode] = useState<HomeRecommendMode>(initialRecommendMode);
  const [recommendFallback, setRecommendFallback] = useState<boolean>(initialAuthed && !initialRecommendListings);
  const [isAuthed, setIsAuthed] = useState(initialAuthed);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set(getFavoriteListingIds()));
  const [keyword, setKeyword] = useState('');
  const [announcements, setAnnouncements] = useState<PublicHomeAnnouncementItem[]>([]);
  const [activeAnnouncementIndex, setActiveAnnouncementIndex] = useState(0);
  const [homeLandingConfig, setHomeLandingConfig] = useState<HomeLandingConfig>(() => normalizeHomeLandingConfig(null));
  const [homeStats, setHomeStats] = useState<PublicHomeStats | null>(null);
  const itemCountRef = useRef(items.length);
  const authStateRef = useRef(isAuthed);
  const recommendModeRef = useRef(recommendMode);
  const loadRequestSeqRef = useRef(0);
  const favoriteSyncSeqRef = useRef(0);
  const pageVisibleRef = useRef(true);
  const consultSeqRef = useRef(0);

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

  useEffect(() => {
    itemCountRef.current = items.length;
  }, [items.length]);

  useEffect(() => {
    authStateRef.current = isAuthed;
  }, [isAuthed]);

  useEffect(() => {
    recommendModeRef.current = recommendMode;
  }, [recommendMode]);

  useDidShow(() => {
    pageVisibleRef.current = true;
  });

  useDidHide(() => {
    pageVisibleRef.current = false;
    consultSeqRef.current += 1;
  });

  const loadAnnouncements = useCallback(async () => {
    try {
      const next = await fetchHomeAnnouncements();
      setAnnouncements(next);
    } catch {
      // Announcement loading should never block the homepage core experience.
      setAnnouncements([]);
    }
  }, []);

  const loadHomeLanding = useCallback(async () => {
    try {
      const config = await fetchHomeLandingConfig();
      setHomeLandingConfig(config);
    } catch {
      setHomeLandingConfig((prev) => normalizeHomeLandingConfig(prev));
    }
  }, []);

  const loadHomeStats = useCallback(async () => {
    try {
      const next = await fetchHomeStats();
      setHomeStats(next);
    } catch {
      setHomeStats(null);
    }
  }, []);

  const applyRecommendPage = useCallback((result: PagedListingSummary, append: boolean) => {
    const nextItems = Array.isArray(result?.items) ? result.items : [];
    setLastCount(nextItems.length);
    setPageInfo((result?.page as ListingPageInfo) || null);
    setItems((prev) => (append ? [...prev, ...nextItems] : nextItems));
  }, []);

  const fetchRecommendPage = useCallback(
    async (page: number) =>
      apiGet<PagedListingSummary>('/me/recommendations/listings', {
        page,
        pageSize: HOME_RECOMMEND_PAGE_SIZE,
      }),
    [],
  );

  const fetchNewestPage = useCallback(
    async (page: number) =>
      apiGet<PagedListingSummary>('/search/listings', {
        sortBy: 'NEWEST',
        page,
        pageSize: HOME_RECOMMEND_PAGE_SIZE,
      }),
    [],
  );

  const load = useCallback(
    async (ctx: 'load' | 'refresh' = 'load') => {
      const requestSeq = ++loadRequestSeqRef.current;
      const targetAuthed = isAuthed;
      const cachedRecommend = getDetailCache<PagedListingSummary>(HOME_LISTINGS_CACHE_SCOPE, 'recommend');
      const cachedNewest = getDetailCache<PagedListingSummary>(HOME_LISTINGS_CACHE_SCOPE, 'newest');
      const cached = targetAuthed ? cachedRecommend || cachedNewest : cachedNewest;

      setLoadingMore(false);

      if (ctx === 'load') {
        if (cached) {
          applyRecommendPage(cached, false);
          if (targetAuthed && cachedRecommend) {
            setRecommendMode('RECOMMEND');
            setRecommendFallback(false);
          } else {
            setRecommendMode('NEWEST');
            setRecommendFallback(targetAuthed);
          }
          setLoading(false);
          setError(null);
        } else {
          setLoading(itemCountRef.current === 0);
          setError(null);
        }
      }

      if (ctx === 'refresh') {
        setRefreshing(true);
        setError(null);
      }

      try {
        if (targetAuthed) {
          let recommendResult: PagedListingSummary | null = null;
          let recommendFailed = false;

          try {
            recommendResult = await fetchRecommendPage(1);
            if (loadRequestSeqRef.current !== requestSeq || authStateRef.current !== targetAuthed) return;
            setDetailCache(HOME_LISTINGS_CACHE_SCOPE, 'recommend', recommendResult);
          } catch {
            recommendFailed = true;
          }

          if (recommendResult?.items?.length) {
            if (loadRequestSeqRef.current !== requestSeq || authStateRef.current !== targetAuthed) return;
            applyRecommendPage(recommendResult, false);
            setRecommendMode('RECOMMEND');
            setRecommendFallback(false);
          } else {
            const newest = await fetchNewestPage(1);
            if (loadRequestSeqRef.current !== requestSeq || authStateRef.current !== targetAuthed) return;
            applyRecommendPage(newest, false);
            setRecommendMode('NEWEST');
            setRecommendFallback(recommendFailed || Boolean(recommendResult));
            setDetailCache(HOME_LISTINGS_CACHE_SCOPE, 'newest', newest);
          }
        } else {
          const newest = await fetchNewestPage(1);
          if (loadRequestSeqRef.current !== requestSeq || authStateRef.current !== targetAuthed) return;
          applyRecommendPage(newest, false);
          setRecommendMode('NEWEST');
          setRecommendFallback(false);
          setDetailCache(HOME_LISTINGS_CACHE_SCOPE, 'newest', newest);
        }
      } catch (e: any) {
        if (loadRequestSeqRef.current !== requestSeq || authStateRef.current !== targetAuthed) return;
        if (!cached && itemCountRef.current === 0) {
          setError(e?.message || '加载失败');
          setItems([]);
          setPageInfo(null);
          setLastCount(0);
        } else if (ctx === 'refresh') {
          toast(e?.message || '刷新失败');
        }
      } finally {
        if (loadRequestSeqRef.current !== requestSeq || authStateRef.current !== targetAuthed) return;
        if (ctx === 'load') setLoading(false);
        if (ctx === 'refresh') setRefreshing(false);
      }
    },
    [applyRecommendPage, fetchNewestPage, fetchRecommendPage, isAuthed],
  );

  useEffect(() => {
    void load('load');
  }, [load]);

  useEffect(() => {
    void loadAnnouncements();
  }, [loadAnnouncements]);

  useEffect(() => {
    void loadHomeLanding();
  }, [loadHomeLanding]);

  useEffect(() => {
    void loadHomeStats();
  }, [loadHomeStats]);

  useEffect(() => {
    if (announcements.length <= 1) return undefined;
    const timer = setInterval(() => {
      setActiveAnnouncementIndex((prev) => (prev + 1) % announcements.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [announcements.length]);

  useEffect(() => {
    const syncSeq = ++favoriteSyncSeqRef.current;
    if (!isAuthed) {
      setFavoriteIds(new Set(getFavoriteListingIds()));
      return;
    }
    const timer = setTimeout(() => {
      void syncFavorites()
        .then((ids) => {
          if (favoriteSyncSeqRef.current !== syncSeq || !authStateRef.current) return;
          setFavoriteIds(new Set(ids));
        })
        .catch(() => {
          if (favoriteSyncSeqRef.current !== syncSeq) return;
          setFavoriteIds(new Set(getFavoriteListingIds()));
        });
    }, HOME_FAVORITES_SYNC_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isAuthed]);


  const hasMore = useMemo(() => {
    if (pageInfo) return pageInfo.page * pageInfo.pageSize < pageInfo.total;
    return lastCount >= HOME_RECOMMEND_PAGE_SIZE;
  }, [lastCount, pageInfo]);

  const loadRecommendMore = useCallback(async () => {
    if (loading || refreshing || loadingMore || !hasMore) return;
    const requestSeq = loadRequestSeqRef.current;
    const targetAuthed = isAuthed;
    const targetMode = recommendMode;
    const currentPage = Math.max(1, Number(pageInfo?.page || 1));
    const nextPage = currentPage + 1;
    setLoadingMore(true);
    try {
      const next =
        targetAuthed && targetMode === 'RECOMMEND'
          ? await fetchRecommendPage(nextPage)
          : await fetchNewestPage(nextPage);
      if (
        loadRequestSeqRef.current !== requestSeq ||
        authStateRef.current !== targetAuthed ||
        recommendModeRef.current !== targetMode
      ) {
        return;
      }
      applyRecommendPage(next, true);
    } catch (e: any) {
      if (
        loadRequestSeqRef.current !== requestSeq ||
        authStateRef.current !== targetAuthed ||
        recommendModeRef.current !== targetMode
      ) {
        return;
      }
      toast(e?.message || '加载更多失败');
    } finally {
      if (
        loadRequestSeqRef.current !== requestSeq ||
        authStateRef.current !== targetAuthed ||
        recommendModeRef.current !== targetMode
      ) {
        return;
      }
      setLoadingMore(false);
    }
  }, [
    applyRecommendPage,
    fetchNewestPage,
    fetchRecommendPage,
    hasMore,
    isAuthed,
    loading,
    loadingMore,
    pageInfo?.page,
    recommendMode,
    refreshing,
  ]);

  useReachBottom(() => {
    void loadRecommendMore();
  });

  usePullDownRefresh(() => {
    void load('refresh').finally(() => {
      try {
        Taro.stopPullDownRefresh();
      } catch {
        // ignore non-weapp stop refresh errors
      }
    });
  });

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
  const openConsultTab = useCallback((tab: 'TECH' | 'ORG') => {
    Taro.setStorageSync(STORAGE_KEYS.consultLandingTab, tab);
    Taro.switchTab({ url: '/pages/tech-managers/index' });
  }, []);
  const goTechManagers = useCallback(() => openConsultTab('TECH'), [openConsultTab]);
  const goOrganizations = useCallback(() => openConsultTab('ORG'), [openConsultTab]);
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
  const goAchievementSearch = useCallback(() => {
    Taro.setStorageSync(STORAGE_KEYS.searchPrefill, { tab: 'ACHIEVEMENT', reset: true });
    Taro.navigateTo({ url: '/subpackages/search/index' });
  }, []);

  const goAnnouncements = useCallback(() => {
    Taro.navigateTo({ url: '/subpackages/home-announcements/index' });
  }, []);

  const startListingConsult = useCallback(async (listingId: string) => {
    if (!ensureApproved()) return;
    const seq = ++consultSeqRef.current;
    try {
      await apiPost<void>(`/listings/${listingId}/consultations`, { channel: 'FORM' }, { idempotencyKey: `c-${listingId}` });
    } catch {
      // ignore heat event failure
    }
    try {
      const conv = await apiPost<Conversation>(
        `/listings/${listingId}/conversations`,
        {},
        { idempotencyKey: `conv-${listingId}` },
      );
      if (seq !== consultSeqRef.current || !pageVisibleRef.current) return;
      Taro.navigateTo({ url: `/subpackages/messages/chat/index?conversationId=${conv.id}` });
    } catch (e: any) {
      if (seq !== consultSeqRef.current || !pageVisibleRef.current) return;
      toast(e?.message || '进入咨询失败');
    }
  }, []);

  const toggleFavorite = useCallback(
    async (listingId: string) => {
      if (!ensureApproved()) return;
      const isFavorited = favoriteIds.has(listingId);
      try {
        if (isFavorited) {
          await unfavorite(listingId);
          setFavoriteIds((prev) => {
            const next = new Set(prev);
            next.delete(listingId);
            return next;
          });
          toast('已取消收藏', { icon: 'success' });
          return;
        }
        await favorite(listingId);
        setFavoriteIds((prev) => new Set(prev).add(listingId));
        toast('已收藏', { icon: 'success' });
      } catch (e: any) {
        toast(e?.message || '操作失败');
      }
    },
    [favoriteIds],
  );

  const goRecommendMore = useCallback(() => {
    Taro.setStorageSync(STORAGE_KEYS.searchPrefill, { tab: 'LISTING', reset: true });
    Taro.navigateTo({ url: '/subpackages/search/index' });
  }, []);

  const quickEntries: QuickEntry[] = useMemo(
    () => [
      { key: 'design-patent', label: '外观专利', icon: homeIconDesignPatent, onClick: goDesignPatents },
      { key: 'invention-patent', label: '发明专利', icon: homeIconInventionPatent, onClick: goInventionPatents },
      { key: 'utility-patent', label: '实用新型', icon: homeIconUtilityPatent, onClick: goUtilityPatents },
      { key: 'organization', label: '机构名录', icon: homeIconOrganization, onClick: goOrganizations },
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
      goOrganizations,
      goTechManagers,
      goAchievementSearch,
    ],
  );

  const patentZoneEntries: PatentZoneEntry[] = useMemo(
    () =>
      (homeLandingConfig.featuredZones.enabled ? homeLandingConfig.featuredZones.items : [])
        .filter((item) => item.enabled)
        .slice(0, homeLandingConfig.featuredZones.displayCount)
        .map((item, idx) => ({
          id: item.id,
          title: normalizeDisplayText(item.title) || '专区标题待确认',
          subtitle: normalizeDisplayText(item.subtitle) || '查看专区内容',
          bgImage: resolveHomeLandingZoneImage(item.imageUrl),
          tone: HOME_ZONE_TONES[idx % HOME_ZONE_TONES.length],
          onClick: () => executeHomeLandingAction(item.actionType, item.actionPayload),
        })),
    [homeLandingConfig],
  );

  const platformStats: HomePlatformStat[] = useMemo(
    () =>
      HOME_PLATFORM_STAT_DEFS.map((stat) => ({
        key: stat.key,
        label: stat.label,
        value: formatHomeStatValue(stat.readValue(homeStats)),
      })),
    [homeStats],
  );

  return (
    <View className="home-page">
      <View className="home-hero" style={heroStyle}>
        <View className="home-hero-top">
          <View className="home-hero-brand">
            <View className="home-hero-logo">
              <Image src={logoPng} mode="aspectFill" className="home-hero-logo-img" />
            </View>
            <View className="home-hero-text">
              <Text className="home-hero-title">IPMONEY</Text>
              <Text className="home-hero-subtitle">知识产权服务</Text>
            </View>
          </View>
        </View>

        <View className="home-hero-tags">
          {homeLandingConfig.hero.tags.map((tag) => (
            <Text key={tag} className="home-hero-tag">
              {tag}
            </Text>
          ))}
        </View>

        <View className="home-search">
          <Image src={iconSearch} svg mode="aspectFit" className="home-search-icon" />
          <Input
            className="home-search-input"
            value={keyword}
            onInput={(e) => setKeyword(e.detail.value)}
            onFocus={() => goSearch()}
            onConfirm={() => goSearch(keyword)}
            placeholder={homeLandingConfig.hero.searchPlaceholder}
            placeholderClass="home-search-placeholder"
          />
          <View className="home-search-btn" onClick={() => goSearch(keyword)}>
            <Text>搜索</Text>
          </View>
        </View>
      </View>

      <View className="home-platform-stats">
        {platformStats.map((stat) => (
          <View key={stat.key} className="home-platform-stat">
            <Text className="home-platform-stat-value">{stat.value}</Text>
            <Text className="home-platform-stat-label">{stat.label}</Text>
          </View>
        ))}
      </View>

      <View className="home-section">
        <View className="home-section-header">
          <View className="home-section-title-wrap">
            <View className="home-section-accent" />
            <Text className="home-section-title">{homeLandingConfig.sectionTexts.featuredTitle}</Text>
          </View>
        </View>
        <View className="home-zone-grid">
          {patentZoneEntries.map((entry) => (
            <View key={entry.id} className={`home-zone-card ${entry.tone}`} onClick={entry.onClick}>
              <Image src={entry.bgImage} mode="aspectFill" className="home-zone-bg" lazyLoad />
              <View className="home-zone-scrim" />

              <View className="home-zone-content">
                <Text className="home-zone-title">{entry.title}</Text>
                <Text className="home-zone-desc">{entry.subtitle}</Text>
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
              {displayTitleOrFallback(
                announcements[activeAnnouncementIndex]?.title || announcements[0]?.title,
                '平台公告',
              )}
            </Text>
          </View>
        </View>
      ) : null}

      <HomeHeroSpotlight config={homeLandingConfig.heroSpotlight} />

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
            <Text className="home-section-title">精选专利推荐</Text>
          </View>
          <Text className="home-section-more" onClick={goRecommendMore}>
            更多
          </Text>
        </View>

        {recommendFallback ? (
          <View className="home-recommend-tip">
            <Text className="home-recommend-tip-text">个性化推荐暂不可用，当前为最新展示内容。</Text>
          </View>
        ) : null}

        <PullToRefresh
          type="primary"
          disabled={loading || refreshing || loadingMore}
          onRefresh={() => load('refresh')}
        >
          {loading ? (
            <ListingListSkeleton count={3} />
          ) : error ? (
            <ErrorCard message={error} onRetry={() => load('load')} />
          ) : !items.length ? (
            <EmptyCard
              message={recommendMode === 'RECOMMEND' ? '当前暂无匹配推荐专利' : '当前暂无最新展示专利'}
              actionText="重新加载"
              onAction={() => load('load')}
            />
          ) : (
            <View className="search-card-list">
              {items.map((it: ListingSummary) => (
                <ListingCard
                  key={it.id}
                  item={it}
                  favorited={favoriteIds.has(it.id)}
                  onClick={() => {
                    Taro.navigateTo({ url: `/subpackages/listing/detail/index?listingId=${it.id}` });
                  }}
                  onFavorite={() => {
                    void toggleFavorite(it.id);
                  }}
                  onConsult={() => {
                    void startListingConsult(it.id);
                  }}
                />
              ))}
            </View>
          )}

          {!loading && !error && items.length ? (
            <ListFooter
              loadingMore={loadingMore}
              hasMore={hasMore}
              onLoadMore={() => {
                void loadRecommendMore();
              }}
              showNoMore
            />
          ) : null}
        </PullToRefresh>
      </View>
    </View>
  );
}
