import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import vercel from './vercel.json' with { type: 'json' }

// 개발 서버도 Vercel과 같은 COOP/COEP 헤더를 보내 crossOriginIsolated 환경을 맞춘다.
const crossOriginHeaders = Object.fromEntries(
  vercel.headers[0].headers.map(({ key, value }) => [key, value]),
)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { headers: crossOriginHeaders },
  preview: { headers: crossOriginHeaders },
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
  },
})
