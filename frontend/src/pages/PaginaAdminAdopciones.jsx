import { useEffect, useState } from 'react'
import { apiRequest, getComunasForRegion, REGION_COMUNAS } from '../shared/appCore'

export default function PaginaAdminAdopciones({ search }) {
  const [adoptions, setAdoptions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  
  const [editForm, setEditForm] = useState({
    pet_name: '', species: '', age: '', region: '', comuna: '', description: '', contact_phone: '', contact_email: ''
  })

  async function loadAdoptions() {
    // Pedimos la lista completa (incluyendo lo pendiente de confirmación)
    const resp = await apiRequest('/api/adoptions/?include_unconfirmed=1', { method: 'GET' })
    if (!resp.ok) throw new Error(resp.data?.detail || 'No se pudieron cargar los registros')
    setAdoptions(resp.data?.results || [])
  }

  useEffect(() => {
    setLoading(true)
    loadAdoptions().catch(e => setError(e.message)).finally(() => setLoading(false))
  }, [])

  const q = (search || '').trim().toLowerCase()
  const filtered = q
    ? adoptions.filter(a => `${a.id} ${a.pet_name} ${a.species} ${a.region} ${a.comuna}`.toLowerCase().includes(q))
    : adoptions

  async function handleConfirm(id) {
    setLoading(true)
    try {
      const resp = await apiRequest(`/api/adoptions/${id}/`, { method: 'PATCH', body: { is_confirmed: true } })
      if (!resp.ok) throw new Error('No se pudo confirmar')
      await loadAdoptions()
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  async function handleDelete(id) {
    if (!window.confirm('¿Eliminar definitivamente este reporte de adopción?')) return
    setLoading(true)
    try {
      const resp = await apiRequest(`/api/adoptions/${id}/`, { method: 'DELETE' })
      if (!resp.ok) throw new Error('No se pudo eliminar')
      if (editingId === id) setEditingId(null)
      await loadAdoptions()
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  function startEdit(a) {
    setEditingId(a.id)
    setEditForm({
      pet_name: a.pet_name || '', species: a.species || '', age: a.age || '',
      region: a.region || '', comuna: a.comuna || '', description: a.description || '',
      contact_phone: a.contact_phone || '', contact_email: a.contact_email || ''
    })
  }

  async function handleSaveEdit(id) {
    setLoading(true)
    try {
      const resp = await apiRequest(`/api/adoptions/${id}/`, { method: 'PATCH', body: editForm })
      if (!resp.ok) throw new Error('No se pudieron guardar los cambios')
      setEditingId(null)
      await loadAdoptions()
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  return (
    <section className="boCard">
      <div className="boCardTop">
        <div>
          <div className="boH1">Panel de Adopciones</div>
          <div className="boSub">Verifica reportes de entrega y confirma su publicación</div>
        </div>
      </div>

      {error && <div className="formError">{error}</div>}
      {loading && <div className="mutedText">Cargando datos…</div>}

      <div className="adminTableWrap">
        <table className="adminTable">
          <thead>
            <tr>
              <th>ID</th>
              <th>Mascota</th>
              <th>Ubicación</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(a => (
              <tr key={a.id}>
                <td>{a.id}</td>
                <td><strong>{a.pet_name}</strong> ({a.species})</td>
                <td>{a.comuna}, {a.region}</td>
                <td>{a.is_confirmed ? '✅ Publicado' : '⏳ En Revisión'}</td>
                <td>
                  <div className="adminRowActions">
                    {!a.is_confirmed && (
                      <button className="miniBtn" type="button" onClick={() => handleConfirm(a.id)} disabled={loading}>
                        Confirmar
                      </button>
                    )}
                    <button className="miniBtn" type="button" onClick={() => startEdit(a)} disabled={loading}>
                      Editar
                    </button>
                    <button className="miniBtn danger" type="button" onClick={() => handleDelete(a.id)} disabled={loading}>
                      Borrar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingId && (
        <div className="adminEdit">
          <div className="adminEditTop">
            <div className="adminEditTitle">Modificar Registro #{editingId}</div>
            <button className="miniBtn" type="button" onClick={() => setEditingId(null)}>Cerrar</button>
          </div>
          <div className="form adminForm">
            <label className="field"><span>Nombre</span><input value={editForm.pet_name} onChange={e => setEditForm(s => ({ ...s, pet_name: e.target.value }))} /></label>
            <label className="field"><span>Especie</span><input value={editForm.species} onChange={e => setEditForm(s => ({ ...s, species: e.target.value }))} /></label>
            <label className="field"><span>Edad</span><input value={editForm.age} onChange={e => setEditForm(s => ({ ...s, age: e.target.value }))} /></label>
            <label className="field">
              <span>Región</span>
              <select value={editForm.region} onChange={e => setEditForm(s => ({ ...s, region: e.target.value, comuna: '' }))}>
                <option value="">Selecciona…</option>
                {REGION_COMUNAS.map(r => <option key={r.region} value={r.region}>{r.region}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Comuna</span>
              <select value={editForm.comuna} onChange={e => setEditForm(s => ({ ...s, comuna: e.target.value }))} disabled={!editForm.region}>
                <option value="">Selecciona…</option>
                {getComunasForRegion(editForm.region).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="field"><span>Descripción</span><textarea value={editForm.description} onChange={e => setEditForm(s => ({ ...s, description: e.target.value }))} rows={2} /></label>
            <label className="field"><span>Teléfono</span><input value={editForm.contact_phone} onChange={e => setEditForm(s => ({ ...s, contact_phone: e.target.value }))} /></label>
            <label className="field"><span>Email</span><input value={editForm.contact_email} onChange={e => setEditForm(s => ({ ...s, contact_email: e.target.value }))} /></label>
            <button className="primaryBtn" type="button" onClick={() => handleSaveEdit(editingId)} disabled={loading}>Guardar Cambios</button>
          </div>
        </div>
      )}
    </section>
  )
}