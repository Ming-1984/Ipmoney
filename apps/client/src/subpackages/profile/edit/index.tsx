import { Button as TaroButton, Picker, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { API_BASE_URL } from '../../../constants';
import { getToken, setOnboardingDone, setVerificationStatus, setVerificationType } from '../../../lib/auth';
import { apiGet, apiPatch, apiPost } from '../../../lib/api';
import { getDetailCache, setDetailCache } from '../../../lib/detailCache';
import { requireLogin } from '../../../lib/guard';
import { normalizePageUrl } from '../../../lib/navigation';
import { cacheRegionNames, regionDisplayName } from '../../../lib/regions';
import { uploadWithRetry } from '../../../lib/upload';
import { ErrorCard, LoadingCard } from '../../../ui/StateCards';
import { Photograph } from '../../../ui/icons';
import { PageHeader, Spacer, Surface } from '../../../ui/layout';
import { Avatar, Button, Input, toast } from '../../../ui/nutui';

type UserProfile = components['schemas']['UserProfile'];
type FileObject = components['schemas']['FileObject'];

const PROFILE_CACHE_SCOPE = 'me-profile';
const PROFILE_CACHE_KEY = 'self';

export default function ProfileEditPage() {
  const params = useMemo(() => Taro.getCurrentInstance().router?.params || {}, []);
  const env = useMemo(() => Taro.getEnv(), []);
  const isWeapp = env === Taro.ENV_TYPE.WEAPP;
  const canChooseAvatar = useMemo(
    () => isWeapp && typeof (Taro as any).canIUse === 'function' && (Taro as any).canIUse('button.open-type.chooseAvatar'),
    [isWeapp],
  );

  const from = String((params as any)?.from || '');
  const nextType = String((params as any)?.nextType || '');
  const rawNextUrl = ((params as any)?.nextUrl ? decodeURIComponent(String((params as any)?.nextUrl)) : '') || '';
  const nextUrl = useMemo(() => normalizePageUrl(rawNextUrl), [rawNextUrl]);
  const verifyType = String((params as any)?.verifyType || '').trim();
  const isOnboarding = from === 'login';
  const initialCachedProfile = getDetailCache<UserProfile>(PROFILE_CACHE_SCOPE, PROFILE_CACHE_KEY);

  const [loading, setLoading] = useState(!initialCachedProfile);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<UserProfile | null>(initialCachedProfile);

  const [avatarUrl, setAvatarUrl] = useState(initialCachedProfile?.avatarUrl || '');
  const [nickname, setNickname] = useState(initialCachedProfile?.nickname || '');
  const [regionCode, setRegionCode] = useState(initialCachedProfile?.regionCode || '');
  const [regionName, setRegionName] = useState('');

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

  const skip = useCallback(async () => {
    if (verifyType === 'PERSON') {
      try {
        const displayName = nickname.trim() || me?.nickname || '个人用户';
        const res = await apiPost<any>('/me/verification', { type: 'PERSON', displayName });
        setVerificationType('PERSON');
        setVerificationStatus(res?.status || 'APPROVED');
        setOnboardingDone(true);
      } catch {
        // Keep skip available even when backend isn't ready.
      }
    }
    goNext();
  }, [goNext, me?.nickname, nickname, verifyType]);

  const load = useCallback(async () => {
    if (!requireLogin()) return;
    const cached = getDetailCache<UserProfile>(PROFILE_CACHE_SCOPE, PROFILE_CACHE_KEY);
    if (cached) {
      setMe(cached);
      setAvatarUrl(cached.avatarUrl || '');
      setNickname(cached.nickname || '');
      setRegionCode(cached.regionCode || '');
      setRegionName('');
      setLoading(false);
      setError(null);
    } else {
      setLoading(true);
      setError(null);
    }
    try {
      const d = await apiGet<UserProfile>('/me');
      setMe(d);
      setAvatarUrl(d.avatarUrl || '');
      setNickname(d.nickname || '');
      setRegionCode(d.regionCode || '');
      setRegionName('');
      setDetailCache(PROFILE_CACHE_SCOPE, PROFILE_CACHE_KEY, d);
    } catch (e: any) {
      if (!cached) {
        setError(e?.message || '加载失败');
        setMe(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const uploadAvatarFromPath = useCallback(async (tempPath: string) => {
    let trimmed = String(tempPath || '').trim();
    if (!trimmed) return false;

    let localPath = trimmed;
    if (/^https?:\/\//i.test(localPath)) {
      try {
        const info = await Taro.getImageInfo({ src: localPath });
        if (info?.path) localPath = info.path;
      } catch {
        // ignore and fallback
      }
    }
    try {
      const res = await Taro.saveFile({ tempFilePath: localPath });
      const savedPath = String((res as any)?.savedFilePath || '').trim();
      if (savedPath) localPath = savedPath;
    } catch {
      // ignore and fallback
    }

    try {
      const token = getToken();
      const uploadRes = await uploadWithRetry({
        url: `${API_BASE_URL}/files`,
        filePath: localPath,
        name: 'file',
        formData: { purpose: 'AVATAR' },
        header: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        retry: 1,
      });

      if (uploadRes.statusCode >= 200 && uploadRes.statusCode < 300) {
        const parsed = JSON.parse(String(uploadRes.data || '{}')) as Partial<FileObject>;
        if (typeof parsed.url === 'string' && parsed.url && String(parsed.mimeType || '').startsWith('image/')) {
          setAvatarUrl(parsed.url);
          return true;
        }
      }
    } catch {
      // ignore upload failure and use local path fallback
    }

    setAvatarUrl(localPath);
    return true;
  }, []);

  const chooseAvatarFromAlbum = useCallback(async () => {
    try {
      const res = await Taro.chooseImage({ count: 1, sizeType: ['compressed'], sourceType: ['album'] });
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

  const handleChooseAvatar = useCallback(
    async (e: any) => {
      const tempPath = String(e?.detail?.avatarUrl || '').trim();
      if (!tempPath) {
        toast('头像读取失败，请重试');
        return;
      }
      let resolvedPath = tempPath;
      if (/^https?:\/\//i.test(resolvedPath)) {
        try {
          const info = await Taro.getImageInfo({ src: resolvedPath });
          if (info?.path) resolvedPath = info.path;
        } catch {
          toast('头像读取失败，请重试');
          return;
        }
      }
      await uploadAvatarFromPath(resolvedPath);
    },
    [uploadAvatarFromPath],
  );

  const save = useCallback(async () => {
    if (!requireLogin()) return;
    const nick = nickname.trim();
    const avatar = avatarUrl.trim();
    const region = regionCode.trim();

    if (!avatar) {
      toast('请先选择头像');
      return;
    }
    if (!nick) {
      toast('请先设置昵称');
      return;
    }
    if (!region) {
      toast('请选择地区');
      return;
    }
    if (nick.length > 50) {
      toast('昵称最多 50 个字符');
      return;
    }

    try {
      const d = await apiPatch<UserProfile>('/me', {
        nickname: nick,
        avatarUrl: avatar,
        regionCode: region,
      });
      setMe(d);
      setDetailCache(PROFILE_CACHE_SCOPE, PROFILE_CACHE_KEY, d);

      if (verifyType === 'PERSON') {
        const res = await apiPost<any>('/me/verification', { type: 'PERSON', displayName: nick });
        setVerificationType('PERSON');
        setVerificationStatus(res?.status || 'APPROVED');
        setOnboardingDone(true);
        toast('注册成功', { icon: 'success' });
      } else {
        toast('已保存', { icon: 'success' });
      }

      setTimeout(() => goNext(), 200);
    } catch (e: any) {
      toast(e?.message || '保存失败');
    }
  }, [avatarUrl, goNext, nickname, regionCode, verifyType]);

  const regionText = useMemo(() => regionDisplayName(regionCode, regionName, ''), [regionCode, regionName]);

  const handleRegionPick = useCallback((e: any) => {
    const names = Array.isArray(e?.detail?.value) ? e.detail.value : [];
    const codes = Array.isArray(e?.detail?.code) ? e.detail.code : [];
    const normalizedNames = names.map((name: any) => String(name || '').trim()).filter(Boolean);
    const normalizedCodes = codes.map((code: any) => String(code || '').trim()).filter(Boolean);

    const code = normalizedCodes[normalizedCodes.length - 1] || '';
    const name = normalizedNames[normalizedNames.length - 1] || '';
    if (code) setRegionCode(code);
    if (name) setRegionName(name);

    cacheRegionNames(
      normalizedCodes.map((c: string, idx: number) => ({
        code: c,
        name: normalizedNames[idx] || '',
      })),
    );
  }, []);

  return (
    <View className="container profile-edit-page">
      <PageHeader title="资料设置" subtitle="更新头像、昵称和地区，用于展示与推荐" />
      <Spacer />

      {loading ? (
        <LoadingCard />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : (
        <View>
          {isOnboarding ? (
            <View className="profile-hint">
              <Text className="profile-hint-title">完善资料</Text>
              <Text className="profile-hint-desc">为了便于咨询与交易沟通，请完善头像、昵称与地区。</Text>
            </View>
          ) : null}

          <Surface padding="none" className="profile-card">
            <View className="profile-card-section profile-form">
              <View className="form-field">
                <Text className="form-label">头像</Text>
                <View className="profile-avatar-row">
                  <View
                    className="profile-avatar-picker"
                    onClick={() => {
                      if (!isWeapp) {
                        void chooseAvatarFromAlbum();
                        return;
                      }
                      if (!canChooseAvatar) {
                        toast('微信版本过低，请升级后重试');
                      }
                    }}
                  >
                    <Avatar
                      size="96"
                      src={avatarUrl}
                      icon={<Text className="text-strong">{(nickname.trim() || me?.nickname || 'U').slice(0, 1)}</Text>}
                    />
                    {isWeapp && canChooseAvatar ? (
                      <TaroButton className="profile-avatar-choose" openType="chooseAvatar" onChooseAvatar={handleChooseAvatar} />
                    ) : null}
                    {isWeapp ? (
                      <View className="profile-avatar-camera">
                        <Photograph size={18} color="#fff" />
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>

              <View className="form-field">
                <Text className="form-label">昵称</Text>
                <Input
                  value={nickname}
                  onChange={setNickname}
                  placeholder="请输入昵称"
                  clearable
                  type={isWeapp ? 'nickname' : undefined}
                  placeholderClass="profile-placeholder"
                  placeholderStyle="font-size:20rpx;color:#c0c4cc;"
                />
              </View>

              <View className="form-field">
                <Text className="form-label">地区</Text>
                {isWeapp ? (
                  <Picker mode="region" level="region" onChange={handleRegionPick}>
                    <View className="form-select">
                      <Text className={regionCode.trim() ? 'form-select-value' : 'form-select-placeholder'}>
                        {regionCode.trim() ? regionText : '请选择'}
                      </Text>
                      <Text className="form-select-arrow">›</Text>
                    </View>
                  </Picker>
                ) : (
                  <View
                    className="form-select"
                    onClick={() => {
                      Taro.navigateTo({
                        url: '/subpackages/region-picker/index',
                        success: (res) => {
                          res.eventChannel.on('regionSelected', (v: any) => {
                            if (v?.code) setRegionCode(String(v.code));
                            if (v?.name) setRegionName(String(v.name));
                          });
                        },
                      });
                    }}
                  >
                    <Text className={regionCode.trim() ? 'form-select-value' : 'form-select-placeholder'}>
                      {regionCode.trim() ? regionText : '请选择'}
                    </Text>
                    <Text className="form-select-arrow">›</Text>
                  </View>
                )}
              </View>
            </View>
          </Surface>

          <View className="profile-actions">
            <Button className="profile-primary-btn" onClick={() => void save()}>
              保存
            </Button>
            {isOnboarding ? (
              <Text className="profile-skip" onClick={() => void skip()}>
                稍后完善
              </Text>
            ) : null}
          </View>

          {me?.phone ? <Text className="profile-phone">手机号：{me.phone}</Text> : null}
        </View>
      )}
    </View>
  );
}
