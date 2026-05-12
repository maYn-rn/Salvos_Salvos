import React from 'react'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('leaflet', () => ({
  default: {
    divIcon: () => ({}),
  },
}))

vi.mock('react-leaflet', () => {
  const map = { setView: () => {}, invalidateSize: () => {} }
  return {
    MapContainer: ({ children }) => <div data-testid="map">{children}</div>,
    TileLayer: () => <div data-testid="tile" />,
    Marker: ({ children }) => <div data-testid="marker">{children}</div>,
    Popup: ({ children }) => <div data-testid="popup">{children}</div>,
    CircleMarker: () => <div data-testid="circle" />,
    useMap: () => map,
    useMapEvents: () => ({}),
  }
})

import App from './App.jsx'

function mockFetch() {
  global.fetch = vi.fn(async (url, init) => {
    const u = String(url)
    if (u.includes('/api/auth/refresh')) {
      return {
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ detail: 'missing_refresh_cookie' }),
      }
    }
    if (u.includes('/api/reports') && (!init || init.method === 'GET')) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ results: [] }),
      }
    }
    if (u.includes('/api/auth/me')) {
      return {
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ detail: 'missing_access' }),
      }
    }
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({}),
    }
  })
}

describe('App', () => {
  beforeEach(() => {
    mockFetch()
  })

  it('muestra header y footer en la home', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )

    const banner = await screen.findByRole('banner')
    expect(within(banner).getByText('Sanos y Salvos')).toBeInTheDocument()
    expect(within(banner).getByRole('link', { name: 'Inicio' })).toBeInTheDocument()
    expect(within(banner).getByRole('link', { name: 'Sobre nosotros' })).toBeInTheDocument()
    expect(within(banner).getByRole('link', { name: 'Preguntas frecuentes' })).toBeInTheDocument()

    const footer = screen.getByRole('contentinfo')
    expect(within(footer).getByText(/©/)).toBeInTheDocument()
  })

  it('renderiza el backoffice en /admin', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/dashboard']}>
        <App />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Backoffice')).toBeInTheDocument()
  })

  it('renderiza la página de preguntas frecuentes', async () => {
    render(
      <MemoryRouter initialEntries={['/preguntas-frecuentes']}>
        <App />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Preguntas frecuentes' })).toBeInTheDocument()
  })
})
