import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React from 'react';

import { usePageAccess } from '../../lib/guard';
import { AccessGate } from '../../ui/PageState';
import { CellGroup } from '../../ui/nutui';
import { CellRow, PageHeader, Spacer, Surface } from '../../ui/layout';

export default function PublishPage() {
  const access = usePageAccess('approved-required');

    return (
      <View className="container">
      <PageHeader title="发布" />
      <Spacer />

      {access.state !== 'ok' ? (
        <AccessGate
          access={access}
          loginMessage="登录后才能发布内容。"
          onboardingMessage="首次进入请先选择身份。"
          pendingMessage="资料审核中，通过后才能发布内容。"
          rejectedMessage="资料已驳回，请重新提交后再发布。"
          auditRequiredMessage="完成认证并审核通过后才能发布内容。"
        />
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
                title={<Text className="text-strong">发布书画专区</Text>}
                description={<Text className="muted">书画作品交易，支持订金+尾款</Text>}
                onClick={() => {
                  Taro.navigateTo({ url: '/pages/publish/artwork/index' });
                }}
              />
              <CellRow
                clickable
                title={<Text className="text-strong">发布产学研需求</Text>}
                description={<Text className="muted">发布后进入审核；通过后可被检索与咨询</Text>}
                onClick={() => {
                  Taro.navigateTo({ url: '/pages/publish/demand/index' });
                }}
              />
              <CellRow
                clickable
                title={<Text className="text-strong">发布成果展示</Text>}
                description={<Text className="muted">支持图片/视频/附件；通过后对外展示</Text>}
                isLast
                onClick={() => {
                  Taro.navigateTo({ url: '/pages/publish/achievement/index' });
                }}
              />
            </CellGroup>
          </Surface>

          <Spacer size={12} />

          <Surface padding="none">
            <CellGroup divider>
              <CellRow
                clickable
                title={<Text className="text-strong">管理专利上架</Text>}
                description={<Text className="muted">查看/编辑/下架自己的专利上架信息</Text>}
                onClick={() => {
                  Taro.navigateTo({ url: '/pages/my-listings/index' });
                }}
              />
              <CellRow
                clickable
                title={<Text className="text-strong">管理我的需求</Text>}
                description={<Text className="muted">查看/编辑/下架自己的产学研需求</Text>}
                onClick={() => {
                  Taro.navigateTo({ url: '/pages/my-demands/index' });
                }}
              />
              <CellRow
                clickable
                title={<Text className="text-strong">管理我的成果</Text>}
                description={<Text className="muted">查看/编辑/下架自己的成果展示</Text>}
                onClick={() => {
                  Taro.navigateTo({ url: '/pages/my-achievements/index' });
                }}
              />
              <CellRow
                clickable
                title={<Text className="text-strong">管理我的书画</Text>}
                description={<Text className="muted">查看/编辑/下架自己的书画作品</Text>}
                isLast
                onClick={() => {
                  Taro.navigateTo({ url: '/pages/my-artworks/index' });
                }}
              />
            </CellGroup>
          </Surface>

          <Spacer size={12} />

          <Surface>
            <Text className="muted">发布后将进入平台审核；审核通过后对外展示（专利/书画/需求/成果）。</Text>
          </Surface>
        </View>
      )}
    </View>
  );
}
