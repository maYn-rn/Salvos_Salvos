import { useEffect, useState } from 'react'

import { apiRequest, formatDateShort, normalizeStatus } from '../shared/appCore'

export default function PaginaAdminResumen() {
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
                      Publicar
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
