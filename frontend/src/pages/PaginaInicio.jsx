import { Link } from 'react-router-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CircleMarker, MapContainer, TileLayer, ZoomControl } from 'react-leaflet'

import AlertasRecientesCerca from '../components/AlertasRecientesCerca'
import VeterinariasDestacadasCarrusel from '../components/VeterinariasDestacadasCarrusel'
import { InvalidarTamanoMapa, RecentrarMapa } from '../components/map/AyudantesMapa'
import { formatDateShort, normalizeSpecies, REGION_VIEW } from '../shared/appCore'

function toFiniteInt(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(n)
}

function usePrefersReducedMotion() {
  const [prefers, setPrefers] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setPrefers(Boolean(mq.matches))
    update()

    if (mq.addEventListener) {
      mq.addEventListener('change', update)
      return () => mq.removeEventListener('change', update)
    }

    mq.addListener(update)
    return () => mq.removeListener(update)
  }, [])

  return prefers
}

function useInViewOnce(ref, { threshold = 0.25 } = {}) {
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const node = ref?.current
    if (!node || inView) return undefined
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      setInView(true)
      return undefined
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true)
          observer.disconnect()
        }
      },
      { threshold }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [ref, threshold, inView])

  return inView
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function useCountUp(targetValue, { delayMs = 80, enabled = true, maxDurationMs = 1800 } = {}) {
  const target = useMemo(() => toFiniteInt(targetValue), [targetValue])
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (!enabled) {
      setDisplay(0)
      return undefined
    }

    setDisplay(0)
    if (target === 0) return undefined

    const direction = target > 0 ? 1 : -1
    const steps = Math.max(1, Math.abs(target))
    const intervalMs = clampNumber(Math.round(Math.max(1, maxDurationMs) / steps), 12, 60)
    let intervalId = 0
    const timeoutId = setTimeout(() => {
      intervalId = setInterval(() => {
        setDisplay((prev) => {
          const next = prev + direction
          if ((direction > 0 && next >= target) || (direction < 0 && next <= target)) {
            clearInterval(intervalId)
            return target
          }
          return next
        })
      }, intervalMs)
    }, Math.max(0, delayMs))

    return () => {
      clearTimeout(timeoutId)
      if (intervalId) clearInterval(intervalId)
    }
  }, [target, delayMs, enabled, maxDurationMs])

  return display
}

export default function PaginaInicio({
  selectedReportId,
  detailedReport,
  loadingDetail,
  error,
  success,
  busy,
  user,
  nearbyRecentReports,
  featuredVeterinarias,
  heroStats,
  onViewDetail,
  onViewVeterinaria,
  onResetDetail,
}) {
  const safeHeroStats = heroStats || {}
  const statsRef = useRef(null)
  const statsInView = useInViewOnce(statsRef)
  const totalReports = useCountUp(safeHeroStats.totalReports, { enabled: statsInView })
  const activeRegions = useCountUp(safeHeroStats.activeRegions, { enabled: statsInView })
  const coveredComunas = useCountUp(safeHeroStats.coveredComunas, { enabled: statsInView })
  const numberFormat = useMemo(() => new Intl.NumberFormat('es-CL'), [])
  const detailMapCenter = detailedReport?.latitude != null && detailedReport?.longitude != null
    ? [Number(detailedReport.latitude), Number(detailedReport.longitude)]
    : (detailedReport?.region && REGION_VIEW[detailedReport.region]
      ? REGION_VIEW[detailedReport.region].center
      : [-33.4489, -70.6693])
  const detailMapZoom = detailedReport?.latitude != null && detailedReport?.longitude != null
    ? 15
    : (detailedReport?.region && REGION_VIEW[detailedReport.region]
      ? REGION_VIEW[detailedReport.region].zoom
      : 10)
  const detailSpeciesLabel = detailedReport ? normalizeSpecies(detailedReport.species) : ''
  const detailSeenSummary = detailedReport
    ? [detailedReport.comuna, detailedReport.region].filter(Boolean).join(', ') || 'Ubicación no informada'
    : ''
  const detailPublishedDate = detailedReport?.created_at ? formatDateShort(detailedReport.created_at) : ''

  return (
    <div className="mainInner mainInnerHome">
      {selectedReportId ? (
        <div className="mainInner">
          <button className="miniBtn" type="button" onClick={onResetDetail} style={{ marginBottom: '20px' }}>
            ← Volver al mapa y reportes
          </button>

          {loadingDetail ? <div className="mutedText" style={{ marginTop: '20px' }}>Cargando ficha técnica...</div> : null}
          {error ? <div className="formError" style={{ marginTop: '20px' }}>{error}</div> : null}
          {success ? <div className="formSuccess" style={{ marginTop: '20px' }}>{success}</div> : null}

          {detailedReport ? (
            <div className="reportGrid" style={{ marginTop: '20px' }}>
              <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '18px', backgroundColor: '#f8f9fa', padding: '24px' }}>
                {detailedReport.image_data_url ? (
                  <img
                    src={detailedReport.image_data_url}
                    alt={detailedReport.pet_name}
                    style={{ width: '100%', height: 'auto', maxHeight: '420px', objectFit: 'contain', borderRadius: '14px' }}
                  />
                ) : (
                  <div className="carouselImgPlaceholder" style={{ height: '300px', width: '100%', borderRadius: '12px' }}>🐾</div>
                )}

                <div className="reportDetailQuickInfo">
                  <div className="reportDetailMiniStat">
                    <span className="reportDetailMiniLabel">Última zona vista</span>
                    <strong>{detailSeenSummary}</strong>
                  </div>
                  <div className="reportDetailMiniStat">
                    <span className="reportDetailMiniLabel">Publicado</span>
                    <strong>{detailPublishedDate || 'Fecha no disponible'}</strong>
                  </div>
                </div>

                <section className="card" style={{ padding: '14px' }}>
                  <div className="cardTitle" style={{ marginBottom: '10px' }}>Última ubicación reportada</div>
                  <div className="adoptionSingleMapWrap reportDetailMiniMapWrap">
                    <MapContainer className="adoptionSingleMap reportDetailMiniMap" center={detailMapCenter} zoom={detailMapZoom} scrollWheelZoom={false} zoomControl={false}>
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      <ZoomControl position="topright" />
                      <RecentrarMapa center={detailMapCenter} zoom={detailMapZoom} />
                      <InvalidarTamanoMapa watch={`report-detail-${detailedReport.id}`} />
                      {detailedReport.latitude != null && detailedReport.longitude != null ? (
                        <CircleMarker
                          center={[Number(detailedReport.latitude), Number(detailedReport.longitude)]}
                          radius={9}
                          pathOptions={{ color: '#ef6c00', fillColor: '#f4a340', fillOpacity: 0.95 }}
                        />
                      ) : null}
                    </MapContainer>
                  </div>
                  <div className="mutedText" style={{ marginTop: '10px' }}>
                    {detailedReport.latitude != null && detailedReport.longitude != null
                      ? `Coordenadas: ${Number(detailedReport.latitude).toFixed(5)}, ${Number(detailedReport.longitude).toFixed(5)}`
                      : 'Este reporte aún no tiene coordenadas exactas, pero sí una zona de referencia.'}
                  </div>
                </section>
              </section>

              <section className="card" style={{ padding: '24px' }}>
                <h2 style={{ color: 'var(--teal-500)', fontSize: '2.5rem', marginBottom: '16px', marginTop: 0 }}>
                  {detailedReport.pet_name || 'Mascota sin nombre'}
                </h2>
                <div style={{ marginBottom: '24px' }}>
                  <span className="boPill" style={{ background: detailedReport.status === 'perdido' ? '#ffe8cc' : '#e6fcf5', color: detailedReport.status === 'perdido' ? '#f4a340' : '#19a6b6', padding: '8px 16px', borderRadius: '20px', fontWeight: 'bold', fontSize: '1.1rem' }}>
                    {detailedReport.status === 'perdido' ? '🔍 Buscado' : '✅ Encontrado'}
                  </span>
                </div>

                <div className="reportDetailHighlights">
                  <div className="reportDetailHighlight">
                    <span className="reportDetailMiniLabel">Especie</span>
                    <strong>{detailSpeciesLabel === 'perro' ? 'Perro' : detailSpeciesLabel === 'gato' ? 'Gato' : detailedReport.species || 'No informada'}</strong>
                  </div>
                  <div className="reportDetailHighlight">
                    <span className="reportDetailMiniLabel">Comuna</span>
                    <strong>{detailedReport.comuna || 'No informada'}</strong>
                  </div>
                  <div className="reportDetailHighlight">
                    <span className="reportDetailMiniLabel">Estado actual</span>
                    <strong>{detailedReport.status === 'perdido' ? 'En búsqueda activa' : 'Marcado como encontrado'}</strong>
                  </div>
                </div>

                <table className="adminTable" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
                  <tbody>
                    <tr><td style={{ padding: '10px 8px' }}><strong>Especie:</strong></td><td style={{ padding: '10px 8px' }}>{detailedReport.species}</td></tr>
                    <tr><td style={{ padding: '10px 8px' }}><strong>Región:</strong></td><td style={{ padding: '10px 8px' }}>{detailedReport.region}</td></tr>
                    <tr><td style={{ padding: '10px 8px' }}><strong>Comuna:</strong></td><td style={{ padding: '10px 8px' }}>{detailedReport.comuna}</td></tr>
                    <tr><td style={{ padding: '10px 8px' }}><strong>Última ubicación:</strong></td><td style={{ padding: '10px 8px' }}>{detailSeenSummary}</td></tr>
                    <tr><td style={{ padding: '10px 8px' }}><strong>Publicado:</strong></td><td style={{ padding: '10px 8px' }}>{detailPublishedDate || 'No disponible'}</td></tr>
                    <tr><td style={{ padding: '10px 8px' }}><strong>Descripción:</strong></td><td style={{ padding: '10px 8px' }}>{detailedReport.description || 'Sin descripción adicional.'}</td></tr>
                    <tr><td style={{ padding: '10px 8px' }}><strong>Contacto:</strong></td><td style={{ padding: '10px 8px' }}>{detailedReport.contact_name || 'Anónimo'}</td></tr>
                    <tr><td style={{ padding: '10px 8px' }}><strong>Teléfono:</strong></td><td style={{ padding: '10px 8px' }}>{detailedReport.contact_details_visible ? (detailedReport.contact_phone || 'No especificado') : 'Disponible al iniciar sesión'}</td></tr>
                    <tr><td style={{ padding: '10px 8px' }}><strong>Email:</strong></td><td style={{ padding: '10px 8px' }}>{detailedReport.contact_details_visible ? (detailedReport.contact_email || 'No especificado') : 'Disponible al iniciar sesión'}</td></tr>
                  </tbody>
                </table>

                {detailedReport.contact_details_visible ? (
                  <div className="reportDetailContactActions">
                    {detailedReport.contact_phone ? (
                      <a className="miniBtn" href={`tel:${String(detailedReport.contact_phone).replace(/\s+/g, '')}`}>
                        Llamar al contacto
                      </a>
                    ) : null}
                    {detailedReport.contact_email ? (
                      <a className="miniBtn" href={`mailto:${detailedReport.contact_email}`}>
                        Enviar correo
                      </a>
                    ) : null}
                    <Link className="miniBtn" to="/mapa">
                      Ver todos los reportes en el mapa
                    </Link>
                  </div>
                ) : (
                  <div className="reportDetailProtectedContact">
                    <strong>Información protegida</strong>
                    <span>Inicia sesión para ver el teléfono y correo del contacto.</span>
                  </div>
                )}

                {detailedReport.status === 'encontrado' ? (
                  <div style={{ marginTop: '30px', background: '#e6fcf5', color: '#19a6b6', padding: '16px', textAlign: 'center', fontWeight: 'bold', borderRadius: '8px', fontSize: '1.1rem', border: '2px solid #20c997' }}>
                    🎉 Esta mascota ya fue marcada como encontrada 🎉
                  </div>
                ) : null}
              </section>
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <div className="fullBleed homeHeroBand">
            <section className="section homeHero">
              <div className="homeHeroContent">
                <h1 className="homeHeroTitle">
                  Encuentra a tu
                  <span className="homeHeroAccent"> mascota perdida</span>
                  <br />
                  con tu comunidad
                </h1>
                <p className="homeHeroText">
                  Reporta, busca y recibe alertas en tiempo real. Miles de vecinos listos para
                  ayudarte a encontrar pistas cerca de tu zona.
                </p>
                <div className="homeHeroActions">
                  <Link className="primaryBtn homeHeroBtn homeHeroBtnPrimary" to="/reportar">Perdi a mi mascota</Link>
                  <a className="miniBtn homeHeroBtn homeHeroBtnSecondary" href="#inicio">Como funciona</a>
                </div>

                <div ref={statsRef} className="homeHeroStats" aria-label="Resumen de actividad">
                  <div className="homeHeroStat">
                    <strong key={`stat-total-${safeHeroStats.totalReports}`}>{numberFormat.format(totalReports)}</strong>
                    <span>Reportes activos</span>
                  </div>
                  <div className="homeHeroStat">
                    <strong key={`stat-regions-${safeHeroStats.activeRegions}`}>{numberFormat.format(activeRegions)}</strong>
                    <span>Regiones cubiertas</span>
                  </div>
                  <div className="homeHeroStat">
                    <strong key={`stat-comunas-${safeHeroStats.coveredComunas}`}>{numberFormat.format(coveredComunas)}</strong>
                    <span>Comunas con alertas</span>
                  </div>
                </div>
              </div>

              <div className="homeHeroArt" aria-hidden="true">
                <img className="homeHeroDog" src="/dog.png" alt="" />
              </div>
            </section>
          </div>

          <section id="reportes" className="section">
            <AlertasRecientesCerca title="Alertas recientes cerca de ti" reports={nearbyRecentReports} onCardClick={onViewDetail} />
          </section>

          <section className="section homeActionsSection" aria-labelledby="home-actions-title">
            <div className="homeActionsHeader">
              <h2 id="home-actions-title" className="homeActionsTitle">¿Qué necesitas hacer?</h2>
            </div>

            <div className="homeActionsGrid">
              <article className="homeActionCard">
                <div className="homeActionIcon homeActionIconOrange" aria-hidden="true">🐾</div>
                <div className="homeActionContent">
                  <h3>Perdí a mi mascota</h3>
                  <p>Publica un reporte para que la comunidad te ayude a encontrarla.</p>
                </div>
                <Link className="homeActionBtn homeActionBtnOrange" to="/reportar">
                  Reportar ahora
                </Link>
              </article>

              <article className="homeActionCard">
                <div className="homeActionIcon homeActionIconTeal" aria-hidden="true">❤</div>
                <div className="homeActionContent">
                  <h3>Quiero adoptar</h3>
                  <p>Revisa mascotas en adopción y encuentra un nuevo compañero para tu hogar.</p>
                </div>
                <Link className="homeActionBtn homeActionBtnTeal" to="/adopciones">
                  Ver adopciones
                </Link>
              </article>

              <article className="homeActionCard">
                <div className="homeActionIcon homeActionIconGold" aria-hidden="true">📍</div>
                <div className="homeActionContent">
                  <h3>Quiero ser voluntario</h3>
                  <p>Súmate a la red de apoyo y ayuda a la comunidad en rescates y difusión.</p>
                </div>
                <Link className="homeActionBtn homeActionBtnGold" to="/voluntarios">
                  Unirme ahora
                </Link>
              </article>
            </div>
          </section>

          <section className="section" aria-labelledby="featured-vets-title">
            <VeterinariasDestacadasCarrusel
              titleId="featured-vets-title"
              items={featuredVeterinarias}
              onCardClick={onViewVeterinaria}
            />
          </section>
        </>
      )}
    </div>
  )
}
