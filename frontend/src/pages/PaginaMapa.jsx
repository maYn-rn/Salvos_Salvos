import { useEffect, useMemo, useRef, useState } from 'react'
import { CircleMarker, MapContainer, Popup, TileLayer, ZoomControl, useMapEvents } from 'react-leaflet'
import { useNavigate } from 'react-router-dom'

import { InvalidarTamanoMapa, RecentrarMapa, MarcadoresReportes } from '../components/map/AyudantesMapa'
import { apiRequest, getComunasForRegion, normalizeSpecies, normalizeStatus, REGION_VIEW, SPECIES_OPTIONS } from '../shared/appCore'

const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter'

function buildOverpassQuery(kind, bbox) {
  const [south, west, north, east] = bbox
  const bboxText = `${south},${west},${north},${east}`
  const tag = kind === 'veterinary' ? '["amenity"="veterinary"]' : '["amenity"="animal_shelter"]'

  return `[out:json][timeout:25];
(
  node${tag}(${bboxText});
  way${tag}(${bboxText});
  relation${tag}(${bboxText});
);
out center tags;`
}

function formatPoiAddress(tags) {
  if (!tags) return ''
  const street = tags['addr:street'] || ''
  const number = tags['addr:housenumber'] || ''
  const city = tags['addr:city'] || ''
  const parts = []
  const streetLine = `${street} ${number}`.trim()
  if (streetLine) parts.push(streetLine)
  if (city) parts.push(city)
  return parts.join(', ')
}

function mapOverpassElementToPoi(kind, element) {
  const tags = element?.tags || {}
  const lat = element?.lat ?? element?.center?.lat
  const lon = element?.lon ?? element?.center?.lon
  if (lat == null || lon == null) return null

  const fallbackName = kind === 'veterinary' ? 'Veterinaria' : 'Albergue'
  const name = (tags.name || tags.operator || tags.brand || fallbackName).trim()
  const address = formatPoiAddress(tags)

  return {
    id: `${kind}:${element.type}:${element.id}`,
    kind,
    lat: Number(lat),
    lon: Number(lon),
    name,
    address,
    phone: tags.phone || tags['contact:phone'] || '',
    website: tags.website || tags['contact:website'] || '',
  }
}

function bboxKey(bounds) {
  const south = bounds.getSouth()
  const west = bounds.getWest()
  const north = bounds.getNorth()
  const east = bounds.getEast()
  return [south, west, north, east].map((n) => Number(n).toFixed(3)).join(',')
}

function toBbox(bounds) {
  return [bounds.getSouth(), bounds.getWest(), bounds.getNorth(), bounds.getEast()]
}

function PuntosInteres({ enabled, kind, color, fillColor }) {
  const [pois, setPois] = useState([])
  const lastKeyRef = useRef('')
  const timerRef = useRef(0)
  const abortRef = useRef(null)

  const fetchPoisForCurrentView = async (map) => {
    const bounds = map.getBounds()
    const key = bboxKey(bounds)
    if (key === lastKeyRef.current) return
    lastKeyRef.current = key

    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const query = buildOverpassQuery(kind, toBbox(bounds))
      const resp = await fetch(OVERPASS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      })
      if (!resp.ok) throw new Error('No se pudo cargar la capa')
      const json = await resp.json()
      const items = (json?.elements || [])
        .map((el) => mapOverpassElementToPoi(kind, el))
        .filter(Boolean)
        .slice(0, 140)
      setPois(items)
    } catch (e) {
      if (e?.name === 'AbortError') return
      setPois([])
    }
  }

  const scheduleFetch = (map) => {
    if (!enabled) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      fetchPoisForCurrentView(map)
    }, 350)
  }

  const map = useMapEvents({
    moveend: () => scheduleFetch(map),
    zoomend: () => scheduleFetch(map),
  })

  useEffect(() => {
    if (!enabled) {
      setPois([])
      lastKeyRef.current = ''
      if (abortRef.current) abortRef.current.abort()
      if (timerRef.current) clearTimeout(timerRef.current)
      return
    }
    scheduleFetch(map)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (abortRef.current) abortRef.current.abort()
    }
  }, [enabled, kind, map])

  if (!enabled) return null

  return (
    <>
      {pois.map((poi) => (
        <CircleMarker
          key={poi.id}
          center={[poi.lat, poi.lon]}
          radius={6}
          pathOptions={{ color, fillColor, fillOpacity: 0.9 }}
        >
          <Popup>
            <div style={{ fontWeight: 900 }}>{poi.name}</div>
            {poi.address ? <div style={{ marginTop: '4px' }}>{poi.address}</div> : null}
            {poi.phone ? <div style={{ marginTop: '4px' }}>{poi.phone}</div> : null}
            {poi.website ? (
              <a href={poi.website} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: '6px' }}>
                Sitio web
              </a>
            ) : null}
          </Popup>
        </CircleMarker>
      ))}
    </>
  )
}

function VeterinariasRegistradas({ enabled, onViewVeterinaria }) {
  const [items, setItems] = useState([])

  useEffect(() => {
    let cancelled = false
    if (!enabled) {
      setItems([])
      return undefined
    }

    ;(async () => {
      const resp = await apiRequest('/api/auth/veterinarias/', { method: 'GET' })
      if (cancelled) return
      if (!resp.ok) {
        setItems([])
        return
      }
      setItems((resp.data?.results || []).filter((item) => item?.latitude != null && item?.longitude != null))
    })()

    return () => {
      cancelled = true
    }
  }, [enabled])

  if (!enabled) return null

  return (
    <>
      {items.map((item) => (
        <CircleMarker
          key={item.id}
          center={[Number(item.latitude), Number(item.longitude)]}
          radius={7}
          pathOptions={{ color: '#7c3aed', fillColor: '#8b5cf6', fillOpacity: 0.95 }}
        >
          <Popup>
            <div style={{ fontWeight: 900 }}>{item.nombre_veterinaria}</div>
            {item.direccion ? <div style={{ marginTop: '4px' }}>{item.direccion}</div> : null}
            {item.comuna || item.region ? <div style={{ marginTop: '4px' }}>{[item.comuna, item.region].filter(Boolean).join(', ')}</div> : null}
            {item.telefono ? <div style={{ marginTop: '4px' }}>{item.telefono}</div> : null}
            <button className="miniBtn" type="button" style={{ marginTop: '8px' }} onClick={() => onViewVeterinaria(item.id)}>
              Ver ficha
            </button>
          </Popup>
        </CircleMarker>
      ))}
    </>
  )
}

export default function PaginaMapa({ center, zoom, reports, lastCreatedReportId, userLocation, onViewDetail }) {
  const navigate = useNavigate()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('todos')
  const [species, setSpecies] = useState('todos')
  const [region, setRegion] = useState('')
  const [comuna, setComuna] = useState('')
  const [showVets, setShowVets] = useState(false)
  const [showShelters, setShowShelters] = useState(false)

  const filteredReports = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (reports || []).filter((report) => {
      if (!report) return false

      if (status !== 'todos' && normalizeStatus(report.status) !== status) return false
      if (species !== 'todos' && normalizeSpecies(report.species) !== normalizeSpecies(species)) return false
      if (region && report.region !== region) return false
      if (comuna && report.comuna !== comuna) return false

      if (!q) return true
      const haystack = `${report.pet_name || ''} ${report.species || ''} ${report.region || ''} ${report.comuna || ''} ${report.description || ''}`
      return haystack.toLowerCase().includes(q)
    })
  }, [reports, search, status, species, region, comuna])

  const activeRegionView = region ? REGION_VIEW[region] || null : null
  const firstFilteredWithCoords = filteredReports.find((report) => report?.latitude != null && report?.longitude != null)
  const mapCenter = firstFilteredWithCoords
    ? [Number(firstFilteredWithCoords.latitude), Number(firstFilteredWithCoords.longitude)]
    : (activeRegionView ? activeRegionView.center : center)
  const mapZoom = firstFilteredWithCoords ? 13 : (activeRegionView ? activeRegionView.zoom : zoom)

  function resetFilters() {
    setSearch('')
    setStatus('todos')
    setSpecies('todos')
    setRegion('')
    setComuna('')
  }

  const speciesNorm = normalizeSpecies(species)
  const dogsActive = speciesNorm === 'perro'
  const catsActive = speciesNorm === 'gato'

  return (
    <div className="mainInner">
      <div className="fullBleed">
        <section className="section mapPageShell">
          <div className="mapExplorer">
            <div className="mapWrap mapExplorerCanvas">
            <button className="miniBtn mapFiltersToggle" type="button" onClick={() => setFiltersOpen((open) => !open)}>
              {filtersOpen ? 'Ocultar filtros' : 'Mostrar filtros'}
            </button>

            <div className="mapOverlayButtons" role="group" aria-label="Capas del mapa">
              <button
                type="button"
                className={`mapOverlayBtn${showVets ? ' isActive' : ''}`}
                onClick={() => setShowVets((v) => !v)}
              >
                Veterinarias
              </button>
              <button
                type="button"
                className={`mapOverlayBtn${showShelters ? ' isActive' : ''}`}
                onClick={() => setShowShelters((v) => !v)}
              >
                Albergues
              </button>
              <button
                type="button"
                className={`mapOverlayBtn${dogsActive ? ' isActive' : ''}`}
                onClick={() => setSpecies(dogsActive ? 'todos' : 'Perro')}
              >
                Perros
              </button>
              <button
                type="button"
                className={`mapOverlayBtn${catsActive ? ' isActive' : ''}`}
                onClick={() => setSpecies(catsActive ? 'todos' : 'Gato')}
              >
                Gatos
              </button>
            </div>

            <div className={`mapFiltersPanel${filtersOpen ? ' isOpen' : ''}`}>
              <div className="mapFiltersHeader">
                <div>
                  <div className="mapFiltersEyebrow">Panel lateral</div>
                  <div className="mapFiltersTitle">Filtra reportes</div>
                </div>
                <button className="miniBtn" type="button" onClick={resetFilters}>Limpiar</button>
              </div>

              <div className="mapFiltersForm">
                <label className="field">
                  <span>Buscar</span>
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nombre, especie o zona..." />
                </label>

                <label className="field">
                  <span>Estado</span>
                  <select value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="todos">Todos</option>
                    <option value="perdido">Perdidos</option>
                    <option value="encontrado">Encontrados</option>
                  </select>
                </label>

                <label className="field">
                  <span>Especie</span>
                  <select value={species} onChange={(e) => setSpecies(e.target.value)}>
                    <option value="todos">Todas</option>
                    {SPECIES_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>

                <label className="field">
                  <span>Region</span>
                  <select value={region} onChange={(e) => {
                    setRegion(e.target.value)
                    setComuna('')
                  }}>
                    <option value="">Todas</option>
                    {Object.keys(REGION_VIEW).map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>

                <label className="field">
                  <span>Comuna</span>
                  <select value={comuna} onChange={(e) => setComuna(e.target.value)} disabled={!region}>
                    <option value="">{region ? 'Todas' : 'Selecciona region'}</option>
                    {getComunasForRegion(region).map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
              </div>

            </div>

            <MapContainer className="map mapExplorerMap" center={mapCenter} zoom={mapZoom} scrollWheelZoom zoomControl={false}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
              <ZoomControl position="topright" />
                <RecentrarMapa center={mapCenter} zoom={mapZoom} />
                <InvalidarTamanoMapa watch={`${filteredReports.length}-${filtersOpen}`} />
                <MarcadoresReportes reports={filteredReports} highlightId={lastCreatedReportId} onSelectReport={onViewDetail} />
                <VeterinariasRegistradas enabled={showVets} onViewVeterinaria={(id) => navigate(`/veterinarias/${id}`)} />
                <PuntosInteres enabled={showShelters} kind="shelter" color="#f4a340" fillColor="#f4a340" />
                {userLocation ? (
                  <CircleMarker
                    center={[userLocation.lat, userLocation.lng]}
                    radius={6}
                    pathOptions={{ color: '#064a55', fillColor: '#f4a340', fillOpacity: 1 }}
                  />
                ) : null}
              </MapContainer>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
