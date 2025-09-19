// vite.config.js

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'; // ◀◀◀ [추가]

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // ▼▼▼ [추가] 경로 별칭(alias) 설정 ▼▼▼
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})