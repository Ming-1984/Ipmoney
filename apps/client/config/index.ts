import type { UserConfigExport } from '@tarojs/cli';

export default {
  projectName: 'ipmoney-client',
  date: '2026-01-11',
  designWidth: 375,
  deviceRatio: {
    375: 2,
    750: 1,
  },
  sourceRoot: 'src',
  outputRoot: 'dist',
  plugins: ['@tarojs/plugin-framework-react'],
  defineConstants: {
    __API_BASE_URL__: JSON.stringify(process.env.TARO_APP_API_BASE_URL ?? 'http://127.0.0.1:4010'),
  },
  alias: {},
  framework: 'react',
  compiler: 'webpack5',
  mini: {},
  h5: {},
} satisfies UserConfigExport;

