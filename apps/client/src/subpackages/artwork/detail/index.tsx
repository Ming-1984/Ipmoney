import { View, Text, Image, Button as TaroButton } from '@tarojs/components';
import Taro, { useShareAppMessage } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import './index.scss';

import type { components } from '@ipmoney/api-types';

import { Heart, HeartFill, Share2 } from '../../../ui/icons';

import { apiGet, apiPost } from '../../../lib/api';
import { getToken } from '../../../lib/auth';
import { getDetailCache, setDetailCache } from '../../../lib/detailCache';
import { createFileTemporaryAccess } from '../../../lib/files';
import { favoriteArtwork, isArtworkFavorited, syncFavoriteArtworks, unfavoriteArtwork } from '../../../lib/favorites';
import { ensureApproved } from '../../../lib/guard';
import {
  artworkCategoryLabel,
  calligraphyScriptLabel,
  paintingGenreLabel,
  priceTypeLabel,
  verificationStatusLabel,
  verificationTypeLabel,
} from '../../../lib/labels';
import { fenToYuan } from '../../../lib/money';
import { safeNavigateBack } from '../../../lib/navigation';
import { regionDisplayName } from '../../../lib/regions';
import { useRouteUuidParam } from '../../../lib/routeParams';
import { CommentsSection } from '../../../ui/CommentsSection';
import { PageHeader, Spacer, StickyBar, Surface, TipBanner } from '../../../ui/layout';
import { Avatar, Button, toast } from '../../../ui/nutui';
import { EmptyCard, ErrorCard, LoadingCard, MissingParamCard } from '../../../ui/StateCards';

type ArtworkPublic = components['schemas']['ArtworkPublic'];
type ContentMedia = components['schemas']['ContentMedia'];
type Conversation = { id: string };

export default function ArtworkDetailPage() {
  const artworkId = useRouteUuidParam('artworkId');

  if (!artworkId) {
    return (
      <View className="container">
        <MissingParamCard onAction={() => void safeNavigateBack()} />
      </View>
    );
  }

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ArtworkPublic | null>(null);
  const [favoritedState, setFavoritedState] = useState(false);
  const [activeTab, setActiveTab] = useState('artwork-overview');

  const certificateMedia = useMemo(
    () => ((data?.media || []) as ContentMedia[]).filter((m) => m.type === 'FILE'),
    [data?.media],
  );

  useEffect(() => {
    setFavoritedState(isArtworkFavorited(artworkId));
  }, [artworkId]);

  const load = useCallback(async () => {
    const cached = getDetailCache<ArtworkPublic>('artwork-public', artworkId);
    if (cached) {
      setData(cached);
      setLoading(false);
      setError(null);
    } else {
      setLoading(true);
      setError(null);
    }
    try {
      const d = await apiGet<ArtworkPublic>(`/public/artworks/${artworkId}`);
      setData(d);
      setDetailCache('artwork-public', artworkId, d);
    } catch (e: any) {
      if (!cached) {
        setError(e?.message || 'Load failed');
        setData(null);
      }
    } finally {
      setLoading(false);
    }
  }, [artworkId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!getToken()) return;
    syncFavoriteArtworks()
      .then((ids) => setFavoritedState(ids.includes(artworkId)))
      .catch(() => {});
  }, [artworkId]);

  useShareAppMessage(() => ({
    title: data?.title ? `Artwork: ${data.title}` : 'Artwork Detail',
    path: artworkId ? `/subpackages/artwork/detail/index?artworkId=${artworkId}` : '/pages/home/index',
    imageUrl: data?.coverUrl || undefined,
  }));

  const startConsult = useCallback(async () => {
    if (!ensureApproved()) return;
    try {
      const conv = await apiPost<Conversation>(
        `/artworks/${artworkId}/conversations`,
        {},
        { idempotencyKey: `conv-artwork-${artworkId}` },
      );
      Taro.navigateTo({ url: `/subpackages/messages/chat/index?conversationId=${conv.id}` });
    } catch (e: any) {
      toast(e?.message || 'Failed to start chat');
    }
  }, [artworkId]);

  const toggleFavorite = useCallback(async () => {
    if (!ensureApproved()) return;
    try {
      if (favoritedState) {
        await unfavoriteArtwork(artworkId);
        setFavoritedState(false);
        toast('Removed from favorites', { icon: 'success' });
        return;
      }
      await favoriteArtwork(artworkId);
      setFavoritedState(true);
      toast('Added to favorites', { icon: 'success' });
    } catch (e: any) {
      toast(e?.message || 'Operation failed');
    }
  }, [artworkId, favoritedState]);

  const tabs = useMemo(
    () => [
      { id: 'artwork-overview', label: 'Overview' },
      { id: 'artwork-info', label: 'Info' },
      { id: 'artwork-detail', label: 'Intro' },
      { id: 'artwork-comments', label: 'Comments' },
    ],
    [],
  );

  const scrollToTab = useCallback((id: string) => {
    setActiveTab(id);
    Taro.pageScrollTo({ selector: `#${id}`, duration: 300 });
  }, []);

  const openMedia = useCallback(async (m: ContentMedia) => {
    let url = m.url || '';
    if (!url && m.fileId) {
      try {
        const res = await createFileTemporaryAccess(String(m.fileId), { scope: 'preview', expiresInSeconds: 600 });
        url = res?.url || '';
      } catch (e: any) {
        toast(e?.message || 'Failed to resolve media link', { icon: 'fail' });
        return;
      }
    }
    if (!url) {
      toast('Media link unavailable', { icon: 'fail' });
      return;
    }
    if (String(m.mimeType || '').startsWith('image/')) {
      void Taro.previewImage({ urls: [url] });
      return;
    }
    void Taro.setClipboardData({ data: url });
    toast('Link copied', { icon: 'success' });
  }, []);

  return (
    <View className="container detail-page-compact has-sticky">
      <PageHeader weapp back title="Artwork Detail" subtitle="Escrowed payment flow for secure delivery" />
      <Spacer />

      {loading ? (
        <LoadingCard />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : data ? (
        <View>
          {data.coverUrl ? (
            <Surface padding="none" className="listing-detail-cover">
              <Image className="listing-detail-cover-img" src={data.coverUrl} mode="aspectFill" />
            </Surface>
          ) : null}

          <Spacer size={12} />

          <Surface className="detail-compact-header" id="artwork-overview">
            <Text className="detail-compact-title clamp-2">{data.title || 'Untitled Artwork'}</Text>
            <Spacer size={8} />

            <View className="detail-compact-tags">
              <Text className="detail-compact-tag detail-compact-tag-strong">Category: {artworkCategoryLabel(data.category)}</Text>
              {data.calligraphyScript ? (
                <Text className="detail-compact-tag">Script: {calligraphyScriptLabel(data.calligraphyScript)}</Text>
              ) : null}
              {data.paintingGenre ? <Text className="detail-compact-tag">Genre: {paintingGenreLabel(data.paintingGenre)}</Text> : null}
              <Text className="detail-compact-tag">Pricing: {priceTypeLabel(data.priceType)}</Text>
            </View>

            <Spacer size={10} />
            <View className="detail-compact-price">
              ¥{data.depositAmountFen != null ? fenToYuan(data.depositAmountFen) : '-'}
              <Text className="detail-compact-price-sub">Deposit</Text>
            </View>
            <Text className="detail-compact-subline">
              Price:
              {data.priceType === 'NEGOTIABLE'
                ? ' Negotiable'
                : data.priceAmountFen != null
                  ? ` ¥${fenToYuan(data.priceAmountFen)}`
                  : ' -'}
            </Text>
          </Surface>

          <View className="detail-tabs">
            <View className="detail-tabs-scroll">
              {tabs.map((tab) => (
                <Text
                  key={tab.id}
                  className={`detail-tab ${activeTab === tab.id ? 'is-active' : ''}`}
                  onClick={() => scrollToTab(tab.id)}
                >
                  {tab.label}
                </Text>
              ))}
            </View>
          </View>

          <Spacer size={12} />

          {data.seller ? (
            <>
              <View className="detail-section-card">
                <View className="artwork-seller-row">
                  <Avatar
                    size="56"
                    src={data.seller.avatarUrl || ''}
                    background="var(--c-soft)"
                    color="var(--c-primary)"
                  >
                    {(data.seller.nickname || 'S').slice(0, 1)}
                  </Avatar>
                  <View className="artwork-seller-meta">
                    <Text className="artwork-seller-name">{data.seller.nickname || 'Seller'}</Text>
                    <View className="artwork-seller-tags">
                      {data.seller.verificationType ? (
                        <Text className="detail-compact-tag">
                          {verificationTypeLabel(data.seller.verificationType, { empty: '-' })}
                        </Text>
                      ) : null}
                      {data.seller.verificationStatus ? (
                        <Text className="detail-compact-tag">
                          {verificationStatusLabel(data.seller.verificationStatus, { empty: '-' })}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </View>
              </View>
              <Spacer size={12} />
            </>
          ) : null}

          <View id="artwork-info" className="detail-section-card">
            <View className="detail-field-list">
              {data.creatorName ? (
                <View className="detail-field-row">
                  <Text className="detail-field-label">Creator</Text>
                  <Text className="detail-field-value">{data.creatorName}</Text>
                </View>
              ) : null}
              {data.creationYear ? (
                <View className="detail-field-row">
                  <Text className="detail-field-label">Year</Text>
                  <Text className="detail-field-value">{data.creationYear}</Text>
                </View>
              ) : null}
              {data.regionCode ? (
                <View className="detail-field-row">
                  <Text className="detail-field-label">Region</Text>
                  <Text className="detail-field-value">{regionDisplayName(data.regionCode)}</Text>
                </View>
              ) : null}
              {data.material ? (
                <View className="detail-field-row">
                  <Text className="detail-field-label">Material</Text>
                  <Text className="detail-field-value">{data.material}</Text>
                </View>
              ) : null}
              {data.size ? (
                <View className="detail-field-row">
                  <Text className="detail-field-label">Size</Text>
                  <Text className="detail-field-value">{data.size}</Text>
                </View>
              ) : null}
              {data.certificateNo ? (
                <View className="detail-field-row">
                  <Text className="detail-field-label">Certificate No.</Text>
                  <Text className="detail-field-value">{data.certificateNo}</Text>
                </View>
              ) : null}
              <View className="detail-field-row detail-field-row--column">
                <Text className="detail-field-label">Proof Files</Text>
                {certificateMedia.length ? (
                  <View className="detail-file-list">
                    {certificateMedia.map((m, idx) => (
                      <View key={`${m.fileId}-${idx}`} className="detail-file-item" onClick={() => openMedia(m)}>
                        <Text className="detail-file-name">{m.fileName || `File ${idx + 1}`}</Text>
                        <Text className="detail-file-meta">{m.mimeType || 'File'}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text className="detail-field-value muted">No proof files</Text>
                )}
              </View>
            </View>
          </View>

          <Spacer size={12} />

          <View id="artwork-detail" className="detail-section-card">
            <View className="detail-field-list">
              <View className="detail-field-row">
                <Text className="detail-field-label">Description</Text>
                <Text className="detail-field-value break-word">{data.description || 'No description'}</Text>
              </View>
            </View>
          </View>

          <Spacer size={12} />

          <TipBanner
            tone="warning"
            title="Trade Notes"
            actionText="Trade Rules"
            onAction={() => {
              Taro.navigateTo({ url: '/subpackages/trade-rules/index' });
            }}
          >
            Contract signing is offline. Final payment is settled after ownership confirmation.
          </TipBanner>

          <Spacer size={12} />
          <View id="artwork-comments">
            <CommentsSection contentType="ARTWORK" contentId={artworkId} />
          </View>
        </View>
      ) : (
        <EmptyCard title="No Data" message="This artwork is unavailable." actionText="Back" onAction={() => void safeNavigateBack()} />
      )}

      {data ? (
        <StickyBar>
          <View className="detail-sticky-icons">
            <TaroButton className="detail-tool" openType="share" hoverClass="none">
              <View className="detail-tool-icon">
                <Share2 size={16} />
              </View>
              <Text>Share</Text>
            </TaroButton>
            <View className={`detail-tool ${favoritedState ? 'is-active' : ''}`} onClick={() => void toggleFavorite()}>
              <View className="detail-tool-icon">
                {favoritedState ? <HeartFill size={16} color="#ff4d4f" /> : <Heart size={16} />}
              </View>
              <Text>{favoritedState ? 'Saved' : 'Save'}</Text>
            </View>
          </View>

          <View className="detail-sticky-buttons">
            <Button variant="default" onClick={() => void startConsult()}>
              Chat
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (!ensureApproved()) return;
                Taro.navigateTo({ url: `/subpackages/checkout/deposit-pay/index?artworkId=${artworkId}` });
              }}
            >
              {`Deposit ¥${data.depositAmountFen != null ? fenToYuan(data.depositAmountFen) : '-'}`}
            </Button>
          </View>
        </StickyBar>
      ) : null}
    </View>
  );
}
