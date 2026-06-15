import { Link } from 'react-router-dom'
import { useEffect, useMemo, useRef, useState } from 'react'

import CarruselReportesRecientes from '../components/CarruselReportesRecientes'

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
  heroStats,
  onMarkFound,
  onViewDetail,
  onResetDetail,
}) {
  const safeHeroStats = heroStats || {}
  const statsRef = useRef(null)
  const statsInView = useInViewOnce(statsRef)
  const totalReports = useCountUp(safeHeroStats.totalReports, { enabled: statsInView })
  const activeRegions = useCountUp(safeHeroStats.activeRegions, { enabled: statsInView })
  const coveredComunas = useCountUp(safeHeroStats.coveredComunas, { enabled: statsInView })
  const numberFormat = useMemo(() => new Intl.NumberFormat('es-CL'), [])

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
              <section className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8f9fa', padding: '24px' }}>
                {detailedReport.image_data_url ? (
                  <img
                    src={detailedReport.image_data_url}
                    alt={detailedReport.pet_name}
                    style={{ width: '100%', height: 'auto', maxHeight: '500px', objectFit: 'contain', borderRadius: '8px' }}
                  />
                ) : (
                  <div className="carouselImgPlaceholder" style={{ height: '300px', width: '100%', borderRadius: '12px' }}>🐾</div>
                )}
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

                <table className="adminTable" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
                  <tbody>
                    <tr><td style={{ padding: '10px 8px' }}><strong>Especie:</strong></td><td style={{ padding: '10px 8px' }}>{detailedReport.species}</td></tr>
                    <tr><td style={{ padding: '10px 8px' }}><strong>Región:</strong></td><td style={{ padding: '10px 8px' }}>{detailedReport.region}</td></tr>
                    <tr><td style={{ padding: '10px 8px' }}><strong>Comuna:</strong></td><td style={{ padding: '10px 8px' }}>{detailedReport.comuna}</td></tr>
                    <tr><td style={{ padding: '10px 8px' }}><strong>Descripción:</strong></td><td style={{ padding: '10px 8px' }}>{detailedReport.description || 'Sin descripción adicional.'}</td></tr>
                    <tr><td style={{ padding: '10px 8px' }}><strong>Contacto:</strong></td><td style={{ padding: '10px 8px' }}>{detailedReport.contact_name || 'Anónimo'}</td></tr>
                    <tr><td style={{ padding: '10px 8px' }}><strong>Teléfono:</strong></td><td style={{ padding: '10px 8px' }}>{detailedReport.contact_phone || 'No especificado'}</td></tr>
                    <tr><td style={{ padding: '10px 8px' }}><strong>Email:</strong></td><td style={{ padding: '10px 8px' }}>{detailedReport.contact_email || 'No especificado'}</td></tr>
                  </tbody>
                </table>

                <div style={{ marginTop: '30px' }}>
                  {detailedReport.status === 'perdido' ? (
                    <button
                      className="primaryBtn"
                      style={{ width: '100%', padding: '16px', fontSize: '1.2rem' }}
                      type="button"
                      disabled={busy}
                      onClick={async (e) => {
                        e.preventDefault()
                        if (!user) {
                          window.scrollTo(0, 0)
                          return
                        }
                        await onMarkFound(detailedReport.id)
                      }}
                    >
                      ¡Reportar como encontrado!
                    </button>
                  ) : (
                    <div style={{ background: '#e6fcf5', color: '#19a6b6', padding: '16px', textAlign: 'center', fontWeight: 'bold', borderRadius: '8px', fontSize: '1.1rem', border: '2px solid #20c997' }}>
                      🎉 Esta mascota ya fue marcada como encontrada 🎉
                    </div>
                  )}
                </div>
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
            <CarruselReportesRecientes title="Reportes recientes cerca de ti" reports={nearbyRecentReports} user={user} onCardClick={onViewDetail} />
          </section>
        </>
      )}
    </div>
  )
}
