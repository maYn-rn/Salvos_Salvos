import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { MapContainer, Marker, TileLayer } from 'react-leaflet'

import { RecentrarMapa } from '../components/map/AyudantesMapa'
import { apiRequest, formatDateShort, getPetIcon, REGION_VIEW } from '../shared/appCore'

const PUBLISHER_TYPE_OPTIONS = [
  { value: 'persona', label: 'Persona' },
  { value: 'albergue', label: 'Albergue' },
]

function publisherLabel(value) {
  return PUBLISHER_TYPE_OPTIONS.find((item) => item.value === value)?.label || 'Persona'
}

function boolLabel(value) {
  if (value === true) return 'Sí'
  if (value === false) return 'No'
  return 'No informado'
}

export default function PaginaAdopcionDetalle({ user }) {
  const navigate = useNavigate()
  const { adoptionId } = useParams()
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [adoption, setAdoption] = useState(null)
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const checkIsAdmin = useMemo(
    () => Boolean(user?.is_staff || user?.is_superuser || user?.role === 'admin' || user?.role === 'staff'),
    [user]
  )
  const adoptionImages = useMemo(() => {
    if (Array.isArray(adoption?.imagenes) && adoption.imagenes.length) return adoption.imagenes
    if (adoption?.image_data_url) {
      return [{ id: null, url_descarga: adoption.image_data_url, categoria: 'principal', orden: 1 }]
    }
    return []
  }, [adoption])
  const activeImage = adoptionImages[activeImageIndex] || adoptionImages[0] || null
  const mapView = useMemo(() => {
    if (!adoption) return null
    if (adoption.latitude != null && adoption.longitude != null) {
      return {
        center: [Number(adoption.latitude), Number(adoption.longitude)],
        zoom: 14,
        exact: true,
      }
    }
    const regionView = adoption.region ? REGION_VIEW[adoption.region] || null : null
    if (regionView) {
      return {
        center: regionView.center,
        zoom: adoption.comuna ? Math.max(regionView.zoom || 10, 11) : regionView.zoom || 10,
        exact: false,
      }
    }
    return null
  }, [adoption])

  useEffect(() => {
    setActiveImageIndex(0)
  }, [adoption?.id])

  async function loadDetail() {
    if (!adoptionId) return
    setLoading(true)
    setError('')
    try {
      const resp = await apiRequest(`/api/adoptions/${adoptionId}/`, { method: 'GET' })
      if (!resp.ok) {
        setError(resp.data?.detail || 'No se pudo cargar la publicacion')
        setAdoption(null)
        return
      }
      setAdoption(resp.data)
    } catch (err) {
      setError(err?.message || 'Error al cargar la publicacion')
      setAdoption(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDetail()
  }, [adoptionId])

  async function handleToggleApprove() {
    if (!adoption?.id || !checkIsAdmin) return
    setUpdating(true)
    setError('')
    setSuccess('')
    try {
      const nextConfirmed = !adoption.is_confirmed
      const resp = await apiRequest(`/api/adoptions/${adoption.id}/`, {
        method: 'PATCH',
        body: { is_confirmed: nextConfirmed, active: nextConfirmed },
      })
      if (!resp.ok) {
        setError(resp.data?.detail || 'No se pudo cambiar el estado de aprobacion')
        return
      }
      setSuccess('Estado de aprobacion actualizado con exito')
      await loadDetail()
    } catch (err) {
      setError(err?.message || 'Error al actualizar la publicacion')
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className="mainInner adoptionsPage">
      <section className="section">
        <div className="card adoptionSingleShell">
          <div className="adoptionSingleTopbar">
            <button type="button" className="miniBtn" onClick={() => navigate('/adopciones')}>
              Volver al listado
            </button>
            <Link className="secondaryBtn" to="/adopciones">
              Ver mas adopciones
            </Link>
          </div>

          {error ? <div className="formError">{error}</div> : null}
          {success ? <div className="formSuccess">{success}</div> : null}

          {loading ? (
            <div className="mutedText">Cargando detalle...</div>
          ) : adoption ? (
            <div className="adoptionSingleContent">
              <div className="adoptionSingleHeader">
                <div>
                  <div className="adoptionSingleEyebrow">Publicacion de adopcion</div>
                  <h1 className="sectionTitle adoptionSingleTitle">{adoption.pet_name}</h1>
                  <div className="adoptionCardLocation">{adoption.comuna}, {adoption.region}</div>
                </div>
                <div className="adoptionPills">
                  <span className="boPill">{publisherLabel(adoption.publisher_type)}</span>
                  {adoption.is_confirmed ? <span className="boPill">Verificada</span> : <span className="boPill">Pendiente</span>}
                </div>
              </div>

              {checkIsAdmin ? (
                <div className="adoptionSingleAdminBar">
                  <div className="mutedText">Moderacion de publicacion</div>
                  <button type="button" className="primaryBtn" onClick={handleToggleApprove} disabled={updating}>
                    {updating ? 'Guardando...' : adoption.is_confirmed ? 'Ocultar publicacion' : 'Aprobar publicacion'}
                  </button>
                </div>
              ) : null}

              <div className="adoptionSingleMainGrid">
                <div className="adoptionSingleLeftCol">
                  {activeImage ? (
                    <div className="adoptionSingleGallery">
                      <div className="adoptionSingleMedia">
                        <img className="adoptionSingleImg" src={activeImage.url_descarga} alt={adoption.pet_name || 'Mascota'} />
                      </div>
                      {adoptionImages.length > 1 ? (
                        <div className="adoptionThumbGrid">
                          {adoptionImages.map((image, index) => (
                            <button
                              key={`${image.id ?? 'legacy'}-${index}`}
                              type="button"
                              className={`adoptionThumbBtn${index === activeImageIndex ? ' isActive' : ''}`}
                              onClick={() => setActiveImageIndex(index)}
                            >
                              <img className="adoptionThumbImg" src={image.url_descarga} alt={`${adoption.pet_name || 'Mascota'} ${index + 1}`} />
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {mapView ? (
                    <div className="adoptionSingleMapCard">
                      <div className="adoptionDetailInfo">
                        <strong>Ubicación</strong>
                        <span>
                          {adoption.comuna ? `${adoption.comuna}, ` : ''}
                          {adoption.region || 'No informada'}
                        </span>
                        <span className="adoptionMapHint">
                          {mapView.exact
                            ? 'Ubicación registrada por quien publicó la adopción.'
                            : 'Ubicación referencial basada en la comuna o región registrada.'}
                        </span>
                      </div>
                      <div className="adoptionSingleMapWrap">
                        <MapContainer className="map adoptionSingleMap" center={mapView.center} zoom={mapView.zoom} scrollWheelZoom>
                          <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          />
                          <RecentrarMapa center={mapView.center} zoom={mapView.zoom} />
                          <Marker position={mapView.center} icon={getPetIcon(adoption.species, { highlight: true })} />
                        </MapContainer>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="adoptionSingleRightCol">
                  <div className="adoptionSingleMetaGrid">
                    <div className="adoptionDetailInfo">
                      <strong>Especie</strong>
                      <span>{adoption.species || 'No informada'}</span>
                    </div>
                    <div className="adoptionDetailInfo">
                      <strong>Raza</strong>
                      <span>{adoption.breed || 'No informada'}</span>
                    </div>
                    <div className="adoptionDetailInfo">
                      <strong>Edad</strong>
                      <span>{adoption.age_label || 'No informada'}</span>
                    </div>
                    <div className="adoptionDetailInfo">
                      <strong>Tamaño</strong>
                      <span>{adoption.size || 'No informado'}</span>
                    </div>
                    <div className="adoptionDetailInfo">
                      <strong>Sexo</strong>
                      <span>{adoption.sex || 'No informado'}</span>
                    </div>
                    <div className="adoptionDetailInfo">
                      <strong>Color</strong>
                      <span>{adoption.color || 'No informado'}</span>
                    </div>
                    <div className="adoptionDetailInfo">
                      <strong>Publicado</strong>
                      <span>{formatDateShort(adoption.created_at) || 'Recientemente'}</span>
                    </div>
                  </div>
                  <div className="adoptionSingleBody">
                    <div className="adoptionDetailInfo">
                      <strong>Su historia</strong>
                      <span>{adoption.description || 'Sin descripcion adicional.'}</span>
                    </div>

                    <div className="adoptionDetailInfo">
                      <strong>Salud</strong>
                      <span>Esterilizado: {boolLabel(adoption.is_sterilized)}</span>
                      <span>Vacunas al día: {boolLabel(adoption.vaccines_up_to_date)}</span>
                      <span>Con microchip: {boolLabel(adoption.has_microchip)}</span>
                      {adoption.health_notes ? <span>{adoption.health_notes}</span> : null}
                    </div>

                    {adoption.adoption_reason ? (
                      <div className="adoptionDetailInfo">
                        <strong>Por qué lo das en adopción</strong>
                        <span>{adoption.adoption_reason}</span>
                      </div>
                    ) : null}

                    {adoption.behavior_notes ? (
                      <div className="adoptionDetailInfo">
                        <strong>Comportamiento</strong>
                        <span>{adoption.behavior_notes}</span>
                      </div>
                    ) : null}

                    {adoption.shelter_name ? (
                      <div className="adoptionDetailInfo">
                        <strong>Albergue</strong>
                        <span>{adoption.shelter_name}</span>
                      </div>
                    ) : null}

                    <div className="adoptionDetailInfo">
                      <strong>Contacto</strong>
                      <span>{adoption.contact_name || 'Sin contacto'}</span>
                      {adoption.contact_phone ? <span>{adoption.contact_phone}</span> : null}
                      {adoption.contact_email ? <span>{adoption.contact_email}</span> : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mutedText">No se encontro la publicacion solicitada.</div>
          )}
        </div>
      </section>
    </div>
  )
}
