import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'

import {
  apiRequest,
  formatDateShort,
  getComunasForRegion,
  REGION_COMUNAS,
  SPECIES_OPTIONS,
} from '../shared/appCore'

const ADOPTION_STATUS_OPTIONS = [
  { value: 'disponible', label: 'Disponible' },
  { value: 'reservado', label: 'Reservado' },
  { value: 'adoptado', label: 'Adoptado' },
]

const PUBLISHER_TYPE_OPTIONS = [
  { value: 'persona', label: 'Persona' },
  { value: 'albergue', label: 'Albergue' },
]

const PET_SIZE_OPTIONS = ['Pequeno', 'Mediano', 'Grande']
const PET_SEX_OPTIONS = ['Macho', 'Hembra', 'No informado']

function statusLabel(value) {
  return ADOPTION_STATUS_OPTIONS.find((item) => item.value === value)?.label || 'Disponible'
}

function publisherLabel(value) {
  return PUBLISHER_TYPE_OPTIONS.find((item) => item.value === value)?.label || 'Persona'
}

function createEmptyForm(user) {
  return {
    pet_name: '',
    species: '',
    breed: '',
    age_label: '',
    sex: '',
    size: '',
    description: '',
    image_data_url: '',
    image_file_name: '',
    region: '',
    comuna: '',
    publisher_type: 'persona',
    shelter_name: '',
    health_notes: '',
    adoption_status: 'disponible',
    contact_name: user?.username || '',
    contact_phone: '',
    contact_email: user?.email || '',
  }
}

export default function PaginaAdopciones({ user }) {
  const [adoptions, setAdoptions] = useState([])
  const [loadingList, setLoadingList] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [selectedAdoptionId, setSelectedAdoptionId] = useState(null)
  const [selectedAdoption, setSelectedAdoption] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState(() => createEmptyForm(user))
  const [filters, setFilters] = useState({
    q: '',
    species: '',
    adoption_status: '',
    region: '',
    comuna: '',
    publisher_type: '',
  })

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      contact_name: prev.contact_name || user?.username || '',
      contact_email: prev.contact_email || user?.email || '',
    }))
  }, [user])

  async function loadAdoptions(nextFilters = filters) {
    setLoadingList(true)
    setError('')
    try {
      const params = new URLSearchParams()
      Object.entries(nextFilters).forEach(([key, value]) => {
        const trimmed = String(value || '').trim()
        if (trimmed) params.set(key, trimmed)
      })
      const query = params.toString()
      const resp = await apiRequest(`/api/adoptions/${query ? `?${query}` : ''}`, { method: 'GET' })
      if (!resp.ok) {
        setError(resp.data?.detail || 'No se pudieron cargar las adopciones')
        setAdoptions([])
        return
      }

      let rawResults = []
      if (Array.isArray(resp.data)) {
        rawResults = resp.data
      } else if (resp.data && Array.isArray(resp.data.results)) {
        rawResults = resp.data.results
      } else if (resp.data && typeof resp.data === 'object') {
        rawResults = Object.values(resp.data).filter(item => typeof item === 'object' && item !== null)
      }

      // DETERMINAR SI EL USUARIO ES ADMIN
      const isAdminUser = 
        user?.is_staff === true || 
        user?.is_superuser === true || 
        user?.role === 'admin' || 
        user?.role === 'staff'

      let finalResults = []
      if (isAdminUser) {
        // Si es admin, ve absolutamente todo (pendientes y aprobados)
        finalResults = rawResults
      } else {
        // Si es público general, solo ve lo confirmado o activo
        finalResults = rawResults.filter(
          (item) => item.is_confirmed === true || item.active === true
        )
      }

      setAdoptions(finalResults)
    } catch (err) {
      setError(err?.message || 'Error al cargar adopciones')
      setAdoptions([])
    } finally {
      setLoadingList(false)
    }
  }

  useEffect(() => {
    loadAdoptions(filters)
  }, [user])

  async function loadAdoptionDetail(id) {
    if (!id) return
    setSelectedAdoptionId(id)
    setLoadingDetail(true)
    setError('')
    try {
      const resp = await apiRequest(`/api/adoptions/${id}/`, { method: 'GET' })
      if (!resp.ok) {
        setError(resp.data?.detail || 'No se pudo cargar la publicacion')
        setSelectedAdoption(null)
        return
      }
      setSelectedAdoption(resp.data)
    } catch (err) {
      setError(err?.message || 'Error al cargar la publicacion')
      setSelectedAdoption(null)
    } finally {
      setLoadingDetail(false)
    }
  }

  
  async function handleToggleApprove(id, currentStatus) {
    setError('')
    setSuccess('')
    try {
      const resp = await apiRequest(`/api/adoptions/${id}/`, {
        // Si tu backend no soporta PATCH, puedes cambiarlo por 'PUT'
        method: 'PATCH', 
        body: { is_confirmed: !currentStatus, active: !currentStatus }
      })
      if (resp.ok) {
        setSuccess('Estado de aprobación actualizado con éxito')
        loadAdoptions(filters)
        loadAdoptionDetail(id)
      } else {
        setError(resp.data?.detail || 'No se pudo cambiar el estado de aprobación')
      }
    } catch (err) {
      setError(err.message)
    }
  }

  function updateFilters(patch) {
    setFilters((prev) => {
      const next = { ...prev, ...patch }
      if (Object.prototype.hasOwnProperty.call(patch, 'region')) next.comuna = ''
      return next
    })
  }

  function updateForm(patch) {
    setForm((prev) => {
      const next = { ...prev, ...patch }
      if (Object.prototype.hasOwnProperty.call(patch, 'region')) next.comuna = ''
      if (next.publisher_type !== 'albergue') next.shelter_name = ''
      return next
    })
  }

  async function onFilterSubmit(e) {
    e.preventDefault()
    await loadAdoptions(filters)
  }

  function onResetFilters() {
    const empty = {
      q: '',
      species: '',
      adoption_status: '',
      region: '',
      comuna: '',
      publisher_type: '',
    }
    setFilters(empty)
    loadAdoptions(empty)
  }

  async function onImageChange(e) {
    const file = e.target.files?.[0]
    if (!file) {
      updateForm({ image_data_url: '', image_file_name: '' })
      return
    }
    if (file.size > 1_200_000) {
      setError('La imagen es muy grande. Usa una de maximo 1.2MB.')
      e.target.value = ''
      return
    }
    const reader = new FileReader()
    const dataUrl = await new Promise((resolve, reject) => {
      reader.onerror = () => reject(new Error('read_error'))
      reader.onload = () => resolve(String(reader.result || ''))
      reader.readAsDataURL(file)
    })
    updateForm({ image_data_url: dataUrl, image_file_name: file.name })
  }

  async function onSubmitAdoption(e) {
    e.preventDefault()
    if (!user) return

    setSubmitting(true)
    setError('')
    setSuccess('')
    try {
      const payload = { ...form }
      Object.keys(payload).forEach((key) => {
        if (typeof payload[key] === 'string') payload[key] = payload[key].trim()
      })
      delete payload.image_file_name

      if (!payload.pet_name) {
        setError('El nombre de la mascota es obligatorio')
        return
      }
      if (!payload.species || !payload.region || !payload.comuna) {
        setError('Completa especie, region y comuna')
        return
      }
      if (!payload.contact_name) {
        setError('El nombre de contacto es obligatorio')
        return
      }
      if (payload.contact_phone) {
        const cleanPhone = payload.contact_phone.replace(/[\s-]/g, '')
        
        if (!/^\+?[0-9]{8,12}$/.test(cleanPhone)) {
          setError('Ingresa un teléfono válido de entre 8 y 12 números (ej: +56912345678)')
          window.scrollTo(0, 0)
          return
        }
      }
      if (payload.publisher_type === 'albergue' && !payload.shelter_name) {
        setError('Indica el nombre del albergue')
        return
      }

      const resp = await apiRequest('/api/adoptions/', { method: 'POST', body: payload })
      if (!resp.ok) {
        if (resp.status === 401) {
          setError('Debes iniciar sesion para publicar una adopcion')
          return
        }
        setError(resp.data?.detail || 'No se pudo publicar la adopcion')
        return
      }

      setSuccess('Publicacion enviada. Quedara visible cuando un administrador la confirme.')
      setForm(createEmptyForm(user))
      setFormOpen(false)
      await loadAdoptions(filters)
    } catch (err) {
      setError(err?.message || 'Error al publicar la adopcion')
    } finally {
      setSubmitting(false)
    }
  }

  const filterComunas = useMemo(() => getComunasForRegion(filters.region), [filters.region])
  const formComunas = useMemo(() => getComunasForRegion(form.region), [form.region])

  const checkIsAdmin = user?.is_staff || user?.is_superuser || user?.role === 'admin' || user?.role === 'staff'

  return (
    <div className="mainInner">
      <section className="section card adoptionsHero">
        <div className="adoptionsHeroCopy">
          <div className="homeHeroEyebrow">
            {checkIsAdmin ? 'Panel de Control de Adopciones (Modo Admin)' : 'Adopciones responsables'}
          </div>
          <h1 className="sectionTitle adoptionsTitle">Encuentra una mascota que necesita un hogar</h1>
          <p className="sectionSubtitle adoptionsSubtitle">
            Explora publicaciones de personas y albergues conectadas al microservicio de adopciones.
          </p>
        </div>
        <div className="adoptionsHeroActions">
          {user ? (
            <button className="primaryBtn" type="button" onClick={() => setFormOpen((open) => !open)}>
              {formOpen ? 'Cerrar formulario' : 'Publicar adopcion'}
            </button>
          ) : (
            <Link className="primaryBtn" to="/login?next=/adopciones">
              Inicia sesion para publicar
            </Link>
          )}
        </div>
      </section>

      {error ? <div className="formError">{error}</div> : null}
      {success ? <div className="formSuccess">{success}</div> : null}

      {formOpen ? (
        <section className="section card">
          <div className="cardTitle" style={{ marginBottom: '12px' }}>Nueva publicacion de adopcion</div>
          <form className="form adoptionsFormGrid" onSubmit={onSubmitAdoption}>
            <label className="field">
              <span>Nombre de la mascota</span>
              <input value={form.pet_name} onChange={(e) => updateForm({ pet_name: e.target.value })} placeholder="Ej: Luna" />
            </label>

            <label className="field">
              <span>Especie</span>
              <select value={form.species} onChange={(e) => updateForm({ species: e.target.value })}>
                <option value="">Selecciona</option>
                {SPECIES_OPTIONS.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Raza</span>
              <input value={form.breed} onChange={(e) => updateForm({ breed: e.target.value })} placeholder="Ej: Mestizo" />
            </label>

            <label className="field">
              <span>Edad aproximada</span>
              <input value={form.age_label} onChange={(e) => updateForm({ age_label: e.target.value })} placeholder="Ej: 2 anos" />
            </label>

            <label className="field">
              <span>Sexo</span>
              <select value={form.sex} onChange={(e) => updateForm({ sex: e.target.value })}>
                <option value="">Selecciona</option>
                {PET_SEX_OPTIONS.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Tamano</span>
              <select value={form.size} onChange={(e) => updateForm({ size: e.target.value })}>
                <option value="">Selecciona</option>
                {PET_SIZE_OPTIONS.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Region</span>
              <select value={form.region} onChange={(e) => updateForm({ region: e.target.value })}>
                <option value="">Selecciona</option>
                {REGION_COMUNAS.map((item) => (
                  <option key={item.region} value={item.region}>{item.region}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Comuna</span>
              <select value={form.comuna} onChange={(e) => updateForm({ comuna: e.target.value })} disabled={!form.region}>
                <option value="">Selecciona</option>
                {formComunas.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Publica como</span>
              <select value={form.publisher_type} onChange={(e) => updateForm({ publisher_type: e.target.value })}>
                {PUBLISHER_TYPE_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Estado</span>
              <select value={form.adoption_status} onChange={(e) => updateForm({ adoption_status: e.target.value })}>
                {ADOPTION_STATUS_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>

            {form.publisher_type === 'albergue' ? (
              <label className="field">
                <span>Nombre del albergue</span>
                <input value={form.shelter_name} onChange={(e) => updateForm({ shelter_name: e.target.value })} placeholder="Ej: Refugio Patitas" />
              </label>
            ) : null}

            <label className="field">
              <span>Nombre de contacto</span>
              <input value={form.contact_name} onChange={(e) => updateForm({ contact_name: e.target.value })} placeholder="Ej: Maria" />
            </label>

            <label className="field">
              <span>Telefono</span>
              <input type="tel" maxLength={15} value={form.contact_phone} onChange={(e) => updateForm({ contact_phone: e.target.value })} placeholder="Ej: +56912345678" />
            </label>

            <label className="field">
              <span>Email</span>
              <input value={form.contact_email} onChange={(e) => updateForm({ contact_email: e.target.value })} placeholder="Ej: contacto@email.com" />
            </label>

            <label className="field">
              <span>Imagen</span>
              <input type="file" accept="image/*" onChange={onImageChange} />
              <span className="fileHint">{form.image_file_name || 'Opcional. JPG, PNG o WEBP.'}</span>
            </label>

            <label className="field adoptionsFieldFull">
              <span>Descripcion</span>
              <input value={form.description} onChange={(e) => updateForm({ description: e.target.value })} placeholder="Cuenta el caracter, energia y necesidades de la mascota" />
            </label>

            <label className="field adoptionsFieldFull">
              <span>Notas de salud</span>
              <input value={form.health_notes} onChange={(e) => updateForm({ health_notes: e.target.value })} placeholder="Vacunas, esterilizacion, tratamientos, etc." />
            </label>

            <div className="adoptionsFormActions adoptionsFieldFull">
              <button className="primaryBtn" type="submit" disabled={submitting}>
                {submitting ? 'Publicando...' : 'Guardar publicacion'}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <div className="adoptionsLayout">
        <section className="card adoptionsFiltersCard">
          <div className="cardTitle" style={{ marginBottom: '12px' }}>Filtrar adopciones</div>
          <form className="form" onSubmit={onFilterSubmit}>
            <label className="field">
              <span>Buscar</span>
              <input value={filters.q} onChange={(e) => updateFilters({ q: e.target.value })} placeholder="Nombre, raza, comuna o albergue" />
            </label>

            <label className="field">
              <span>Especie</span>
              <select value={filters.species} onChange={(e) => updateFilters({ species: e.target.value })}>
                <option value="">Todas</option>
                {SPECIES_OPTIONS.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Estado</span>
              <select value={filters.adoption_status} onChange={(e) => updateFilters({ adoption_status: e.target.value })}>
                <option value="">Todos</option>
                {ADOPTION_STATUS_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Tipo de publicador</span>
              <select value={filters.publisher_type} onChange={(e) => updateFilters({ publisher_type: e.target.value })}>
                <option value="">Todos</option>
                {PUBLISHER_TYPE_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Region</span>
              <select value={filters.region} onChange={(e) => updateFilters({ region: e.target.value })}>
                <option value="">Todas</option>
                {REGION_COMUNAS.map((item) => (
                  <option key={item.region} value={item.region}>{item.region}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Comuna</span>
              <select value={filters.comuna} onChange={(e) => updateFilters({ comuna: e.target.value })} disabled={!filters.region}>
                <option value="">Todas</option>
                {filterComunas.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>

            <div className="adoptionsFilterActions">
              <button className="primaryBtn" type="submit">Aplicar filtros</button>
              <button className="miniBtn" type="button" onClick={onResetFilters}>Limpiar</button>
            </div>
          </form>
        </section>

        <section className="adoptionsResults">
          <div className="card adoptionsResultsHeader">
            <div>
              <div className="cardTitle" style={{ marginBottom: '4px' }}>
                {checkIsAdmin ? 'Todas las publicaciones (Admin)' : 'Publicaciones activas'}
              </div>
              <div className="mutedText" style={{ marginTop: 0 }}>
                {loadingList ? 'Cargando...' : `${adoptions.length} registros cargados`}
              </div>
            </div>
          </div>

          <div className="adoptionsCards">
            {loadingList ? (
              <div className="card mutedText">Cargando adopciones...</div>
            ) : adoptions.length ? (
              adoptions.map((item) => (
                <article
                  key={item.id}
                  className={`adoptionCard card${selectedAdoptionId === item.id ? ' isSelected' : ''}`}
                  onClick={() => loadAdoptionDetail(item.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      loadAdoptionDetail(item.id)
                    }
                  }}
                >
                  <div className="adoptionCardTop">
                    <div>
                      <div className="carouselCardTitle">
                        {item.pet_name} 
                        {checkIsAdmin && !item.is_confirmed && !item.active && (
                          <span style={{ color: 'var(--error-color, #d32f2f)', fontSize: '0.8rem', marginLeft: '8px', fontWeight: 'bold' }}>
                            [PENDIENTE]
                          </span>
                        )}
                      </div>
                      <div className="carouselCardMeta">{item.species} • {item.comuna}, {item.region}</div>
                    </div>
                    <span className={`adoptionStatusPill status-${item.adoption_status}`}>{statusLabel(item.adoption_status)}</span>
                  </div>

                  <div className="adoptionPills">
                    <span className="boPill">{publisherLabel(item.publisher_type)}</span>
                    {item.breed ? <span className="boPill">{item.breed}</span> : null}
                    {item.shelter_name ? <span className="boPill">{item.shelter_name}</span> : null}
                  </div>

                  <p className="carouselCardDesc">
                    {item.description || 'Sin descripcion adicional.'}
                  </p>

                  <div className="adoptionCardFooter">
                    <span>Publicado {formatDateShort(item.created_at) || 'recientemente'}</span>
                    <span>{item.contact_name || 'Sin contacto'}</span>
                  </div>
                </article>
              ))
            ) : (
              <div className="card mutedText">No se encontraron adopciones en la base de datos.</div>
            )}
          </div>
        </section>

        <aside className="card adoptionsDetailCard">
          <div className="cardTitle" style={{ marginBottom: '12px' }}>Detalle</div>
          {loadingDetail ? (
            <div className="mutedText">Cargando detalle...</div>
          ) : selectedAdoption ? (
            <div className="adoptionDetailContent">
              {selectedAdoption.image_data_url ? (
                <div className="adoptionDetailImageWrap">
                  <img className="adoptionDetailImage" src={selectedAdoption.image_data_url} alt={selectedAdoption.pet_name} />
                </div>
              ) : (
                <div className="carouselImgPlaceholder adoptionDetailImageWrap">
                  <span className="carouselImgEmoji">🐾</span>
                </div>
              )}

              <div className="adoptionDetailHeading">
                <h2 className="sectionTitle" style={{ margin: 0 }}>{selectedAdoption.pet_name}</h2>
                <div className="adoptionPills">
                  <span className={`adoptionStatusPill status-${selectedAdoption.adoption_status}`}>{statusLabel(selectedAdoption.adoption_status)}</span>
                  <span className="boPill">{publisherLabel(selectedAdoption.publisher_type)}</span>
                </div>
              </div>

              {/* CONTROLES DE ADMINISTRADOR INTEGRADOS DE FORMA LIMPIA */}
              {checkIsAdmin && (
                <div style={{ background: '#f5f5f5', padding: '10px', borderRadius: '6px', margin: '12px 0', border: '1px solid #ddd' }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', fontWeight: 'bold', color: '#333' }}>Moderación de Publicación:</p>
                  <button 
                    type="button" 
                    className="primaryBtn" 
                    style={{ backgroundColor: selectedAdoption.is_confirmed ? '#d32f2f' : '#2e7d32', width: '100%', fontSize: '0.85rem', padding: '6px', color: '#fff', border: 'none', cursor: 'pointer', borderRadius: '4px' }}
                    onClick={() => handleToggleApprove(selectedAdoption.id, selectedAdoption.is_confirmed)}
                  >
                    {selectedAdoption.is_confirmed ? 'Ocultar Publicación' : 'Aprobar Publicación'}
                  </button>
                </div>
              )}

              <div className="adoptionDetailMeta">
                <span>{selectedAdoption.species}</span>
                {selectedAdoption.breed ? <span>{selectedAdoption.breed}</span> : null}
                {selectedAdoption.age_label ? <span>{selectedAdoption.age_label}</span> : null}
                {selectedAdoption.size ? <span>{selectedAdoption.size}</span> : null}
              </div>

              <div className="adoptionDetailInfo">
                <strong>Ubicacion</strong>
                <span>{selectedAdoption.comuna}, {selectedAdoption.region}</span>
              </div>

              {selectedAdoption.shelter_name ? (
                <div className="adoptionDetailInfo">
                  <strong>Albergue</strong>
                  <span>{selectedAdoption.shelter_name}</span>
                </div>
              ) : null}

              <div className="adoptionDetailInfo">
                <strong>Descripcion</strong>
                <span>{selectedAdoption.description || 'Sin descripcion adicional.'}</span>
              </div>

              {selectedAdoption.health_notes ? (
                <div className="adoptionDetailInfo">
                  <strong>Salud</strong>
                  <span>{selectedAdoption.health_notes}</span>
                </div>
              ) : null}

              <div className="adoptionDetailInfo">
                <strong>Contacto</strong>
                <span>{selectedAdoption.contact_name}</span>
                {selectedAdoption.contact_phone ? <span>{selectedAdoption.contact_phone}</span> : null}
                {selectedAdoption.contact_email ? <span>{selectedAdoption.contact_email}</span> : null}
              </div>
            </div>
          ) : (
            <div className="mutedText">Selecciona una publicacion para ver su informacion completa.</div>
          )}
        </aside>
      </div>
    </div>
  )
}