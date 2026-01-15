import { View, Text, Button as WxButton } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type { components } from '@ipmoney/api-types';

import { API_BASE_URL } from '../../../constants';
import { getToken } from '../../../lib/auth';
import { apiGet, apiPatch } from '../../../lib/api';
import { requireLogin } from '../../../lib/guard';
import { CellRow, PageHeader, SectionHeader, Spacer, Surface, TipBanner } from '../../../ui/layout';
import { Avatar, Button, CellGroup, Input, toast } from '../../../ui/nutui';
import { ErrorCard, LoadingCard } from '../../../ui/StateCards';

type UserProfile = components['schemas']['UserProfile'];
type FileObject = components['schemas']['FileObject'];

export default function ProfileEditPage() {
  const params = useMemo(() => Taro.getCurrentInstance().router?.params || {}, []);
  const env = useMemo(() => Taro.getEnv(), []);
  const isWeapp = env === Taro.ENV_TYPE.WEAPP;

  const from = String((params as any)?.from || '');
  const nextType = String((params as any)?.nextType || '');
  const nextUrl = ((params as any)?.nextUrl ? decodeURIComponent(String((params as any)?.nextUrl)) : '') || '';
  const isOnboarding = from === 'login';

  const goNext = useCallback(() => {
    if (nextType === 'redirectTo' && nextUrl) {
      Taro.redirectTo({ url: nextUrl });
      return;
    }
    if (nextType === 'switchTab' && nextUrl) {
      Taro.switchTab({ url: nextUrl });
      return;
    }
    if (nextType === 'navigateBack') {
      Taro.navigateBack();
      return;
    }
    Taro.navigateBack();
  }, [nextType, nextUrl]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<UserProfile | null>(null);

  const [avatarUrl, setAvatarUrl] = useState('');
  const [nickname, setNickname] = useState('');
  const [regionCode, setRegionCode] = useState('');
  const [regionName, setRegionName] = useState('');

  const load = useCallback(async () => {
    if (!requireLogin()) return;
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<UserProfile>('/me');
      setMe(d);
      setAvatarUrl(d.avatarUrl || '');
      setNickname(d.nickname || '');
      setRegionCode(d.regionCode || '');
      setRegionName('');
    } catch (e: any) {
      setError(e?.message || '加载失败');
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const uploadAvatarFromPath = useCallback(async (tempPath: string) => {
    const trimmed = String(tempPath || '').trim();
    if (!trimmed) return false;

    // Prefer uploading to API (so avatarUrl becomes a stable URL). If upload isn't available (e.g. mock/prism),
    // fall back to local saved file path so WeApp can still display the avatar immediately.
    let localPath = trimmed;
    try {
      const res = await Taro.saveFile({ tempFilePath: trimmed });
      const savedPath = String((res as any)?.savedFilePath || '').trim();
      if (savedPath) localPath = savedPath;
    } catch (_) {}

    try {
      const token = getToken();
      const uploadRes = await Taro.uploadFile({
        url: `${API_BASE_URL}/files`,
        filePath: localPath,
        name: 'file',
        formData: { purpose: 'AVATAR' },
        header: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (uploadRes.statusCode >= 200 && uploadRes.statusCode < 300) {
        const parsed = JSON.parse(String(uploadRes.data || '{}')) as Partial<FileObject>;
        if (typeof parsed.url === 'string' && parsed.url && String(parsed.mimeType || '').startsWith('image/')) {
          setAvatarUrl(parsed.url);
          return true;
        }
      }
    } catch (_) {
      // ignore upload failure and use localPath as fallback
    }

    setAvatarUrl(localPath);
    return true;
  }, []);

  const onChooseAvatar = useCallback(
    async (e: any) => {
      const tempPath = String(e?.detail?.avatarUrl || '').trim();
      if (!tempPath) {
        const errMsg = String(e?.detail?.errMsg || '').toLowerCase();
        if (errMsg.includes('no permission')) {
          toast('未授权头像权限，可改用“从相册选择”。');
        } else if (errMsg) {
          toast('选择头像失败，请重试');
        }
        return;
      }
      await uploadAvatarFromPath(tempPath);
    },
    [uploadAvatarFromPath],
  );

  const chooseAvatarFromAlbum = useCallback(async () => {
    try {
      const res = await Taro.chooseImage({ count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'] });
      const tempPath = String(res?.tempFilePaths?.[0] || res?.tempFiles?.[0]?.path || '').trim();
      if (!tempPath) {
        toast('未选择图片');
        return;
      }
      await uploadAvatarFromPath(tempPath);
    } catch (e: any) {
      const errMsg = String(e?.errMsg || '').toLowerCase();
      if (errMsg.includes('cancel')) return;
      toast(e?.message || '选择头像失败');
    }
  }, [uploadAvatarFromPath]);

  const save = useCallback(async () => {
    if (!requireLogin()) return;
    const nick = nickname.trim();
    const avatar = avatarUrl.trim();

    if (isOnboarding) {
      if (!avatar) {
        toast('请先选择头像');
        return;
      }
      if (!nick) {
        toast('请先设置昵称');
        return;
      }
    }

    if (nick && nick.length > 50) {
      toast('昵称最多 50 个字符');
      return;
    }
    try {
      const d = await apiPatch<UserProfile>('/me', {
        ...(nick ? { nickname: nick } : {}),
        ...(avatar ? { avatarUrl: avatar } : {}),
        ...(regionCode.trim() ? { regionCode: regionCode.trim() } : {}),
      });
      setMe(d);
      toast('已保存', { icon: 'success' });
      setTimeout(() => goNext(), 200);
    } catch (e: any) {
      toast(e?.message || '保存失败');
    }
  }, [avatarUrl, goNext, isOnboarding, nickname, regionCode]);

  return (
    <View className="container">
      <PageHeader title="资料设置" subtitle="更新头像/昵称/地区，用于展示与地域推荐" />
      <Spacer />

      {loading ? (
        <LoadingCard />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : (
        <View>
          {isOnboarding ? (
            <>
              <TipBanner tone="info" title="建议完善资料">
                为了便于咨询与交易沟通，建议完善头像与昵称（也可稍后在“我的-资料设置”修改）。
              </TipBanner>
              <Spacer size={12} />
            </>
          ) : null}

          <Surface>
            <SectionHeader title="基本信息" density="compact" />
            <Spacer size={10} />

            <Text className="muted">头像（建议）</Text>
            <Spacer size={6} />
            <View className="row" style={{ gap: '12rpx', flexWrap: 'wrap' }}>
              <Avatar
                size="64"
                src={avatarUrl}
                icon={<Text className="text-strong">{(nickname.trim() || me?.nickname || '用').slice(0, 1)}</Text>}
              />
              {isWeapp ? (
                <>
                  <WxButton className="btn-ghost" openType="chooseAvatar" onChooseAvatar={onChooseAvatar}>
                    选择头像
                  </WxButton>
                  <WxButton className="btn-ghost" onClick={() => void chooseAvatarFromAlbum()}>
                    从相册选择
                  </WxButton>
                </>
              ) : null}
            </View>

            <Spacer size={12} />

            <Text className="muted">昵称（可选）</Text>
            <Spacer size={6} />
            <Input
              value={nickname}
              onChange={setNickname}
              placeholder="设置昵称（可选）"
              clearable
              type={isWeapp ? 'nickname' : undefined}
            />
          </Surface>

          <Spacer size={12} />

          <Surface padding="none">
            <CellGroup divider>
              <CellRow
                title={<Text className="text-strong">地区（可选）</Text>}
                description={<Text className="muted">{regionName || regionCode || '用于地域推荐与展示'}</Text>}
                onClick={() => {
                  Taro.navigateTo({
                    url: '/pages/region-picker/index',
                    success: (res) => {
                      res.eventChannel.on('regionSelected', (v: any) => {
                        if (v?.code) setRegionCode(String(v.code));
                        if (v?.name) setRegionName(String(v.name));
                      });
                    },
                  });
                }}
                isLast
              />
            </CellGroup>
          </Surface>

          <Spacer size={12} />

          <Surface>
            <View className="row" style={{ gap: '12rpx' }}>
              {isOnboarding ? (
                <View style={{ flex: 1 }}>
                  <Button variant="ghost" onClick={goNext}>
                    稍后完善
                  </Button>
                </View>
              ) : null}
              <View style={{ flex: 1 }}>
                <Button onClick={() => void save()}>保存</Button>
              </View>
            </View>
          </Surface>

          {me?.phone ? (
            <>
              <Spacer size={12} />
              <Surface>
                <Text className="muted">手机号：{me.phone}</Text>
              </Surface>
            </>
          ) : null}
        </View>
      )}
    </View>
  );
}
