import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'
let accessToken = null

const REGION_COMUNAS = [
  {
    region: 'Región Metropolitana de Santiago',
    comunas: [
      'Santiago',
      'Providencia',
      'Las Condes',
      'Ñuñoa',
      'La Florida',
      'Maipú',
      'Puente Alto',
      'San Miguel',
      'Estación Central',
      'La Reina',
      'Peñalolén',
      'Recoleta',
      'Independencia',
      'Quilicura',
      'Renca',
      'Conchalí',
      'Lo Prado',
      'Cerro Navia',
      'Pudahuel',
      'Huechuraba',
      'Vitacura',
      'San Joaquín',
      'Macul',
      'Lo Barnechea',
      'La Cisterna',
      'El Bosque',
      'San Ramón',
      'Pedro Aguirre Cerda',
      'La Pintana',
      'Lo Espejo',
      'Cerrillos',
      'San Bernardo',
      'Peñaflor',
      'Padre Hurtado',
      'Talagante',
      'El Monte',
      'Buin',
      'Paine',
      'Colina',
      'Lampa',
      'Tiltil',
      'Isla de Maipo',
      'Calera de Tango',
      'Pirque',
      'San José de Maipo',
      'Melipilla',
      'Curacaví',
      'María Pinto',
      'Alhué',
      'San Pedro',
    ],
  },
  { region: 'Región de Valparaíso', comunas: ['Valparaíso', 'Viña del Mar', 'Quilpué', 'Villa Alemana', 'Quillota', 'San Antonio', 'Otra'] },
  { region: "Región del Libertador General Bernardo O'Higgins", comunas: ['Rancagua', 'San Fernando', 'Santa Cruz', 'Otra'] },
  { region: 'Región del Maule', comunas: ['Talca', 'Curicó', 'Linares', 'Constitución', 'Otra'] },
  { region: 'Región de Ñuble', comunas: ['Chillán', 'San Carlos', 'Bulnes', 'Otra'] },
  { region: 'Región del Biobío', comunas: ['Concepción', 'Talcahuano', 'Los Ángeles', 'Coronel', 'San Pedro de la Paz', 'Otra'] },
  { region: 'Región de La Araucanía', comunas: ['Temuco', 'Padre Las Casas', 'Villarrica', 'Pucón', 'Angol', 'Otra'] },
  { region: 'Región de Los Ríos', comunas: ['Valdivia', 'La Unión', 'Río Bueno', 'Otra'] },
  { region: 'Región de Los Lagos', comunas: ['Puerto Montt', 'Puerto Varas', 'Osorno', 'Castro', 'Ancud', 'Otra'] },
  { region: 'Región de Aysén del General Carlos Ibáñez del Campo', comunas: ['Coyhaique', 'Aysén', 'Chile Chico', 'Otra'] },
  { region: 'Región de Magallanes y de la Antártica Chilena', comunas: ['Punta Arenas', 'Puerto Natales', 'Porvenir', 'Otra'] },
  { region: 'Región de Atacama', comunas: ['Copiapó', 'Caldera', 'Vallenar', 'Otra'] },
  { region: 'Región de Coquimbo', comunas: ['La Serena', 'Coquimbo', 'Ovalle', 'Illapel', 'Otra'] },
  { region: 'Región de Antofagasta', comunas: ['Antofagasta', 'Calama', 'Tocopilla', 'Otra'] },
  { region: 'Región de Tarapacá', comunas: ['Iquique', 'Alto Hospicio', 'Otra'] },
  { region: 'Región de Arica y Parinacota', comunas: ['Arica', 'Camarones', 'Otra'] },
]

const SPECIES_OPTIONS = ['Perro', 'Gato', 'Otro']

const REGION_VIEW = {
  'Región Metropolitana de Santiago': { center: [-33.4489, -70.6693], zoom: 10 },
  'Región de Valparaíso': { center: [-33.0472, -71.6127], zoom: 10 },
  "Región del Libertador General Bernardo O'Higgins": { center: [-34.1701, -70.7406], zoom: 10 },
  'Región del Maule': { center: [-35.4264, -71.6554], zoom: 9 },
  'Región de Ñuble': { center: [-36.6063, -72.1034], zoom: 10 },
  'Región del Biobío': { center: [-36.8270, -73.0503], zoom: 10 },
  'Región de La Araucanía': { center: [-38.7359, -72.5904], zoom: 10 },
  'Región de Los Ríos': { center: [-39.8174, -73.2459], zoom: 10 },
  'Región de Los Lagos': { center: [-41.4689, -72.9411], zoom: 9 },
  'Región de Aysén del General Carlos Ibáñez del Campo': { center: [-45.5712, -72.0683], zoom: 8 },
  'Región de Magallanes y de la Antártica Chilena': { center: [-53.1638, -70.9171], zoom: 9 },
  'Región de Atacama': { center: [-27.3668, -70.3322], zoom: 9 },
  'Región de Coquimbo': { center: [-29.9027, -71.2519], zoom: 9 },
  'Región de Antofagasta': { center: [-23.6509, -70.3975], zoom: 9 },
  'Región de Tarapacá': { center: [-20.2208, -70.1431], zoom: 10 },
  'Región de Arica y Parinacota': { center: [-18.4783, -70.3126], zoom: 10 },
}

function getComunasForRegion(region) {
  const item = REGION_COMUNAS.find((r) => r.region === region)
  return item ? item.comunas : []
}

function normalizeSpecies(species) {
  const s = (species || '').trim().toLowerCase()
  if (s === 'perro') return 'perro'
  if (s === 'gato') return 'gato'
  return 'otro'
}

function normalizeStatus(status) {
  const s = (status || '').trim().toLowerCase()
  if (s === 'lost') return 'perdido'
  if (s === 'found') return 'encontrado'
  if (s === 'perdido') return 'perdido'
  if (s === 'encontrado') return 'encontrado'
  return (status || '').trim()
}

const petIconCache = new Map()
function getPetIcon(species, { highlight = false } = {}) {
  const key = `${normalizeSpecies(species)}|${highlight ? '1' : '0'}`
  const cached = petIconCache.get(key)
  if (cached) return cached

  const kind = normalizeSpecies(species)
  const emoji = kind === 'perro' ? '🐶' : kind === 'gato' ? '🐱' : '🐾'
  const size = highlight ? 40 : 34
  const icon = L.divIcon({
    className: 'petMarkerWrapper',
    html: `<div class="petMarkerBubble${highlight ? ' isHighlight' : ''}">${emoji}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
  petIconCache.set(key, icon)
  return icon
}

async function apiRequest(path, { method = 'GET', body } = {}) {
  const url = `${API_BASE}${path}`
  const headers = {}
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const resp = await fetch(url, {
    method,
    headers,
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const text = await resp.text()
  const data = text ? (() => { try { return JSON.parse(text) } catch { return text } })() : null
  return { ok: resp.ok, status: resp.status, data }
}

async function refreshAccess() {
  // 1. Recuperamos el refresh token guardado
  const refreshToken = localStorage.getItem('refresh_token');

  // 2. Si no hay token, no intentamos el refresh
  if (!refreshToken) return false;

  // 3. Enviamos el token en el body y agregamos el slash final
  const resp = await apiRequest('/api/auth/refresh/', { 
    method: 'POST', 
    body: { refresh: refreshToken } 
  });

  if (!resp.ok || !resp.data?.access) {
    accessToken = null;
    return false;
  }
  
  accessToken = resp.data.access;
  return true;
}

function Recenter({ center, zoom }) {
  const map = useMap()
  useEffect(() => {
    if (!center) return
    map.setView(center, zoom, { animate: true })
  }, [map, center, zoom])
  return null
}

function InvalidateSize({ watch }) {
  const map = useMap()
  useEffect(() => {
    const t = setTimeout(() => {
      map.invalidateSize()
    }, 0)
    return () => clearTimeout(t)
  }, [map, watch])

  useEffect(() => {
    function onResize() {
      map.invalidateSize()
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [map])

  return null
}

function LocationPicker({ onPick }) {
  useMapEvents({
    click(e) {
      onPick({ latitude: e.latlng.lat, longitude: e.latlng.lng })
    },
  })
  return null
}

function ReportsMarkers({ reports, highlightId }) {
  const [detailsById, setDetailsById] = useState({})
  const [loadingById, setLoadingById] = useState({})

  async function ensureDetails(id) {
    if (!id) return
    if (detailsById[id] || loadingById[id]) return
    setLoadingById((s) => ({ ...s, [id]: true }))
    try {
      const resp = await apiRequest(`/api/reports/${id}/`)
      if (resp.ok && resp.data) setDetailsById((s) => ({ ...s, [id]: resp.data }))
    } finally {
      setLoadingById((s) => ({ ...s, [id]: false }))
    }
  }

  return (reports || [])
    .filter((r) => r && r.latitude != null && r.longitude != null)
    .map((r) => {
      const isHighlight = highlightId != null && r.id === highlightId
      const details = detailsById[r.id] || null
      return (
        <Marker
          key={r.id}
          position={[Number(r.latitude), Number(r.longitude)]}
          icon={getPetIcon(r.species, { highlight: isHighlight })}
          eventHandlers={{
            click: () => ensureDetails(r.id),
          }}
        >
          <Popup>
            {loadingById[r.id] ? <div className="popupMeta">Cargando…</div> : null}
            {details?.image_data_url ? (
              <img className="popupImg" src={details.image_data_url} alt={details.pet_name || 'Mascota'} />
            ) : null}
            <div className="popupTitle">
              {r.pet_name ? r.pet_name : 'Mascota sin nombre'} · {r.species || 'Mascota'}
            </div>
            <div className="popupMeta">
              {(r.comuna || '').trim()}{r.region ? `, ${r.region}` : ''}
            </div>
            {r.created_at ? <div className="popupMeta">Reportado: {formatDateShort(r.created_at)}</div> : null}
            {r.description ? <div className="popupDesc">{r.description}</div> : null}
          </Popup>
        </Marker>
      )
    })
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function formatDateShort(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short' }).format(d)
}

function RecentReportsCarousel({ title, reports, onMarkFound }) {
  const trackRef = useRef(null)
  const [detailsById, setDetailsById] = useState({})
  const [loadingById, setLoadingById] = useState({})
  const [markingById, setMarkingById] = useState({})
  const detailsRef = useRef({})
  const loadingRef = useRef({})
  const fetchTokenRef = useRef(0)

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

      const results = await Promise.allSettled(toFetch.map((id) => apiRequest(`/api/reports/${id}/`)))
      if (fetchTokenRef.current !== token) return

      const updates = []
      for (let i = 0; i < toFetch.length; i++) {
        const id = toFetch[i]
        const r = results[i]
        if (r.status === 'fulfilled' && r.value?.ok && r.value?.data) updates.push([id, r.value.data])
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

      <div className="carouselTrack" ref={trackRef}>
        {(reports || []).length === 0 ? (
          <div className="carouselEmpty">Sin reportes recientes</div>
        ) : (
          (reports || []).map((r) => (
            <div key={r.id} className="carouselCard">
              <div className="carouselImgWrap">
                {detailsById[r.id]?.image_data_url ? (
                  <img className="carouselImg" src={detailsById[r.id].image_data_url} alt={r.pet_name || 'Mascota'} />
                ) : (
                  <div className={`carouselImgPlaceholder${loadingById[r.id] ? ' isLoading' : ''}`}>
                    <div className="carouselImgEmoji" aria-hidden="true">{getSpeciesEmoji(r.species)}</div>
                  </div>
                )}
              </div>
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
                  className="primaryBtn"
                  style={{ width: '100%', marginTop: '12px' }}
                  type="button"
                  disabled={markingById[r.id]}
                  onClick={() => onMarkFound?.(r.id)}
                >
                  {markingById[r.id] ? 'Marcando...' : 'Reportar como encontrado'}
                </button>
              ) : (
                <div className="carouselCardMeta" style={{ marginTop: '12px', fontWeight: 'bold', color: '#19a6b6' }}>
                  ✓ Encontrado
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  )
}

function AdminDashboardPage() {
  const [users, setUsers] = useState([])
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function buildMonthlySeries(items, monthsBack = 6) {
    const now = new Date()
    const buckets = []
    for (let i = monthsBack - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      buckets.push({
        y: d.getFullYear(),
        m: d.getMonth(),
        label: d.toLocaleString('es-CL', { month: 'short' }),
        value: 0,
      })
    }
    for (const r of items || []) {
      if (!r?.created_at) continue
      const t = new Date(r.created_at)
      if (Number.isNaN(t.getTime())) continue
      const y = t.getFullYear()
      const m = t.getMonth()
      const b = buckets.find((x) => x.y === y && x.m === m)
      if (b) b.value += 1
    }
    return buckets
  }

  function TrendChart({ series }) {
    const w = 920
    const h = 220
    const padX = 24
    const padY = 24
    const maxV = Math.max(1, ...series.map((s) => s.value))
    const dx = series.length > 1 ? (w - padX * 2) / (series.length - 1) : 0
    const points = series.map((s, i) => {
      const x = padX + i * dx
      const y = padY + (1 - s.value / maxV) * (h - padY * 2)
      return { x, y }
    })
    const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')
    const area = `${d} L ${(padX + (series.length - 1) * dx).toFixed(2)} ${(h - padY).toFixed(2)} L ${padX.toFixed(2)} ${(h - padY).toFixed(2)} Z`

    return (
      <svg className="boChart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Tendencia de reportes">
        <defs>
          <linearGradient id="boLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="var(--teal-500)" />
            <stop offset="1" stopColor="var(--orange-500)" />
          </linearGradient>
          <linearGradient id="boFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="rgba(25, 166, 182, 0.18)" />
            <stop offset="1" stopColor="rgba(244, 163, 64, 0.05)" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#boFill)" />
        <path d={d} fill="none" stroke="url(#boLine)" strokeWidth="3" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="4" fill="#fff" stroke="rgba(6, 74, 85, 0.55)" strokeWidth="2" />
        ))}
      </svg>
    )
  }

  async function loadAll() {
    const [uResp, rResp] = await Promise.all([
      apiRequest('/api/auth/users/', { method: 'GET' }),
      apiRequest('/api/reports/?include_unconfirmed=1', { method: 'GET' }),
    ])

    if (!uResp.ok) throw new Error(uResp.data?.detail || 'No se pudieron cargar los usuarios')
    if (!rResp.ok) throw new Error(rResp.data?.detail || 'No se pudieron cargar los reportes')

    setUsers(uResp.data?.results || [])
    setReports(rResp.data?.results || [])
  }

  async function confirmReport(id) {
    // Agregamos el slash / después del ${id}
    const resp = await apiRequest(`/api/reports/${id}/`, { method: 'PATCH', body: { is_confirmed: true } })
    if (!resp.ok) throw new Error(resp.data?.detail || 'No se pudo confirmar')
    await loadAll()
  }

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        await loadAll()
      } catch (e) {
        setError(e?.message || 'Error')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const totalUsers = users.length
  const totalReports = reports.length
  const pendingReports = reports.filter((r) => !r.is_confirmed)
  const confirmedReports = reports.filter((r) => r.is_confirmed)
  const lostCount = reports.filter((r) => normalizeStatus(r.status) === 'perdido').length
  const foundCount = reports.filter((r) => normalizeStatus(r.status) === 'encontrado').length
  const trend = buildMonthlySeries(reports, 6)
  const recentActivity = reports
    .slice()
    .sort((a, b) => (Date.parse(b.updated_at || b.created_at || '') || 0) - (Date.parse(a.updated_at || a.created_at || '') || 0))
    .slice(0, 6)

  return (
    <section className="boCard">
      <div className="boCardTop">
        <div>
          <div className="boH1">Dashboard</div>
          <div className="boSub">Resumen del sistema</div>
        </div>
        <button className="miniBtn" type="button" disabled={loading} onClick={() => {
          setLoading(true)
          setError('')
          loadAll().catch((e) => setError(e?.message || 'Error')).finally(() => setLoading(false))
        }}>
          Actualizar
        </button>
      </div>

      {error ? <div className="formError">{error}</div> : null}
      {loading ? <div className="mutedText">Cargando…</div> : null}

      <div className="boKpiGrid">
        <div className="boKpi">
          <div className="boKpiLabel">Usuarios</div>
          <div className="boKpiValue">{totalUsers}</div>
          <div className="boKpiMeta">Registrados</div>
        </div>
        <div className="boKpi">
          <div className="boKpiLabel">Reportes</div>
          <div className="boKpiValue">{totalReports}</div>
          <div className="boKpiMeta">Totales</div>
        </div>
        <div className="boKpi">
          <div className="boKpiLabel">Pendientes</div>
          <div className="boKpiValue">{pendingReports.length}</div>
          <div className="boKpiMeta">Por confirmar</div>
        </div>
        <div className="boKpi">
          <div className="boKpiLabel">Confirmados</div>
          <div className="boKpiValue">{confirmedReports.length}</div>
          <div className="boKpiMeta">Visibles en mapa</div>
        </div>
      </div>

      <div className="boGrid2">
        <div className="boCard boCardInset">
          <div className="boCardTop">
            <div>
              <div className="boH2">Tendencia</div>
              <div className="boSub">Reportes últimos 6 meses</div>
            </div>
            <div className="boPills">
              <span className="boPill">Perdidos: {lostCount}</span>
              <span className="boPill">Encontrados: {foundCount}</span>
            </div>
          </div>
          <TrendChart series={trend} />
          <div className="boXAxis">
            {trend.map((t) => (
              <div key={`${t.y}-${t.m}`} className="boXTick">{t.label}</div>
            ))}
          </div>
        </div>

        <div className="boCard boCardInset">
          <div className="boCardTop">
            <div>
              <div className="boH2">Actividad reciente</div>
              <div className="boSub">Últimos movimientos</div>
            </div>
          </div>
          <div className="boList">
            {recentActivity.map((r) => (
              <div key={r.id} className="boListItem">
                <div className="boDot" aria-hidden="true" />
                <div className="boListMain">
                  <div className="boListTitle">
                    #{r.id} · {r.pet_name || 'Sin nombre'} · {r.species || 'Mascota'}
                  </div>
                  <div className="boListMeta">
                    {r.is_confirmed ? 'Confirmado' : 'Pendiente'} · {r.updated_at ? formatDateShort(r.updated_at) : (r.created_at ? formatDateShort(r.created_at) : '-')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="boCard boCardInset">
        <div className="boCardTop">
          <div>
            <div className="boH2">Pendientes recientes</div>
            <div className="boSub">Confirma antes de que aparezcan en el mapa</div>
          </div>
        </div>
        <div className="adminTableWrap">
          <table className="adminTable">
            <thead>
              <tr>
                <th>ID</th>
                <th>Mascota</th>
                <th>Zona</th>
                <th>Creado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {pendingReports.slice(0, 8).map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{r.pet_name || 'Sin nombre'} · {r.species || 'Mascota'}</td>
                  <td>{r.comuna || ''}{r.region ? `, ${r.region}` : ''}</td>
                  <td>{r.created_at ? formatDateShort(r.created_at) : '-'}</td>
                  <td>
                    <button
                      className="miniBtn"
                      type="button"
                      disabled={loading}
                      onClick={() => {
                        setLoading(true)
                        setError('')
                        confirmReport(r.id).catch((e) => setError(e?.message || 'Error')).finally(() => setLoading(false))
                      }}
                    >
                      Confirmar
                    </button>
                  </td>
                </tr>
              ))}
              {pendingReports.length === 0 ? (
                <tr>
                  <td colSpan={5} className="boEmpty">No hay pendientes.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

function AdminUsersPage({ search }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function loadUsers() {
    const resp = await apiRequest('/api/auth/users/', { method: 'GET' })
    if (!resp.ok) throw new Error(resp.data?.detail || 'No se pudieron cargar los usuarios')
    setUsers(resp.data?.results || [])
  }

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        await loadUsers()
      } catch (e) {
        setError(e?.message || 'Error')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const q = (search || '').trim().toLowerCase()
  const filtered = q
    ? users.filter((u) => `${u.username || ''} ${u.email || ''} ${u.id || ''}`.toLowerCase().includes(q))
    : users

  return (
    <section className="boCard">
      <div className="boCardTop">
        <div>
          <div className="boH1">Usuarios</div>
          <div className="boSub">Listado de cuentas registradas</div>
        </div>
        <button className="miniBtn" type="button" disabled={loading} onClick={() => {
          setLoading(true)
          setError('')
          loadUsers().catch((e) => setError(e?.message || 'Error')).finally(() => setLoading(false))
        }}>
          Actualizar
        </button>
      </div>
      {error ? <div className="formError">{error}</div> : null}
      {loading ? <div className="mutedText">Cargando…</div> : null}
      <div className="adminTableWrap">
        <table className="adminTable">
          <thead>
            <tr>
              <th>ID</th>
              <th>Usuario</th>
              <th>Email</th>
              <th>Staff</th>
              <th>Activo</th>
              <th>Registro</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id}>
                <td>{u.id}</td>
                <td>{u.username}</td>
                <td>{u.email || '-'}</td>
                <td>{u.is_staff ? 'Sí' : 'No'}</td>
                <td>{u.is_active ? 'Sí' : 'No'}</td>
                <td>{u.date_joined ? formatDateShort(u.date_joined) : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function AdminReportsPage({ search }) {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({
    pet_name: '',
    species: '',
    region: '',
    comuna: '',
    status: '',
    description: '',
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    latitude: '',
    longitude: '',
  })

  async function loadReports() {
    const resp = await apiRequest('/api/reports/?include_unconfirmed=1', { method: 'GET' })
    if (!resp.ok) throw new Error(resp.data?.detail || 'No se pudieron cargar los reportes')
    setReports(resp.data?.results || [])
  }

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        await loadReports()
      } catch (e) {
        setError(e?.message || 'Error')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const q = (search || '').trim().toLowerCase()
  const filtered = q
    ? reports.filter((r) => {
        const hay = `${r.id || ''} ${r.pet_name || ''} ${r.species || ''} ${r.region || ''} ${r.comuna || ''} ${r.status || ''}`
        return hay.toLowerCase().includes(q)
      })
    : reports

  function startEdit(r) {
    setEditingId(r.id)
    setEditForm({
      pet_name: r.pet_name || '',
      species: r.species || '',
      region: r.region || '',
      comuna: r.comuna || '',
      status: normalizeStatus(r.status) || 'perdido',
      description: r.description || '',
      contact_name: r.contact_name || '',
      contact_phone: r.contact_phone || '',
      contact_email: r.contact_email || '',
      latitude: r.latitude == null ? '' : String(r.latitude),
      longitude: r.longitude == null ? '' : String(r.longitude),
    })
  }

  function stopEdit() {
    setEditingId(null)
  }

  async function confirmReport(id) {
    // 1. Agregamos el slash /
    const resp = await apiRequest(`/api/reports/${id}/`, { method: 'PATCH', body: { is_confirmed: true } })
    if (!resp.ok) throw new Error(resp.data?.detail || 'No se pudo confirmar')
    await loadReports() 
  }

  async function deleteReport(id) {
    const resp = await apiRequest(`/api/reports/${id}/`, { method: 'DELETE' })
    if (!resp.ok) throw new Error(resp.data?.detail || 'No se pudo borrar')
    if (editingId === id) setEditingId(null)
    await loadReports()
  }

  async function saveEdit(id) {
    const body = {
      pet_name: editForm.pet_name,
      species: editForm.species,
      region: editForm.region,
      comuna: editForm.comuna,
      status: editForm.status,
      description: editForm.description,
      contact_name: editForm.contact_name,
      contact_phone: editForm.contact_phone,
      contact_email: editForm.contact_email,
      latitude: editForm.latitude === '' ? null : Number(editForm.latitude),
      longitude: editForm.longitude === '' ? null : Number(editForm.longitude),
    }
    const resp = await apiRequest(`/api/reports/${id}/`, { method: 'PATCH', body })
    if (!resp.ok) throw new Error(resp.data?.detail || 'No se pudo guardar')
    setEditingId(null)
    await loadReports()
  }

  return (
    <section className="boCard">
      <div className="boCardTop">
        <div>
          <div className="boH1">Reportes</div>
          <div className="boSub">Gestiona confirmación, edición y eliminación</div>
        </div>
        <button className="miniBtn" type="button" disabled={loading} onClick={() => {
          setLoading(true)
          setError('')
          loadReports().catch((e) => setError(e?.message || 'Error')).finally(() => setLoading(false))
        }}>
          Actualizar
        </button>
      </div>
      {error ? <div className="formError">{error}</div> : null}
      {loading ? <div className="mutedText">Cargando…</div> : null}

      <div className="adminTableWrap">
        <table className="adminTable">
          <thead>
            <tr>
              <th>ID</th>
              <th>Mascota</th>
              <th>Zona</th>
              <th>Estado</th>
              <th>Confirmado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.pet_name || 'Sin nombre'} · {r.species || 'Mascota'}</td>
                <td>{r.comuna || ''}{r.region ? `, ${r.region}` : ''}</td>
                <td>{normalizeStatus(r.status) || '-'}</td>
                <td>{r.is_confirmed ? 'Sí' : 'No'}</td>
                <td>
                  <div className="adminRowActions">
                    {!r.is_confirmed ? (
                      <button className="miniBtn" type="button" disabled={loading} onClick={() => {
                        setLoading(true)
                        setError('')
                        confirmReport(r.id).catch((e) => setError(e?.message || 'Error')).finally(() => setLoading(false))
                      }}>
                        Confirmar
                      </button>
                    ) : null}
                    <button className="miniBtn" type="button" disabled={loading} onClick={() => startEdit(r)}>
                      Editar
                    </button>
                    <button className="miniBtn danger" type="button" disabled={loading} onClick={() => {
                      setLoading(true)
                      setError('')
                      deleteReport(r.id).catch((e) => setError(e?.message || 'Error')).finally(() => setLoading(false))
                    }}>
                      Borrar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingId != null ? (
        <div className="adminEdit">
          <div className="adminEditTop">
            <div className="adminEditTitle">Editar reporte #{editingId}</div>
            <button className="miniBtn" type="button" onClick={stopEdit} disabled={loading}>Cerrar</button>
          </div>
          <div className="form adminForm">
            <label className="field">
              <span>Nombre</span>
              <input value={editForm.pet_name} onChange={(e) => setEditForm((s) => ({ ...s, pet_name: e.target.value }))} />
            </label>
            <label className="field">
              <span>Especie</span>
              <input value={editForm.species} onChange={(e) => setEditForm((s) => ({ ...s, species: e.target.value }))} />
            </label>
            <label className="field">
              <span>Región</span>
              <input value={editForm.region} onChange={(e) => setEditForm((s) => ({ ...s, region: e.target.value }))} />
            </label>
            <label className="field">
              <span>Comuna</span>
              <input value={editForm.comuna} onChange={(e) => setEditForm((s) => ({ ...s, comuna: e.target.value }))} />
            </label>
            <label className="field">
              <span>Estado</span>
              <select value={editForm.status} onChange={(e) => setEditForm((s) => ({ ...s, status: e.target.value }))}>
                <option value="perdido">Perdido</option>
                <option value="encontrado">Encontrado</option>
              </select>
            </label>
            <label className="field">
              <span>Descripción</span>
              <input value={editForm.description} onChange={(e) => setEditForm((s) => ({ ...s, description: e.target.value }))} />
            </label>
            <label className="field">
              <span>Contacto (nombre)</span>
              <input value={editForm.contact_name} onChange={(e) => setEditForm((s) => ({ ...s, contact_name: e.target.value }))} />
            </label>
            <label className="field">
              <span>Contacto (teléfono)</span>
              <input value={editForm.contact_phone} onChange={(e) => setEditForm((s) => ({ ...s, contact_phone: e.target.value }))} />
            </label>
            <label className="field">
              <span>Contacto (email)</span>
              <input value={editForm.contact_email} onChange={(e) => setEditForm((s) => ({ ...s, contact_email: e.target.value }))} />
            </label>
            <label className="field">
              <span>Latitud</span>
              <input
                type="number"
                step="any"
                value={editForm.latitude}
                onChange={(e) => setEditForm((s) => ({ ...s, latitude: e.target.value }))}
              />
            </label>
            <label className="field">
              <span>Longitud</span>
              <input
                type="number"
                step="any"
                value={editForm.longitude}
                onChange={(e) => setEditForm((s) => ({ ...s, longitude: e.target.value }))}
              />
            </label>
            <button className="primaryBtn" type="button" disabled={loading} onClick={() => {
              setLoading(true)
              setError('')
              saveEdit(editingId).catch((e) => setError(e?.message || 'Error')).finally(() => setLoading(false))
            }}>
              Guardar cambios
            </button>
          </div>
          <div className="mutedText">Si editas un reporte, quedará no confirmado hasta que lo confirmes nuevamente.</div>
        </div>
      ) : null}
    </section>
  )
}

function AdminBackoffice({ user, onLogout, busy }) {
  const isAdmin = Boolean(user?.is_staff || user?.is_superuser)
  const location = useLocation()
  const [search, setSearch] = useState('')

  if (!isAdmin) {
    return (
      <div className="mainInner">
        <section className="card">
          <h2 className="cardTitle">Backoffice</h2>
          <div className="mutedText">Acceso restringido.</div>
        </section>
      </div>
    )
  }

  const path = location.pathname
  const active = (suffix) => (path === `/admin/${suffix}` ? ' isActive' : '')
  const title =
    path.startsWith('/admin/reportes') ? 'Reportes' :
    path.startsWith('/admin/usuarios') ? 'Usuarios' :
    'Dashboard'
  const initials = (user?.username || 'A').slice(0, 1).toUpperCase()

  return (
    <div className="boApp">
      <div className="boLayout">
        <aside className="boSidebar" aria-label="Navegación del backoffice">
          <Link className="boBrand" to="/">
            <img className="boLogo" src="/logo_nuevo_sys.png" alt="Sanos y Salvos" />
            <div className="boBrandText">
              <div className="boBrandName">Sanos y Salvos</div>
              <div className="boBrandSub">Backoffice</div>
            </div>
          </Link>
          <nav className="boNav">
            <Link className={`boNavLink${active('dashboard')}`} to="/admin/dashboard">
              <span className="boNavIcon" aria-hidden="true">
                <svg viewBox="0 0 24 24" role="presentation"><path fill="currentColor" d="M4 13h7V4H4v9Zm9 7h7V11h-7v9ZM4 20h7v-5H4v5Zm9-18v7h7V2h-7Z"/></svg>
              </span>
              <span>Dashboard</span>
            </Link>
            <Link className={`boNavLink${active('reportes')}`} to="/admin/reportes">
              <span className="boNavIcon" aria-hidden="true">
                <svg viewBox="0 0 24 24" role="presentation"><path fill="currentColor" d="M7 2h10a2 2 0 0 1 2 2v16l-4-2-4 2-4-2-4 2V4a2 2 0 0 1 2-2Zm2 5h6v2H9V7Zm0 4h6v2H9v-2Z"/></svg>
              </span>
              <span>Reportes</span>
            </Link>
            <Link className={`boNavLink${active('usuarios')}`} to="/admin/usuarios">
              <span className="boNavIcon" aria-hidden="true">
                <svg viewBox="0 0 24 24" role="presentation"><path fill="currentColor" d="M12 12a4.5 4.5 0 1 0-4.5-4.5A4.5 4.5 0 0 0 12 12Zm0 2c-4.42 0-8 2.35-8 5.25V21h16v-1.75c0-2.9-3.58-5.25-8-5.25Z"/></svg>
              </span>
              <span>Usuarios</span>
            </Link>
          </nav>
        </aside>

        <div className="boMain">
          <div className="boTopbar">
            <div className="boTopbarLeft">
              <div className="boPageTitle">{title}</div>
              <div className="boSearch">
                <svg className="boSearchIcon" viewBox="0 0 24 24" aria-hidden="true" role="presentation">
                  <path
                    fill="currentColor"
                    d="M10.5 3a7.5 7.5 0 1 1 4.61 13.41l3.24 3.25a1 1 0 0 1-1.41 1.41l-3.25-3.24A7.5 7.5 0 0 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11a5.5 5.5 0 0 0 0-11Z"
                  />
                </svg>
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar en la sección…" />
              </div>
            </div>

            <div className="boTopbarRight">
              <Link className="boTopBtn" to="/">Ir al sitio</Link>
              <button className="boTopBtn" type="button" disabled={busy} onClick={onLogout}>Salir</button>
              <div className="boUserChip" title={user?.username || ''}>
                <div className="boAvatar" aria-hidden="true">{initials}</div>
                <div className="boUserText">
                  <div className="boUserName">{user?.username || '-'}</div>
                  <div className="boUserRole">Admin</div>
                </div>
              </div>
            </div>
          </div>

          <Routes>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboardPage />} />
            <Route path="reportes" element={<AdminReportsPage search={search} />} />
            <Route path="usuarios" element={<AdminUsersPage search={search} />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}

function PublicLayout({ user, isAdmin, busy, onLogout, year }) {
  const location = useLocation()
  if (String(location.pathname || '').includes('admin')) return null

  return (
    <div className="appShell">
      <header className="siteHeader">
        <div className="headerInner">
          <Link className="brand" to="/">
            <img className="brandLogo" src="/logo_nuevo_sys.png" alt="Sanos y Salvos" />
            <span className="brandName">Sanos y Salvos</span>
          </Link>

          <nav className="siteNav" aria-label="Navegación principal">
            <Link className="navLink" to="/#inicio">Inicio</Link>
            <Link className="navLink" to="/#sobre-nosotros">Sobre nosotros</Link>
            <Link className="navLink" to="/preguntas-frecuentes">Preguntas frecuentes</Link>
          </nav>

          <div className="headerActions">
            <Link className="reportBtn" to={user ? '/reportar' : '/login?next=/reportar'}>
              Reportar
            </Link>
            {isAdmin ? (
              <Link className="adminBtn" to="/admin">
                Admin
              </Link>
            ) : null}
            {user ? (
              <button className="loginBtn" type="button" disabled={busy} onClick={onLogout}>
                <svg
                  className="userIcon"
                  viewBox="0 0 24 24"
                  role="presentation"
                  aria-hidden="true"
                >
                  <path
                    fill="currentColor"
                    d="M12 12a4.5 4.5 0 1 0-4.5-4.5A4.505 4.505 0 0 0 12 12Zm0 2.25c-4.135 0-7.5 2.52-7.5 5.625A1.125 1.125 0 0 0 5.625 21h12.75a1.125 1.125 0 0 0 1.125-1.125c0-3.105-3.365-5.625-7.5-5.625Z"
                  />
                </svg>
                <span>Salir</span>
              </button>
            ) : (
              <Link className="loginBtn" to="/login">
                <svg
                  className="userIcon"
                  viewBox="0 0 24 24"
                  role="presentation"
                  aria-hidden="true"
                >
                  <path
                    fill="currentColor"
                    d="M12 12a4.5 4.5 0 1 0-4.5-4.5A4.505 4.505 0 0 0 12 12Zm0 2.25c-4.135 0-7.5 2.52-7.5 5.625A1.125 1.125 0 0 0 5.625 21h12.75a1.125 1.125 0 0 0 1.125-1.125c0-3.105-3.365-5.625-7.5-5.625Z"
                  />
                </svg>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="siteMain" role="main">
        <Outlet />
      </main>

      <footer className="siteFooter">
        <div className="footerInner">
          <div className="footerGrid">
            <div className="footerBrand">
              <div className="footerBrandTop">
                <img className="footerLogo" src="/logo_nuevo_sys.png" alt="Sanos y Salvos" />
                <div className="footerBrandName">Sanos y Salvos</div>
              </div>
              <div className="footerText footerTagline">
                Plataforma comunitaria para reportar mascotas perdidas y ayudar a reencontrarlas.
              </div>
              <div className="footerSocialButtons" aria-label="Redes sociales">
                <a
                  className="footerSocialBtn"
                  href="https://instagram.com/sanosysalvos.cl"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Instagram"
                  title="Instagram"
                >
                  <svg className="footerSocialIcon" viewBox="0 0 24 24" aria-hidden="true" role="presentation">
                    <path
                      fill="currentColor"
                      d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2Zm0 2A3.75 3.75 0 0 0 4 7.75v8.5A3.75 3.75 0 0 0 7.75 20h8.5A3.75 3.75 0 0 0 20 16.25v-8.5A3.75 3.75 0 0 0 16.25 4h-8.5ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm5.6-2.15a1.05 1.05 0 1 1 0 2.1 1.05 1.05 0 0 1 0-2.1Z"
                    />
                  </svg>
                </a>

                <a
                  className="footerSocialBtn"
                  href="https://facebook.com/"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Facebook"
                  title="Facebook"
                >
                  <span className="footerSocialIconText" aria-hidden="true">f</span>
                </a>

                <a
                  className="footerSocialBtn"
                  href="https://tiktok.com/"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="TikTok"
                  title="TikTok"
                >
                  <span className="footerSocialIconText" aria-hidden="true">♪</span>
                </a>
              </div>
            </div>

            <div className="footerCol">
              <div className="footerTitle">Contacto</div>
              <a className="footerLink" href="mailto:contacto@sanosysalvos.cl">contacto@sanosysalvos.cl</a>
              <div className="footerText">Chile</div>
            </div>

            <div className="footerCol">
              <div className="footerTitle">Navegación</div>
              <div className="footerLinks">
                <Link className="footerLink" to="/#inicio">Inicio</Link>
                <Link className="footerLink" to="/#sobre-nosotros">Sobre nosotros</Link>
                <Link className="footerLink" to="/preguntas-frecuentes">Preguntas frecuentes</Link>
                <Link className="footerLink" to="/reportar">Reportar mascota</Link>
              </div>
            </div>

            <div className="footerCol">
              <div className="footerTitle">Empresa</div>
              <div className="footerLinks">
                <Link className="footerLink" to="/#sobre-nosotros">Nosotros</Link>
                <Link className="footerLink" to="/politicas-de-privacidad">Políticas de privacidad</Link>
                <Link className="footerLink" to="/terminos-y-condiciones">Términos y condiciones</Link>
              </div>
            </div>

          </div>

          <div className="footerBottom">
            <div>© {year} Sanos y Salvos</div>
            <div className="footerSmall">Hecho para la comunidad</div>
          </div>
        </div>
      </footer>
    </div>
  )
}

function App() {
  const year = new Date().getFullYear()
  const fallbackCenter = useMemo(() => [-33.4489, -70.6693], [])
  const [userLocation, setUserLocation] = useState(null)
  const [user, setUser] = useState(null)
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState({ username: '', password: '', email: '' })
  const [reports, setReports] = useState([])
  const [lastCreatedReportId, setLastCreatedReportId] = useState(null)
  const [reportForm, setReportForm] = useState({
    pet_name: '',
    species: '',
    image_data_url: '',
    image_file_name: '',
    region: '',
    comuna: '',
    description: '',
    status: 'perdido',
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    latitude: null,
    longitude: null,
  })
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const location = useLocation()
  const isAdmin = Boolean(user?.is_staff || user?.is_superuser)

  useEffect(() => {
    if (!('geolocation' in navigator)) return

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        const accuracy = pos.coords.accuracy
        setUserLocation({ lat, lng, accuracy })
      },
      () => {
        setUserLocation(null)
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 60000,
      },
    )
  }, [])

  useEffect(() => {
    ;(async () => {
      const ok = await refreshAccess()
      if (!ok) return
      const me = await apiRequest('/api/auth/me/', { method: 'GET' })
      if (me.ok) setUser(me.data)
    })()
  }, [])

  async function loadReports() {
    const resp = await apiRequest('/api/reports/', { method: 'GET' })
    if (resp.ok && resp.data?.results) {
      setReports(resp.data.results)
    }
  }

  useEffect(() => {
    loadReports()
  }, [])

  useEffect(() => {
    if (location.pathname === '/register') setAuthMode('register')
    else if (location.pathname === '/login') setAuthMode('login')
    setError('')
    setSuccess('')
  }, [location.pathname])

  const center = userLocation ? [userLocation.lat, userLocation.lng] : fallbackCenter
  const zoom = userLocation ? 14 : 6

  const reportRegionView = useMemo(() => {
    if (!reportForm.region) return null
    return REGION_VIEW[reportForm.region] || null
  }, [reportForm.region])

  const reportCenter = reportRegionView ? reportRegionView.center : center
  const reportZoom = reportRegionView ? reportRegionView.zoom : zoom

  function onSelectRegion(value) {
    setReportForm((s) => ({ ...s, region: value, comuna: '' }))
  }

  async function onImageChange(e) {
    const file = e.target.files?.[0]
    if (!file) {
      setReportForm((s) => ({ ...s, image_data_url: '', image_file_name: '' }))
      return
    }

    if (file.size > 700_000) {
      setError('La imagen es muy grande (máx 700KB)')
      setReportForm((s) => ({ ...s, image_data_url: '', image_file_name: '' }))
      e.target.value = ''
      return
    }

    const reader = new FileReader()
    const dataUrl = await new Promise((resolve, reject) => {
      reader.onerror = () => reject(new Error('read_error'))
      reader.onload = () => resolve(String(reader.result || ''))
      reader.readAsDataURL(file)
    })

    setReportForm((s) => ({ ...s, image_data_url: dataUrl, image_file_name: file.name }))
  }

  const nearbyRecentReports = useMemo(() => {
    const parsed = (reports || [])
      .filter((r) => r && r.created_at)
      .map((r) => ({ ...r, created_ts: Date.parse(r.created_at) || 0 }))
      .sort((a, b) => b.created_ts - a.created_ts)

    if (!userLocation) return parsed.slice(0, 12)

    const lat0 = userLocation.lat
    const lon0 = userLocation.lng
    const radiusKm = 25
    const withDistance = parsed
      .filter((r) => r.latitude != null && r.longitude != null)
      .map((r) => ({
        ...r,
        distance_km: haversineKm(lat0, lon0, Number(r.latitude), Number(r.longitude)),
      }))
      .filter((r) => r.distance_km <= radiusKm)
      .sort((a, b) => b.created_ts - a.created_ts)

    return (withDistance.length ? withDistance : parsed).slice(0, 12)
  }, [reports, userLocation])

  async function submitAuth(e) {
    e.preventDefault()
    setBusy(true)
    setError('')

    if (authMode === 'register') {
      const email = (authForm.email || '').trim()
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setError('Ingresa un email válido que incluya @ y un dominio')
        setBusy(false)
        return
      }
    }

    try {
      const path = authMode === 'register' ? '/api/auth/register/' : '/api/auth/login/'
      const body = authMode === 'register'
        ? { username: authForm.username, password: authForm.password, email: authForm.email }
        : { username: authForm.username, password: authForm.password }

      const resp = await apiRequest(path, { method: 'POST', body })
      if (!resp.ok || !resp.data?.access) {
        setError(resp.data?.detail || 'No se pudo autenticar')
        return
      }
      accessToken = resp.data.access
      const me = await apiRequest('/api/auth/me/', { method: 'GET' })
      if (me.ok) setUser(me.data)
      const next = new URLSearchParams(location.search).get('next') || '/'
      navigate(next, { replace: true })
    } finally {
      setBusy(false)
    }
  }

  async function doLogout() {
    setBusy(true)
    setError('')
    try {
      await apiRequest('/api/auth/logout/', { method: 'POST', body: {} })
      accessToken = null
      setUser(null)
      navigate('/', { replace: true })
    } finally {
      setBusy(false)
    }
  }

  async function markReportAsFound(reportId) {
    if (!reportId) return
    try {
      const resp = await apiRequest(`/api/reports/${reportId}/`, {
        method: 'PATCH',
        body: { status: 'encontrado' },
      })
      if (!resp.ok) {
        setError(resp.data?.detail || 'No se pudo marcar como encontrado')
        return
      }
      setSuccess('Reporte marcado como encontrado. El administrador lo verificara.')
      await loadReports()
    } catch (err) {
      setError(err?.message || 'Error al marcar como encontrado')
    }
  }

  async function submitReport(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      if (!user) {
        navigate('/login?next=/reportar', { replace: false })
        return
      }

      const payload = { ...reportForm }
      Object.keys(payload).forEach((k) => {
        if (typeof payload[k] === 'string') payload[k] = payload[k].trim()
      })
      delete payload.image_file_name

      if (!payload.pet_name) {
        setError('El nombre es obligatorio')
        return
      }

      if (!payload.image_data_url) {
        setError('La imagen es obligatoria')
        return
      }

      if (!payload.species || !payload.region || !payload.comuna) {
        setError('Completa: especie, región y comuna')
        return
      }

      if (payload.latitude == null || payload.longitude == null) {
        setError('Selecciona una ubicación en el mapa')
        return
      }

      if (payload.contact_phone) {
        if (!/^[+\d][\d\s\-().]{5,30}$/.test(payload.contact_phone)) {
          setError('Ingresa un teléfono válido de contacto')
          return
        }
      }

      if (payload.contact_email) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.contact_email)) {
          setError('Ingresa un email válido de contacto')
          return
        }
      }

      const resp = await apiRequest('/api/reports/', { method: 'POST', body: payload })
      if (!resp.ok) {
        if (resp.status === 401) {
          setError('Tu sesión expiró. Inicia sesión nuevamente.')
          navigate('/login?next=/reportar', { replace: false })
          return
        }
        setError(resp.data?.detail || 'No se pudo crear el reporte')
        return
      }

      setSuccess('Reporte enviado (pendiente de confirmación)')
      setLastCreatedReportId(resp.data?.id ?? null)
      await loadReports()
      setReportForm((s) => ({
        ...s,
        pet_name: '',
        description: '',
        latitude: null,
        longitude: null,
        image_data_url: '',
        image_file_name: '',
      }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Routes>
      <Route
        path="admin/*"
        element={
          <div className="appShell">
            <main className="siteMain" role="main">
              <AdminBackoffice user={user} onLogout={doLogout} busy={busy} />
            </main>
          </div>
        }
      />

      <Route path="*" element={<PublicLayout user={user} isAdmin={isAdmin} busy={busy} onLogout={doLogout} year={year} />}>
          <Route
            index
            element={
              <div className="mainInner mainInnerHome">
                <div className="fullBleed">
                  <section id="inicio" className="section">
                    <div className="mapWrap mapFullBleed">
                      <MapContainer className="map" center={center} zoom={zoom} scrollWheelZoom>
                        <TileLayer
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <Recenter center={center} zoom={zoom} />
                        <InvalidateSize watch={reports.length} />
                        <ReportsMarkers reports={reports} highlightId={lastCreatedReportId} />
                        {userLocation ? (
                          <CircleMarker
                            center={[userLocation.lat, userLocation.lng]}
                            radius={6}
                            pathOptions={{ color: '#064a55', fillColor: '#f4a340', fillOpacity: 1 }}
                          />
                        ) : null}
                      </MapContainer>
                    </div>
                  </section>
                </div>
                <RecentReportsCarousel title="Reportes recientes cerca de ti" reports={nearbyRecentReports} onMarkFound={markReportAsFound} />

                <section id="sobre-nosotros" className="section" />
              </div>
            }
          />

          <Route
            path="politicas-de-privacidad"
            element={
              <div className="mainInner">
                <section className="card">
                  <h2 className="cardTitle">Políticas de privacidad</h2>
                  <div className="mutedText">Contenido en construcción.</div>
                </section>
              </div>
            }
          />

          <Route
            path="terminos-y-condiciones"
            element={
              <div className="mainInner">
                <section className="card">
                  <h2 className="cardTitle">Términos y condiciones</h2>
                  <div className="mutedText">Contenido en construcción.</div>
                </section>
              </div>
            }
          />

          <Route
            path="preguntas-frecuentes"
            element={
              <div className="mainInner">
                <section className="card">
                  <h2 className="cardTitle">Preguntas frecuentes</h2>
                  <div className="mutedText">Contenido en construcción.</div>
                </section>
              </div>
            }
          />

          <Route
            path="login"
            element={
              <div className="mainInner">
                <section className="card authCard">
                  <h2 className="cardTitle">Iniciar sesión</h2>
                  {error ? <div className="formError">{error}</div> : null}
                  <form className="form" onSubmit={submitAuth}>
                    <label className="field">
                      <span>Usuario</span>
                      <input
                        value={authForm.username}
                        onChange={(e) => setAuthForm((s) => ({ ...s, username: e.target.value }))}
                        autoComplete="username"
                      />
                    </label>
                    <label className="field">
                      <span>Contraseña</span>
                      <input
                        type="password"
                        value={authForm.password}
                        onChange={(e) => setAuthForm((s) => ({ ...s, password: e.target.value }))}
                        autoComplete="current-password"
                      />
                    </label>
                    <button className="primaryBtn" type="submit" disabled={busy}>Entrar</button>
                  </form>
                  <div className="mutedText">
                    ¿No tienes cuenta?{' '}
                    <Link
                      to={`/register${location.search || ''}`}
                      onClick={() => setAuthMode('register')}
                    >
                      Regístrate
                    </Link>
                  </div>
                </section>
              </div>
            }
          />

          <Route
            path="register"
            element={
              <div className="mainInner">
                <section className="card authCard">
                  <h2 className="cardTitle">Registro</h2>
                  {error ? <div className="formError">{error}</div> : null}
                  <form className="form" onSubmit={submitAuth}>
                    <label className="field">
                      <span>Usuario</span>
                      <input
                        value={authForm.username}
                        onChange={(e) => setAuthForm((s) => ({ ...s, username: e.target.value }))}
                        autoComplete="username"
                      />
                    </label>
                    <label className="field">
                      <span>Contraseña</span>
                      <input
                        type="password"
                        value={authForm.password}
                        onChange={(e) => setAuthForm((s) => ({ ...s, password: e.target.value }))}
                        autoComplete="new-password"
                      />
                    </label>
                    <label className="field">
                      <span>Email</span>
                      <input
                        type="email"
                        value={authForm.email}
                        onChange={(e) => setAuthForm((s) => ({ ...s, email: e.target.value }))}
                        autoComplete="email"
                      />
                    </label>
                    <button className="primaryBtn" type="submit" disabled={busy}>Crear cuenta</button>
                  </form>
                  <div className="mutedText">
                    ¿Ya tienes cuenta?{' '}
                    <Link
                      to={`/login${location.search || ''}`}
                      onClick={() => setAuthMode('login')}
                    >
                      Inicia sesión
                    </Link>
                  </div>
                </section>
              </div>
            }
          />

          <Route
            path="reportar"
            element={
              <div className="mainInner">
                {!user ? (
                  <section className="card authCard">
                    <h2 className="cardTitle">Inicia sesión para reportar</h2>
                    <div className="mutedText">
                      <Link to="/login?next=/reportar">Ir a login</Link>
                    </div>
                  </section>
                ) : (
                  <div className="reportGrid">
                    <section className="card reportFormCard">
                      <h2 className="cardTitle">Reportar mascota perdida</h2>
                      {error ? <div className="formError">{error}</div> : null}
                      {success ? <div className="formSuccess">{success}</div> : null}
                      <form className="form" onSubmit={submitReport}>
                        <label className="field">
                          <span>Nombre *</span>
                          <input
                            value={reportForm.pet_name}
                            onChange={(e) => setReportForm((s) => ({ ...s, pet_name: e.target.value }))}
                          />
                        </label>
                        <label className="field">
                          <span>Especie</span>
                          <select
                            value={reportForm.species}
                            onChange={(e) => setReportForm((s) => ({ ...s, species: e.target.value }))}
                          >
                            <option value="">Selecciona…</option>
                            {SPECIES_OPTIONS.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </label>
                        <label className="field">
                          <span>Región</span>
                          <select
                            value={reportForm.region}
                            onChange={(e) => onSelectRegion(e.target.value)}
                          >
                            <option value="">Selecciona…</option>
                            {REGION_COMUNAS.map((r) => (
                              <option key={r.region} value={r.region}>{r.region}</option>
                            ))}
                          </select>
                        </label>
                        <label className="field">
                          <span>Comuna</span>
                          <select
                            value={reportForm.comuna}
                            onChange={(e) => setReportForm((s) => ({ ...s, comuna: e.target.value }))}
                            disabled={!reportForm.region}
                          >
                            <option value="">{reportForm.region ? 'Selecciona…' : 'Elige región primero'}</option>
                            {getComunasForRegion(reportForm.region).map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </label>
                        <label className="field">
                          <span>Imagen *</span>
                          <input type="file" accept="image/*" onChange={onImageChange} required />
                          {reportForm.image_file_name ? (
                            <span className="fileHint">Seleccionada: {reportForm.image_file_name}</span>
                          ) : null}
                        </label>
                        <label className="field">
                          <span>Descripción</span>
                          <input
                            value={reportForm.description}
                            onChange={(e) => setReportForm((s) => ({ ...s, description: e.target.value }))}
                            placeholder="Se perdió cerca de…"
                          />
                        </label>
                        <label className="field">
                          <span>Contacto (teléfono)</span>
                          <input
                            type="tel"
                            value={reportForm.contact_phone}
                            onChange={(e) => setReportForm((s) => ({ ...s, contact_phone: e.target.value }))}
                          />
                        </label>
                        <label className="field">
                          <span>Contacto (email)</span>
                          <input
                            type="email"
                            value={reportForm.contact_email}
                            onChange={(e) => setReportForm((s) => ({ ...s, contact_email: e.target.value }))}
                          />
                        </label>

                        <div className="mutedText">
                          Ubicación: {reportForm.latitude != null && reportForm.longitude != null
                            ? `${reportForm.latitude.toFixed(6)}, ${reportForm.longitude.toFixed(6)}`
                            : 'haz click en el mapa'}
                        </div>

                        <button className="primaryBtn" type="submit" disabled={busy}>
                          Publicar reporte
                        </button>
                      </form>
                    </section>

                    <section className="card reportMapCard">
                      <div className="mapWrap reportMapWrap">
                        <MapContainer className="map reportMap" center={reportCenter} zoom={reportZoom} scrollWheelZoom>
                          <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          />
                          <Recenter center={reportCenter} zoom={reportZoom} />
                          <ReportsMarkers reports={reports} highlightId={lastCreatedReportId} />
                          <LocationPicker
                            onPick={({ latitude, longitude }) =>
                              setReportForm((s) => ({ ...s, latitude, longitude }))
                            }
                          />
                          {userLocation ? (
                            <CircleMarker
                              center={[userLocation.lat, userLocation.lng]}
                              radius={6}
                              pathOptions={{ color: '#064a55', fillColor: '#f4a340', fillOpacity: 1 }}
                            />
                          ) : null}
                          {reportForm.latitude != null && reportForm.longitude != null ? (
                            <Marker
                              position={[reportForm.latitude, reportForm.longitude]}
                              icon={getPetIcon(reportForm.species, { highlight: true })}
                            />
                          ) : null}
                        </MapContainer>
                      </div>
                    </section>
                  </div>
                )}
              </div>
            }
          />
      </Route>
    </Routes>
  )
}

export default App
