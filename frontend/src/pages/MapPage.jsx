import { useMemo, useState } from 'react'
import { CircleMarker, MapContainer, TileLayer } from 'react-leaflet'

import { InvalidateSize, Recenter, ReportsMarkers } from '../components/map/MapHelpers'
import { getComunasForRegion, normalizeSpecies, normalizeStatus, REGION_VIEW, SPECIES_OPTIONS } from '../shared/appCore'

export default function MapPage({ center, zoom, reports, lastCreatedReportId, userLocation, onViewDetail }) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('todos')
  const [species, setSpecies] = useState('todos')
  const [region, setRegion] = useState('')
  const [comuna, setComuna] = useState('')

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

  return (
    <div className="mainInner mainInnerHome">
      <section className="section mapPageIntro">
        <div className="mapPageHeading">
          <div className="howEyebrow">Mapa comunitario</div>
          <h1 className="sectionTitle" style={{ marginTop: '8px' }}>Mapa completo de reportes</h1>
          <p className="sectionSubtitle">
            Revisa los avisos activos, explora marcadores cercanos y abre cada ficha para ver mas detalles.
          </p>
        </div>
      </section>

      <div className="fullBleed">
        <section className="section">
          <div className="mapExplorer">
            <button className="miniBtn mapFiltersToggle" type="button" onClick={() => setFiltersOpen((open) => !open)}>
              {filtersOpen ? 'Ocultar filtros' : 'Mostrar filtros'}
            </button>

            <div className={`mapFiltersPanel${filtersOpen ? ' isOpen' : ''}`}>
              <div className="mapFiltersHeader">
                <div>
                  <div className="mapFiltersEyebrow">Panel lateral</div>
                  <div className="mapFiltersTitle">Filtra reportes</div>
                </div>
                <button className="miniBtn" type="button" onClick={resetFilters}>Limpiar</button>
              </div>

              <div className="mapFiltersSummary">
                <strong>{filteredReports.length}</strong>
                <span>reportes visibles en el mapa</span>
              </div>

              <div className="mapFiltersForm">
                <label className="field">
                  <span>Buscar</span>
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre, especie, comuna o región" />
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

              <div className="mapFiltersChips">
                <span className="mapFilterChip">Perdidos: {filteredReports.filter((report) => normalizeStatus(report.status) === 'perdido').length}</span>
                <span className="mapFilterChip">Encontrados: {filteredReports.filter((report) => normalizeStatus(report.status) === 'encontrado').length}</span>
              </div>
            </div>

            <div className="mapWrap mapFullBleed mapExplorerCanvas">
              <MapContainer className="map mapExplorerMap" center={mapCenter} zoom={mapZoom} scrollWheelZoom>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Recenter center={mapCenter} zoom={mapZoom} />
                <InvalidateSize watch={`${filteredReports.length}-${filtersOpen}`} />
                <ReportsMarkers reports={filteredReports} highlightId={lastCreatedReportId} onSelectReport={onViewDetail} />
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
