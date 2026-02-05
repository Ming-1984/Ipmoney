import { View, Text, Image, Video } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback } from 'react';

import { resolveLocalAsset, resolveLocalAssetList } from '../lib/localAssets';
import { Button, toast } from './nutui';

export type MediaKind = 'IMAGE' | 'VIDEO' | 'FILE';

export type MediaItem = {
  type: MediaKind;
  url?: string | null;
  fileName?: string | null;
  fileId?: string | null;
};

function fileNameFromUrl(url?: string | null): string {
  if (!url) return 'File';
  try {
    const u = new URL(url);
    const pathname = u.pathname || '';
    const idx = pathname.lastIndexOf('/');
    const name = idx >= 0 ? pathname.slice(idx + 1) : pathname;
    return decodeURIComponent(name || 'File');
  } catch {
    const idx = url.lastIndexOf('/');
    const name = idx >= 0 ? url.slice(idx + 1) : url;
    return name || 'File';
  }
}

function isHttpUrl(url?: string | null): boolean {
  return Boolean(url && /^https?:\/\//.test(url));
}

export function MediaList(props: { media: MediaItem[]; coverUrl?: string | null }) {
  const media = props.media || [];
  const coverUrl = props.coverUrl ?? null;
  const imageUrls = resolveLocalAssetList(
    media.filter((item) => item.type === 'IMAGE' && item.url).map((item) => item.url as string),
  );

  const copyLink = useCallback(async (url: string) => {
    try {
      await Taro.setClipboardData({ data: url });
      toast('Link copied', { icon: 'success' });
    } catch (_) {
      toast('Copy failed', { icon: 'fail' });
    }
  }, []);

  const previewImage = useCallback(async (url: string, urls: string[]) => {
    try {
      await Taro.previewImage({ urls, current: url });
    } catch (_) {}
  }, []);

  const onVideoError = useCallback((e: any) => {
    // Avoid hard crashes/white screens when media URLs are invalid (e.g. fixtures).
    const err = e?.detail?.errMsg || e?.detail?.msg;
    toast(err ? `Copy link?${String(err)}` : 'Copy link', { icon: 'fail' });
  }, []);

  if (!media.length) return null;

  return (
    <View className="media-list">
      {media.map((m, idx) => {
        const url = m.url || '';
        const resolvedUrl = resolveLocalAsset(url);
        const key = `${m.fileId || 'media'}-${idx}`;

        if (m.type === 'IMAGE' && resolvedUrl) {
          return (
            <View key={key} className="media-item">
              <Image className="media-thumb" src={resolvedUrl} mode="aspectFill" onClick={() => void previewImage(resolvedUrl, imageUrls)} />
            </View>
          );
        }

        if (m.type === 'VIDEO' && url) {
          const name = m.fileName || fileNameFromUrl(url);
          const poster = isHttpUrl(coverUrl) ? coverUrl || undefined : undefined;
          return (
            <View key={key} className="media-item">
              <Video
                className="media-thumb"
                src={url}
                controls
                autoplay={false}
                poster={poster}
                onError={onVideoError}
              />
              <View className="row-between" style={{ gap: '12rpx', marginTop: '10rpx' }}>
                <Text className="muted clamp-1">{name}</Text>
                <Button block={false} size="small" variant="ghost" onClick={() => void copyLink(url)}>
                  复制链接
                </Button>
              </View>
            </View>
          );
        }

        if (m.type === 'FILE' && url) {
          const name = m.fileName || fileNameFromUrl(url);
          return (
            <View key={key} className="media-item media-file">
              <View className="media-file-main">
                <Text className="text-strong clamp-1">{name}</Text>
                <Text className="media-file-url clamp-1">{url}</Text>
              </View>
              <Button block={false} size="small" variant="ghost" onClick={() => void copyLink(url)}>
                复制链接
              </Button>
            </View>
          );
        }

        return null;
      })}
    </View>
  );
}
