import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React from 'react';

import { getToken, getVerificationStatus, isOnboardingDone } from '../../lib/auth';
import { Button, CellGroup } from '../../ui/nutui';
import { CellRow, PageHeader, Spacer, Surface } from '../../ui/layout';
import { AuditPendingCard } from '../../ui/StateCards';

export default function PublishPage() {
  const token = getToken();
  const onboardingDone = isOnboardingDone();
  const verificationStatus = getVerificationStatus();

  return (
    <View className="container">
      <PageHeader
        variant="hero"
        title="发布"
        subtitle="发布前需完成登录与身份选择；非个人需后台审核通过。"
      />
      <Spacer />

      {!token ? (
        <Surface>
          <Button
            onClick={() => {
              Taro.navigateTo({ url: '/pages/login/index' });
            }}
          >
            登录后发布
          </Button>
        </Surface>
      ) : !onboardingDone ? (
        <Surface>
          <Button
            onClick={() => {
              Taro.navigateTo({ url: '/pages/onboarding/choose-identity/index' });
            }}
          >
            首次进入：选择身份
          </Button>
        </Surface>
      ) : verificationStatus !== 'APPROVED' ? (
        <View>
          <AuditPendingCard
            title={verificationStatus === 'REJECTED' ? '资料已驳回' : '资料审核中'}
            message={
              verificationStatus === 'REJECTED'
                ? '请重新提交资料，审核通过后才能发布。'
                : '审核通过后才能发布。'
            }
          />
          <Spacer size={12} />
          <Surface>
            <Button
              variant="ghost"
              onClick={() => {
                Taro.navigateTo({ url: '/pages/onboarding/choose-identity/index' });
              }}
            >
              {verificationStatus === 'REJECTED' ? '重新提交资料' : '查看认证进度'}
            </Button>
          </Surface>
        </View>
      ) : (
        <View>
          <Surface padding="none">
            <CellGroup divider>
              <CellRow
                clickable
                title={<Text className="text-strong">发布专利交易</Text>}
                description={<Text className="muted">专利转让/许可，上架后可被检索</Text>}
                onClick={() => {
                  Taro.navigateTo({ url: '/pages/publish/patent/index' });
                }}
              />
              <CellRow
                clickable
                title={<Text className="text-strong">发布产学研需求</Text>}
                description={<Text className="muted">需求对接与供需撮合（建设中）</Text>}
                onClick={() => {
                  Taro.navigateTo({ url: '/pages/publish/demand/index' });
                }}
              />
              <CellRow
                clickable
                title={<Text className="text-strong">发布成果展示</Text>}
                description={<Text className="muted">成果信息展示与咨询入口（建设中）</Text>}
                isLast
                onClick={() => {
                  Taro.navigateTo({ url: '/pages/publish/achievement/index' });
                }}
              />
            </CellGroup>
          </Surface>

          <Spacer size={12} />

          <Surface>
            <Text className="muted">发布后将进入后台审核；审核通过后对外展示。</Text>
          </Surface>
        </View>
      )}
    </View>
  );
}
