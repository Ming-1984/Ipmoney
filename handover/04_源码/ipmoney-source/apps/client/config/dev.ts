import type { UserConfigExport } from '@tarojs/cli';

const h5Port = Number(process.env.CLIENT_H5_PORT || 5173);
const isWeappDev = process.env.TARO_ENV === 'weapp';

export default {
  env: {
    NODE_ENV: '"development"',
  },
  // Work around an unstable webpack watch path on Node 22 + weapp
  // (`No template for dependency: PureExpressionDependency` in source-map stage).
  // Keep source maps enabled for H5 development.
  enableSourceMap: !isWeappDev,
  sourceMapType: isWeappDev ? undefined : 'source-map',
  h5: {
    devServer: {
      port: h5Port,
      host: '127.0.0.1',
    },
  },
} satisfies UserConfigExport;
