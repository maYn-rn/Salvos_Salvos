import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import {
  apiRequest,
  formatDateShort,
  getComunasForRegion,
  optimizeImageFileToDataUrl,
  REGION_COMUNAS,
  SPECIES_OPTIONS,
} from '../shared/appCore'

const PUBLISHER_TYPE_OPTIONS = [
  { value: 'persona', label: 'Persona' },
  { value: 'albergue', label: 'Albergue' },
]

const PET_SIZE_OPTIONS = ['Pequeño', 'Mediano', 'Grande']
const PET_SEX_OPTIONS = ['Macho', 'Hembra', 'No informado']
const MAXIMO_IMAGENES = 3

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
    imagenes_locales: [],
    color: '',
    is_sterilized: false,
    vaccines_up_to_date: false,
    has_microchip: false,
    adoption_reason: '',
    behavior_notes: '',
    region: '',
    comuna: '',
    publisher_type: 'persona',
    shelter_name: '',
    health_notes: '',
    contact_name: user?.username || '',
    contact_phone: '',
    contact_email: user?.email || '',
  }
}

async function subirImagenesAdopcion(adoptionId, localImages) {
  const uploadedImages = []

  for (let index = 0; index < localImages.length; index += 1) {
    const localImage = localImages[index]
    const resp = await apiRequest('/api/archivos/', {
      method: 'POST',
      body: {
        tipo_entidad: 'adopcion',
        id_entidad: adoptionId,
        categoria: index === 0 ? 'principal' : 'galeria',
        orden: index + 1,
        servicio_origen: 'ms_adopciones',
        nombre_original: localImage.nombre_original,
        contenido_base64: localImage.contenido_base64,
      },
    })

    if (!resp.ok || !resp.data?.url_descarga) {
      throw new Error(resp.data?.detail || 'No se pudo subir una de las imágenes')
    }

    uploadedImages.push({
      id: resp.data.id,
      url_descarga: resp.data.url_descarga,
      categoria: resp.data.categoria || (index === 0 ? 'principal' : 'galeria'),
      orden: resp.data.orden || index + 1,
    })
  }

  return uploadedImages
}

export default function PaginaAdopciones({ user }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [adoptions, setAdoptions] = useState([])
  const [loadingList, setLoadingList] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [filters, setFilters] = useState({
    q: '',
    species: '',
    region: '',
    comuna: '',
    publisher_type: '',
  })

  async function loadAdoptions(nextFilters = filters) {
    setLoadingList(true)
    setError('')
    try {
      const isAdminUser =
        user?.is_staff === true ||
        user?.is_superuser === true ||
        user?.role === 'admin' ||
        user?.role === 'staff'

      const params = new URLSearchParams()
      Object.entries(nextFilters).forEach(([key, value]) => {
        const trimmed = String(value || '').trim()
        if (trimmed) params.set(key, trimmed)
      })
      params.set('include_image', '1')
      if (user) params.set('include_mine', '1')
      if (isAdminUser) params.set('include_unconfirmed', '1')

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
      setAdoptions(rawResults)
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

  useEffect(() => {
    const params = new URLSearchParams(location.search || '')
    if (params.get('publicar') !== '1') return
    const next = encodeURIComponent('/adopciones/publicar')
    if (!user) {
      window.location.href = `/login?next=${next}`
      return
    }
    navigate('/adopciones/publicar', { replace: true })
  }, [location.search, user])

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

  async function onFilterSubmit(e) {
    e.preventDefault()
    await loadAdoptions(filters)
  }

  function onResetFilters() {
    const empty = {
      q: '',
      species: '',
      region: '',
      comuna: '',
      publisher_type: '',
    }
    setFilters(empty)
    loadAdoptions(empty)
  }

  const filterComunas = useMemo(() => getComunasForRegion(filters.region), [filters.region])

  const checkIsAdmin = user?.is_staff || user?.is_superuser || user?.role === 'admin' || user?.role === 'staff'
  return (
    <div className="mainInner adoptionsPage">
      {error ? <div className="formError">{error}</div> : null}
      {success ? <div className="formSuccess">{success}</div> : null}

      <section className="section card adoptionsFiltersSurface">
        <form className="adoptionsTopFilters" onSubmit={onFilterSubmit}>
          <label className="field adoptionsSearchField">
            <span>Buscar</span>
            <input value={filters.q} onChange={(e) => updateFilters({ q: e.target.value })} placeholder="Nombre, raza, comuna o albergue" />
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

      <div className="adoptionsLayout">
        <section className="adoptionsResults" id="adoptions-list">
          <div className="adoptionsCards">
            {loadingList ? (
              <div className="card mutedText">Cargando adopciones...</div>
            ) : adoptions.length ? (
              adoptions.map((item) => {
                const isMine = Boolean(user?.id && item.publisher_id === user.id)
                const showPending = Boolean(!item.is_confirmed && (checkIsAdmin || isMine))
                const imgUrl = item.image_data_url || item.imagenes?.[0]?.url_descarga || ''

                return (
                  <article
                    key={item.id}
                    className="adoptionCard card"
                    onClick={() => navigate(`/adopciones/${item.id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        navigate(`/adopciones/${item.id}`)
                      }
                    }}
                  >
                    <div className="adoptionCardMedia">
                      {imgUrl ? (
                        <img className="adoptionCardImg" src={imgUrl} alt={item.pet_name || 'Mascota'} />
                      ) : (
                        <div className="adoptionCardImgPlaceholder" aria-hidden="true">🐾</div>
                      )}
                    </div>

                    <div className="adoptionCardBody">
                      <div className="adoptionCardBadges">
                        {showPending ? (
                          <span className="adoptionStatusPill adoptionPendingPill">Pendiente</span>
                        ) : null}
                      </div>
                    <div className="adoptionCardTop">
                      <div>
                        <div className="adoptionCardTitle">{item.pet_name}</div>
                        <div className="adoptionCardLocation">{item.comuna}, {item.region}</div>
                      </div>
                    </div>

                    <div className="adoptionCardMetaLine">
                      <span>{item.species}</span>
                      {item.sex ? <span>{item.sex}</span> : null}
                      {item.age_label ? <span>{item.age_label}</span> : null}
                      {item.size ? <span>{item.size}</span> : null}
                    </div>

                    <div className="adoptionPills">
                      <span className="boPill">{publisherLabel(item.publisher_type)}</span>
                      {item.breed ? <span className="boPill">{item.breed}</span> : null}
                      {item.shelter_name ? <span className="boPill">{item.shelter_name}</span> : null}
                      {item.imagenes?.length > 1 ? <span className="boPill">{item.imagenes.length} fotos</span> : null}
                    </div>

                    <p className="adoptionCardDesc">
                      {item.description || 'Sin descripcion adicional.'}
                    </p>

                    <div className="adoptionCardFooter">
                      <span>Publicado {formatDateShort(item.created_at) || 'recientemente'}</span>
                      <span>{item.contact_name || 'Sin contacto'}</span>
                    </div>
                  </div>
                  </article>
                )
              })
            ) : (
              <div className="card mutedText">No se encontraron adopciones en la base de datos.</div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

export function PaginaPublicarAdopcion({ user }) {
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState(() => createEmptyForm(user))

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      contact_name: prev.contact_name || user?.username || '',
      contact_email: prev.contact_email || user?.email || '',
    }))
  }, [user])

  function updateForm(patch) {
    setForm((prev) => {
      const next = { ...prev, ...patch }
      if (Object.prototype.hasOwnProperty.call(patch, 'region')) next.comuna = ''
      if (next.publisher_type !== 'albergue') next.shelter_name = ''
      return next
    })
  }

  async function onImageChange(e) {
    const selectedFiles = Array.from(e.target.files || [])
    if (!selectedFiles.length) {
      updateForm({ imagenes_locales: [] })
      return
    }

    setError('')
    const limitedFiles = selectedFiles.slice(0, MAXIMO_IMAGENES)
    if (selectedFiles.length > MAXIMO_IMAGENES) {
      setError(`Solo puedes subir hasta ${MAXIMO_IMAGENES} imágenes por adopción.`)
    }

    try {
      const localImages = []
      for (const file of limitedFiles) {
        if (file.size > 10_000_000) {
          setError(`La imagen "${file.name}" es muy grande. Usa una de máximo 10MB.`)
          e.target.value = ''
          return
        }

        const dataUrl = await optimizeImageFileToDataUrl(file, { maxEdge: 1400, maxBytes: 650_000 })
        if (!dataUrl) {
          setError(`No se pudo procesar la imagen "${file.name}"`)
          e.target.value = ''
          return
        }

        localImages.push({
          nombre_original: file.name,
          contenido_base64: dataUrl,
          vista_previa: dataUrl,
        })
      }

      updateForm({ imagenes_locales: localImages })
    } catch {
      setError('No se pudieron procesar las imágenes')
      e.target.value = ''
    }
  }

  function onRemoveImage(indexToRemove) {
    updateForm({
      imagenes_locales: form.imagenes_locales.filter((_, index) => index !== indexToRemove),
    })
  }

  async function onSubmitAdoption(e) {
    e.preventDefault()
    if (!user) {
      setError('Debes iniciar sesion para publicar una adopcion')
      return
    }

    setSubmitting(true)
    setError('')
    setSuccess('')
    let createdAdoptionId = null
    try {
      const payload = { ...form }
      Object.keys(payload).forEach((key) => {
        if (typeof payload[key] === 'string') payload[key] = payload[key].trim()
      })
      delete payload.imagenes_locales

      if (!payload.pet_name) {
        setError('El nombre de la mascota es obligatorio')
        return
      }
      if (!form.imagenes_locales.length) {
        setError(`Debes subir entre 1 y ${MAXIMO_IMAGENES} imágenes`)
        return
      }
      if (!payload.species || !payload.region || !payload.comuna) {
        setError('Completa especie, region y comuna')
        return
      }
      if (!payload.description) {
        setError('La descripcion es obligatoria')
        return
      }
      if (!payload.adoption_reason) {
        setError('Indica por que la das en adopcion')
        return
      }
      if (!payload.contact_name) {
        setError('El nombre de contacto es obligatorio')
        return
      }
      if (!payload.contact_phone && !payload.contact_email) {
        setError('Ingresa al menos un teléfono o un email de contacto')
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

      createdAdoptionId = resp.data?.id
      if (!createdAdoptionId) {
        setError('La adopción se creó sin identificador válido')
        return
      }

      const uploadedImages = await subirImagenesAdopcion(createdAdoptionId, form.imagenes_locales)
      const patchResp = await apiRequest(`/api/adoptions/${createdAdoptionId}/`, {
        method: 'PATCH',
        body: { imagenes: uploadedImages },
      })
      if (!patchResp.ok) {
        throw new Error('La adopción se creó, pero no se pudieron asociar las imágenes')
      }

      setSuccess('Publicacion enviada. Quedará como Pendiente hasta que un administrador la confirme.')
      setForm(createEmptyForm(user))
      window.scrollTo(0, 0)
    } catch (err) {
      if (createdAdoptionId) {
        try {
          await apiRequest(`/api/adoptions/${createdAdoptionId}/`, { method: 'DELETE' })
        } catch {}
      }
      setError(err?.message || 'Error al publicar la adopcion')
    } finally {
      setSubmitting(false)
    }
  }

  const formComunas = useMemo(() => getComunasForRegion(form.region), [form.region])

  if (!user) {
    const next = encodeURIComponent('/adopciones/publicar')
    return (
      <div className="mainInner">
        <section className="card authCard">
          <h2 className="cardTitle">Inicia sesión para publicar una adopción</h2>
          <div className="mutedText">
            <Link to={`/login?next=${next}`}>Ir a login</Link>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="mainInner adoptionsPage">
      <section className="section">
        <div className="adoptionSingleTopbar">
          <button type="button" className="miniBtn" onClick={() => navigate('/adopciones')}>
            Volver al listado
          </button>
          <Link className="secondaryBtn" to="/adopciones">
            Ver adopciones
          </Link>
        </div>
      </section>

      {error ? <div className="formError">{error}</div> : null}
      {success ? (
        <div className="formSuccess" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>{success}</div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button className="primaryBtn" type="button" onClick={() => navigate('/adopciones')}>
              Volver a adopciones
            </button>
            <button
              className="miniBtn"
              type="button"
              onClick={() => {
                setSuccess('')
                setError('')
                setForm(createEmptyForm(user))
              }}
            >
              Publicar otra
            </button>
          </div>
        </div>
      ) : null}

      <section className="section card">
        <div className="adoptionsFormHeader">
          <div className="cardTitle">Nueva publicacion de adopcion</div>
        </div>
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
            <input value={form.age_label} onChange={(e) => updateForm({ age_label: e.target.value })} placeholder="Ej: 2 Años" />
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
            <span>Tamaño</span>
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
            <span>Color</span>
            <input value={form.color} onChange={(e) => updateForm({ color: e.target.value })} placeholder="Ej: Café y blanco" />
          </label>

          {form.publisher_type === 'albergue' ? (
            <label className="field">
              <span>Nombre del albergue</span>
              <input value={form.shelter_name} onChange={(e) => updateForm({ shelter_name: e.target.value })} placeholder="Ej: Refugio Patitas" />
            </label>
          ) : null}

          <label className="field adoptionsCheckboxField">
            <span>Esterilizado</span>
            <span className="adoptionsCheckboxRow">
              <input
                type="checkbox"
                checked={Boolean(form.is_sterilized)}
                onChange={(e) => updateForm({ is_sterilized: e.target.checked })}
              />
              <span>Seleccionar</span>
            </span>
          </label>

          <label className="field adoptionsCheckboxField">
            <span>Vacunas al día</span>
            <span className="adoptionsCheckboxRow">
              <input
                type="checkbox"
                checked={Boolean(form.vaccines_up_to_date)}
                onChange={(e) => updateForm({ vaccines_up_to_date: e.target.checked })}
              />
              <span>Seleccionar</span>
            </span>
          </label>

          <label className="field adoptionsCheckboxField">
            <span>Con microchip</span>
            <span className="adoptionsCheckboxRow">
              <input
                type="checkbox"
                checked={Boolean(form.has_microchip)}
                onChange={(e) => updateForm({ has_microchip: e.target.checked })}
              />
              <span>Seleccionar</span>
            </span>
          </label>

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

          <label className="field adoptionsFieldFull">
            <span>Imagenes</span>
            <input type="file" accept="image/*" multiple onChange={onImageChange} />
            <span className="fileHint">
              {form.imagenes_locales.length
                ? `${form.imagenes_locales.length} de ${MAXIMO_IMAGENES} imágenes seleccionadas`
                : `Obligatorias. Puedes subir hasta ${MAXIMO_IMAGENES}.`}
            </span>
            {form.imagenes_locales.length ? (
              <div className="adoptionUploadPreviewGrid">
                {form.imagenes_locales.map((image, index) => (
                  <div key={`${image.nombre_original}-${index}`} className="adoptionUploadPreviewCard">
                    <img className="adoptionUploadPreviewImg" src={image.vista_previa} alt={image.nombre_original || `Imagen ${index + 1}`} />
                    <div className="adoptionUploadPreviewMeta">
                      <span>{index === 0 ? 'Portada' : `Imagen ${index + 1}`}</span>
                      <button type="button" className="miniBtn" onClick={() => onRemoveImage(index)}>
                        Quitar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </label>

          <label className="field adoptionsFieldFull">
            <span>Su historia</span>
            <textarea rows={4} value={form.description} onChange={(e) => updateForm({ description: e.target.value })} placeholder="Cuenta el caracter, energia y necesidades de la mascota" />
          </label>

          <label className="field adoptionsFieldFull">
            <span>Por qué lo das en adopción</span>
            <textarea rows={4} value={form.adoption_reason} onChange={(e) => updateForm({ adoption_reason: e.target.value })} placeholder="Motivo de la adopción" />
          </label>

          <label className="field adoptionsFieldFull">
            <span>Comportamiento</span>
            <textarea rows={3} value={form.behavior_notes} onChange={(e) => updateForm({ behavior_notes: e.target.value })} placeholder="Ej: vive en departamento, sociable, etc." />
          </label>

          <label className="field adoptionsFieldFull">
            <span>Notas de salud</span>
            <textarea rows={3} value={form.health_notes} onChange={(e) => updateForm({ health_notes: e.target.value })} placeholder="Detalles adicionales (opcional)" />
          </label>

          <div className="adoptionsFormActions adoptionsFieldFull">
            <button className="primaryBtn" type="submit" disabled={submitting}>
              {submitting ? 'Publicando...' : 'Guardar publicacion'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
