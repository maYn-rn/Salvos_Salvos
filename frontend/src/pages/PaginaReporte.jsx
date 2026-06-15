import { Link } from 'react-router-dom'
import { CircleMarker, MapContainer, Marker, TileLayer } from 'react-leaflet'

import { SelectorUbicacion, RecentrarMapa, MarcadoresReportes } from '../components/map/AyudantesMapa'
import { getComunasForRegion, getPetIcon, REGION_COMUNAS, SPECIES_OPTIONS } from '../shared/appCore'

export default function PaginaReporte({
  user,
  error,
  success,
  busy,
  reportForm,
  reports,
  reportCenter,
  reportZoom,
  lastCreatedReportId,
  userLocation,
  onSubmitReport,
  onReportFormChange,
  onSelectRegion,
  onImageChange,
  onClearSuccess,
}) {
  function quitarImagen(indice) {
    const actuales = reportForm.imagenes_locales || []
    onReportFormChange({ imagenes_locales: actuales.filter((_, i) => i !== indice) })
  }

  return (
    <div className="mainInner">
      <div style={{ marginBottom: '16px' }}>
        <Link className="miniBtn" to="/">← Volver al inicio</Link>
      </div>
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

            {success ? (
              <div className="formSuccess" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>🎉 {success}</div>
                <p>Tu reporte está guardado y será revisado por un administrador pronto.</p>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '10px' }}>
                  <Link to="/" className="primaryBtn" style={{ textDecoration: 'none', textAlign: 'center', flex: 1 }}>
                    ← Volver al mapa de inicio
                  </Link>
                  <button className="miniBtn" type="button" onClick={onClearSuccess} style={{ flex: 1 }}>
                    Reportar otra mascota
                  </button>
                </div>
              </div>
            ) : (
              <form className="form" onSubmit={onSubmitReport}>
                <label className="field">
                  <span>Nombre *</span>
                  <input value={reportForm.pet_name} onChange={(e) => onReportFormChange({ pet_name: e.target.value })} />
                </label>
                <label className="field">
                  <span>Especie</span>
                  <select value={reportForm.species} onChange={(e) => onReportFormChange({ species: e.target.value })}>
                    <option value="">Selecciona…</option>
                    {SPECIES_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>Región</span>
                  <select value={reportForm.region} onChange={(e) => onSelectRegion(e.target.value)}>
                    <option value="">Selecciona…</option>
                    {REGION_COMUNAS.map((r) => <option key={r.region} value={r.region}>{r.region}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>Comuna</span>
                  <select value={reportForm.comuna} onChange={(e) => onReportFormChange({ comuna: e.target.value })} disabled={!reportForm.region}>
                    <option value="">{reportForm.region ? 'Selecciona…' : 'Elige región primero'}</option>
                    {getComunasForRegion(reportForm.region).map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>Imágenes *</span>
                  <input type="file" accept="image/*" multiple onChange={onImageChange} required />
                  <span className="fileHint">
                    {(reportForm.imagenes_locales || []).length
                      ? `${(reportForm.imagenes_locales || []).length} de 3 imágenes seleccionadas`
                      : 'Obligatorias. Puedes subir hasta 3.'}
                  </span>
                  {(reportForm.imagenes_locales || []).length ? (
                    <div className="adoptionUploadPreviewGrid">
                      {(reportForm.imagenes_locales || []).map((imagen, index) => (
                        <div key={`${imagen.nombre_original || 'imagen'}-${index}`} className="adoptionUploadPreviewCard">
                          <img
                            className="adoptionUploadPreviewImg"
                            src={imagen.vista_previa}
                            alt={imagen.nombre_original || `Imagen ${index + 1}`}
                          />
                          <div className="adoptionUploadPreviewMeta">
                            <span>{index === 0 ? 'Portada' : `Imagen ${index + 1}`}</span>
                            <button type="button" className="miniBtn" onClick={() => quitarImagen(index)}>
                              Quitar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </label>
                <label className="field">
                  <span>Descripción</span>
                  <input value={reportForm.description} onChange={(e) => onReportFormChange({ description: e.target.value })} placeholder="Se perdió cerca de…" />
                </label>
                <label className="field">
                  <span>Contacto (teléfono) *</span>
                  <input type="tel" value={reportForm.contact_phone} onChange={(e) => onReportFormChange({ contact_phone: e.target.value })} placeholder="+56912345678" maxLength={15} />
                </label>
                <label className="field">
                  <span>Contacto (email) *</span>
                  <input type="email" value={reportForm.contact_email} onChange={(e) => onReportFormChange({ contact_email: e.target.value })} placeholder="correo@ejemplo.com" />
                </label>

                <div className="mutedText">
                  Ubicación: {reportForm.latitude != null && reportForm.longitude != null ? `${reportForm.latitude.toFixed(6)}, ${reportForm.longitude.toFixed(6)}` : 'haz click en el mapa'}
                </div>
                <button className="primaryBtn" type="submit" disabled={busy}>Publicar reporte</button>
              </form>
            )}
          </section>

          <section className="card reportMapCard">
            <div className="mapWrap reportMapWrap">
              <MapContainer className="map reportMap" center={reportCenter} zoom={reportZoom} scrollWheelZoom>
                <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <RecentrarMapa center={reportCenter} zoom={reportZoom} />
                <MarcadoresReportes reports={reports} highlightId={lastCreatedReportId} />
                <SelectorUbicacion onPick={({ latitude, longitude }) => onReportFormChange({ latitude, longitude })} />
                {userLocation ? <CircleMarker center={[userLocation.lat, userLocation.lng]} radius={6} pathOptions={{ color: '#064a55', fillColor: '#f4a340', fillOpacity: 1 }} /> : null}
                {reportForm.latitude != null && reportForm.longitude != null ? <Marker position={[reportForm.latitude, reportForm.longitude]} icon={getPetIcon(reportForm.species, { highlight: true })} /> : null}
              </MapContainer>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
