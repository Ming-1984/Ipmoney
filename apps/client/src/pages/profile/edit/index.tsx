import { View, Text, Button as WxButton } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { API_BASE_URL } from '../../../constants';
import { getToken } from '../../../lib/auth';
import { apiGet, apiPatch } from '../../../lib/api';
import { requireLogin } from '../../../lib/guard';
import { regionDisplayName } from '../../../lib/regions';
import { CellRow, PageHeader, Spacer, Surface } from '../../../ui/layout';
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

  const regionText = useMemo(
    () => regionDisplayName(regionCode, regionName, '用于地区推荐与展示'),
    [regionCode, regionName],
  );

  return (
    <View className="container profile-edit-page">
      <PageHeader title="资料设置" subtitle="更新头像/昵称/地区，用于展示与地域推荐" />
      <Spacer />

      {loading ? (
        <LoadingCard />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : (
        <View>
          {isOnboarding ? (
            <View className="profile-hint">
              <Text className="profile-hint-title">建议完善资料</Text>
              <Text className="profile-hint-desc">
                为了便于咨询与交易沟通，建议完善头像与昵称（也可稍后在“我的-资料设置”修改）。
              </Text>
            </View>
          ) : null}

          <Surface padding="none" className="profile-card">
            <View className="profile-card-section">
              <Text className="profile-label">头像（建议）</Text>
              <View className="profile-avatar-block">
                <Avatar
                  size="72"
                  src={avatarUrl}
                  icon={<Text className="text-strong">{(nickname.trim() || me?.nickname || '用').slice(0, 1)}</Text>}
                />
                {isWeapp ? (
                  <View className="profile-avatar-actions">
                    <WxButton
                      className="btn-ghost profile-avatar-btn profile-avatar-btn-primary"
                      openType="chooseAvatar"
                      onChooseAvatar={onChooseAvatar}
                    >
                      选择头像
                    </WxButton>
                    <WxButton
                      className="btn-ghost profile-avatar-btn profile-avatar-btn-secondary"
                      onClick={() => void chooseAvatarFromAlbum()}
                    >
                      从相册选择
                    </WxButton>
                  </View>
                ) : null}
              </View>

              <View className="profile-field">
                <Text className="profile-label">昵称（可选）</Text>
                <Input
                  value={nickname}
                  onChange={setNickname}
                  placeholder="设置昵称（可选）"
                  clearable
                  type={isWeapp ? 'nickname' : undefined}
                />
              </View>
            </View>

            <CellGroup divider>
              <CellRow
                title={<Text className="text-strong">地区（可选）</Text>}
                description={<Text className="muted">{regionText}</Text>}
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

          <View className="profile-actions">
            <Button className="profile-primary-btn" onClick={() => void save()}>
              保存
            </Button>
            {isOnboarding ? (
              <Text className="profile-skip" onClick={goNext}>
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
