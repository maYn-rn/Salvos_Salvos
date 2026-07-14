import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CircleMarker, MapContainer, Popup, TileLayer, ZoomControl } from 'react-leaflet'

import { InvalidarTamanoMapa, RecentrarMapa } from '../components/map/AyudantesMapa'
import { apiRequest, REGION_VIEW } from '../shared/appCore'

export default function PaginaVeterinariaDetalle() {
  const navigate = useNavigate()
  const { veterinariaId } = useParams()
  const [veterinaria, setVeterinaria] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  function handleBack() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1)
      return
    }
    navigate('/mapa')
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      const resp = await apiRequest(`/api/auth/veterinarias/${veterinariaId}/`, { method: 'GET' })
      if (cancelled) return
      if (!resp.ok) {
        setVeterinaria(null)
        setError(resp.data?.detail === 'not_found' ? 'No se encontró la veterinaria.' : 'No se pudo cargar la veterinaria.')
      } else {
        setVeterinaria(resp.data)
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [veterinariaId])

  const fallbackCenter = veterinaria?.region && REGION_VIEW[veterinaria.region]
    ? REGION_VIEW[veterinaria.region].center
    : [-33.4489, -70.6693]
  const mapCenter = veterinaria?.latitude != null && veterinaria?.longitude != null
    ? [Number(veterinaria.latitude), Number(veterinaria.longitude)]
    : fallbackCenter
  const mapZoom = veterinaria?.latitude != null && veterinaria?.longitude != null
    ? 15
    : (veterinaria?.region && REGION_VIEW[veterinaria.region] ? REGION_VIEW[veterinaria.region].zoom : 10)

  return (
    <div className="mainInner">
      <button className="miniBtn" type="button" onClick={handleBack} style={{ marginBottom: '18px' }}>
        ← Volver
      </button>

      {loading ? <section className="card"><div className="mutedText">Cargando veterinaria...</div></section> : null}
      {error ? <section className="card"><div className="formError">{error}</div></section> : null}

      {veterinaria ? (
        <div className="reportGrid">
          <section className="card" style={{ padding: '24px' }}>
            <div className="eyebrowTag" style={{ marginBottom: '10px' }}>Veterinaria registrada</div>
            <h1 className="cardTitle" style={{ marginTop: 0 }}>{veterinaria.nombre_veterinaria}</h1>
            <p className="mutedText" style={{ marginTop: '0', marginBottom: '18px' }}>
              {veterinaria.descripcion || 'Esta veterinaria aún no agregó una descripción.'}
            </p>

            <table className="adminTable" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr><td style={{ padding: '10px 8px' }}><strong>Dueño o responsable</strong></td><td style={{ padding: '10px 8px' }}>{veterinaria.owner_name || 'No informado'}</td></tr>
                <tr><td style={{ padding: '10px 8px' }}><strong>Email</strong></td><td style={{ padding: '10px 8px' }}>{veterinaria.owner_email || 'No informado'}</td></tr>
                <tr><td style={{ padding: '10px 8px' }}><strong>Teléfono</strong></td><td style={{ padding: '10px 8px' }}>{veterinaria.telefono || 'No informado'}</td></tr>
                <tr><td style={{ padding: '10px 8px' }}><strong>Dirección</strong></td><td style={{ padding: '10px 8px' }}>{veterinaria.direccion || 'No informada'}</td></tr>
                <tr><td style={{ padding: '10px 8px' }}><strong>Comuna</strong></td><td style={{ padding: '10px 8px' }}>{veterinaria.comuna || 'No informada'}</td></tr>
                <tr><td style={{ padding: '10px 8px' }}><strong>Región</strong></td><td style={{ padding: '10px 8px' }}>{veterinaria.region || 'No informada'}</td></tr>
                <tr>
                  <td style={{ padding: '10px 8px' }}><strong>Sitio web</strong></td>
                  <td style={{ padding: '10px 8px' }}>
                    {veterinaria.sitio_web ? <a href={veterinaria.sitio_web} target="_blank" rel="noreferrer">{veterinaria.sitio_web}</a> : 'No informado'}
                  </td>
                </tr>
                <tr><td style={{ padding: '10px 8px' }}><strong>Puede confirmar reportes</strong></td><td style={{ padding: '10px 8px' }}>{veterinaria.puede_confirmar_reportes ? 'Sí' : 'No'}</td></tr>
              </tbody>
            </table>

            <div style={{ marginTop: '18px' }}>
              <Link className="primaryBtn" to="/mapa">Ver en el mapa</Link>
            </div>
          </section>

          <section className="card" style={{ padding: '14px' }}>
            <div className="cardTitle" style={{ marginBottom: '10px' }}>Ubicación</div>
            <div className="adoptionSingleMapWrap" style={{ height: '420px' }}>
              <MapContainer className="adoptionSingleMap" center={mapCenter} zoom={mapZoom} scrollWheelZoom zoomControl={false}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <ZoomControl position="topright" />
                <RecentrarMapa center={mapCenter} zoom={mapZoom} />
                <InvalidarTamanoMapa watch={`vet-${veterinaria.id}`} />
                {veterinaria.latitude != null && veterinaria.longitude != null ? (
                  <CircleMarker center={[Number(veterinaria.latitude), Number(veterinaria.longitude)]} radius={8} pathOptions={{ color: '#7c3aed', fillColor: '#8b5cf6', fillOpacity: 0.95 }}>
                    <Popup>{veterinaria.nombre_veterinaria}</Popup>
                  </CircleMarker>
                ) : null}
              </MapContainer>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}
