import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }
// The date players see, in China time: sv-SE formats as YYYY-MM-DD.
const buildDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date())

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(version),
    'import.meta.env.VITE_BUILD_DATE': JSON.stringify(buildDate),
  },
  test: {
    // Engine tests run in Node. A UI test opts in with `// @vitest-environment jsdom` on its first line.
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
