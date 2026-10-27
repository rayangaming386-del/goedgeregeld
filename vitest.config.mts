import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Node lost dit pakket zelf op (zonder react-server-conditie); in tests is alles server.
      'server-only': fileURLToPath(new URL('./tests/support/server-only.ts', import.meta.url)),
    },
    conditions: ['react-server'],
  },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    environment: 'node',
    // Integratietests delen één testdatabase.
    fileParallelism: false,
    testTimeout: 20_000,
    env: { TZ: 'UTC' },
    setupFiles: ['tests/integration/setup.ts'],
  },
})
