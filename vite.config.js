import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages는 /weatherwear/ 하위, Vercel은 루트(/)로 서빙된다.
  base: process.env.VERCEL ? '/' : '/weatherwear/',
  server: {
    // 로컬 개발: /api 요청을 Express 프록시(server.js, 3001)로 전달
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
