import { ReactElement, ReactNode } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

/**
 * Create a QueryClient with retries disabled so failing queries surface
 * immediately in tests instead of being retried.
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

interface ProvidersProps {
  children: ReactNode
  queryClient?: QueryClient
  initialEntries?: string[]
}

export function AppProviders({ children, queryClient, initialEntries = ['/'] }: ProvidersProps) {
  const client = queryClient ?? createTestQueryClient()
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={initialEntries} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        {children}
      </MemoryRouter>
    </QueryClientProvider>
  )
}

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient
  initialEntries?: string[]
}

/**
 * Render a component wrapped in the providers used across the app
 * (React Query + Router). Returns the React Testing Library result.
 */
export function renderWithProviders(ui: ReactElement, options: CustomRenderOptions = {}) {
  const { queryClient, initialEntries, ...renderOptions } = options
  return render(ui, {
    wrapper: ({ children }) => (
      <AppProviders queryClient={queryClient} initialEntries={initialEntries}>
        {children}
      </AppProviders>
    ),
    ...renderOptions,
  })
}

// Re-export the full Testing Library API so tests import from one place.
export * from '@testing-library/react'
export { default as userEvent } from '@testing-library/user-event'
