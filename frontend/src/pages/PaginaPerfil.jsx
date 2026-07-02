import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'

import { apiRequest, formatDateShort, normalizeSpecies, normalizeStatus } from '../shared/appCore'

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

  const myReports = useMemo(() => {
    return (reports || []).filter((r) => r.contact_email === user.email)
  }, [reports, user.email])

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

      {user?.role === 'veterinaria' && user?.veterinaria ? (
        <section className="card" style={{ marginBottom: '28px' }}>
          <h3 className="cardTitle" style={{ marginTop: 0 }}>Estado de verificación de veterinaria</h3>
          <div className="mutedText" style={{ marginBottom: '12px' }}>
            {user.veterinaria.estado_verificacion === 'aprobada'
              ? 'Tu veterinaria está aprobada y ya puede aparecer en el mapa y confirmar reportes.'
              : user.veterinaria.estado_verificacion === 'rechazada'
                ? 'La solicitud fue rechazada. Revisa el comentario del administrador.'
                : 'Tu solicitud está pendiente. Un administrador revisará el documento antes de activarte.'}
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="boPill">
              Estado: {user.veterinaria.estado_verificacion || 'pendiente'}
            </span>
            {user.veterinaria.documento_verificacion_url ? (
              <a className="miniBtn" href={user.veterinaria.documento_verificacion_url} target="_blank" rel="noreferrer">
                Ver documento enviado
              </a>
            ) : null}
          </div>
          {user.veterinaria.comentario_revision ? (
            <div className="formError" style={{ marginTop: '12px' }}>
              Comentario admin: {user.veterinaria.comentario_revision}
            </div>
          ) : null}
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
