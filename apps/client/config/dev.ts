import type { UserConfigExport } from '@tarojs/cli';

const h5Port = Number(process.env.CLIENT_H5_PORT || 5173);

export default {
  env: {
    NODE_ENV: '"development"',
  },
  h5: {
    devServer: {
      port: h5Port,
      host: '127.0.0.1',
    },
  },
} satisfies UserConfigExport;
