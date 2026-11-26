import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import App from './App.jsx'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('shows connected when the backend readiness endpoint succeeds', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ready' }),
    }),
  )

  render(<App />)

  expect(await screen.findByText('API: Connected')).toBeTruthy()
  expect(fetch).toHaveBeenCalledWith('/api/v1/health/ready')
})

it('shows unavailable when backend readiness fails', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    }),
  )

  render(<App />)

  expect(await screen.findByText('API: Unavailable')).toBeTruthy()
})
