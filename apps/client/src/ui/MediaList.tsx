import { View, Text, Image, Video } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useMemo, useRef, useState } from 'react';

import { createFileTemporaryAccess } from '../lib/files';
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
  const [tempUrls, setTempUrls] = useState<Record<string, string>>({});
  const tempUrlRef = useRef<Record<string, string>>({});
  const pendingRef = useRef(new Set<string>());

  const setTempUrl = useCallback((key: string, url: string) => {
    tempUrlRef.current[key] = url;
    setTempUrls((prev) => (prev[key] === url ? prev : { ...prev, [key]: url }));
  }, []);

  const getTempUrl = useCallback(
    async (fileId: string, scope: 'preview' | 'download') => {
      const key = `${fileId}:${scope}`;
      const existing = tempUrlRef.current[key];
      if (existing) return existing;
      if (pendingRef.current.has(key)) return '';
      pendingRef.current.add(key);
      try {
        const res = await createFileTemporaryAccess(fileId, { scope, expiresInSeconds: 600 });
        const url = res?.url || '';
        if (url) setTempUrl(key, url);
        return url;
      } catch (e: any) {
        toast(e?.message || '获取链接失败', { icon: 'fail' });
        return '';
      } finally {
        pendingRef.current.delete(key);
      }
    },
    [setTempUrl],
  );

  const imageUrls = useMemo(() => {
    const urls = media
      .filter((item) => item.type === 'IMAGE')
      .map((item) => {
        if (item.url) return item.url;
        if (item.fileId) return tempUrls[`${item.fileId}:preview`] || '';
        return '';
      })
      .filter(Boolean);
    return resolveLocalAssetList(urls);
  }, [media, tempUrls]);

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
        const fileId = m.fileId || '';
        const resolvedUrl = resolveLocalAsset(url);
        const key = `${m.fileId || 'media'}-${idx}`;
        const previewKey = fileId ? `${fileId}:preview` : '';
        const downloadKey = fileId ? `${fileId}:download` : '';

        if (m.type === 'IMAGE' && resolvedUrl) {
          return (
            <View key={key} className="media-item">
              <Image className="media-thumb" src={resolvedUrl} mode="aspectFill" onClick={() => void previewImage(resolvedUrl, imageUrls)} />
            </View>
          );
        }

        if (m.type === 'IMAGE' && fileId) {
          const handleImagePreview = async () => {
            const tempUrl = await getTempUrl(fileId, 'preview');
            if (!tempUrl) {
              toast('暂无可预览链接', { icon: 'fail' });
              return;
            }
            const urls = imageUrls.includes(tempUrl) ? imageUrls : [tempUrl];
            await previewImage(tempUrl, urls.length ? urls : [tempUrl]);
          };
          return (
            <View key={key} className="media-item">
              <View className="media-thumb" onClick={() => void handleImagePreview()}>
                <Text className="muted">点击预览</Text>
              </View>
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

        if (m.type === 'VIDEO' && fileId) {
          const name = m.fileName || `视频 ${idx + 1}`;
          const poster = isHttpUrl(coverUrl) ? coverUrl || undefined : undefined;
          const activeUrl = tempUrls[previewKey] || '';
          return (
            <View key={key} className="media-item">
              {activeUrl ? (
                <Video className="media-thumb" src={activeUrl} controls autoplay={false} poster={poster} onError={onVideoError} />
              ) : (
                <View className="media-thumb">
                  <Text className="muted">暂无播放链接</Text>
                  <Button block={false} size="small" variant="ghost" onClick={() => void getTempUrl(fileId, 'preview')}>
                    获取播放链接
                  </Button>
                </View>
              )}
              <View className="row-between" style={{ gap: '12rpx', marginTop: '10rpx' }}>
                <Text className="muted clamp-1">{name}</Text>
                {activeUrl ? (
                  <Button block={false} size="small" variant="ghost" onClick={() => void copyLink(activeUrl)}>
                    复制链接
                  </Button>
                ) : null}
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

        if (m.type === 'FILE' && fileId) {
          const name = m.fileName || `附件 ${idx + 1}`;
          const activeUrl = tempUrls[downloadKey] || '';
          return (
            <View key={key} className="media-item media-file">
              <View className="media-file-main">
                <Text className="text-strong clamp-1">{name}</Text>
                {activeUrl ? (
                  <Text className="media-file-url clamp-1">{activeUrl}</Text>
                ) : (
                  <Text className="muted">未生成下载链接</Text>
                )}
              </View>
              {activeUrl ? (
                <Button block={false} size="small" variant="ghost" onClick={() => void copyLink(activeUrl)}>
                  复制链接
                </Button>
              ) : (
                <Button block={false} size="small" variant="ghost" onClick={() => void getTempUrl(fileId, 'download')}>
                  获取下载链接
                </Button>
              )}
            </View>
          );
        }

        return null;
      })}
    </View>
  );
}
