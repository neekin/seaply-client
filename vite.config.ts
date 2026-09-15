import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Tauri 开发时固定 1420 端口（strictPort），否则壳会连不上
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  build: {
    // Tauri 内嵌 WebView（macOS 用 WebKit），目标对齐 Safari 13+
    target: 'es2021',
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
})
