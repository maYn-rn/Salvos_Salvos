import { useEffect, useState } from 'react'

import { apiRequest, formatDateShort } from '../shared/appCore'

export default function PaginaAdminUsuarios({ search }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [savingId, setSavingId] = useState(null)
  const [comentariosRevision, setComentariosRevision] = useState({})

  async function loadUsers() {
    const resp = await apiRequest('/api/auth/users/', { method: 'GET' })
    if (!resp.ok) throw new Error(resp.data?.detail || 'No se pudieron cargar los usuarios')
    setUsers(resp.data?.results || [])
  }

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        await loadUsers()
      } catch (e) {
        setError(e?.message || 'Error')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  useEffect(() => {
    setComentariosRevision((prev) => {
      const next = { ...prev }
      for (const user of users) {
        if (user?.veterinaria?.id && next[user.veterinaria.id] === undefined) {
          next[user.veterinaria.id] = user.veterinaria.comentario_revision || ''
        }
      }
      return next
    })
  }, [users])

  const q = (search || '').trim().toLowerCase()
  const filtered = q
    ? users.filter((u) => `${u.username || ''} ${u.email || ''} ${u.id || ''} ${u.veterinaria?.nombre_veterinaria || ''}`.toLowerCase().includes(q))
    : users

  async function actualizarEstadoVeterinaria(veterinariaId, estado) {
    const comentario = (comentariosRevision[veterinariaId] || '').trim()
    if (estado === 'rechazada' && !comentario) {
      setError('Debes escribir un comentario antes de rechazar una veterinaria')
      return
    }
    setSavingId(veterinariaId)
    setError('')
    try {
      const resp = await apiRequest(`/api/auth/veterinarias/${veterinariaId}/`, {
        method: 'PATCH',
        body: { estado_verificacion: estado, comentario_revision: comentario },
      })
      if (!resp.ok) throw new Error(resp.data?.detail || 'No se pudo actualizar la veterinaria')
      await loadUsers()
    } catch (e) {
      setError(e?.message || 'Error')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <section className="boCard">
      <div className="boCardTop">
        <div>
          <div className="boH1">Usuarios</div>
          <div className="boSub">Listado de cuentas registradas</div>
        </div>
        <button className="miniBtn" type="button" disabled={loading} onClick={() => {
          setLoading(true)
          setError('')
          loadUsers().catch((e) => setError(e?.message || 'Error')).finally(() => setLoading(false))
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
              <th>Usuario</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Veterinaria</th>
              <th>Verificación</th>
              <th>Staff</th>
              <th>Activo</th>
              <th>Registro</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id}>
                <td>{u.id}</td>
                <td>{u.username}</td>
                <td>{u.email || '-'}</td>
                <td>{u.role || 'usuario'}</td>
                <td>{u.veterinaria?.nombre_veterinaria || '-'}</td>
                <td>
                  {u.veterinaria ? (
                    <div style={{ display: 'grid', gap: '6px' }}>
                      <span>{u.veterinaria.estado_verificacion || 'pendiente'}</span>
                      {u.veterinaria.documento_verificacion_url ? (
                        <a href={u.veterinaria.documento_verificacion_url} target="_blank" rel="noreferrer">Ver documento</a>
                      ) : (
                        <span className="mutedText">Sin documento</span>
                      )}
                    </div>
                  ) : '-'}
                </td>
                <td>{u.is_staff ? 'Sí' : 'No'}</td>
                <td>{u.is_active ? 'Sí' : 'No'}</td>
                <td>{u.date_joined ? formatDateShort(u.date_joined) : '-'}</td>
                <td>
                  {u.veterinaria ? (
                    <div style={{ display: 'grid', gap: '8px', minWidth: '240px' }}>
                      <textarea
                        value={comentariosRevision[u.veterinaria.id] || ''}
                        onChange={(e) => setComentariosRevision((prev) => ({ ...prev, [u.veterinaria.id]: e.target.value }))}
                        rows={3}
                        placeholder="Comentario para la veterinaria..."
                        style={{ width: '100%', resize: 'vertical' }}
                      />
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          className="miniBtn"
                          type="button"
                          disabled={savingId === u.veterinaria.id || !u.veterinaria.documento_verificacion_url}
                          onClick={() => actualizarEstadoVeterinaria(u.veterinaria.id, 'aprobada')}
                        >
                          Aprobar
                        </button>
                        <button
                          className="miniBtn"
                          type="button"
                          disabled={savingId === u.veterinaria.id}
                          onClick={() => actualizarEstadoVeterinaria(u.veterinaria.id, 'rechazada')}
                        >
                          Rechazar
                        </button>
                      </div>
                    </div>
                  ) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
