export default defineAppConfig({
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
      root: 'subpackages/patent-map',
      pages: ['index', 'region-detail/index'],
    },
    {
      root: 'subpackages/patent',
      pages: ['detail/index', 'detail/summary/index', 'detail/info/index', 'detail/comments/index'],
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
      pages: ['patent/index', 'demand/index', 'achievement/index', 'artwork/index'],
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
      root: 'subpackages/announcements',
      pages: ['index', 'detail/index'],
    },
    {
      root: 'subpackages/listing',
      pages: ['detail/index'],
    },
    {
      root: 'subpackages/demand',
      pages: ['detail/index'],
    },
    {
      root: 'subpackages/achievement',
      pages: ['detail/index'],
    },
    {
      root: 'subpackages/artwork',
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
      root: 'subpackages',
      pages: [
        'inventors/index',
        'tech-managers/detail/index',
        'trade-rules/index',
        'contracts/index',
        'invoices/index',
        'addresses/index',
        'addresses/edit/index',
        'my-listings/index',
        'my-demands/index',
        'my-achievements/index',
        'my-artworks/index',
        'cluster-picker/index',
        'settings/notifications/index',
        'about/index',
        'profile/edit/index',
        'login/index',
        'region-picker/index',
        'ipc-picker/index',
      ],
    },
  ],
  preloadRule: {
    'pages/home/index': {
      network: 'all',
      packages: [
        'subpackages/search',
        'subpackages/patent-map',
        'subpackages/announcements',
        'subpackages/listing',
      ],
    },
    'pages/tech-managers/index': {
      network: 'all',
      packages: ['subpackages/organizations'],
    },
    'pages/messages/index': {
      network: 'all',
      packages: ['subpackages/messages', 'subpackages/notifications'],
    },
    'pages/me/index': {
      network: 'all',
      packages: ['subpackages/orders', 'subpackages/publish', 'subpackages/checkout', 'subpackages/favorites'],
    },
  },
  window: {
    backgroundColor: '#f7f3ec',
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTitleText: 'Ipmoney',
    navigationBarTextStyle: 'black',
  },
  tabBar: {
    color: '#475569',
    selectedColor: '#ff6600',
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
