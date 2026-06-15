import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { apiRequestMock, navigateMock, optimizeImageFileToDataUrlMock } = vi.hoisted(() => ({
  apiRequestMock: vi.fn(),
  navigateMock: vi.fn(),
  optimizeImageFileToDataUrlMock: vi.fn(),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

vi.mock('../shared/appCore', () => ({
  apiRequest: apiRequestMock,
  formatDateShort: vi.fn(),
  getComunasForRegion: vi.fn((region) => {
    if (region === 'Región Metropolitana de Santiago') return ['Santiago', 'Providencia']
    return []
  }),
  optimizeImageFileToDataUrl: optimizeImageFileToDataUrlMock,
  REGION_COMUNAS: [
    { region: 'Región Metropolitana de Santiago', comunas: ['Santiago', 'Providencia'] },
  ],
  SPECIES_OPTIONS: ['Perro', 'Gato', 'Otro'],
}))

import { PaginaPublicarAdopcion } from './PaginaAdopciones.jsx'

function renderizarPagina(props = {}) {
  return render(
    <MemoryRouter>
      <PaginaPublicarAdopcion {...props} />
    </MemoryRouter>,
  )
}

async function cargarImagen() {
  const archivo = new File(['imagen'], 'luna.png', { type: 'image/png' })
  const etiquetaImagenes = screen.getByText('Imagenes').closest('label')
  const inputImagenes = etiquetaImagenes.querySelector('input[type="file"]')
  fireEvent.change(inputImagenes, { target: { files: [archivo] } })
  await waitFor(() => expect(screen.getByText('1 de 3 imágenes seleccionadas')).toBeInTheDocument())
}

function completarCamposBase() {
  fireEvent.change(screen.getByLabelText('Nombre de la mascota'), { target: { value: 'Luna' } })
  fireEvent.change(screen.getByLabelText('Especie'), { target: { value: 'Perro' } })
  fireEvent.change(screen.getByLabelText('Region'), { target: { value: 'Región Metropolitana de Santiago' } })
  fireEvent.change(screen.getByLabelText('Comuna'), { target: { value: 'Santiago' } })
  fireEvent.change(screen.getByLabelText('Su historia'), { target: { value: 'Muy tranquila y sociable' } })
  fireEvent.change(screen.getByLabelText('Por qué lo das en adopción'), { target: { value: 'Cambio de casa' } })
}

describe('PaginaPublicarAdopcion', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
    navigateMock.mockReset()
    optimizeImageFileToDataUrlMock.mockReset()
    optimizeImageFileToDataUrlMock.mockResolvedValue('data:image/webp;base64,abc123')
    window.scrollTo = vi.fn()
  })

  afterEach(() => {
    cleanup()
  })

  it('bloquea el envio si el telefono es invalido aunque el resto del formulario este correcto', async () => {
    renderizarPagina({
      user: { id: 8, username: 'matias', email: 'matias@correo.cl' },
    })

    completarCamposBase()
    await cargarImagen()
    fireEvent.change(screen.getByLabelText('Telefono'), { target: { value: '123' } })

    fireEvent.click(screen.getByRole('button', { name: 'Guardar publicacion' }))

    expect(await screen.findByText('Ingresa un teléfono válido de entre 8 y 12 números (ej: +56912345678)')).toBeInTheDocument()
    expect(apiRequestMock).not.toHaveBeenCalled()
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0)
  })

  it('publica la adopcion, sube imagenes y las asocia al registro creado', async () => {
    apiRequestMock
      .mockResolvedValueOnce({ ok: true, data: { id: 77 } })
      .mockResolvedValueOnce({
        ok: true,
        data: { id: 901, url_descarga: 'http://archivos/901', categoria: 'principal', orden: 1 },
      })
      .mockResolvedValueOnce({ ok: true, data: { id: 77, imagenes: [{ id: 901 }] } })

    renderizarPagina({
      user: { id: 9, username: 'maria', email: 'maria@correo.cl' },
    })

    completarCamposBase()
    await cargarImagen()
    fireEvent.change(screen.getByLabelText('Telefono'), { target: { value: '+56912345678' } })

    fireEvent.click(screen.getByRole('button', { name: 'Guardar publicacion' }))

    expect(await screen.findByText('Publicacion enviada. Quedará como Pendiente hasta que un administrador la confirme.')).toBeInTheDocument()
    expect(apiRequestMock).toHaveBeenCalledTimes(3)

    const [rutaCrear, opcionesCrear] = apiRequestMock.mock.calls[0]
    expect(rutaCrear).toBe('/api/adoptions/')
    expect(opcionesCrear.method).toBe('POST')
    expect(opcionesCrear.body).not.toHaveProperty('imagenes_locales')
    expect(opcionesCrear.body.pet_name).toBe('Luna')

    const [rutaSubida, opcionesSubida] = apiRequestMock.mock.calls[1]
    expect(rutaSubida).toBe('/api/archivos/')
    expect(opcionesSubida.body.tipo_entidad).toBe('adopcion')
    expect(opcionesSubida.body.id_entidad).toBe(77)
    expect(opcionesSubida.body.nombre_original).toBe('luna.png')

    const [rutaPatch, opcionesPatch] = apiRequestMock.mock.calls[2]
    expect(rutaPatch).toBe('/api/adoptions/77/')
    expect(opcionesPatch.method).toBe('PATCH')
    expect(opcionesPatch.body.imagenes).toEqual([
      {
        id: 901,
        url_descarga: 'http://archivos/901',
        categoria: 'principal',
        orden: 1,
      },
    ])
  })

  it('revierte la creacion si falla la asociacion final de imagenes', async () => {
    apiRequestMock
      .mockResolvedValueOnce({ ok: true, data: { id: 55 } })
      .mockResolvedValueOnce({
        ok: true,
        data: { id: 300, url_descarga: 'http://archivos/300', categoria: 'principal', orden: 1 },
      })
      .mockResolvedValueOnce({ ok: false, data: { detail: 'fallo_patch' } })
      .mockResolvedValueOnce({ ok: true, data: {} })

    renderizarPagina({
      user: { id: 10, username: 'paula', email: 'paula@correo.cl' },
    })

    completarCamposBase()
    await cargarImagen()
    fireEvent.change(screen.getByLabelText('Telefono'), { target: { value: '+56987654321' } })

    fireEvent.click(screen.getByRole('button', { name: 'Guardar publicacion' }))

    expect(await screen.findByText('La adopción se creó, pero no se pudieron asociar las imágenes')).toBeInTheDocument()
    expect(apiRequestMock).toHaveBeenCalledTimes(4)

    const [rutaRollback, opcionesRollback] = apiRequestMock.mock.calls[3]
    expect(rutaRollback).toBe('/api/adoptions/55/')
    expect(opcionesRollback.method).toBe('DELETE')
  })
})
