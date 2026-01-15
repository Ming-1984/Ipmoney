import type { UserConfigExport, UserConfigFn } from '@tarojs/cli';

import devConfig from './dev';
import prodConfig from './prod';

export default ((merge, env) => {
  const isDev = env.mode === 'development';
  const apiBaseUrl = process.env.TARO_APP_API_BASE_URL ?? 'http://127.0.0.1:4010';
  const taroEnv = process.env.TARO_ENV;
  const outputRoot = taroEnv ? `dist/${taroEnv}` : 'dist';

  const enableMockToolsEnv = process.env.TARO_APP_ENABLE_MOCK_TOOLS;
  const enableMockTools = enableMockToolsEnv === '1' || enableMockToolsEnv === 'true';

  const baseConfig: UserConfigExport = {
    projectName: 'ipmoney-client',
    date: '2026-01-11',
    designWidth: 750,
    deviceRatio: {
      750: 1,
    },
    sourceRoot: 'src',
    outputRoot,
    plugins: ['@tarojs/plugin-framework-react'],
    defineConstants: {
      __API_BASE_URL__: JSON.stringify(apiBaseUrl),
      __ENABLE_MOCK_TOOLS__: JSON.stringify(enableMockTools),
      __APP_MODE__: JSON.stringify(env.mode),
    },
    alias: {},
    framework: 'react',
    compiler: {
      type: 'webpack5',
      prebundle: {
        enable: false,
      },
    },
    csso: {
      enable: false,
    },
    mini: {},
    h5: {
      router: {
        mode: 'hash',
      },
      postcss: {
        pxtransform: {
          config: {
            baseFontSize: 20,
            minRootSize: 18,
            maxRootSize: 22,
          },
        },
      },
    },
  };

  if (isDev) return merge({}, baseConfig, devConfig);
  return merge({}, baseConfig, prodConfig);
}) satisfies UserConfigFn;
