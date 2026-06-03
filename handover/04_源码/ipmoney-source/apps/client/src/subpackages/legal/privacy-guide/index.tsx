import { Text, View } from '@tarojs/components';
import React from 'react';
import './index.scss';

import { PageHeader, Spacer, Surface } from '../../../ui/layout';

type Section = {
  title: string;
  paragraphs: string[];
};

const VERSION = '2026年5月11日';
const PLATFORM_NAME = 'Ipmoney';
const CONTACT_PHONE = '13925106699';

const SECTIONS: Section[] = [
  {
    title: '一、指引说明',
    paragraphs: [
      `本指引用于说明“${PLATFORM_NAME}”小程序中与个人信息相关的具体功能场景、调用目的、拒绝影响和撤回方式，帮助你在授权前充分知情。`,
      '本指引是《隐私政策》的补充说明；如与《隐私政策》不一致，以《隐私政策》及法律法规要求为准。',
    ],
  },
  {
    title: '二、需要你主动触发的能力',
    paragraphs: [
      '1. 微信手机号能力：当你点击“一键授权手机号”时，我们会申请获取你的手机号，用于绑定账号、咨询联系、交易沟通与安全校验。你拒绝授权不会影响浏览功能，但可能影响部分咨询和交易功能。',
      '2. 头像选择能力：当你点击选择头像时，我们会获取你主动选择的头像内容，用于资料设置与页面展示。拒绝授权不影响浏览，但会影响头像完善。',
      '3. 相册/拍摄图片能力：当你上传认证材料、发布图片、认领材料、头像或其他图片时，我们会在你主动选择后处理相关图片文件，用于审核、展示、履约或存证。',
      '4. 文件选择能力：当你上传合同 PDF 等文件时，我们会在你主动选择后处理文件，用于合同流转、确认和履约管理。',
      '5. 拨号能力：当你点击客服热线时，我们会调用系统拨号能力，便于你联系平台客服。',
    ],
  },
  {
    title: '三、我们不会在后台偷偷开启的能力',
    paragraphs: [
      '本小程序不会在你不知情的情况下后台启用通讯录、定位、麦克风、通讯内容读取等与当前业务无关的能力。',
      '如后续版本新增涉及个人信息的新功能、新接口或新场景，我们会在功能启用前通过隐私指引、隐私政策更新、弹窗提示或重新授权等方式另行说明。',
    ],
  },
  {
    title: '四、撤回授权与管理方式',
    paragraphs: [
      '你可以通过微信客户端的小程序权限设置撤回相关授权，也可以在平台内删除已上传的部分资料、修改头像昵称、更新地址等。',
      '撤回后，可能导致对应功能无法继续使用。例如，撤回手机号相关授权后，你可能需要改用短信登录或手动补充联系信息。',
    ],
  },
  {
    title: '五、联系我们',
    paragraphs: [
      `如果你对本指引或小程序隐私处理有疑问，可通过平台客服或隐私联系渠道与我们联系。当前指引版本发布日期为${VERSION}。`,
      `当前已确认客服电话为${CONTACT_PHONE}。由于你暂未提供隐私联系邮箱，邮箱字段请在后续补充后同步更新至小程序后台与正式隐私政策。`,
    ],
  },
];

export default function PrivacyGuidePage() {
  return (
    <View className="container legal-page">
      <PageHeader weapp back title="用户隐私保护指引" subtitle={`版本发布日期：${VERSION}`} />
      <Spacer />
      <View className="legal-list">
        {SECTIONS.map((section, idx) => (
          <Surface key={`${section.title}-${idx}`} className="legal-card">
            <Text className="legal-title">{section.title}</Text>
            <View className="legal-body">
              {section.paragraphs.map((paragraph, paragraphIdx) => (
                <Text key={`${section.title}-${paragraphIdx}`} className="legal-paragraph">
                  {paragraph}
                </Text>
              ))}
            </View>
          </Surface>
        ))}
      </View>
    </View>
  );
}
