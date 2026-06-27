import { Button as TaroButton, Picker, Text, View } from '@tarojs/components';
import Taro, { useDidHide, useDidShow } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { API_BASE_URL } from '../../../constants';
import { getToken, setOnboardingDone, setVerificationStatus, setVerificationType } from '../../../lib/auth';
import { apiGet, apiPatch, apiPost } from '../../../lib/api';
import { getDetailCache, setDetailCache } from '../../../lib/detailCache';
import { displayInitial, displayUserName, normalizeDisplayText } from '../../../lib/displayText';
import { requireLogin } from '../../../lib/guard';
import { normalizePageUrl, safeNavigateBack } from '../../../lib/navigation';
import {
  cacheProfileRegionPathName,
  ensureRegionNamesReady,
  formatRegionPathNames,
  parseRegionPickerSelection,
  profileRegionDisplayName,
} from '../../../lib/regions';
import { useRouteStringParam } from '../../../lib/routeParams';
import { chooseImageFiles, uploadFileToApi } from '../../../lib/upload';
import { ErrorCard, LoadingCard } from '../../../ui/StateCards';
import { Photograph } from '../../../ui/icons';
import { PageHeader, Spacer, Surface } from '../../../ui/layout';
import { Avatar, Input, toast } from '../../../ui/nutui';

type UserProfile = components['schemas']['UserProfile'];
type FileObject = components['schemas']['FileObject'];

const PROFILE_CACHE_SCOPE = 'me-profile';
const PROFILE_CACHE_KEY = 'self';
const PLACEHOLDER_NICKNAMES = new Set(['New User']);

function buildPublicUploadUrl(fileName?: string | null): string {
  const safeName = String(fileName || '').trim().split(/[\\/]/).filter(Boolean).pop() || '';
  if (!safeName) return '';
  return `${API_BASE_URL.replace(/\/$/, '')}/uploads/${encodeURIComponent(safeName)}`;
}

async function saveTempFilePath(tempFilePath: string): Promise<string> {
  const fs =
    typeof (Taro as any).getFileSystemManager === 'function' ? (Taro as any).getFileSystemManager() : null;
  if (fs && typeof fs.saveFile === 'function') {
    return await new Promise<string>((resolve, reject) => {
      fs.saveFile({
        tempFilePath,
        success: (res: any) => resolve(String(res?.savedFilePath || '').trim()),
        fail: reject,
      });
    });
  }

  const res = await Taro.saveFile({ tempFilePath });
  return String((res as any)?.savedFilePath || '').trim();
}

function normalizeNicknameInput(value: string | null | undefined): string {
  const normalized = normalizeDisplayText(value);
  if (!normalized) return '';
  if (PLACEHOLDER_NICKNAMES.has(normalized)) return '';
  return normalized;
}

export default function ProfileEditPage() {
  const env = useMemo(() => Taro.getEnv(), []);
  const isWeapp = env === Taro.ENV_TYPE.WEAPP;
  const canChooseAvatar = useMemo(
    () => isWeapp && typeof (Taro as any).canIUse === 'function' && (Taro as any).canIUse('button.open-type.chooseAvatar'),
    [isWeapp],
  );

  const from = useRouteStringParam('from') || '';
  const nextType = useRouteStringParam('nextType') || '';
  const nextUrlParam = useRouteStringParam('nextUrl') || '';
  const rawNextUrl = nextUrlParam ? decodeURIComponent(String(nextUrlParam)) : '';
  const nextUrl = useMemo(() => normalizePageUrl(rawNextUrl), [rawNextUrl]);
  const verifyType = (useRouteStringParam('verifyType') || '').trim();
  const isOnboarding = from === 'login';
  const initialCachedProfile = getDetailCache<UserProfile>(PROFILE_CACHE_SCOPE, PROFILE_CACHE_KEY);

  const [loading, setLoading] = useState(!initialCachedProfile);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<UserProfile | null>(initialCachedProfile);

  const [avatarUrl, setAvatarUrl] = useState(initialCachedProfile?.avatarUrl || '');
  const [avatarRemoteReady, setAvatarRemoteReady] = useState(Boolean(initialCachedProfile?.avatarUrl));
  const [nickname, setNickname] = useState(normalizeNicknameInput(initialCachedProfile?.nickname || ''));
  const [regionCode, setRegionCode] = useState(initialCachedProfile?.regionCode || '');
  const [regionName, setRegionName] = useState('');
  const pageVisibleRef = useRef(true);
  const loadSeqRef = useRef(0);
  const uploadSeqRef = useRef(0);
  const saveSeqRef = useRef(0);
  const skipSeqRef = useRef(0);
  const actionBusyRef = useRef(false);
  const selectedRegionNameRef = useRef('');

  useEffect(() => {
    void ensureRegionNamesReady();
  }, []);

  useDidShow(() => {
    pageVisibleRef.current = true;
  });

  useDidHide(() => {
    pageVisibleRef.current = false;
    loadSeqRef.current += 1;
    uploadSeqRef.current += 1;
    saveSeqRef.current += 1;
    skipSeqRef.current += 1;
  });

  const goNext = useCallback(() => {
    if (nextType === 'redirectTo' && nextUrl) {
      Taro.redirectTo({ url: nextUrl });
      return;
    }
    if (nextType === 'switchTab' && nextUrl) {
      Taro.switchTab({ url: nextUrl });
      return;
    }
    void safeNavigateBack({ fallbackUrl: '/pages/me/index' });
  }, [nextType, nextUrl]);

  const resolvedDisplayName = useMemo(() => displayUserName(me, ''), [me]);
  const displayInitialText = useMemo(
    () => displayInitial(normalizeNicknameInput(nickname) || normalizeNicknameInput(resolvedDisplayName), '平'),
    [nickname, resolvedDisplayName],
  );

  const skip = useCallback(async () => {
    const seq = ++skipSeqRef.current;
    if (verifyType === 'PERSON') {
      try {
        const displayName = normalizeNicknameInput(nickname) || normalizeNicknameInput(resolvedDisplayName);
        if (displayName) {
          const res = await apiPost<any>('/me/verification', { type: 'PERSON', displayName });
          if (seq !== skipSeqRef.current || !pageVisibleRef.current) return;
          setVerificationType('PERSON');
          if (res?.status) setVerificationStatus(res.status);
          setOnboardingDone(true);
        }
      } catch {
        // Keep skip available even when backend isn't ready.
      }
    }
    if (seq !== skipSeqRef.current || !pageVisibleRef.current) return;
    goNext();
  }, [goNext, nickname, resolvedDisplayName, verifyType]);

  const load = useCallback(async () => {
    if (!requireLogin()) return;
    const seq = ++loadSeqRef.current;
    const cached = getDetailCache<UserProfile>(PROFILE_CACHE_SCOPE, PROFILE_CACHE_KEY);
    if (cached) {
      setMe(cached);
      setAvatarUrl(cached.avatarUrl || '');
      setAvatarRemoteReady(Boolean(cached.avatarUrl));
      setNickname(normalizeNicknameInput(cached.nickname || ''));
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
      if (seq !== loadSeqRef.current) return;
      setMe(d);
      setAvatarUrl(d.avatarUrl || '');
      setAvatarRemoteReady(Boolean(d.avatarUrl));
      setNickname(normalizeNicknameInput(d.nickname || ''));
      setRegionCode(d.regionCode || '');
      setRegionName('');
      setDetailCache(PROFILE_CACHE_SCOPE, PROFILE_CACHE_KEY, d);
    } catch (e: any) {
      if (seq !== loadSeqRef.current) return;
      if (!cached) {
        setError(e?.message || '加载失败');
        setMe(null);
      }
    } finally {
      if (seq === loadSeqRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const uploadAvatarFromPath = useCallback(async (tempPath: string) => {
    const seq = ++uploadSeqRef.current;
    let localPath = String(tempPath || '').trim();
    if (!localPath) return false;

    if (/^https?:\/\//i.test(localPath)) {
      try {
        const info = await Taro.getImageInfo({ src: localPath });
        if (info?.path) localPath = info.path;
      } catch {
        // ignore and fallback
      }
    }
    try {
      const savedPath = await saveTempFilePath(localPath);
      if (savedPath) localPath = savedPath;
    } catch {
      // ignore and fallback
    }

    try {
      const token = getToken();
      const { data: parsed } = await uploadFileToApi<Partial<FileObject>>({
        url: `${API_BASE_URL}/files`,
        filePath: localPath,
        name: 'file',
        formData: { purpose: 'AVATAR' },
        header: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        retry: 1,
      });

      if (typeof parsed.url === 'string' && parsed.url && String(parsed.mimeType || '').startsWith('image/')) {
        if (seq !== uploadSeqRef.current || !pageVisibleRef.current) return false;
        setAvatarUrl(buildPublicUploadUrl(parsed.fileName) || parsed.url);
        setAvatarRemoteReady(true);
        return true;
      }
      throw new Error('头像上传失败');
    } catch {
      // ignore and show explicit failure below
    }

    if (seq !== uploadSeqRef.current || !pageVisibleRef.current) return false;
    setAvatarRemoteReady(false);
    toast('头像上传失败，请重试');
    return true;
  }, []);

  const chooseAvatarFromWechat = useCallback(async () => {
    try {
      const res = await chooseImageFiles({ count: 1 });
      const tempPath = String(res[0]?.path || '').trim();
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

  const handleRegionChange = useCallback((event: any) => {
    const parsed = parseRegionPickerSelection(event);
    if (!parsed) {
      toast('地区读取失败，请重试');
      return;
    }
    setRegionCode(parsed.code);
    const nextRegionName = formatRegionPathNames(parsed.pathNames, parsed.name);
    selectedRegionNameRef.current = nextRegionName;
    setRegionName(nextRegionName);
  }, []);

  const save = useCallback(async () => {
    if (actionBusyRef.current) return;
    if (!requireLogin()) return;
    actionBusyRef.current = true;
    const seq = ++saveSeqRef.current;
    const nick = normalizeNicknameInput(nickname);
    const avatar = avatarRemoteReady ? normalizeDisplayText(avatarUrl) : '';
    const region = normalizeDisplayText(regionCode);

    if (!avatar && verifyType !== 'PERSON') {
      toast('请先选择头像');
      actionBusyRef.current = false;
      return;
    }
    if (!nick) {
      toast('请先设置昵称，不能使用默认昵称');
      actionBusyRef.current = false;
      return;
    }
    if (nick.length > 50) {
      toast('昵称最多 50 个字符');
      actionBusyRef.current = false;
      return;
    }

    try {
      const currentNick = normalizeNicknameInput(me?.nickname || '');
      const currentAvatar = normalizeDisplayText(me?.avatarUrl || '');
      const currentRegion = normalizeDisplayText(me?.regionCode || '');
      const profilePatch = {
        ...(nick !== currentNick ? { nickname: nick } : {}),
        ...(avatar && avatar !== currentAvatar ? { avatarUrl: avatar } : {}),
        ...(region && region !== currentRegion ? { regionCode: region } : {}),
      };
      const d =
        Object.keys(profilePatch).length > 0
          ? await apiPatch<UserProfile>('/me', profilePatch)
          : me || (await apiGet<UserProfile>('/me'));
      if (seq !== saveSeqRef.current || !pageVisibleRef.current) return;
      cacheProfileRegionPathName(d.id, d.regionCode, selectedRegionNameRef.current || regionName);
      setMe(d);
      setDetailCache(PROFILE_CACHE_SCOPE, PROFILE_CACHE_KEY, d);

      if (verifyType === 'PERSON') {
        const verificationDisplayName = nick || normalizeNicknameInput(resolvedDisplayName);
        const res = await apiPost<any>('/me/verification', { type: 'PERSON', displayName: verificationDisplayName });
        if (seq !== saveSeqRef.current || !pageVisibleRef.current) return;
        setVerificationType('PERSON');
        if (res?.status) setVerificationStatus(res.status);
        setOnboardingDone(true);
        toast('注册成功', { icon: 'success' });
      } else {
        toast('已保存', { icon: 'success' });
      }

      setTimeout(() => {
        if (seq !== saveSeqRef.current || !pageVisibleRef.current) return;
        goNext();
      }, 200);
    } catch (e: any) {
      if (seq !== saveSeqRef.current || !pageVisibleRef.current) return;
      if (process.env.NODE_ENV !== 'production') {
        console.error('[profile-edit] save failed', e);
      }
      toast(e?.message || '保存失败');
    } finally {
      if (seq === saveSeqRef.current) {
        actionBusyRef.current = false;
      }
    }
  }, [avatarUrl, goNext, me, nickname, regionCode, regionName, resolvedDisplayName, verifyType]);

  const regionText = useMemo(
    () => profileRegionDisplayName(me?.id, regionCode, regionName, ''),
    [me?.id, regionCode, regionName],
  );

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
                        void chooseAvatarFromWechat();
                        return;
                      }
                      if (!canChooseAvatar) {
                        void chooseAvatarFromWechat();
                      }
                    }}
                  >
                    <Avatar size="96" src={avatarUrl} icon={<Text className="text-strong">{displayInitialText}</Text>} />
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
                <Picker mode="region" level="region" onChange={handleRegionChange}>
                  <View className="form-select">
                    <Text className={regionCode.trim() ? 'form-select-value' : 'form-select-placeholder'}>
                      {regionCode.trim() ? regionText : '请选择'}
                    </Text>
                    <Text className="form-select-arrow">{'>'}</Text>
                  </View>
                </Picker>
              </View>
            </View>
          </Surface>

          <View className="profile-actions">
            <TaroButton className="profile-primary-btn profile-primary-native-btn" onClick={() => void save()}>
              保存
            </TaroButton>
            {isOnboarding ? (
              <TaroButton className="profile-skip-btn" plain onClick={() => void skip()}>
                稍后完善
              </TaroButton>
            ) : null}
          </View>

          {me?.phone ? <Text className="profile-phone">手机号：{me.phone}</Text> : null}
        </View>
      )}
    </View>
  );
}
