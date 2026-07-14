import { useEffect, useState } from 'react'

import { apiRequest, normalizeStatus } from '../shared/appCore'

export default function PaginaAdminReportes({ search }) {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({
    pet_name: '',
    species: '',
    region: '',
    comuna: '',
    status: '',
    description: '',
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    latitude: '',
    longitude: '',
  })

  async function loadReports() {
    const resp = await apiRequest('/api/reports/?include_unconfirmed=1', { method: 'GET' })
    if (!resp.ok) throw new Error(resp.data?.detail || 'No se pudieron cargar los reportes')
    setReports(resp.data?.results || [])
  }

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        await loadReports()
      } catch (e) {
        setError(e?.message || 'Error')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const q = (search || '').trim().toLowerCase()
  const filtered = q
    ? reports.filter((r) => {
        const hay = `${r.id || ''} ${r.pet_name || ''} ${r.species || ''} ${r.region || ''} ${r.comuna || ''} ${r.status || ''}`
        return hay.toLowerCase().includes(q)
      })
    : reports

  function startEdit(r) {
    setEditingId(r.id)
    setEditForm({
      pet_name: r.pet_name || '',
      species: r.species || '',
      region: r.region || '',
      comuna: r.comuna || '',
      status: normalizeStatus(r.status) || 'perdido',
      description: r.description || '',
      contact_name: r.contact_name || '',
      contact_phone: r.contact_phone || '',
      contact_email: r.contact_email || '',
      latitude: r.latitude == null ? '' : String(r.latitude),
      longitude: r.longitude == null ? '' : String(r.longitude),
    })
  }

  function stopEdit() {
    setEditingId(null)
  }

  async function confirmReport(id) {
    const resp = await apiRequest(`/api/reports/${id}/`, { method: 'PATCH', body: { is_confirmed: true } })
    if (!resp.ok) throw new Error(resp.data?.detail || 'No se pudo confirmar')
    await loadReports()
  }

  async function deleteReport(id) {
    const resp = await apiRequest(`/api/reports/${id}/`, { method: 'DELETE' })
    if (!resp.ok) throw new Error(resp.data?.detail || 'No se pudo borrar')
    if (editingId === id) setEditingId(null)
    await loadReports()
  }

  async function saveEdit(id) {
    const body = {
      pet_name: editForm.pet_name,
      species: editForm.species,
      region: editForm.region,
      comuna: editForm.comuna,
      status: editForm.status,
      description: editForm.description,
      contact_name: editForm.contact_name,
      contact_phone: editForm.contact_phone,
      contact_email: editForm.contact_email,
      latitude: editForm.latitude === '' ? null : Number(editForm.latitude),
      longitude: editForm.longitude === '' ? null : Number(editForm.longitude),
    }
    const resp = await apiRequest(`/api/reports/${id}/`, { method: 'PATCH', body })
    if (!resp.ok) throw new Error(resp.data?.detail || 'No se pudo guardar')
    setEditingId(null)
    await loadReports()
  }

  return (
    <section className="boCard">
      <div className="boCardTop">
        <div>
          <div className="boH1">Reportes</div>
          <div className="boSub">Gestiona confirmación, edición y eliminación</div>
        </div>
        <button className="miniBtn" type="button" disabled={loading} onClick={() => {
          setLoading(true)
          setError('')
          loadReports().catch((e) => setError(e?.message || 'Error')).finally(() => setLoading(false))
        }}>
          Actualizar
        </button>
      </div>
      {error ? <div className="formError">{error}</div> : null}
      {loading ? <div className="mutedText">Cargando…</div> : null}

      <div className="adminTableWrap">
        <table className="adminTable">
          <thead>
            <tr>
              <th>ID</th>
              <th>Mascota</th>
              <th>Zona</th>
              <th>Estado</th>
              <th>Confirmado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.pet_name || 'Sin nombre'} · {r.species || 'Mascota'}</td>
                <td>{r.comuna || ''}{r.region ? `, ${r.region}` : ''}</td>
                <td>{normalizeStatus(r.status) || '-'}</td>
                <td>{r.is_confirmed ? 'Sí' : 'No'}</td>
                <td>
                  <div className="adminRowActions">
                    {!r.is_confirmed ? (
                      <button className="miniBtn" type="button" disabled={loading} onClick={() => {
                        setLoading(true)
                        setError('')
                        confirmReport(r.id).catch((e) => setError(e?.message || 'Error')).finally(() => setLoading(false))
                      }}>
                        Publicar
                      </button>
                    ) : null}
                    <button className="miniBtn" type="button" disabled={loading} onClick={() => startEdit(r)}>
                      Editar
                    </button>
                    <button className="miniBtn danger" type="button" disabled={loading} onClick={() => {
                      setLoading(true)
                      setError('')
                      deleteReport(r.id).catch((e) => setError(e?.message || 'Error')).finally(() => setLoading(false))
                    }}>
                      Borrar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingId != null ? (
        <div className="adminEdit">
          <div className="adminEditTop">
            <div className="adminEditTitle">Editar reporte #{editingId}</div>
            <button className="miniBtn" type="button" onClick={stopEdit} disabled={loading}>Cerrar</button>
          </div>
          <div className="form adminForm">
            <label className="field">
              <span>Nombre</span>
              <input value={editForm.pet_name} onChange={(e) => setEditForm((s) => ({ ...s, pet_name: e.target.value }))} />
            </label>
            <label className="field">
              <span>Especie</span>
              <input value={editForm.species} onChange={(e) => setEditForm((s) => ({ ...s, species: e.target.value }))} />
            </label>
            <label className="field">
              <span>Región</span>
              <input value={editForm.region} onChange={(e) => setEditForm((s) => ({ ...s, region: e.target.value }))} />
            </label>
            <label className="field">
              <span>Comuna</span>
              <input value={editForm.comuna} onChange={(e) => setEditForm((s) => ({ ...s, comuna: e.target.value }))} />
            </label>
            <label className="field">
              <span>Estado</span>
              <select value={editForm.status} onChange={(e) => setEditForm((s) => ({ ...s, status: e.target.value }))}>
                <option value="perdido">Perdido</option>
                <option value="encontrado">Encontrado</option>
              </select>
            </label>
            <label className="field">
              <span>Descripción</span>
              <input value={editForm.description} onChange={(e) => setEditForm((s) => ({ ...s, description: e.target.value }))} />
            </label>
            <label className="field">
              <span>Contacto (nombre)</span>
              <input value={editForm.contact_name} onChange={(e) => setEditForm((s) => ({ ...s, contact_name: e.target.value }))} />
            </label>
            <label className="field">
              <span>Contacto (teléfono)</span>
              <input value={editForm.contact_phone} onChange={(e) => setEditForm((s) => ({ ...s, contact_phone: e.target.value }))} />
            </label>
            <label className="field">
              <span>Contacto (email)</span>
              <input value={editForm.contact_email} onChange={(e) => setEditForm((s) => ({ ...s, contact_email: e.target.value }))} />
            </label>
            <label className="field">
              <span>Latitud</span>
              <input
                type="number"
                step="any"
                value={editForm.latitude}
                onChange={(e) => setEditForm((s) => ({ ...s, latitude: e.target.value }))}
              />
            </label>
            <label className="field">
              <span>Longitud</span>
              <input
                type="number"
                step="any"
                value={editForm.longitude}
                onChange={(e) => setEditForm((s) => ({ ...s, longitude: e.target.value }))}
              />
            </label>
            <button className="primaryBtn" type="button" disabled={loading} onClick={() => {
              setLoading(true)
              setError('')
              saveEdit(editingId).catch((e) => setError(e?.message || 'Error')).finally(() => setLoading(false))
            }}>
              Guardar cambios
            </button>
          </div>
          <div className="mutedText">Si editas un reporte, quedará no confirmado hasta que lo confirmes nuevamente.</div>
        </div>
      ) : null}
    </section>
  )
}
