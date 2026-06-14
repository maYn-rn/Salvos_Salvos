import { useEffect, useMemo, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import 'leaflet/dist/leaflet.css'

import DisposicionPublica from './components/DisposicionPublica'
import PanelAdministracion from './pages/PanelAdministracion'
import PaginaAdopciones from './pages/PaginaAdopciones'
import PaginaInicio from './pages/PaginaInicio'
import PaginaInicioSesion from './pages/PaginaInicioSesion'
import PaginaMapa from './pages/PaginaMapa'
import PaginaPreguntasFrecuentes from './pages/PaginaPreguntasFrecuentes'
import PaginaPerfil from './pages/PaginaPerfil'
import PaginaRegistro from './pages/PaginaRegistro'
import PaginaReporte from './pages/PaginaReporte'
// 1. IMPORTAMOS LA PÁGINA REAL DE VOLUNTARIOS
import PaginaVoluntarios from './pages/PaginaVoluntarios' 
import { apiRequest, haversineKm, refreshAccess, REGION_VIEW, setAccessToken } from './shared/appCore'

function App() {
  const year = new Date().getFullYear()
  const fallbackCenter = useMemo(() => [-33.4489, -70.6693], [])
  const [selectedReportId, setSelectedReportId] = useState(null)
  const [detailedReport, setDetailedReport] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [userLocation, setUserLocation] = useState(null)
  const [user, setUser] = useState(null)
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState({ username: '', password: '', email: '', rut: '' })
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
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
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

  async function handleViewDetail(id) {
    if (!id) return
    navigate('/')
    setSelectedReportId(id)
    setLoadingDetail(true)
    setError('')
    try {
      const resp = await apiRequest(`/api/reports/${id}/`, { method: 'GET' })
      if (resp.ok && resp.data) {
        setDetailedReport(resp.data)
      } else {
        setError('No se pudo cargar la informacion detallada de la mascota.')
      }
    } catch {
      setError('Error de comunicacion con el servidor.')
    } finally {
      setLoadingDetail(false)
    }
  }

  function resetDetailView() {
    setSelectedReportId(null)
    setDetailedReport(null)
    setError('')
    setSuccess('')
  }

  useEffect(() => {
    loadReports()
  }, [])

  useEffect(() => {
    if (location.pathname === '/register') setAuthMode('register')
    else if (location.pathname === '/login') setAuthMode('login')

    if (location.pathname !== '/') {
      setSelectedReportId(null)
      setDetailedReport(null)
    }
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

  function updateReportForm(patch) {
    setReportForm((s) => ({ ...s, ...patch }))
  }

  function updateAuthForm(patch) {
    setAuthForm((s) => ({ ...s, ...patch }))
  }

  async function onImageChange(e) {
    const file = e.target.files?.[0]
    if (!file) {
      setReportForm((s) => ({ ...s, image_data_url: '', image_file_name: '' }))
      return
    }
    if (file.size > 700_000) {
      setError('La imagen es muy grande (max 700KB)')
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

  const heroStats = useMemo(() => {
    const coveredComunas = new Set()
    const coveredRegions = new Set()

    for (const report of reports || []) {
      if (report?.comuna) coveredComunas.add(`${report.region || ''}::${report.comuna}`)
      if (report?.region) coveredRegions.add(report.region)
    }

    return {
      totalReports: reports.length,
      activeRegions: coveredRegions.size,
      coveredComunas: coveredComunas.size,
    }
  }, [reports])

  const heroHighlight = useMemo(() => {
    const withCoords = (reports || []).filter((r) => r && r.latitude != null && r.longitude != null)
    return withCoords[0] || reports[0] || null
  }, [reports])

  async function submitAuth(e) {
    e.preventDefault()
    setBusy(true)
    setError('')

    if (authMode === 'register') {
      const email = (authForm.email || '').trim()
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setError('Ingresa un email valido que incluya @ y un dominio')
        setBusy(false)
        return
      }
    }

    try {
      const path = authMode === 'register' ? '/api/auth/register/' : '/api/auth/login/'
      const body = authMode === 'register'
        ? { 
            username: authForm.username, 
            password: authForm.password, 
            email: authForm.email, 
            rut: authForm.rut 
          }
        : { username: authForm.username, password: authForm.password }

      const resp = await apiRequest(path, { method: 'POST', body })
      if (!resp.ok || !resp.data?.access) {
        setError(resp.data?.detail || 'No se pudo autenticar')
        return
      }

      setAccessToken(resp.data.access)
      if (resp.data?.refresh) localStorage.setItem('refresh_token', resp.data.refresh)
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
      setAccessToken(null)
      localStorage.removeItem('refresh_token')
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
      setDetailedReport((prev) => (prev && prev.id === reportId ? { ...prev, status: 'encontrado' } : prev))
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
        setError('Completa: especie, region y comuna')
        return
      }
      if (payload.latitude == null || payload.longitude == null) {
        setError('Selecciona una ubicacion en el mapa')
        return
      }
      if (!payload.contact_phone) {
        setError('El telefono de contacto es obligatorio')
        return
      }
      if (!payload.contact_email) {
        setError('El email de contacto es obligatorio')
        return
      }

      if (payload.contact_phone) {
        const cleanPhone = payload.contact_phone.replace(/[\s-]/g, '')
        if (!/^\+?[0-9]{8,12}$/.test(cleanPhone)) {
          setError('Ingresa un telefono valido de entre 8 y 12 numeros (ej: +56912345678)')
          window.scrollTo(0, 0)
          return
        }
      }
      if (payload.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.contact_email)) {
        setError('Ingresa un email valido de contacto')
        window.scrollTo(0, 0)
        return
      }

      const resp = await apiRequest('/api/reports/', { method: 'POST', body: payload })
      if (!resp.ok) {
        if (resp.status === 401) {
          setError('Tu sesion expiro. Inicia sesion nuevamente.')
          navigate('/login?next=/reportar', { replace: false })
          return
        }
        setError(resp.data?.detail || 'No se pudo crear el reporte')
        return
      }

      setSuccess('Reporte enviado correctamente.')
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
        path="/admin/*"
        element={
          <div className="appShell">
            <main className="siteMain" role="main">
              <PanelAdministracion user={user} onLogout={doLogout} busy={busy} />
            </main>
          </div>
        }
      />

      <Route element={<DisposicionPublica user={user} isAdmin={isAdmin} busy={busy} onLogout={doLogout} year={year} />}>
        <Route
          path="/"
          element={
            <PaginaInicio
              selectedReportId={selectedReportId}
              detailedReport={detailedReport}
              loadingDetail={loadingDetail}
              error={error}
              success={success}
              busy={busy}
              user={user}
              reports={reports}
              center={center}
              zoom={zoom}
              userLocation={userLocation}
              lastCreatedReportId={lastCreatedReportId}
              nearbyRecentReports={nearbyRecentReports}
              heroStats={heroStats}
              heroHighlight={heroHighlight}
              onMarkFound={markReportAsFound}
              onViewDetail={handleViewDetail}
              onResetDetail={resetDetailView}
            />
          }
        />

        <Route path="/mapa" element={<PaginaMapa center={center} zoom={zoom} reports={reports} lastCreatedReportId={lastCreatedReportId} userLocation={userLocation} onViewDetail={handleViewDetail} />} />
        <Route path="/adopciones" element={<PaginaAdopciones user={user} />} />

        <Route
          path="/reportar"
          element={
            <PaginaReporte
              user={user}
              error={error}
              success={success}
              busy={busy}
              reportForm={reportForm}
              reports={reports}
              reportCenter={reportCenter}
              reportZoom={reportZoom}
              lastCreatedReportId={lastCreatedReportId}
              userLocation={userLocation}
              onSubmitReport={submitReport}
              onReportFormChange={updateReportForm}
              onSelectRegion={onSelectRegion}
              onImageChange={onImageChange}
              onClearSuccess={() => setSuccess('')}
            />
          }
        />

        <Route path="/perfil" element={<PaginaPerfil user={user} reports={reports} onLogout={doLogout} busy={busy} onMarkFound={markReportAsFound} onViewDetail={handleViewDetail} />} />
        <Route path="/preguntas-frecuentes" element={<PaginaPreguntasFrecuentes user={user} isAdmin={isAdmin} />} />
        
        {/* 2. RUTA REAL DE VOLUNTARIOS CONECTADA AL COMPONENTE */}
        <Route path="/voluntarios" element={<PaginaVoluntarios user={user} />} />
        
        <Route
          path="/login"
          element={
            <PaginaInicioSesion
              error={error}
              busy={busy}
              authForm={authForm}
              onAuthFormChange={updateAuthForm}
              onSubmitAuth={submitAuth}
              locationSearch={location.search}
              onSwitchToRegister={() => setAuthMode('register')}
            />
          }
        />
        <Route
          path="/register"
          element={
            <PaginaRegistro
              error={error}
              busy={busy}
              authForm={authForm}
              onAuthFormChange={updateAuthForm}
              onSubmitAuth={submitAuth}
              locationSearch={location.search}
              onSwitchToLogin={() => setAuthMode('login')}
            />
          }
        />
        <Route path="/politicas-de-privacidad" element={<div className="mainInner"><section className="card"><h2 className="cardTitle">Politicas de privacidad</h2><div className="mutedText">Contenido en construccion.</div></section></div>} />
        <Route path="/terminos-y-condiciones" element={<div className="mainInner"><section className="card"><h2 className="cardTitle">Terminos y condiciones</h2><div className="mutedText">Contenido en construccion.</div></section></div>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default App