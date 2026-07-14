import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

let latestMapProps = null

vi.mock('leaflet', () => ({
  default: {
    divIcon: () => ({}),
  },
}))

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children, ...props }) => {
    latestMapProps = props
    return <div data-testid="map">{children}</div>
  },
  TileLayer: () => <div data-testid="tile" />,
  CircleMarker: () => <div data-testid="circle" />,
  Popup: ({ children }) => <div>{children}</div>,
  ZoomControl: () => <div data-testid="zoom-control" />,
  useMapEvents: () => ({}),
}))

vi.mock('../components/map/AyudantesMapa', () => ({
  InvalidarTamanoMapa: () => null,
  RecentrarMapa: () => null,
  MarcadoresReportes: () => null,
}))

import PaginaMapa from './PaginaMapa.jsx'

describe('PaginaMapa', () => {
  beforeEach(() => {
    latestMapProps = null
  })

  it('mantiene el centro en la ubicacion actual al entrar sin filtros activos', () => {
    render(
      <MemoryRouter>
        <PaginaMapa
          center={[-33.45, -70.66]}
          zoom={14}
          reports={[
            { id: 1, pet_name: 'Luna', species: 'Perro', status: 'perdido', latitude: -36.82, longitude: -73.05 },
          ]}
          lastCreatedReportId={null}
          userLocation={{ lat: -33.45, lng: -70.66 }}
          onViewDetail={vi.fn()}
        />
      </MemoryRouter>,
    )

    expect(latestMapProps.center).toEqual([-33.45, -70.66])
    expect(latestMapProps.zoom).toBe(14)
  })

  it('recentrar al primer reporte cuando el usuario aplica filtros', () => {
    render(
      <MemoryRouter>
        <PaginaMapa
          center={[-33.45, -70.66]}
          zoom={14}
          reports={[
            { id: 1, pet_name: 'Luna', species: 'Perro', status: 'perdido', latitude: -36.82, longitude: -73.05 },
          ]}
          lastCreatedReportId={null}
          userLocation={{ lat: -33.45, lng: -70.66 }}
          onViewDetail={vi.fn()}
        />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'luna' } })

    expect(latestMapProps.center).toEqual([-36.82, -73.05])
    expect(latestMapProps.zoom).toBe(13)
  })
})
