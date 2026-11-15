import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // Engine tests run in Node. A UI test opts in with `// @vitest-environment jsdom` on its first line.
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
