import type { UserConfigExport, UserConfigFn } from '@tarojs/cli';
import path from 'path';

import devConfig from './dev';
import prodConfig from './prod';

export default ((merge, env) => {
  const isDev = env.mode === 'development';
  const rawApiBaseUrl = process.env.TARO_APP_API_BASE_URL ?? 'http://127.0.0.1:3200';
  const apiBaseUrl = rawApiBaseUrl.replace('http://localhost', 'http://127.0.0.1');
  const demoAuthEnabledRaw = String(process.env.DEMO_AUTH_ENABLED || '').trim().toLowerCase() === 'true';
  const demoAuthEnabled = demoAuthEnabledRaw && env.mode !== 'production';
  const taroEnv = process.env.TARO_ENV;
  const enablePrebundle = isDev && taroEnv === 'h5';
  const outputRoot = taroEnv ? `dist/${taroEnv}` : 'dist';
  const inlineImageLimit = taroEnv === 'weapp' ? 0 : 2048;

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
      __APP_MODE__: JSON.stringify(env.mode),
      __DEMO_AUTH_ENABLED__: JSON.stringify(demoAuthEnabled),
    },
    alias: {},
    framework: 'react',
    cache: {
      enable: isDev,
    },
    imageUrlLoaderOption: {
      limit: inlineImageLimit,
    },
    compiler: {
      type: 'webpack5',
      prebundle: {
        enable: enablePrebundle,
        cacheDir: path.join(__dirname, '..', 'node_modules/.taro'),
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
