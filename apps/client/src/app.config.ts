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
      root: 'subpackages/inventors',
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
      root: 'subpackages/my-demands',
      pages: ['index'],
    },
    {
      root: 'subpackages/my-achievements',
      pages: ['index'],
    },
    {
      root: 'subpackages/my-artworks',
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
      root: 'subpackages/region-picker',
      pages: ['index'],
    },
    {
      root: 'subpackages/ipc-picker',
      pages: ['index'],
    },
  ],
  preloadRule: {
    'pages/home/index': {
      network: 'all',
      packages: ['subpackages/search', 'subpackages/listing'],
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
