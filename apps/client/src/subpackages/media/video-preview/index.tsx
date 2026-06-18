import { View, Video, Swiper, SwiperItem, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import './index.scss';

import { apiGet } from '../../../lib/api';
import { buildHomeBannerItems, clampBannerIndex, type BannerConfig, type HomeBannerItem } from '../../../lib/homeBannerConfig';
import { useRouteNumberParam } from '../../../lib/routeParams';

export default function VideoPreviewPage() {
  const routeIndex = useRouteNumberParam('i');
  const [bannerItems, setBannerItems] = useState<HomeBannerItem[]>(() => buildHomeBannerItems());
  const [activeIndex, setActiveIndex] = useState(0);
  const previousIndexRef = useRef(0);
  const [videoSources, setVideoSources] = useState<string[]>(() => bannerItems.map((item) => item.videoUrl || ''));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const banner = await apiGet<BannerConfig>('/public/config/banner');
        if (!cancelled) setBannerItems(buildHomeBannerItems(banner));
      } catch {
        // keep fallback banner when config request fails
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setVideoSources(bannerItems.map((item) => item.videoUrl || ''));
  }, [bannerItems]);

  useEffect(() => {
    const raw = Number(routeIndex ?? 0);
    const nextIndex = clampBannerIndex(raw, bannerItems.length);
    setActiveIndex(nextIndex);
    previousIndexRef.current = nextIndex;
  }, [bannerItems.length, routeIndex]);

  useEffect(() => {
    if (process.env.TARO_ENV !== 'weapp') return;
    const src = videoSources[activeIndex];
    if (!src) return;
    try {
      const ctx = Taro.createVideoContext(`video-preview-${activeIndex}`);
      ctx.play();
    } catch {
      // ignore
    }
  }, [activeIndex, videoSources]);

  const handleExit = useCallback(() => {
    try {
      Taro.navigateBack({ delta: 1 });
    } catch {
      Taro.switchTab({ url: '/pages/home/index' });
    }
  }, []);

  const handleChange = useCallback(
    (e: any) => {
      const nextIndex = e.detail.current;
      if (nextIndex === activeIndex) return;
      const prevIndex = previousIndexRef.current;
      previousIndexRef.current = nextIndex;
      setActiveIndex(nextIndex);
      if (process.env.TARO_ENV !== 'weapp') return;
      try {
        Taro.createVideoContext(`video-preview-${prevIndex}`).stop();
      } catch {
        // ignore
      }
      try {
        Taro.createVideoContext(`video-preview-${nextIndex}`).play();
      } catch {
        // ignore
      }
    },
    [activeIndex],
  );

  return (
    <View className="video-preview">
      <View className="video-preview-exit" onClick={handleExit}>
        <Text className="video-preview-exit-text">{`\u9000\u51fa`}</Text>
      </View>
      <Swiper
        className="video-preview-swiper"
        vertical
        circular={bannerItems.length > 1}
        current={activeIndex}
        onChange={handleChange}
      >
        {bannerItems.map((item, index) => {
          const src = videoSources[index];
          return (
            <SwiperItem key={item.id} className="video-preview-item">
              {src ? (
                <Video
                  id={`video-preview-${index}`}
                  className="video-preview-player"
                  src={src}
                  autoplay={index === activeIndex}
                  controls
                  loop={index === activeIndex}
                  muted={false}
                  objectFit="contain"
                  poster={item.cover}
                />
              ) : (
                <View className="video-preview-poster">
                  <Image src={item.cover} mode="aspectFill" className="video-preview-poster-img" />
                </View>
              )}
            </SwiperItem>
          );
        })}
      </Swiper>
    </View>
  );
}
