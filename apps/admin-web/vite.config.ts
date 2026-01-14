import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const port = Number(process.env.ADMIN_WEB_PORT || 5174);

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port,
    strictPort: true,
  },
});
