import type { UserConfigExport, UserConfigFn } from '@tarojs/cli';
import path from 'path';

import devConfig from './dev';
import prodConfig from './prod';

export default ((merge, env) => {
  const isDev = env.mode === 'development';
  // Taro/webpack typically run builds with env.mode=production even for staging.
  // Only enforce "no demo/mock + non-local API base" when an explicit deploy env
  // indicates a real production release.
  const deployEnvValues = [
    process.env.DEPLOY_ENV,
    process.env.APP_MODE,
    process.env.STAGE,
    process.env.ENV,
  ]
    .filter(Boolean)
    .map((v) => String(v).trim().toLowerCase());
  const isProdDeploy = deployEnvValues.some((v) => v.includes('prod'));
  const isProdBuild = env.mode === 'production' && isProdDeploy;
  const rawApiBaseUrl = process.env.TARO_APP_API_BASE_URL ?? 'http://127.0.0.1:3200';
  const apiBaseUrl = rawApiBaseUrl.replace('http://localhost', 'http://127.0.0.1');
  const rawMockTools = String(process.env.TARO_APP_ENABLE_MOCK_TOOLS || '').trim().toLowerCase();
  const rawDemoAuth = String(process.env.DEMO_AUTH_ENABLED || '').trim().toLowerCase();
  if (isProdBuild) {
    if (rawMockTools === '1' || rawMockTools === 'true') {
      throw new Error('TARO_APP_ENABLE_MOCK_TOOLS must be disabled in production build.');
    }
    if (rawDemoAuth === 'true') {
      throw new Error('DEMO_AUTH_ENABLED must be disabled in production build.');
    }
    if (apiBaseUrl.includes('localhost') || apiBaseUrl.includes('127.0.0.1')) {
      throw new Error('TARO_APP_API_BASE_URL must not use localhost/127.0.0.1 in production build.');
    }
  }
  const demoAuthEnabledRaw = String(process.env.DEMO_AUTH_ENABLED || '').trim().toLowerCase() === 'true';
  const demoAuthEnabled = demoAuthEnabledRaw && !isProdBuild;
  const taroEnv = process.env.TARO_ENV;
  const enablePrebundle = isDev && taroEnv === 'h5';
  const outputRoot = taroEnv ? `dist/${taroEnv}` : 'dist';
  const inlineImageLimit = taroEnv === 'weapp' ? 0 : 2048;
  // Webpack's default performance budgets are extremely low for modern apps and
  // create noisy warnings. Set explicit budgets (still warning) so regressions
  // remain visible.
  const h5PerformanceBudget = {
    maxAssetSize: 650 * 1024,
    maxEntrypointSize: 1200 * 1024,
  };

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
      __IS_PROD_DEPLOY__: JSON.stringify(isProdDeploy),
    },
    alias: {
      // Keep H5 bundles lean: NutUI's icon entry is marked as side-effectful and
      // can pull in the whole icon set. Alias to a local shim that re-exports
      // only the icons we actually need.
      '@nutui/icons-react-taro$': path.resolve(__dirname, '..', 'src/shims/nutui-icons.ts'),
    },
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
      webpackChain(chain) {
        try {
          chain.performance
            .maxAssetSize(h5PerformanceBudget.maxAssetSize)
            .maxEntrypointSize(h5PerformanceBudget.maxEntrypointSize);
        } catch {
          // Ignore if webpack-chain API changes; budgets are best-effort.
        }
      },
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
