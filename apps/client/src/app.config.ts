export default defineAppConfig({
  pages: [
    'pages/home/index',
    'pages/search/index',
    'pages/listing/detail/index',
    'pages/checkout/deposit-pay/index',
    'pages/checkout/deposit-success/index',
    'pages/publish/index',
    'pages/messages/index',
    'pages/me/index',
    'pages/login/index',
    'pages/onboarding/choose-identity/index',
    'pages/onboarding/verification-form/index',
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#FF7A00',
    navigationBarTitleText: 'Ipmoney',
    navigationBarTextStyle: 'white',
  },
  tabBar: {
    color: '#475569',
    selectedColor: '#FF7A00',
    backgroundColor: '#ffffff',
    list: [
      { pagePath: 'pages/home/index', text: '首页' },
      { pagePath: 'pages/search/index', text: '检索' },
      { pagePath: 'pages/publish/index', text: '发布' },
      { pagePath: 'pages/messages/index', text: '消息' },
      { pagePath: 'pages/me/index', text: '我的' }
    ]
  }
});
