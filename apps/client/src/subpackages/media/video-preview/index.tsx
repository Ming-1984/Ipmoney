import { View, Video } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useEffect, useMemo, useState } from 'react';
import './index.scss';

import bannerLocal1Mp4 from '../../../assets/home/banner-local-1.mp4';
import bannerLocal2Mp4 from '../../../assets/home/banner-local-2.mp4';
import { ensureWeappVideoSrc } from '../../../lib/localMedia';

const bannerVideos = [
  { id: 'banner-local-1', title: 'Local Banner 1', asset: bannerLocal1Mp4, fileName: 'banner-local-1.mp4' },
  { id: 'banner-local-2', title: 'Local Banner 2', asset: bannerLocal2Mp4, fileName: 'banner-local-2.mp4' },
];

export default function VideoPreviewPage() {
  const params = Taro.getCurrentInstance().router?.params;
  const index = useMemo(() => {
    const raw = Number(params?.i ?? 0);
    if (Number.isNaN(raw)) return 0;
    return Math.min(Math.max(raw, 0), bannerVideos.length - 1);
  }, [params?.i]);

  const [src, setSrc] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    const item = bannerVideos[index];
    if (!item) return;
    if (process.env.TARO_ENV !== 'weapp') {
      setSrc(item.asset);
      return;
    }

    (async () => {
      try {
        const resolved = await ensureWeappVideoSrc(item.asset, item.fileName);
        if (!cancelled) setSrc(resolved);
      } catch (e) {
        if (!cancelled) setSrc('');
        // eslint-disable-next-line no-console
        console.warn('Video preview load failed', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [index]);

  return (
    <View className="video-preview">
      {src ? (
        <Video
          className="video-preview-player"
          src={src}
          autoplay
          controls
          loop
          muted={false}
          objectFit="contain"
        />
      ) : null}
    </View>
  );
}
