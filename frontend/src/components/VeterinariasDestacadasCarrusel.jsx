import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

function getVisibleCount(total) {
  if (total <= 1) return 1
  if (total === 2) return 2
  if (total === 3) return 3
  return 4
}

function getInitials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
  if (!parts.length) return 'VS'
  return parts.map((p) => p[0]?.toUpperCase() || '').join('')
}

export default function VeterinariasDestacadasCarrusel({ items, onCardClick, titleId = 'featured-vets-title' }) {
  const visibleCount = getVisibleCount((items || []).length)
  const [startIndex, setStartIndex] = useState(0)

  const visibleItems = useMemo(() => {
    const all = items || []
    return all.slice(startIndex, startIndex + visibleCount)
  }, [items, startIndex, visibleCount])

  const canGoPrev = startIndex > 0
  const canGoNext = startIndex + visibleCount < (items || []).length
  const visibleCountClass = `count-${Math.min(Math.max(visibleItems.length, 0), 4)}`

  function handlePrev() {
    setStartIndex((current) => Math.max(0, current - visibleCount))
  }

  function handleNext() {
    setStartIndex((current) => {
      const total = (items || []).length
      const maxStart = Math.max(0, total - visibleCount)
      return Math.min(maxStart, current + visibleCount)
    })
  }

  return (
    <div className="featuredVets">
      <div className="featuredVetsHeader">
        <div>
          <h2 id={titleId} className="featuredVetsTitle">Veterinarias destacadas</h2>
          <p className="featuredVetsLead">
            Da visibilidad a tu clínica en la plataforma y conecta con más familias que necesitan apoyo.
          </p>
        </div>

        <div className="featuredVetsActions">
          <Link className="featuredVetsRegisterBtn" to="/register">
            Registrar mi veterinaria
          </Link>
          <div className="featuredVetsNav">
            <button type="button" className="featuredVetsNavBtn" onClick={handlePrev} disabled={!canGoPrev} aria-label="Ver veterinarias anteriores">
              <span aria-hidden="true">‹</span>
            </button>
            <button type="button" className="featuredVetsNavBtn" onClick={handleNext} disabled={!canGoNext} aria-label="Ver más veterinarias destacadas">
              <span aria-hidden="true">›</span>
            </button>
          </div>
        </div>
      </div>

      {visibleItems.length === 0 ? (
        <div className="featuredVetsEmpty">
          <strong>Tu veterinaria puede aparecer aquí.</strong>
          <span>Regístrala en la plataforma para mostrar sus servicios, ubicación y datos de contacto.</span>
        </div>
      ) : (
        <div className={`featuredVetsGrid ${visibleCountClass}`}>
          {visibleItems.map((item) => {
            const location = [item?.comuna, item?.region].filter(Boolean).join(', ')
            return (
              <article key={item.id} className="featuredVetCard">
                <div className="featuredVetBanner">
                  <div className="featuredVetSeal">Destacada</div>
                  <div className="featuredVetAvatar" aria-hidden="true">
                    {getInitials(item?.nombre_veterinaria)}
                  </div>
                </div>

                <div className="featuredVetBody">
                  <div className="featuredVetName">{item?.nombre_veterinaria || 'Veterinaria sin nombre'}</div>

                  {location ? (
                    <div className="featuredVetMeta">
                      <svg className="featuredVetMetaIcon" viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          fill="currentColor"
                          d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 14.5 9 2.503 2.503 0 0 1 12 11.5Z"
                        />
                      </svg>
                      <span>{location}</span>
                    </div>
                  ) : null}

                  {item?.telefono ? (
                    <div className="featuredVetMeta">
                      <svg className="featuredVetMetaIcon" viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          fill="currentColor"
                          d="M6.62 10.79a15.053 15.053 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1-.24 11.36 11.36 0 0 0 3.57.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.49a1 1 0 0 1 1 1 11.36 11.36 0 0 0 .57 3.57 1 1 0 0 1-.24 1Z"
                        />
                      </svg>
                      <span>{item.telefono}</span>
                    </div>
                  ) : null}

                  <p className="featuredVetDescription">
                    {item?.descripcion || 'Atención veterinaria registrada en Sanos y Salvos para apoyar a la comunidad.'}
                  </p>

                  <div className="featuredVetFooter">
                    <button type="button" className="featuredVetLinkBtn" onClick={() => onCardClick?.(item.id)}>
                      Ver ficha
                    </button>
                    {item?.sitio_web ? (
                      <a className="featuredVetSiteLink" href={item.sitio_web} target="_blank" rel="noreferrer">
                        Sitio web
                      </a>
                    ) : null}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
