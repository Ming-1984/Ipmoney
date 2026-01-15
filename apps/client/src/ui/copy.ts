export const TERMS = {
  favorite: '收藏',
  consult: '咨询',
  deposit: '订金',
  finalPayment: '尾款',
  verification: '认证',
  audit: '审核',
} as const;

export const STATE_COPY = {
  loading: {
    title: '加载中…',
    subtitle: '正在挖掘数据金豆矿脉…',
  },
  missing: {
    title: '链接无效',
    message: '页面地址不完整或已失效。',
    actionText: '返回',
  },
  error: {
    title: '加载失败',
    message: '请稍后重试。',
    retryText: '重试',
  },
  empty: {
    title: '暂无数据',
    message: '试试刷新或调整筛选。',
    actionText: '刷新',
  },
  permission: {
    needLogin: {
      title: '需要登录',
      message: '登录后才能继续。',
      actionText: '去登录',
    },
    needOnboarding: {
      title: '需要选择身份',
      message: '完成身份选择后才能继续。',
      actionText: '去选择',
    },
    auditPending: {
      title: '资料审核中',
      message: '审核通过后才能继续。',
      actionText: '查看进度',
    },
    auditRejected: {
      title: '资料已驳回',
      message: '请重新提交资料，审核通过后才能继续。',
      actionText: '重新提交',
    },
    auditRequired: {
      title: '需要认证',
      message: '完成认证并审核通过后才能继续。',
      actionText: '去认证',
    },
  },
} as const;
