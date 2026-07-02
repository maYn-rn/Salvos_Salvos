import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import 'leaflet/dist/leaflet.css'

import DisposicionPublica from './components/DisposicionPublica'
import PanelAdministracion from './pages/PanelAdministracion'
import PaginaAdopcionDetalle from './pages/PaginaAdopcionDetalle'
import PaginaAdopciones, { PaginaPublicarAdopcion } from './pages/PaginaAdopciones'
import PaginaInicio from './pages/PaginaInicio'
import PaginaInicioSesion from './pages/PaginaInicioSesion'
import PaginaMapa from './pages/PaginaMapa'
import PaginaPreguntasFrecuentes from './pages/PaginaPreguntasFrecuentes'
import PaginaPerfil from './pages/PaginaPerfil'
import PaginaRegistro from './pages/PaginaRegistro'
import PaginaReporte from './pages/PaginaReporte'
import PaginaVeterinariaDetalle from './pages/PaginaVeterinariaDetalle'
// 1. IMPORTAMOS LA PÁGINA REAL DE VOLUNTARIOS
import PaginaVoluntarios from './pages/PaginaVoluntarios' 
import { apiRequest, haversineKm, optimizeImageFileToDataUrl, refreshAccess, REGION_VIEW, setAccessToken } from './shared/appCore'

function App() {
  const year = new Date().getFullYear()
  const fallbackCenter = useMemo(() => [-33.4489, -70.6693], [])
  const [selectedReportId, setSelectedReportId] = useState(null)
  const [detailedReport, setDetailedReport] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [userLocation, setUserLocation] = useState(null)
  const [user, setUser] = useState(null)
  const [authInicializando, setAuthInicializando] = useState(true)
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState({
    username: '',
    password: '',
    email: '',
    rut: '',
    first_name: '',
    last_name: '',
    account_type: 'usuario',
    nombre_veterinaria: '',
    telefono_veterinaria: '',
    region: '',
    comuna: '',
    direccion_veterinaria: '',
    descripcion_veterinaria: '',
    sitio_web_veterinaria: '',
    documento_verificacion_local: null,
    latitude: null,
    longitude: null,
  })
  const [reports, setReports] = useState([])
  const [lastCreatedReportId, setLastCreatedReportId] = useState(null)
  const [reportForm, setReportForm] = useState({
    pet_name: '',
    species: '',
    imagenes_locales: [],
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
  const [ubicacionTexto, setUbicacionTexto] = useState('')
  const [buscandoUbicacion, setBuscandoUbicacion] = useState(false)
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const busquedaUbicacionTimeoutRef = useRef(null)
  const busquedaUbicacionAbortRef = useRef(null)
  const navigate = useNavigate()
  const location = useLocation()
  const isAdmin = Boolean(user?.is_staff || user?.is_superuser)
  const canModerateReports = Boolean(user?.is_staff || user?.is_superuser || user?.can_confirm_reports)

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
      setAuthInicializando(true)
      try {
        const ok = await refreshAccess()
        if (!ok) {
          setUser(null)
          return
        }
        const me = await apiRequest('/api/auth/me/', { method: 'GET' })
        if (me.ok) setUser(me.data)
        else setUser(null)
      } finally {
        setAuthInicializando(false)
      }
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

  const reportCenter =
    reportForm.latitude != null && reportForm.longitude != null
      ? [Number(reportForm.latitude), Number(reportForm.longitude)]
      : reportRegionView
        ? reportRegionView.center
        : center

  const reportZoom =
    reportForm.latitude != null && reportForm.longitude != null
      ? 15
      : reportRegionView
        ? reportRegionView.zoom
        : zoom

  function onSelectRegion(value) {
    setReportForm((s) => ({ ...s, region: value, comuna: '' }))
  }

  function updateReportForm(patch) {
    setReportForm((s) => ({ ...s, ...patch }))
  }

  async function usarUbicacionDispositivoParaReporte() {
    if (!('geolocation' in navigator)) {
      setError('Tu dispositivo no soporta geolocalización')
      return
    }

    setError('')
    setSuccess('')
    setBuscandoUbicacion(true)
    try {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve(pos),
          (err) => reject(err),
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        )
      })
      const lat = pos.coords.latitude
      const lng = pos.coords.longitude
      const accuracy = pos.coords.accuracy
      setUserLocation({ lat, lng, accuracy })
      setReportForm((s) => ({ ...s, latitude: lat, longitude: lng }))
      setSuccess('Ubicación del dispositivo aplicada al reporte.')
    } catch {
      setError('No se pudo obtener la ubicación del dispositivo. Verifica permisos.')
    } finally {
      setBuscandoUbicacion(false)
    }
  }

  async function buscarUbicacionPorTexto(textoEntrada, { mostrarErrores = true } = {}) {
    const texto = (textoEntrada ?? ubicacionTexto ?? '').trim()
    if (!texto) {
      if (mostrarErrores) setError('Ingresa una ubicación por texto para buscarla.')
      return
    }

    if (texto.length < 4) {
      if (mostrarErrores) setError('La búsqueda necesita al menos 4 caracteres.')
      return
    }

    if (busquedaUbicacionAbortRef.current) {
      try {
        busquedaUbicacionAbortRef.current.abort()
      } catch {}
    }

    const controller = new AbortController()
    busquedaUbicacionAbortRef.current = controller

    if (mostrarErrores) {
      setError('')
      setSuccess('')
    } else {
      setError('')
    }
    setBuscandoUbicacion(true)
    try {
      const partes = [texto]
      if ((reportForm.comuna || '').trim()) partes.push(reportForm.comuna)
      if ((reportForm.region || '').trim()) partes.push(reportForm.region)
      partes.push('Chile')
      const q = partes.join(', ')
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=cl&q=${encodeURIComponent(q)}`
      const resp = await fetch(url, { headers: { 'Accept-Language': 'es' }, signal: controller.signal })
      const data = await resp.json().catch(() => [])
      const item = Array.isArray(data) ? data[0] : null
      if (!item || item.lat == null || item.lon == null) {
        if (mostrarErrores) setError('No se encontró la ubicación. Prueba con más detalle (ej: calle y comuna).')
        return
      }

      const lat = Number(item.lat)
      const lng = Number(item.lon)
      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        if (mostrarErrores) setError('La búsqueda devolvió coordenadas inválidas.')
        return
      }

      setReportForm((s) => ({ ...s, latitude: lat, longitude: lng }))
      if (mostrarErrores) setSuccess('Ubicación encontrada y aplicada en el mapa.')
    } catch (err) {
      if (err?.name === 'AbortError') return
      if (mostrarErrores) setError('No se pudo buscar la ubicación. Revisa tu conexión a internet.')
    } finally {
      if (busquedaUbicacionAbortRef.current === controller) {
        setBuscandoUbicacion(false)
      }
    }
  }

  useEffect(() => {
    const texto = (ubicacionTexto || '').trim()
    if (!texto) return
    if (texto.length < 4) return
    if (busy) return

    if (busquedaUbicacionTimeoutRef.current) {
      clearTimeout(busquedaUbicacionTimeoutRef.current)
    }

    busquedaUbicacionTimeoutRef.current = setTimeout(() => {
      buscarUbicacionPorTexto(texto, { mostrarErrores: false })
    }, 650)

    return () => {
      if (busquedaUbicacionTimeoutRef.current) {
        clearTimeout(busquedaUbicacionTimeoutRef.current)
      }
    }
  }, [ubicacionTexto, reportForm.region, reportForm.comuna])

  function updateAuthForm(patch) {
    setAuthForm((s) => ({ ...s, ...patch }))
  }

  async function onImageChange(e) {
    const archivosSeleccionados = Array.from(e.target.files || [])
    if (!archivosSeleccionados.length) {
      setReportForm((s) => ({ ...s, imagenes_locales: [] }))
      return
    }

    setError('')
    const archivosLimitados = archivosSeleccionados.slice(0, 3)
    if (archivosSeleccionados.length > 3) {
      setError('Solo puedes subir hasta 3 imágenes por reporte.')
    }

    try {
      const imagenesLocales = []
      for (const archivo of archivosLimitados) {
        if (archivo.size > 10_000_000) {
          setError(`La imagen "${archivo.name}" es muy grande. Usa una de máximo 10MB.`)
          e.target.value = ''
          return
        }

        const dataUrl = await optimizeImageFileToDataUrl(archivo, { maxEdge: 1400, maxBytes: 650_000 })
        if (!dataUrl) {
          setError(`No se pudo procesar la imagen "${archivo.name}"`)
          e.target.value = ''
          return
        }

        imagenesLocales.push({
          nombre_original: archivo.name,
          contenido_base64: dataUrl,
          vista_previa: dataUrl,
        })
      }

      setReportForm((s) => ({ ...s, imagenes_locales: imagenesLocales }))
    } catch {
      setError('No se pudieron procesar las imágenes')
      setReportForm((s) => ({ ...s, imagenes_locales: [] }))
      e.target.value = ''
    }
  }

  async function subirImagenesReporte(reportId, imagenesLocales) {
    const imagenesSubidas = []
    for (let index = 0; index < imagenesLocales.length; index += 1) {
      const imagenLocal = imagenesLocales[index]
      const resp = await apiRequest('/api/archivos/', {
        method: 'POST',
        body: {
          tipo_entidad: 'reporte',
          id_entidad: reportId,
          categoria: index === 0 ? 'principal' : 'galeria',
          orden: index + 1,
          servicio_origen: 'ms_mascotas',
          nombre_original: imagenLocal.nombre_original,
          contenido_base64: imagenLocal.contenido_base64,
        },
      })
      if (!resp.ok || !resp.data?.url_descarga) {
        throw new Error(resp.data?.detail || 'No se pudo subir una de las imágenes')
      }
      imagenesSubidas.push({
        id: resp.data.id,
        url_descarga: resp.data.url_descarga,
        categoria: resp.data.categoria || (index === 0 ? 'principal' : 'galeria'),
        orden: resp.data.orden || index + 1,
      })
    }
    return imagenesSubidas
  }

  async function subirDocumentoVerificacion(veterinaria, documentoLocal) {
    if (!veterinaria?.user_id || !documentoLocal?.contenido_base64) {
      throw new Error('Debes adjuntar un documento de verificación válido')
    }

    const resp = await apiRequest('/api/archivos/', {
      method: 'POST',
      body: {
        tipo_entidad: 'veterinaria_verificacion',
        id_entidad: veterinaria.user_id,
        categoria: 'verificacion',
        orden: 1,
        servicio_origen: 'ms_seguridad',
        nombre_original: documentoLocal.nombre_original,
        contenido_base64: documentoLocal.contenido_base64,
      },
    })
    if (!resp.ok || !resp.data?.id || !resp.data?.url_descarga) {
      throw new Error(resp.data?.detail || 'No se pudo subir el documento de verificación')
    }

    const vincularResp = await apiRequest(`/api/auth/veterinarias/${veterinaria.id}/`, {
      method: 'PATCH',
      body: {
        documento_verificacion_archivo_id: resp.data.id,
        documento_verificacion_url: resp.data.url_descarga,
        documento_verificacion_nombre: resp.data.nombre_original || documentoLocal.nombre_original,
      },
    })
    if (!vincularResp.ok) {
      throw new Error(vincularResp.data?.detail || 'No se pudo asociar el documento de verificación')
    }
    return vincularResp.data
  }

  const nearbyRecentReports = useMemo(() => {
    const parsed = (reports || [])
      .filter((r) => r && r.created_at)
      .filter((r) => String(r.status || '').toLowerCase() !== 'encontrado')
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
      if ((authForm.account_type || 'usuario') === 'veterinaria') {
        if (!authForm.nombre_veterinaria || !authForm.telefono_veterinaria || !authForm.region || !authForm.comuna || !authForm.direccion_veterinaria) {
          setError('Completa todos los datos principales de la veterinaria')
          setBusy(false)
          return
        }
        if (!authForm.documento_verificacion_local?.contenido_base64) {
          setError('Debes adjuntar un documento o imagen que respalde la veterinaria')
          setBusy(false)
          return
        }
        if (authForm.latitude == null || authForm.longitude == null) {
          setError('Debes fijar la ubicación de la veterinaria con dirección o ubicación actual')
          setBusy(false)
          return
        }
      }
    }

    try {
      const path = authMode === 'register' ? '/api/auth/register/' : '/api/auth/login/'
      const body = authMode === 'register'
        ? { 
            username: authForm.username, 
            password: authForm.password, 
            email: authForm.email, 
            rut: authForm.rut,
            first_name: authForm.first_name,
            last_name: authForm.last_name,
            account_type: authForm.account_type || 'usuario',
            nombre_veterinaria: authForm.nombre_veterinaria,
            telefono_veterinaria: authForm.telefono_veterinaria,
            region: authForm.region,
            comuna: authForm.comuna,
            direccion_veterinaria: authForm.direccion_veterinaria,
            descripcion_veterinaria: authForm.descripcion_veterinaria,
            sitio_web_veterinaria: authForm.sitio_web_veterinaria,
            latitude: authForm.latitude,
            longitude: authForm.longitude,
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
      let currentUser = null
      if (me.ok) {
        currentUser = me.data
        if (authMode === 'register' && currentUser?.role === 'veterinaria') {
          currentUser = await subirDocumentoVerificacion(currentUser.veterinaria, authForm.documento_verificacion_local)
            .then(() => apiRequest('/api/auth/me/', { method: 'GET' }))
            .then((updatedMe) => (updatedMe.ok ? updatedMe.data : currentUser))
          setSuccess('Registro enviado. La veterinaria quedará pendiente hasta que un administrador revise el documento.')
        }
        setUser(currentUser)
      }
      const next =
        new URLSearchParams(location.search).get('next') ||
        (authMode === 'register' && currentUser?.role === 'veterinaria' ? '/perfil' : '/')
      navigate(next, { replace: true })
    } catch (err) {
      setError(err?.message || 'No se pudo completar la autenticación')
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
    let createdReportId = null
    try {
      if (!user) {
        navigate('/login?next=/reportar', { replace: false })
        return
      }
      const payload = { ...reportForm }
      Object.keys(payload).forEach((k) => {
        if (typeof payload[k] === 'string') payload[k] = payload[k].trim()
      })
      delete payload.imagenes_locales

      if (!payload.pet_name) {
        setError('El nombre es obligatorio')
        return
      }
      if (!reportForm.imagenes_locales.length) {
        setError('Debes subir al menos 1 imagen')
        return
      }
      if (!payload.species || !payload.region || !payload.comuna) {
        setError('Completa: especie, region y comuna')
        return
      }
      if (payload.latitude == null || payload.longitude == null) {
        setError('Selecciona una ubicación en el mapa o usa tu ubicación/búsqueda por texto.')
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

      createdReportId = resp.data?.id ?? null
      if (!createdReportId) {
        setError('El reporte se creó sin identificador válido')
        return
      }

      const imagenesSubidas = await subirImagenesReporte(createdReportId, reportForm.imagenes_locales)
      const patchResp = await apiRequest(`/api/reports/${createdReportId}/`, {
        method: 'PATCH',
        body: { imagenes: imagenesSubidas },
      })
      if (!patchResp.ok) {
        throw new Error('El reporte se creó, pero no se pudieron asociar las imágenes')
      }

      setSuccess('Reporte enviado correctamente.')
      setLastCreatedReportId(createdReportId)
      await loadReports()
      setReportForm((s) => ({
        ...s,
        pet_name: '',
        description: '',
        latitude: null,
        longitude: null,
        imagenes_locales: [],
      }))
    } catch (err) {
      if (createdReportId) {
        try {
          await apiRequest(`/api/reports/${createdReportId}/`, { method: 'DELETE' })
        } catch {}
      }
      setError(err?.message || 'No se pudo crear el reporte')
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

      <Route element={<DisposicionPublica user={user} isAdmin={isAdmin} canModerateReports={canModerateReports} busy={busy} onLogout={doLogout} year={year} />}>
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
        <Route path="/adopciones/publicar" element={<PaginaPublicarAdopcion user={user} />} />
        <Route path="/adopciones/:adoptionId" element={<PaginaAdopcionDetalle user={user} />} />
        <Route path="/veterinarias/:veterinariaId" element={<PaginaVeterinariaDetalle />} />

        <Route
          path="/reportar"
          element={
            <PaginaReporte
              user={user}
              error={error}
              success={success}
              busy={busy}
              reportForm={reportForm}
              ubicacionTexto={ubicacionTexto}
              buscandoUbicacion={buscandoUbicacion}
              reports={reports}
              reportCenter={reportCenter}
              reportZoom={reportZoom}
              lastCreatedReportId={lastCreatedReportId}
              userLocation={userLocation}
              onSubmitReport={submitReport}
              onReportFormChange={updateReportForm}
              onUbicacionTextoChange={setUbicacionTexto}
              onBuscarUbicacionTexto={buscarUbicacionPorTexto}
              onUsarUbicacionDispositivo={usarUbicacionDispositivoParaReporte}
              onSelectRegion={onSelectRegion}
              onImageChange={onImageChange}
              onClearSuccess={() => setSuccess('')}
            />
          }
        />

        <Route path="/perfil" element={<PaginaPerfil user={user} authInicializando={authInicializando} reports={reports} onLogout={doLogout} busy={busy} onMarkFound={markReportAsFound} onViewDetail={handleViewDetail} />} />
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
