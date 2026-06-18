import path from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const workspaceRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));

function isReleaseLike(value: string | undefined): boolean {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return false;
  if (raw === 'prod' || raw === 'production') return true;
  if (raw === 'staging' || raw === 'stage') return true;
  if (/(^|[-_])prod($|[-_])/.test(raw)) return true;
  if (/(^|[-_])staging($|[-_])/.test(raw)) return true;
  return false;
}

export default defineConfig(({ mode, command }) => {
  const env = { ...loadEnv(mode, workspaceRoot, ''), ...process.env };
  const port = Number(env.ADMIN_WEB_PORT || 5174);
  const deployEnvValues = [env.DEPLOY_ENV, env.APP_MODE, env.STAGE, env.ENV].filter(Boolean);
  const isProdDeploy = deployEnvValues.some((v) => isReleaseLike(v));
  const isProdBuild = command === 'build' && mode === 'production' && isProdDeploy;
  const demoToken = String(env.VITE_DEMO_ADMIN_TOKEN || '').trim();
  const mockTools = String(env.VITE_ENABLE_MOCK_TOOLS || '').trim().toLowerCase();
  const apiBaseUrl = String(env.VITE_API_BASE_URL || '').trim();

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
    envDir: workspaceRoot,
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
