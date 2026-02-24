import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(({ mode, command }) => {
  const port = Number(process.env.ADMIN_WEB_PORT || 5174);
  const deployEnvValues = [process.env.DEPLOY_ENV, process.env.APP_MODE, process.env.STAGE, process.env.ENV]
    .filter(Boolean)
    .map((v) => String(v).trim().toLowerCase());
  const isProdDeploy = deployEnvValues.some((v) => v.includes('prod'));
  const isProdBuild = command === 'build' && mode === 'production' && isProdDeploy;
  const demoToken = String(process.env.VITE_DEMO_ADMIN_TOKEN || '').trim();
  const mockTools = String(process.env.VITE_ENABLE_MOCK_TOOLS || '').trim().toLowerCase();
  const apiBaseUrl = String(process.env.VITE_API_BASE_URL || '').trim();

  if (command === 'build' && !apiBaseUrl) {
    throw new Error('VITE_API_BASE_URL is required for build.');
  }

  if (isProdBuild) {
    if (demoToken) {
      throw new Error('VITE_DEMO_ADMIN_TOKEN must not be set in production build.');
    }
    if (mockTools === '1' || mockTools === 'true') {
      throw new Error('VITE_ENABLE_MOCK_TOOLS must be disabled in production build.');
    }
    if (apiBaseUrl.includes('localhost') || apiBaseUrl.includes('127.0.0.1')) {
      throw new Error('VITE_API_BASE_URL must not use localhost/127.0.0.1 in production build.');
    }
  }

  return {
    plugins: [react()],
    build: {
      // The default vendor chunking is fine here; adjust warning threshold based on gzip size.
      chunkSizeWarningLimit: 800,
    },
    server: {
      host: '127.0.0.1',
      port,
      strictPort: true,
    },
  };
});
