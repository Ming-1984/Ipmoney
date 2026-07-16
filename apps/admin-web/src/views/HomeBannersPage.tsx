import { Button, Card, Input, InputNumber, Space, Switch, Typography, Upload, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { apiGet, apiPut, apiUploadFile, type FileObject } from '../lib/api';
import { isSuperAdminSession, type AdminSessionInfo } from '../lib/adminSession';
import { normalizeUserFacingText } from '../lib/userFacingText';
import { ImageUrlUploadField } from '../ui/ImageUrlUploadField';
import { confirmActionWithReason } from '../ui/confirm';

type BannerMediaType = 'IMAGE' | 'VIDEO';

type BannerVideoMeta = {
  durationMs?: number;
  loop?: boolean;
  muted?: boolean;
  autoplay?: boolean;
  objectFit?: 'contain' | 'cover' | 'fill';
};

type BannerConfig = {
  items: {
    id: string;
    title: string;
    imageUrl: string;
    linkUrl?: string;
    enabled: boolean;
    order: number;
    mediaType?: BannerMediaType;
    videoUrl?: string;
    posterUrl?: string;
    videoMeta?: BannerVideoMeta;
  }[];
};

function normalizeOperatorText(value: unknown, fallback = '', maxLength = 1000): string {
  const normalized = normalizeUserFacingText(value);
  if (!normalized) return fallback;
  if (normalized.toLowerCase() === 'string') return fallback;
  return normalized.slice(0, maxLength);
}

function normalizePositiveOrder(value: unknown, fallback: number): number {
  const raw = Number(value);
  return Number.isSafeInteger(raw) && raw > 0 ? raw : fallback;
}

function normalizeBannerConfig(input: BannerConfig | null): BannerConfig {
  const base: BannerConfig = input && typeof input === 'object' ? input : { items: [] };
  const items = Array.isArray(base.items) ? [...base.items] : [];

  if (!items.length) {
    items.push({
      id: 'home-main-banner',
      title: '首页主轮播',
      imageUrl: '',
      linkUrl: '',
      enabled: true,
      order: 1,
      mediaType: 'VIDEO',
    });
  }

  const normalizedItems = items.map((item, index) => {
    const fallbackId = index === 0 ? 'home-main-banner' : `home-banner-${index + 1}`;
    const fallbackTitle = index === 0 ? '首页主轮播' : `轮播 ${index + 1}`;
    return {
      ...item,
      id: normalizeOperatorText(item.id, fallbackId, 40),
      title: normalizeOperatorText(item.title, fallbackTitle, 24),
      imageUrl: normalizeOperatorText(item.imageUrl, '', 1000),
      linkUrl: normalizeOperatorText(item.linkUrl, '', 1000) || undefined,
      videoUrl: normalizeOperatorText(item.videoUrl, '', 1000) || undefined,
      posterUrl: normalizeOperatorText(item.posterUrl, '', 1000) || undefined,
      enabled: item.enabled !== false,
      order: normalizePositiveOrder(item.order, index + 1),
      mediaType: item.mediaType === 'IMAGE' ? 'IMAGE' : 'VIDEO',
    };
  });

  return { ...base, items: normalizedItems };
}

export function HomeBannersPage() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bannerJson, setBannerJson] = useState('');
  const [bannerVideoFile, setBannerVideoFile] = useState<FileObject | null>(null);
  const [bannerPosterFile, setBannerPosterFile] = useState<FileObject | null>(null);
  const [canUseAdvancedEditor, setCanUseAdvancedEditor] = useState(false);
  const [advancedEditorVisible, setAdvancedEditorVisible] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [banner, session] = await Promise.all([
        apiGet<BannerConfig>('/admin/config/banner'),
        apiGet<AdminSessionInfo>('/auth/session'),
      ]);
      const normalized = normalizeBannerConfig(banner);
      setBannerJson(JSON.stringify(normalized, null, 2));
      const isSuperAdmin = isSuperAdminSession(session);
      setCanUseAdvancedEditor(isSuperAdmin);
      if (!isSuperAdmin) {
        setAdvancedEditorVisible(false);
      }
    } catch (e: any) {
      message.error(e?.message || '加载首页轮播失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const parseBannerJson = useCallback(() => {
    try {
      return JSON.parse(bannerJson) as BannerConfig;
    } catch (e: any) {
      message.error(e?.message || '当前高级编辑内容格式不正确');
      return null;
    }
  }, [bannerJson]);

  const updateBannerJson = useCallback(
    (updater: (config: BannerConfig) => BannerConfig) => {
      const parsed = parseBannerJson();
      if (!parsed) return;
      const normalized = normalizeBannerConfig(parsed);
      const next = updater(normalized);
      setBannerJson(JSON.stringify(normalizeBannerConfig(next), null, 2));
    },
    [parseBannerJson],
  );

  const applyBannerUpload = useCallback(
    (kind: 'video' | 'poster', url: string) => {
      updateBannerJson((config) => {
        const items = [...config.items];
        const current = { ...items[0] };
        current.mediaType = 'VIDEO';
        current.enabled = current.enabled !== false;
        current.order = normalizePositiveOrder(current.order, 1);
        if (kind === 'video') {
          current.videoUrl = url;
        } else {
          current.posterUrl = url;
          current.imageUrl = url;
        }
        items[0] = current;
        return { ...config, items };
      });
    },
    [updateBannerJson],
  );

  const validateFileSize = useCallback((file: File, maxMb: number) => {
    const sizeMb = file.size / 1024 / 1024;
    if (sizeMb > maxMb) {
      message.error(`文件过大，请控制在 ${maxMb}MB 以内`);
      return false;
    }
    return true;
  }, []);

  const bannerConfigDraft = useMemo(() => {
    try {
      return normalizeBannerConfig(JSON.parse(bannerJson) as BannerConfig);
    } catch {
      return null;
    }
  }, [bannerJson]);

  const bannerItemsView = useMemo(() => {
    if (!bannerConfigDraft) return [];
    return [...bannerConfigDraft.items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [bannerConfigDraft]);

  const updateBannerItem = useCallback(
    (id: string, patch: Partial<BannerConfig['items'][number]>) => {
      updateBannerJson((config) => {
        const items = [...config.items];
        const idx = items.findIndex((item) => item.id === id);
        if (idx < 0) return config;
        items[idx] = { ...items[idx], ...patch };
        return { ...config, items };
      });
    },
    [updateBannerJson],
  );

  const moveBannerItem = useCallback(
    (id: string, direction: 'up' | 'down') => {
      updateBannerJson((config) => {
        const items = [...config.items];
        const idx = items.findIndex((item) => item.id === id);
        if (idx < 0) return config;
        const target = direction === 'up' ? idx - 1 : idx + 1;
        if (target < 0 || target >= items.length) return config;
        const next = [...items];
        const currentOrder = normalizePositiveOrder(next[idx].order, idx + 1);
        const targetOrder = normalizePositiveOrder(next[target].order, target + 1);
        [next[idx], next[target]] = [next[target], next[idx]];
        next[idx].order = targetOrder;
        next[target].order = currentOrder;
        return { ...config, items: next };
      });
    },
    [updateBannerJson],
  );

  const save = useCallback(async () => {
    const parsed = parseBannerJson();
    if (!parsed) return;
    const payload = normalizeBannerConfig(parsed);
    const { ok } = await confirmActionWithReason({
      title: '确认保存首页轮播？',
      content: '保存后将直接影响官网首页轮播展示。',
      okText: '保存',
      reasonLabel: '变更原因（建议填写）',
    });
    if (!ok) return;

    setSaving(true);
    try {
      await apiPut<BannerConfig>('/admin/config/banner', payload);
      message.success('首页轮播已保存');
      void load();
    } catch (e: any) {
      message.error(e?.message || '保存失败，请检查轮播内容');
    } finally {
      setSaving(false);
    }
  }, [load, parseBannerJson]);

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card loading={loading}>
        <Typography.Title level={3} style={{ marginTop: 0 }}>
          首页轮播
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          这里维护官网首页轮播。普通运营只需要管理标题、视频、封面图、显示状态和顺序，不需要手动改配置文本。
        </Typography.Paragraph>
      </Card>

      <Card loading={loading}>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Typography.Text strong>上传轮播素材</Typography.Text>
          <Typography.Text type="secondary">
            先上传视频和封面图，系统会自动写入当前轮播内容。
          </Typography.Text>
          <Space wrap size={12}>
            <Upload
              maxCount={1}
              showUploadList={false}
              accept="video/*"
              beforeUpload={(file) => (validateFileSize(file as File, 30) ? true : Upload.LIST_IGNORE)}
              customRequest={async (options: any) => {
                try {
                  const uploaded = await apiUploadFile(options.file as File, 'BANNER_VIDEO');
                  setBannerVideoFile(uploaded);
                  applyBannerUpload('video', uploaded.url);
                  message.success('视频已上传并同步到首页轮播');
                  options.onSuccess?.(uploaded);
                } catch (e: any) {
                  options.onError?.(e);
                  message.error(e?.message || '视频上传失败');
                }
              }}
            >
              <Button>上传视频</Button>
            </Upload>
            <Upload
              maxCount={1}
              showUploadList={false}
              accept="image/*"
              beforeUpload={(file) => (validateFileSize(file as File, 10) ? true : Upload.LIST_IGNORE)}
              customRequest={async (options: any) => {
                try {
                  const uploaded = await apiUploadFile(options.file as File, 'BANNER_POSTER');
                  setBannerPosterFile(uploaded);
                  applyBannerUpload('poster', uploaded.url);
                  message.success('封面图已上传并同步到首页轮播');
                  options.onSuccess?.(uploaded);
                } catch (e: any) {
                  options.onError?.(e);
                  message.error(e?.message || '封面图上传失败');
                }
              }}
            >
              <Button>上传封面图</Button>
            </Upload>
          </Space>
          {bannerVideoFile ? <Typography.Text type="secondary">最近上传视频：{bannerVideoFile.url}</Typography.Text> : null}
          {bannerPosterFile ? <Typography.Text type="secondary">最近上传封面图：{bannerPosterFile.url}</Typography.Text> : null}
        </Space>
      </Card>

      <Card loading={loading}>
        <Typography.Title level={4} style={{ marginTop: 0 }}>
          当前轮播内容
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
          首页默认按展示顺序播放。数字越小越靠前。
        </Typography.Paragraph>
        {bannerConfigDraft ? (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            {bannerItemsView.map((item, idx) => (
              <Card key={item.id} size="small">
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <Space wrap size={12} align="center">
                    <Input
                      value={item.title}
                      onChange={(e) => updateBannerItem(item.id, { title: e.target.value })}
                      placeholder="轮播标题"
                      style={{ width: 240 }}
                    />
                    <Switch
                      checked={item.enabled !== false}
                      onChange={(checked) => updateBannerItem(item.id, { enabled: checked })}
                      checkedChildren="显示"
                      unCheckedChildren="隐藏"
                    />
                    <InputNumber
                      min={1}
                      value={item.order}
                      onChange={(val) => updateBannerItem(item.id, { order: typeof val === 'number' ? val : 1 })}
                    />
                    <Button disabled={idx === 0} onClick={() => moveBannerItem(item.id, 'up')}>
                      上移
                    </Button>
                    <Button disabled={idx === bannerItemsView.length - 1} onClick={() => moveBannerItem(item.id, 'down')}>
                      下移
                    </Button>
                  </Space>
                  <Typography.Text type="secondary">视频地址：{item.videoUrl || '-'}</Typography.Text>
                  <Space direction="vertical" size={6} style={{ width: '100%' }}>
                    <Typography.Text type="secondary">封面图</Typography.Text>
                    <ImageUrlUploadField
                      value={item.posterUrl || item.imageUrl || ''}
                      uploadPurpose="BANNER_POSTER"
                      maxSizeMb={10}
                      onChange={(next) => {
                        updateBannerItem(item.id, { posterUrl: next, imageUrl: next });
                      }}
                    />
                  </Space>
                </Space>
              </Card>
            ))}
          </Space>
        ) : (
          <Typography.Text type="danger">当前轮播内容格式异常，请联系管理员处理。</Typography.Text>
        )}

        <Space style={{ marginTop: 12 }}>
          <Button onClick={() => void load()} disabled={saving}>
            重新加载
          </Button>
          <Button type="primary" loading={saving} onClick={() => void save()}>
            保存首页轮播
          </Button>
        </Space>
      </Card>

      {canUseAdvancedEditor ? (
        <Card loading={loading}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <Typography.Text strong>管理员高级编辑</Typography.Text>
              <Button onClick={() => setAdvancedEditorVisible((value) => !value)}>
                {advancedEditorVisible ? '收起高级编辑' : '展开高级编辑'}
              </Button>
            </Space>
            {advancedEditorVisible ? (
              <>
                <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                  仅管理员在排查问题或批量修正时使用。普通运营不需要编辑下面这段配置文本。
                </Typography.Paragraph>
                <Input.TextArea rows={12} value={bannerJson} onChange={(e) => setBannerJson(e.target.value)} />
              </>
            ) : (
              <Typography.Text type="secondary">高级配置文本已隐藏。</Typography.Text>
            )}
          </Space>
        </Card>
      ) : null}
    </Space>
  );
}
