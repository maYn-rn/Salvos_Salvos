import { useEffect, useMemo, useRef, useState } from 'react'

import {
  apiRequest,
  formatDateShort,
  formatFileSize,
  MAX_IMAGE_OUTPUT_BYTES,
  MAX_IMAGE_UPLOAD_BYTES,
  normalizeSpecies,
  optimizeImageFileToDataUrl,
} from '../shared/appCore'

export default function CarruselReportesRecientes({ title, reports, user, onCardClick }) {
  const trackRef = useRef(null)
  const [detailsById, setDetailsById] = useState({})
  const [loadingById, setLoadingById] = useState({})
  const detailsRef = useRef({})
  const loadingRef = useRef({})
  const fetchTokenRef = useRef(0)
  const [toast, setToast] = useState('')
  const toastTimerRef = useRef(0)
  const [modal, setModal] = useState({ open: false, reportId: null })
  const [leadForm, setLeadForm] = useState({
    imagen_local: null,
    nombre_archivo: '',
    found_location: '',
  })
  const [leadError, setLeadError] = useState('')
  const [leadSubmitting, setLeadSubmitting] = useState(false)

  const reportById = useMemo(() => {
    const map = {}
    for (const r of reports || []) {
      if (r?.id != null) map[r.id] = r
    }
    return map
  }, [reports])

  function scrollByAmount(direction) {
    const el = trackRef.current
    if (!el) return
    const amount = Math.max(240, Math.floor(el.clientWidth * 0.8))
    el.scrollBy({ left: direction * amount, behavior: 'smooth' })
  }

  useEffect(() => {
    const token = ++fetchTokenRef.current
    const ids = (reports || [])
      .map((r) => r?.id)
      .filter((id) => id != null)
      .slice(0, 12)

    ;(async () => {
      const toFetch = ids.filter((id) => !detailsRef.current[id] && !loadingRef.current[id])
      if (toFetch.length === 0) return

      setLoadingById((s) => {
        const next = { ...s }
        for (const id of toFetch) next[id] = true
        loadingRef.current = next
        return next
      })

      const resp = await apiRequest(`/api/reports/?ids=${encodeURIComponent(toFetch.join(','))}&include_image=1`)
      if (fetchTokenRef.current !== token) return

      const fetched = resp.ok && resp.data?.results ? resp.data.results : []
      const updates = []
      for (const item of fetched) {
        if (item?.id != null) updates.push([item.id, item])
      }

      if (updates.length) {
        setDetailsById((s) => {
          const next = { ...s }
          for (const [id, data] of updates) next[id] = data
          detailsRef.current = next
          return next
        })
      }

      setLoadingById((s) => {
        const next = { ...s }
        for (const id of toFetch) next[id] = false
        loadingRef.current = next
        return next
      })
    })()
  }, [reports])

  function getSpeciesEmoji(species) {
    const kind = normalizeSpecies(species)
    if (kind === 'perro') return '🐶'
    if (kind === 'gato') return '🐱'
    return '🐾'
  }

  function showToast(message) {
    setToast(message)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(''), 4200)
  }

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

  function openFoundModal(reportId) {
    if (!user) {
      const next = encodeURIComponent(`${window.location.pathname}${window.location.search}`)
      window.location.href = `/login?next=${next}`
      return
    }

    const report = reportById[reportId]
    const initialLocation = `${report?.comuna || ''}${report?.region ? `, ${report.region}` : ''}`.trim()
    setLeadForm({ imagen_local: null, nombre_archivo: '', found_location: initialLocation })
    setLeadError('')
    setLeadSubmitting(false)
    setModal({ open: true, reportId })
  }

  function closeFoundModal() {
    if (leadSubmitting) return
    setModal({ open: false, reportId: null })
    setLeadError('')
  }

  async function onLeadImageChange(e) {
    const file = e.target.files?.[0]
    if (!file) {
      setLeadForm((s) => ({ ...s, imagen_local: null, nombre_archivo: '' }))
      return
    }
    if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
      setLeadError(`La imagen es muy grande. Usa una de maximo ${formatFileSize(MAX_IMAGE_UPLOAD_BYTES)}.`)
      e.target.value = ''
      return
    }
    setLeadError('')
    try {
      const dataUrl = await optimizeImageFileToDataUrl(file, { maxEdge: 1400, maxBytes: MAX_IMAGE_OUTPUT_BYTES })
      if (!dataUrl) {
        setLeadError('No se pudo procesar la imagen')
        e.target.value = ''
        return
      }
      setLeadForm((s) => ({
        ...s,
        imagen_local: { nombre_original: file.name, contenido_base64: dataUrl },
        nombre_archivo: file.name,
      }))
    } catch {
      setLeadError('No se pudo procesar la imagen')
      e.target.value = ''
    }
  }

  async function submitFoundLead() {
    if (!modal.open || !modal.reportId) return
    if (!user) {
      const next = encodeURIComponent(`${window.location.pathname}${window.location.search}`)
      window.location.href = `/login?next=${next}`
      return
    }

    const location = (leadForm.found_location || '').trim()
    if (!leadForm.imagen_local?.contenido_base64) {
      setLeadError('Sube una foto de la mascota')
      return
    }
    if (!location) {
      setLeadError('Ingresa la ubicacion donde fue encontrada')
      return
    }

    setLeadSubmitting(true)
    setLeadError('')
    let leadIdCreado = null
    try {
      const resp = await apiRequest(`/api/reports/${modal.reportId}/found-leads/`, {
        method: 'POST',
        body: { found_location: location },
      })
      if (!resp.ok) {
        if (resp.status === 401) {
          setLeadError('Debes iniciar sesion para enviar este aviso')
          return
        }
        setLeadError(resp.data?.detail || 'No se pudo enviar el aviso')
        return
      }

      leadIdCreado = resp.data?.id ?? null
      if (!leadIdCreado) {
        setLeadError('El aviso se creó sin identificador válido')
        return
      }

      const archivoResp = await apiRequest('/api/archivos/', {
        method: 'POST',
        body: {
          tipo_entidad: 'pista_reporte',
          id_entidad: leadIdCreado,
          categoria: 'principal',
          orden: 1,
          servicio_origen: 'ms_mascotas',
          nombre_original: leadForm.imagen_local.nombre_original,
          contenido_base64: leadForm.imagen_local.contenido_base64,
        },
      })
      if (!archivoResp.ok || !archivoResp.data?.url_descarga) {
        throw new Error(archivoResp.data?.detail || 'No se pudo subir la foto')
      }

      const patchResp = await apiRequest(`/api/reports/found-leads/${leadIdCreado}/`, {
        method: 'PATCH',
        body: {
          imagenes: [
            {
              id: archivoResp.data.id,
              url_descarga: archivoResp.data.url_descarga,
              categoria: archivoResp.data.categoria || 'principal',
              orden: archivoResp.data.orden || 1,
            },
          ],
        },
      })
      if (!patchResp.ok) {
        throw new Error('No se pudo asociar la foto al aviso')
      }

      setModal({ open: false, reportId: null })
      showToast('Recibimos tu aviso. Pronto nos pondremos en contacto con usted.')
    } catch (e) {
      if (leadIdCreado) {
        try {
          await apiRequest(`/api/reports/found-leads/${leadIdCreado}/`, { method: 'DELETE' })
        } catch {}
      }
      setLeadError(e?.message || 'No se pudo enviar el aviso')
    } finally {
      setLeadSubmitting(false)
    }
  }

  return (
    <section className="section">
      <div className="carouselHeader">
        <h2 className="carouselTitle">{title}</h2>
        <div className="carouselControls">
          <button className="iconBtn" type="button" onClick={() => scrollByAmount(-1)} aria-label="Anterior">
            ‹
          </button>
          <button className="iconBtn" type="button" onClick={() => scrollByAmount(1)} aria-label="Siguiente">
            ›
          </button>
        </div>
      </div>

      {toast ? <div className="formSuccess">{toast}</div> : null}

      <div className="carouselTrack" ref={trackRef}>
        {(reports || []).length === 0 ? (
          <div className="carouselEmpty">Sin reportes recientes</div>
        ) : (
          (reports || []).map((r) => {
            const imgUrl = r.image_data_url || detailsById[r.id]?.image_data_url

            return (
              <div
                key={r.id}
                className="carouselCard"
                onClick={(e) => {
                  if (e.target.tagName !== 'BUTTON') {
                    onCardClick?.(r.id)
                  }
                }}
                style={{ cursor: 'pointer' }}
              >
                <div className="carouselImgWrap">
                  {imgUrl ? (
                    <img
                      className="carouselImg"
                      src={imgUrl}
                      alt={r.pet_name || 'Mascota'}
                    />
                  ) : (
                    <div className={`carouselImgPlaceholder${loadingById[r.id] ? ' isLoading' : ''}`}>
                      <div className="carouselImgEmoji" aria-hidden="true">{getSpeciesEmoji(r.species)}</div>
                    </div>
                  )}
                </div>
                <div className="carouselCardBody">
                  <div className="carouselCardTop">
                    <div className="carouselCardTitle">
                      {r.species || 'Mascota'}{r.pet_name ? ` · ${r.pet_name}` : ''}
                    </div>
                    <div className="carouselCardMeta">{formatDateShort(r.created_at)}</div>
                  </div>
                  <div className="carouselCardMeta">
                    {r.comuna || ''}{r.region ? `, ${r.region}` : ''}
                  </div>
                  {r.distance_km != null ? (
                    <div className="carouselCardMeta">A {Number(r.distance_km).toFixed(1)} km</div>
                  ) : null}
                  {r.description ? <div className="carouselCardDesc">{r.description}</div> : null}
                  {r.status === 'perdido' ? (
                    <button
                      className="primaryBtn carouselActionBtn"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        openFoundModal(r.id)
                      }}
                    >
                      Encontré a la mascota
                    </button>
                  ) : (
                    <div className="carouselFoundBadge">✓ Encontrado</div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {modal.open ? (
        <div className="sysModalBackdrop" role="dialog" aria-modal="true" onMouseDown={closeFoundModal}>
          <div className="sysModalCard" onMouseDown={(e) => e.stopPropagation()}>
            <div className="sysModalHeader">
              <div className="sysModalTitle">Encontré a la mascota</div>
              <button className="miniBtn" type="button" onClick={closeFoundModal} disabled={leadSubmitting}>
                Cerrar
              </button>
            </div>

            {leadError ? <div className="formError">{leadError}</div> : null}

            <div className="form">
              <label className="field">
                <span>Foto de la mascota</span>
                <input type="file" accept="image/*" onChange={onLeadImageChange} />
                <span className="fileHint">{leadForm.nombre_archivo || 'Obligatoria. JPG, PNG o WEBP.'}</span>
              </label>

              <label className="field">
                <span>Ubicacion donde fue encontrada</span>
                <input
                  value={leadForm.found_location}
                  onChange={(e) => setLeadForm((s) => ({ ...s, found_location: e.target.value }))}
                  placeholder="Ej.: Recoleta, a una cuadra de Av. Providencia"
                />
              </label>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button className="miniBtn" type="button" onClick={closeFoundModal} disabled={leadSubmitting}>
                  Cancelar
                </button>
                <button className="primaryBtn" type="button" onClick={submitFoundLead} disabled={leadSubmitting}>
                  {leadSubmitting ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
