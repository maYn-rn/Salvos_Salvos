import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { apiRequestMock, navigateMock } = vi.hoisted(() => ({
  apiRequestMock: vi.fn(),
  navigateMock: vi.fn(),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useLocation: () => ({ search: '' }),
  }
})

vi.mock('../shared/appCore', () => ({
  apiRequest: apiRequestMock,
  formatDateShort: vi.fn(() => '15 jun'),
  getComunasForRegion: vi.fn((region) => {
    if (region === 'Región Metropolitana de Santiago') return ['Santiago', 'Providencia']
    if (region === 'Región de Valparaíso') return ['Valparaíso', 'Viña del Mar']
    return []
  }),
  optimizeImageFileToDataUrl: vi.fn(),
  REGION_COMUNAS: [
    { region: 'Región Metropolitana de Santiago', comunas: ['Santiago', 'Providencia'] },
    { region: 'Región de Valparaíso', comunas: ['Valparaíso', 'Viña del Mar'] },
  ],
  SPECIES_OPTIONS: ['Perro', 'Gato', 'Otro'],
}))

import PaginaAdopciones from './PaginaAdopciones.jsx'

function renderizarPagina(props = {}) {
  return render(
    <MemoryRouter>
      <PaginaAdopciones {...props} />
    </MemoryRouter>,
  )
}

describe('PaginaAdopciones', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
    navigateMock.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('carga adopciones con filtros segun rol admin y muestra pendientes visibles', async () => {
    apiRequestMock.mockResolvedValue({
      ok: true,
      data: {
        adopcion_1: {
          id: 1,
          pet_name: 'Luna',
          publisher_id: 5,
          is_confirmed: false,
          comuna: 'Santiago',
          region: 'Región Metropolitana de Santiago',
          species: 'Perro',
          sex: 'Hembra',
          age_label: '2 años',
          size: 'Mediano',
          description: 'Muy cariñosa',
          publisher_type: 'persona',
          imagenes: [{ url_descarga: 'http://imagenes/luna.png' }],
          created_at: '2026-06-15T12:00:00Z',
          contact_name: 'Matias',
        },
        estado: 'ok',
      },
    })

    renderizarPagina({
      user: { id: 5, is_staff: true, username: 'admin' },
    })

    expect(await screen.findByText('Luna')).toBeInTheDocument()
    expect(screen.getByText('Pendiente')).toBeInTheDocument()
    expect(apiRequestMock).toHaveBeenCalledTimes(1)

    const [path] = apiRequestMock.mock.calls[0]
    expect(path).toContain('/api/adoptions/?')
    expect(path).toContain('include_image=1')
    expect(path).toContain('include_mine=1')
    expect(path).toContain('include_unconfirmed=1')

    fireEvent.click(screen.getByText('Luna'))
    expect(navigateMock).toHaveBeenCalledWith('/adopciones/1')
  })

  it('reinicia comuna al cambiar region y reaplica filtros con parametros del usuario', async () => {
    apiRequestMock.mockResolvedValue({ ok: true, data: { results: [] } })

    renderizarPagina({
      user: { id: 10, username: 'dueno' },
    })

    await screen.findByText('No se encontraron adopciones en la base de datos.')

    const inputBuscar = screen.getByPlaceholderText('Nombre, raza, comuna o albergue')
    const selectRegion = screen.getByLabelText('Region')
    const selectComuna = screen.getByLabelText('Comuna')

    fireEvent.change(inputBuscar, { target: { value: 'luna' } })
    fireEvent.change(selectRegion, { target: { value: 'Región Metropolitana de Santiago' } })
    expect(selectComuna).not.toBeDisabled()

    fireEvent.change(selectComuna, { target: { value: 'Providencia' } })
    expect(selectComuna.value).toBe('Providencia')

    fireEvent.change(selectRegion, { target: { value: 'Región de Valparaíso' } })
    expect(selectComuna.value).toBe('')

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }))

    await waitFor(() => expect(apiRequestMock).toHaveBeenCalledTimes(2))

    const [path] = apiRequestMock.mock.calls[1]
    expect(path).toContain('q=luna')
    expect(path).toContain('region=Regi%C3%B3n+de+Valpara%C3%ADso')
    expect(path).toContain('include_image=1')
    expect(path).toContain('include_mine=1')
    expect(path).not.toContain('include_unconfirmed=1')
  })
})
