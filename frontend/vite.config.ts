import { execSync } from 'node:child_process'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import pkg from './package.json' with { type: 'json' }

// Resolve a short git sha for build metadata. Falls back to "unknown" when
// git is unavailable (e.g. when building from a source tarball or inside a
// Docker context that excludes .git).
function resolveGitSha(): string {
  // Allow CI / Docker builds to inject the sha explicitly.
  if (process.env.GIT_SHA && process.env.GIT_SHA.trim()) {
    return process.env.GIT_SHA.trim().slice(0, 7)
  }
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return 'unknown'
  }
}

const APP_VERSION = `${pkg.version}+devX-${resolveGitSha()}`

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Exposed as import.meta.env.VITE_APP_VERSION at build time.
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(APP_VERSION),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // Playwright specs live under e2e/ and are run with @playwright/test,
    // not Vitest. Keep them out of the unit/component test run.
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/test/**',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/**/*.test.{ts,tsx}',
      ],
      // Lenient initial thresholds; ratchet up as coverage grows.
      thresholds: {
        lines: 0,
        functions: 0,
        branches: 0,
        statements: 0,
      },
    },
  },
})
