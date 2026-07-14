import { useEffect, useState } from 'react'

import { apiRequest, formatDateShort, getVeterinaryDocumentTypeLabel } from '../shared/appCore'

export default function PaginaAdminUsuarios({ search }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [savingId, setSavingId] = useState(null)
  const [comentariosRevision, setComentariosRevision] = useState({})
  const [adminForm, setAdminForm] = useState({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    password: '',
  })

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
  const veterinariasRegistradas = filtered.filter((u) => u?.veterinaria)

  async function actualizarEstadoVeterinaria(veterinariaId, estado) {
    const comentario = (comentariosRevision[veterinariaId] || '').trim()
    if (estado === 'rechazada' && !comentario) {
      setError('Debes escribir un comentario antes de rechazar una veterinaria')
      return
    }
    setSavingId(veterinariaId)
    setError('')
    setSuccess('')
    try {
      const resp = await apiRequest(`/api/auth/veterinarias/${veterinariaId}/`, {
        method: 'PATCH',
        body: { estado_verificacion: estado, comentario_revision: comentario },
      })
      if (!resp.ok) throw new Error(resp.data?.detail || 'No se pudo actualizar la veterinaria')
      setUsers((prev) => prev.map((user) => (
        user?.veterinaria?.id === veterinariaId
          ? { ...user, veterinaria: { ...user.veterinaria, ...resp.data } }
          : user
      )))
      await loadUsers()
      setSuccess(`Veterinaria ${estado === 'aprobada' ? 'aprobada' : 'rechazada'} correctamente.`)
    } catch (e) {
      setError(e?.message || 'Error')
    } finally {
      setSavingId(null)
    }
  }

  async function crearAdmin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const resp = await apiRequest('/api/auth/users/', {
        method: 'POST',
        body: {
          username: adminForm.username.trim(),
          email: adminForm.email.trim(),
          first_name: adminForm.first_name.trim(),
          last_name: adminForm.last_name.trim(),
          password: adminForm.password,
        },
      })
      if (!resp.ok) throw new Error(resp.data?.detail || 'No se pudo crear la cuenta admin')
      setAdminForm({ username: '', email: '', first_name: '', last_name: '', password: '' })
      await loadUsers()
      setSuccess(`Administrador ${resp.data.username} creado correctamente.`)
    } catch (e) {
      setError(e?.message || 'Error')
    } finally {
      setLoading(false)
    }
  }

  async function actualizarPrivilegiosUsuario(userId, patch, mensajeExito) {
    setSavingId(userId)
    setError('')
    setSuccess('')
    try {
      const resp = await apiRequest(`/api/auth/users/${userId}/`, {
        method: 'PATCH',
        body: patch,
      })
      if (!resp.ok) throw new Error(resp.data?.detail || 'No se pudo actualizar el usuario')
      setUsers((prev) => prev.map((user) => (user.id === userId ? resp.data : user)))
      setSuccess(mensajeExito)
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
          <div className="boSub">Listado de cuentas registradas y revisión de veterinarias</div>
        </div>
        <button className="miniBtn" type="button" disabled={loading} onClick={() => {
          setLoading(true)
          setError('')
          loadUsers().catch((e) => setError(e?.message || 'Error')).finally(() => setLoading(false))
        }}>
          Actualizar
        </button>
      </div>
      <form onSubmit={crearAdmin} className="adminCreateForm" style={{ marginBottom: '18px' }}>
        <div className="adminCreateFormGrid">
          <input
            value={adminForm.first_name}
            onChange={(e) => setAdminForm((prev) => ({ ...prev, first_name: e.target.value }))}
            placeholder="Nombre"
          />
          <input
            value={adminForm.last_name}
            onChange={(e) => setAdminForm((prev) => ({ ...prev, last_name: e.target.value }))}
            placeholder="Apellido"
          />
          <input
            value={adminForm.username}
            onChange={(e) => setAdminForm((prev) => ({ ...prev, username: e.target.value }))}
            placeholder="Nombre de usuario"
          />
          <input
            type="email"
            value={adminForm.email}
            onChange={(e) => setAdminForm((prev) => ({ ...prev, email: e.target.value }))}
            placeholder="correo@dominio.cl"
          />
          <input
            type="password"
            value={adminForm.password}
            onChange={(e) => setAdminForm((prev) => ({ ...prev, password: e.target.value }))}
            placeholder="Contraseña segura"
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="mutedText">Crea una nueva cuenta con permisos de administración completos.</div>
          <button
            className="miniBtn"
            type="submit"
            disabled={
              loading ||
              !adminForm.first_name.trim() ||
              !adminForm.last_name.trim() ||
              !adminForm.username.trim() ||
              !adminForm.email.trim() ||
              !adminForm.password
            }
          >
            Crear admin
          </button>
        </div>
      </form>
      {error ? <div className="formError">{error}</div> : null}
      {success ? <div className="formSuccess">{success}</div> : null}
      {loading ? <div className="mutedText">Cargando…</div> : null}
      <section className="card" style={{ marginBottom: '18px' }}>
        <h3 className="cardTitle" style={{ marginTop: 0 }}>Veterinarias registradas</h3>
        <div className="mutedText" style={{ marginBottom: '12px' }}>
          Desde aquí puedes revisar y aprobar las veterinarias que enviaron documentos de respaldo.
        </div>
        {!veterinariasRegistradas.length ? (
          <div className="mutedText">No hay veterinarias para revisar con el filtro actual.</div>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {veterinariasRegistradas.map((u) => {
              const documentos = u.veterinaria?.documentos_verificacion || []
              return (
                <div key={`vet-review-${u.id}`} style={{ border: '1px solid rgba(6, 74, 85, 0.12)', borderRadius: '14px', padding: '14px', display: 'grid', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 900 }}>{u.veterinaria?.nombre_veterinaria || u.username}</div>
                      <div className="mutedText">{u.email || 'Sin correo'} · Estado: {u.veterinaria?.estado_verificacion || 'pendiente'}</div>
                    </div>
                    <span className="boPill">{documentos.length} documento(s)</span>
                  </div>
                  {u.veterinaria?.comentario_revision ? (
                    <div className="mutedText">Comentario actual: {u.veterinaria.comentario_revision}</div>
                  ) : null}
                  {documentos.length ? (
                    <div style={{ display: 'grid', gap: '8px' }}>
                      {documentos.map((documento, index) => (
                        <div key={`${documento.archivo_id || 'doc'}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', alignItems: 'center', padding: '10px 12px', borderRadius: '10px', background: '#f8fafc' }}>
                          <div>
                            <div style={{ fontWeight: 700 }}>{documento.archivo_nombre || `Documento ${index + 1}`}</div>
                            <div className="mutedText">{documento.tipo_documento_label || getVeterinaryDocumentTypeLabel(documento.tipo_documento)}</div>
                          </div>
                          <a className="miniBtn" href={documento.archivo_url} target="_blank" rel="noreferrer">Abrir</a>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="formError" style={{ margin: 0 }}>
                      Esta veterinaria no tiene documentos guardados. Se puede rechazar, pero no aprobar hasta que suba al menos un respaldo.
                    </div>
                  )}
                  <textarea
                    value={comentariosRevision[u.veterinaria.id] || ''}
                    onChange={(e) => setComentariosRevision((prev) => ({ ...prev, [u.veterinaria.id]: e.target.value }))}
                    rows={3}
                    placeholder="Escribe un comentario claro para la veterinaria"
                    style={{ width: '100%', resize: 'vertical' }}
                  />
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      className="miniBtn"
                      type="button"
                      disabled={savingId === u.veterinaria.id || !documentos.length}
                      onClick={() => actualizarEstadoVeterinaria(u.veterinaria.id, 'aprobada')}
                    >
                      Aprobar veterinaria
                    </button>
                    <button
                      className="miniBtn"
                      type="button"
                      disabled={savingId === u.veterinaria.id}
                      onClick={() => actualizarEstadoVeterinaria(u.veterinaria.id, 'rechazada')}
                    >
                      Rechazar veterinaria
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
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
                      {(u.veterinaria.documentos_verificacion || []).length ? (
                        <span>{u.veterinaria.documentos_verificacion.length} documento(s) cargados</span>
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
                  <div style={{ display: 'grid', gap: '10px', minWidth: '240px' }}>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        className="miniBtn"
                        type="button"
                        disabled={savingId === u.id || u.is_staff}
                        onClick={() => actualizarPrivilegiosUsuario(u.id, { is_staff: true }, `${u.username} ahora es administrador.`)}
                      >
                        Hacer admin
                      </button>
                      <button
                        className="miniBtn"
                        type="button"
                        disabled={savingId === u.id || !u.is_staff}
                        onClick={() => actualizarPrivilegiosUsuario(u.id, { is_staff: false }, `Se quitaron privilegios admin a ${u.username}.`)}
                      >
                        Quitar admin
                      </button>
                      <button
                        className={`miniBtn${u.is_active ? ' danger' : ''}`}
                        type="button"
                        disabled={savingId === u.id}
                        onClick={() => actualizarPrivilegiosUsuario(
                          u.id,
                          { is_active: !u.is_active },
                          u.is_active ? `${u.username} fue desactivado.` : `${u.username} fue reactivado.`
                        )}
                      >
                        {u.is_active ? 'Desactivar' : 'Reactivar'}
                      </button>
                    </div>
                    {u.veterinaria ? (
                      <div style={{ display: 'grid', gap: '8px' }}>
                        <textarea
                          value={comentariosRevision[u.veterinaria.id] || ''}
                          onChange={(e) => setComentariosRevision((prev) => ({ ...prev, [u.veterinaria.id]: e.target.value }))}
                          rows={3}
                          placeholder="Escribe un comentario claro para la veterinaria"
                          style={{ width: '100%', resize: 'vertical' }}
                        />
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button
                            className="miniBtn"
                            type="button"
                            disabled={savingId === u.veterinaria.id || !(u.veterinaria.documentos_verificacion || []).length}
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
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
