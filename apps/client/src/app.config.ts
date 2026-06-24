const isDev = process.env.NODE_ENV !== 'production';

const enablePreload = String(process.env.TARO_APP_ENABLE_PRELOAD || '').trim().toLowerCase() === 'true';

const preloadRule: Record<string, { network: 'all' | 'wifi'; packages: string[] }> = {
  'pages/home/index': {
    network: 'all',
    packages: [
      'subpackages/search',
      'subpackages/listing',
      'subpackages/achievement',
      'subpackages/inventors',
      'subpackages/patent-map',
      'subpackages/patent-square',
      'subpackages/home-announcements',
      'subpackages/media',
    ],
  },
  'pages/tech-managers/index': {
    network: 'all',
    packages: ['subpackages/organizations', 'subpackages/tech-managers'],
  },
  'pages/messages/index': {
    network: 'all',
    packages: ['subpackages/messages', 'subpackages/notifications'],
  },
  'pages/me/index': {
    network: 'all',
    packages: [
      'subpackages/orders',
      'subpackages/publish',
      'subpackages/checkout',
      'subpackages/favorites',
      'subpackages/my-achievements',
      'subpackages/patent-claims',
      'subpackages/maintenance',
    ],
  },
};

export default defineAppConfig({
  __usePrivacyCheck__: true,
  pages: [
    'pages/home/index',
    'pages/tech-managers/index',
    'pages/publish/index',
    'pages/messages/index',
    'pages/me/index',
  ],
  lazyCodeLoading: 'requiredComponents',
  subPackages: [
    {
      root: 'subpackages/search',
      pages: ['index'],
    },
    {
      root: 'subpackages/patent',
      pages: ['detail/index'],
    },
    {
      root: 'subpackages/orders',
      pages: ['index', 'detail/index'],
    },
    {
      root: 'subpackages/checkout',
      pages: ['deposit-pay/index', 'deposit-success/index', 'final-pay/index', 'final-success/index'],
    },
    {
      root: 'subpackages/publish',
      pages: ['patent/index', 'achievement/index'],
    },
    {
      root: 'subpackages/messages',
      pages: ['chat/index'],
    },
    {
      root: 'subpackages/support',
      pages: ['index', 'faq/index', 'faq/detail/index', 'contact/index'],
    },
    {
      root: 'subpackages/legal',
      pages: ['privacy/index', 'terms/index', 'privacy-guide/index'],
    },
    {
      root: 'subpackages/onboarding',
      pages: ['choose-identity/index', 'verification-form/index'],
    },
    {
      root: 'subpackages/notifications',
      pages: ['index', 'detail/index'],
    },
    {
      root: 'subpackages/home-announcements',
      pages: ['index', 'detail/index'],
    },
    {
      root: 'subpackages/listing',
      pages: ['detail/index'],
    },
    {
      root: 'subpackages/achievement',
      pages: ['detail/index'],
    },
    {
      root: 'subpackages/favorites',
      pages: ['index'],
    },
    {
      root: 'subpackages/organizations',
      pages: ['index', 'detail/index'],
    },
    {
      root: 'subpackages/inventors',
      pages: ['index'],
    },
    {
      root: 'subpackages/patent-map',
      pages: ['index'],
    },
    {
      root: 'subpackages/patent-square',
      pages: ['index'],
    },
    {
      root: 'subpackages/tech-managers',
      pages: ['detail/index'],
    },
    {
      root: 'subpackages/trade-rules',
      pages: ['index'],
    },
    {
      root: 'subpackages/contracts',
      pages: ['index'],
    },
    {
      root: 'subpackages/invoices',
      pages: ['index'],
    },
    {
      root: 'subpackages/addresses',
      pages: ['index', 'edit/index'],
    },
    {
      root: 'subpackages/my-listings',
      pages: ['index'],
    },
    {
      root: 'subpackages/my-achievements',
      pages: ['index'],
    },
    {
      root: 'subpackages/patent-claims',
      pages: ['index'],
    },
    {
      root: 'subpackages/maintenance',
      pages: ['index'],
    },
    {
      root: 'subpackages/settings',
      pages: ['notifications/index'],
    },
    {
      root: 'subpackages/about',
      pages: ['index'],
    },
    {
      root: 'subpackages/profile',
      pages: ['edit/index'],
    },
    {
      root: 'subpackages/login',
      pages: ['index'],
    },
    {
      root: 'subpackages/ipc-picker',
      pages: ['index'],
    },
    {
      root: 'subpackages/region-picker',
      pages: ['index'],
    },
    {
      root: 'subpackages/media',
      pages: ['video-preview/index'],
    },
  ],
  preloadRule: isDev || !enablePreload ? undefined : preloadRule,
  window: {
    backgroundColor: '#f5f6f8',
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTitleText: '首页-IPMONEY聚智诚知识产权服务平台',
    navigationBarTextStyle: 'black',
  },
  tabBar: {
    color: '#475569',
    selectedColor: '#eb5c20',
    backgroundColor: '#ffffff',
    list: [
      {
        pagePath: 'pages/home/index',
        text: '首页',
        iconPath: 'assets/tabbar/home.png',
        selectedIconPath: 'assets/tabbar/home-active.png',
      },
      {
        pagePath: 'pages/tech-managers/index',
        text: '咨询',
        iconPath: 'assets/tabbar/consult.png',
        selectedIconPath: 'assets/tabbar/consult-active.png',
      },
      {
        pagePath: 'pages/publish/index',
        text: '发布',
        iconPath: 'assets/tabbar/publish.png',
        selectedIconPath: 'assets/tabbar/publish-active.png',
      },
      {
        pagePath: 'pages/messages/index',
        text: '消息',
        iconPath: 'assets/tabbar/messages.png',
        selectedIconPath: 'assets/tabbar/messages-active.png',
      },
      {
        pagePath: 'pages/me/index',
        text: '我的',
        iconPath: 'assets/tabbar/me.png',
        selectedIconPath: 'assets/tabbar/me-active.png',
      },
    ],
  },
});
