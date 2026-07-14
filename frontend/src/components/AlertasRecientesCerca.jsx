import { useMemo, useState } from 'react'

import { normalizeSpecies, normalizeStatus } from '../shared/appCore'

function getBadge(status) {
  const s = String(status || '').trim().toLowerCase()
  if (s.includes('adop')) return { label: 'EN ADOPCIÓN', tone: 'adoption' }
  if (normalizeStatus(s) === 'encontrado') return { label: 'ENCONTRADO', tone: 'found' }
  if (normalizeStatus(s) === 'perdido') return { label: 'PERDIDA', tone: 'lost' }
  return { label: 'ALERTA', tone: 'default' }
}

function getSpeciesEmoji(species) {
  const kind = normalizeSpecies(species)
  if (kind === 'perro') return '🐶'
  if (kind === 'gato') return '🐱'
  return '🐾'
}

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function toTimeLabel(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  if (diffMs < 0) return 'Hoy'

  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 60) return `Hace ${Math.max(1, diffMin)} min`

  const diffH = Math.floor(diffMin / 60)
  if (diffH < 6) return `Hace ${Math.max(1, diffH)} h`

  if (isSameDay(d, now)) return 'Hoy'
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (isSameDay(d, yesterday)) return 'Ayer'

  return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short' }).format(d)
}

const FILTERS = [
  { key: 'todos', label: 'Todos' },
  { key: 'perdidos', label: 'Perdidos' },
  { key: 'encontrados', label: 'Encontrados' },
  { key: 'perros', label: 'Perros' },
  { key: 'gatos', label: 'Gatos' },
]

export default function AlertasRecientesCerca({ title, reports, onCardClick }) {
  const [filterKey, setFilterKey] = useState('todos')

  const filtered = useMemo(() => {
    const all = reports || []
    if (filterKey === 'todos') return all
    if (filterKey === 'perdidos') return all.filter((r) => normalizeStatus(r?.status) === 'perdido')
    if (filterKey === 'encontrados') return all.filter((r) => normalizeStatus(r?.status) === 'encontrado')
    if (filterKey === 'perros') return all.filter((r) => normalizeSpecies(r?.species) === 'perro')
    if (filterKey === 'gatos') return all.filter((r) => normalizeSpecies(r?.species) === 'gato')
    return all
  }, [reports, filterKey])

  const visible = useMemo(() => filtered.slice(0, 12), [filtered])

  return (
    <div className="nearbyAlerts">
      <div className="nearbyAlertsHeader">
        <h2 className="nearbyAlertsTitle">{title}</h2>
        <div className="nearbyAlertsFilters" role="tablist" aria-label="Filtrar alertas recientes">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={filterKey === f.key}
              className={`nearbyAlertsChip${filterKey === f.key ? ' isActive' : ''}`}
              onClick={() => setFilterKey(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="nearbyAlertsGrid">
        {visible.length === 0 ? (
          <div className="nearbyAlertsEmpty">Sin alertas recientes</div>
        ) : (
          visible.map((r) => {
            const badge = getBadge(r?.status)
            const location = `${r?.comuna || ''}${r?.region ? `, ${r.region}` : ''}`.trim()
            const timeLabel = toTimeLabel(r?.created_at)
            const name = (r?.pet_name || '').trim() || 'Mascota sin nombre'

            return (
              <button
                key={r.id}
                className="nearbyAlertCard"
                type="button"
                onClick={() => onCardClick?.(r.id)}
              >
                <div className="nearbyAlertImgWrap">
                  {r?.image_data_url ? (
                    <img className="nearbyAlertImg" src={r.image_data_url} alt={name} />
                  ) : (
                    <div className="nearbyAlertImgPlaceholder" aria-hidden="true">
                      <div className="nearbyAlertImgEmoji">{getSpeciesEmoji(r?.species)}</div>
                    </div>
                  )}
                  <div className={`nearbyAlertBadge tone-${badge.tone}`}>{badge.label}</div>
                </div>

                <div className="nearbyAlertBody">
                  <div className="nearbyAlertName">{name}</div>

                  {location ? (
                    <div className="nearbyAlertMeta">
                      <svg className="nearbyAlertIcon" viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          fill="currentColor"
                          d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 14.5 9 2.503 2.503 0 0 1 12 11.5Z"
                        />
                      </svg>
                      <span>{location}</span>
                    </div>
                  ) : null}

                  {timeLabel ? (
                    <div className="nearbyAlertMeta">
                      <svg className="nearbyAlertIcon" viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          fill="currentColor"
                          d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm.75 5a.75.75 0 0 0-1.5 0v5.25c0 .199.079.39.22.53l3.25 3.25a.75.75 0 0 0 1.06-1.06l-3.03-3.03Z"
                        />
                      </svg>
                      <span>{timeLabel}</span>
                    </div>
                  ) : null}

                  <div className="nearbyAlertFooter">
                    <span>Ver detalles</span>
                    <svg className="nearbyAlertArrow" viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="currentColor" d="M10 6l6 6-6 6-1.4-1.4L13.2 12 8.6 7.4Z" />
                    </svg>
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
