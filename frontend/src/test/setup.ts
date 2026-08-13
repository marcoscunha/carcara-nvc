import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// Unmount React trees and clear the DOM after every test.
afterEach(() => {
  cleanup()
})

// MUI components rely on these browser APIs that jsdom does not implement.
// Provide minimal mocks so components render without throwing.
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  })
}

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

class IntersectionObserverStub {
  readonly root = null
  readonly rootMargin = ''
  readonly thresholds = []
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}

window.ResizeObserver = window.ResizeObserver ?? (ResizeObserverStub as unknown as typeof ResizeObserver)
window.IntersectionObserver =
  window.IntersectionObserver ?? (IntersectionObserverStub as unknown as typeof IntersectionObserver)
