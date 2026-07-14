import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'

import {
  apiRequest,
  fileToDataUrl,
  formatDateShort,
  formatFileSize,
  getVeterinaryDocumentTypeLabel,
  MAX_DOCUMENT_OUTPUT_BYTES,
  MAX_IMAGE_UPLOAD_BYTES,
  optimizeImageFileToDataUrl,
  normalizeSpecies,
  normalizeStatus,
  VETERINARY_VERIFICATION_DOCUMENT_OPTIONS,
} from '../shared/appCore'

export default function PaginaPerfil({ user, authInicializando, reports, onLogout, busy, onMarkFound, onViewDetail }) {
  if (!user) {
    if (authInicializando) {
      return (
        <div className="mainInner">
          <section className="card">
            <h2 className="cardTitle">Perfil</h2>
            <div className="mutedText">Cargando sesión…</div>
          </section>
        </div>
      )
    }
    return <Navigate to="/login?next=/perfil" replace />
  }

  const [isEditing, setIsEditing] = useState(false)
  const [profileDesc, setProfileDesc] = useState('Amante de los animales y miembro activo de la comunidad Sanos y Salvos.')
  const [profilePic, setProfilePic] = useState('')
  const [detailsById, setDetailsById] = useState({})
  const [veterinariaData, setVeterinariaData] = useState(user?.veterinaria || null)
  const [documentosLocales, setDocumentosLocales] = useState([])
  const [documentoBusy, setDocumentoBusy] = useState(false)
  const [veterinariaError, setVeterinariaError] = useState('')
  const [veterinariaSuccess, setVeterinariaSuccess] = useState('')

  const myReports = useMemo(() => {
    return (reports || []).filter((r) => r.contact_email === user.email)
  }, [reports, user.email])
  const documentosVeterinaria = veterinariaData?.documentos_verificacion || []

  useEffect(() => {
    setVeterinariaData(user?.veterinaria || null)
  }, [user])

  useEffect(() => {
    const key = user?.username ? `profile_${user.username}` : null
    if (key) {
      const saved = localStorage.getItem(key)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.desc) setProfileDesc(parsed.desc)
        if (parsed.pic) setProfilePic(parsed.pic)
      }
    }
  }, [user])

  function handleSaveProfile() {
    const key = user?.username ? `profile_${user.username}` : null
    if (key) {
      localStorage.setItem(key, JSON.stringify({ desc: profileDesc, pic: profilePic }))
    }
    setIsEditing(false)
  }

  function onProfilePicChange(e) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const maxWidth = 300
        const scaleSize = maxWidth / img.width
        canvas.width = maxWidth
        canvas.height = img.height * scaleSize

        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
        setProfilePic(dataUrl)
      }
      img.src = event.target.result
    }
    reader.readAsDataURL(file)
  }

  useEffect(() => {
    const fetchDetails = async () => {
      const idsToFetch = myReports.map((r) => r.id).filter((id) => !detailsById[id])
      if (idsToFetch.length === 0) return

      const results = await Promise.allSettled(
        idsToFetch.map((id) => apiRequest(`/api/reports/${id}/`).then((res) => ({ id, data: res.data })))
      )

      setDetailsById((prev) => {
        const next = { ...prev }
        results.forEach((res) => {
          if (res.status === 'fulfilled' && res.value?.data) {
            next[res.value.id] = res.value.data
          }
        })
        return next
      })
    }
    fetchDetails()
  }, [myReports, detailsById])

  function getSpeciesEmoji(species) {
    const kind = normalizeSpecies(species)
    if (kind === 'perro') return '🐶'
    if (kind === 'gato') return '🐱'
    return '🐾'
  }

  async function handleDocumentosVeterinariaChange(e) {
    const archivos = Array.from(e.target.files || [])
    if (!archivos.length) {
      setDocumentosLocales([])
      return
    }

    setDocumentoBusy(true)
    setVeterinariaError('')
    setVeterinariaSuccess('')
    try {
      const nuevosDocumentos = []
      for (const file of archivos) {
        const esImagen = file.type.startsWith('image/')
        const esPdf = file.type === 'application/pdf'
        if (!esImagen && !esPdf) {
          setVeterinariaError('Solo se admiten imágenes o archivos PDF para la verificación.')
          e.target.value = ''
          return
        }
        if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
          setVeterinariaError(`El documento "${file.name}" es muy grande. Usa un archivo de máximo ${formatFileSize(MAX_IMAGE_UPLOAD_BYTES)}.`)
          e.target.value = ''
          return
        }
        const dataUrl = esImagen
          ? await optimizeImageFileToDataUrl(file, { maxEdge: 1800, maxBytes: MAX_DOCUMENT_OUTPUT_BYTES, mimePreference: 'image/jpeg' })
          : await fileToDataUrl(file)
        if (!dataUrl) {
          setVeterinariaError(`No se pudo procesar el documento "${file.name}".`)
          e.target.value = ''
          return
        }
        nuevosDocumentos.push({
          nombre_original: file.name,
          contenido_base64: dataUrl,
          vista_previa: esImagen ? dataUrl : '',
          tipo_documento: VETERINARY_VERIFICATION_DOCUMENT_OPTIONS[0].value,
        })
      }
      setDocumentosLocales((prev) => [...prev, ...nuevosDocumentos].slice(0, 6))
      e.target.value = ''
    } finally {
      setDocumentoBusy(false)
    }
  }

  function actualizarTipoDocumento(index, tipo_documento) {
    setDocumentosLocales((prev) => prev.map((documento, idx) => (idx === index ? { ...documento, tipo_documento } : documento)))
  }

  function eliminarDocumento(index) {
    setDocumentosLocales((prev) => prev.filter((_, idx) => idx !== index))
  }

  async function reenviarDocumentosVeterinaria() {
    if (!veterinariaData?.id || !veterinariaData?.user_id || !documentosLocales.length) {
      setVeterinariaError('Adjunta al menos un documento antes de reenviar la revisión.')
      return
    }
    setDocumentoBusy(true)
    setVeterinariaError('')
    setVeterinariaSuccess('')
    try {
      const documentosSubidos = []
      for (let index = 0; index < documentosLocales.length; index += 1) {
        const documentoLocal = documentosLocales[index]
        const archivoResp = await apiRequest('/api/archivos/', {
          method: 'POST',
          body: {
            tipo_entidad: 'veterinaria_verificacion',
            id_entidad: veterinariaData.user_id,
            categoria: documentoLocal.tipo_documento || 'otro',
            orden: index + 1,
            servicio_origen: 'ms_seguridad',
            nombre_original: documentoLocal.nombre_original,
            contenido_base64: documentoLocal.contenido_base64,
          },
        })
        if (!archivoResp.ok || !archivoResp.data?.id || !archivoResp.data?.url_descarga) {
          throw new Error(archivoResp.data?.detail || 'No se pudo subir uno de los documentos')
        }
        documentosSubidos.push({
          tipo_documento: documentoLocal.tipo_documento || 'otro',
          archivo_id: archivoResp.data.id,
          archivo_url: archivoResp.data.url_descarga,
          archivo_nombre: archivoResp.data.nombre_original || documentoLocal.nombre_original,
        })
      }

      const vincularResp = await apiRequest(`/api/auth/veterinarias/${veterinariaData.id}/`, {
        method: 'PATCH',
        body: {
          documentos_verificacion: documentosSubidos,
        },
      })
      if (!vincularResp.ok) {
        throw new Error(vincularResp.data?.detail || 'No se pudieron asociar los documentos')
      }

      setVeterinariaData(vincularResp.data)
      setDocumentosLocales([])
      setVeterinariaSuccess('Documentos reenviados correctamente. La veterinaria volvió a estado pendiente para revisión.')
    } catch (err) {
      setVeterinariaError(err?.message || 'No se pudieron reenviar los documentos')
    } finally {
      setDocumentoBusy(false)
    }
  }

  return (
    <div className="mainInner">
      <div style={{ marginBottom: '16px' }}>
        <Link className="miniBtn" to="/">← Volver al mapa de inicio</Link>
      </div>

      <section className="card" style={{ padding: '32px', marginBottom: '32px', display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap', backgroundColor: '#f8f9fa' }}>
        <div style={{ width: '100px', height: '100px', position: 'relative', flexShrink: 0 }}>
          {profilePic ? (
            <img src={profilePic} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--teal-500)' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', backgroundColor: 'var(--teal-500)', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '3rem', fontWeight: 'bold' }}>
              {(user.username || 'U').charAt(0).toUpperCase()}
            </div>
          )}
          {isEditing ? (
            <label style={{ position: 'absolute', bottom: -10, left: 0, right: 0, background: 'rgba(0,0,0,0.7)', color: 'white', fontSize: '0.8rem', textAlign: 'center', cursor: 'pointer', padding: '4px', borderRadius: '10px' }}>
              Subir Foto
              <input type="file" style={{ display: 'none' }} accept="image/*" onChange={onProfilePicChange} />
            </label>
          ) : null}
        </div>

        <div style={{ flex: '1 1 200px' }}>
          <h2 style={{ fontSize: '2rem', margin: '0 0 8px 0', color: '#064a55' }}>{user.username}</h2>
          <p style={{ margin: '0 0 12px 0', color: '#666', fontSize: '1.1rem' }}>{user.email}</p>
          {isEditing ? (
            <textarea value={profileDesc} onChange={(e) => setProfileDesc(e.target.value)} style={{ width: '100%', minHeight: '60px', padding: '12px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '1rem', fontFamily: 'inherit' }} />
          ) : (
            <p style={{ margin: 0, fontStyle: 'italic', color: '#444' }}>"{profileDesc}"</p>
          )}
        </div>

        <div style={{ flexShrink: 0 }}>
          {isEditing ? (
            <button className="primaryBtn" style={{ marginBottom: '12px', width: '100%', display: 'block' }} type="button" onClick={handleSaveProfile}>Guardar Cambios</button>
          ) : (
            <button className="miniBtn" style={{ marginBottom: '12px', width: '100%', display: 'block', padding: '10px' }} type="button" onClick={() => setIsEditing(true)}>Editar Perfil</button>
          )}
          <button className="primaryBtn danger" style={{ width: '100%' }} type="button" disabled={busy} onClick={onLogout}>Cerrar Sesión</button>
        </div>
      </section>

      {user?.role === 'veterinaria' && veterinariaData ? (
        <section className="card" style={{ marginBottom: '28px' }}>
          <h3 className="cardTitle" style={{ marginTop: 0 }}>Estado de verificación de veterinaria</h3>
          <div className="mutedText" style={{ marginBottom: '12px' }}>
            {veterinariaData.estado_verificacion === 'aprobada'
              ? 'Tu veterinaria está aprobada y ya puede aparecer en el mapa y confirmar reportes.'
              : veterinariaData.estado_verificacion === 'rechazada'
                ? 'La solicitud fue rechazada. Revisa el comentario del administrador.'
                : 'Tu solicitud está pendiente. Un administrador revisará los documentos antes de activarte.'}
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="boPill">
              Estado: {veterinariaData.estado_verificacion || 'pendiente'}
            </span>
          </div>
          {documentosVeterinaria.length ? (
            <div style={{ display: 'grid', gap: '10px', marginTop: '14px' }}>
              {documentosVeterinaria.map((documento, index) => (
                <div key={`${documento.archivo_id || 'doc'}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'center', padding: '10px 12px', border: '1px solid rgba(6, 74, 85, 0.12)', borderRadius: '12px' }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{documento.archivo_nombre || `Documento ${index + 1}`}</div>
                    <div className="mutedText">{documento.tipo_documento_label || getVeterinaryDocumentTypeLabel(documento.tipo_documento)}</div>
                  </div>
                  <a className="miniBtn" href={documento.archivo_url} target="_blank" rel="noreferrer">
                    Ver documento
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <div className="formError" style={{ marginTop: '12px' }}>
              No hay documentos de verificación guardados para esta veterinaria.
            </div>
          )}
          {veterinariaData.comentario_revision ? (
            <div className="formError" style={{ marginTop: '12px' }}>
              Comentario admin: {veterinariaData.comentario_revision}
            </div>
          ) : null}
          <div style={{ marginTop: '16px', display: 'grid', gap: '12px' }}>
            <label className="field" style={{ marginBottom: 0 }}>
              <span>Reenviar documentos de verificación</span>
              <input type="file" accept="image/*,application/pdf" onChange={handleDocumentosVeterinariaChange} multiple />
            </label>
            {documentosLocales.length ? (
              <div style={{ display: 'grid', gap: '10px' }}>
                {documentosLocales.map((documento, index) => (
                  <div key={`${documento.nombre_original || 'documento'}-${index}`} style={{ border: '1px solid rgba(6, 74, 85, 0.12)', borderRadius: '12px', padding: '12px', display: 'grid', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <strong>{documento.nombre_original}</strong>
                      <button type="button" className="miniBtn danger" onClick={() => eliminarDocumento(index)}>Quitar</button>
                    </div>
                    <label className="field" style={{ marginBottom: 0 }}>
                      <span>Tipo de documento</span>
                      <select value={documento.tipo_documento || 'otro'} onChange={(e) => actualizarTipoDocumento(index, e.target.value)}>
                        {VETERINARY_VERIFICATION_DOCUMENT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                    {documento.vista_previa ? (
                      <img
                        src={documento.vista_previa}
                        alt={documento.nombre_original || 'Documento de verificación'}
                        style={{ width: '100%', maxHeight: '220px', objectFit: 'contain', borderRadius: '10px', background: '#f8f9fa' }}
                      />
                    ) : (
                      <div style={{ padding: '14px', borderRadius: '10px', background: '#f8f9fa', color: '#475569', fontWeight: 700 }}>
                        PDF listo para revisión
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : null}
            {veterinariaError ? <div className="formError">{veterinariaError}</div> : null}
            {veterinariaSuccess ? <div className="formSuccess">{veterinariaSuccess}</div> : null}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              <button className="miniBtn" type="button" disabled={documentoBusy || !documentosLocales.length} onClick={reenviarDocumentosVeterinaria}>
                {documentoBusy ? 'Enviando documentos...' : 'Reenviar documentos'}
              </button>
              <div className="mutedText">Si tu registro se creó mientras el sistema rechazaba el guardado, puedes reenviar los respaldos desde aquí.</div>
            </div>
          </div>
        </section>
      ) : null}

      <h2 className="cardTitle" style={{ marginBottom: '20px' }}>Mis Reportes</h2>

      {myReports.length === 0 ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center', color: '#666' }}>Aún no has reportado ninguna mascota en esta cuenta.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
          {myReports.map((r) => {
            const imgUrl = r.image_data_url || detailsById[r.id]?.image_data_url
            return (
              <div key={r.id} className="carouselCard" style={{ margin: 0, width: 'auto', cursor: 'pointer' }} onClick={() => onViewDetail?.(r.id)}>
                <div className="carouselImgWrap" style={{ backgroundColor: '#f8f9fa' }}>
                  {imgUrl ? (
                    <img className="carouselImg" src={imgUrl} alt={r.pet_name || 'Mascota'} style={{ objectFit: 'contain', width: '100%', height: '100%' }} />
                  ) : (
                    <div className="carouselImgPlaceholder"><div className="carouselImgEmoji" aria-hidden="true">{getSpeciesEmoji(r.species)}</div></div>
                  )}
                </div>
                <div className="carouselCardTop">
                  <div className="carouselCardTitle">{r.species || 'Mascota'} · {r.pet_name}</div>
                  <div className="carouselCardMeta">{formatDateShort(r.created_at)}</div>
                </div>
                <div className="carouselCardMeta">{r.comuna || ''}{r.region ? `, ${r.region}` : ''}</div>
                <div style={{ marginTop: '16px' }}>
                  {normalizeStatus(r.status) === 'perdido' ? (
                    <>
                      <div className="boPill" style={{ background: '#ffe8cc', color: '#f4a340', textAlign: 'center', marginBottom: '12px', display: 'block' }}>🔍 Buscado</div>
                      <button className="primaryBtn" style={{ width: '100%' }} type="button" disabled={busy} onClick={(e) => { e.stopPropagation(); onMarkFound?.(r.id) }}>
                        Marcar como encontrado
                      </button>
                    </>
                  ) : (
                    <div className="boPill" style={{ background: '#e6fcf5', color: '#19a6b6', textAlign: 'center', display: 'block', padding: '12px' }}>✅ Encontrado</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
