import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const src = fileURLToPath(new URL('./src', import.meta.url))

// Deliberately does not extend vite.config.ts. The app config loads the
// TanStack Router plugin, which regenerates routeTree.gen.ts on build start,
// and the devtools/tailwind plugins, none of which a test run needs.
export default defineConfig({
  resolve: {
    alias: {
      '@': src,
      '#': src,
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    env: {
      TZ: 'UTC',
    },
    // Requires `@vitest/coverage-v8`, which is not a dependency yet. Only the
    // `--coverage` run needs it; plain `vitest run` is unaffected.
    coverage: {
      provider: 'v8',
      include: ['src/lib/**'],
      reporter: ['text', 'html'],
    },
  },
})
