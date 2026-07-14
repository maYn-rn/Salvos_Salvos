import L from 'leaflet'

function resolverApiBase() {
  const fromEnv = import.meta.env.VITE_API_BASE_URL
  if (fromEnv) return fromEnv

  if (typeof window !== 'undefined' && window.location?.hostname) {
    const host = window.location.hostname
    if (host === 'localhost' || host === '127.0.0.1') {
      return `${window.location.protocol}//${host}:8000`
    }
    return window.location.origin
  }

  return 'http://localhost:8000'
}

export const API_BASE = resolverApiBase()
export const MAX_IMAGE_UPLOAD_BYTES = 3 * 1024 * 1024
export const MAX_IMAGE_OUTPUT_BYTES = 600_000
export const MAX_DOCUMENT_OUTPUT_BYTES = 800_000
export const VETERINARY_VERIFICATION_DOCUMENT_OPTIONS = [
  { value: 'patente_comercial', label: 'Patente comercial' },
  { value: 'inicio_actividades', label: 'Inicio de actividades' },
  { value: 'rut_empresa', label: 'RUT empresa' },
  { value: 'titulo_profesional', label: 'Título profesional' },
  { value: 'certificado_sanitario', label: 'Certificado sanitario' },
  { value: 'otro', label: 'Otro' },
]
const ACCESS_TOKEN_STORAGE_KEY = 'access_token'

let accessToken = null

if (typeof window !== 'undefined') {
  accessToken = window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) || null
}

export function getAccessToken() {
  return accessToken
}

export function setAccessToken(token) {
  accessToken = token || null
  if (typeof window === 'undefined') return
  if (accessToken) window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken)
  else window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY)
}

export const REGION_COMUNAS = [
  {
    region: 'Región Metropolitana de Santiago',
    comunas: [
      'Santiago', 'Providencia', 'Las Condes', 'Ñuñoa', 'La Florida', 'Maipú', 'Puente Alto',
      'San Miguel', 'Estación Central', 'La Reina', 'Peñalolén', 'Recoleta', 'Independencia',
      'Quilicura', 'Renca', 'Conchalí', 'Lo Prado', 'Cerro Navia', 'Pudahuel', 'Huechuraba',
      'Vitacura', 'San Joaquín', 'Macul', 'Lo Barnechea', 'La Cisterna', 'El Bosque', 'San Ramón',
      'Pedro Aguirre Cerda', 'La Pintana', 'Lo Espejo', 'Cerrillos', 'San Bernardo', 'Peñaflor',
      'Padre Hurtado', 'Talagante', 'El Monte', 'Buin', 'Paine', 'Colina', 'Lampa', 'Tiltil',
      'Isla de Maipo', 'Calera de Tango', 'Pirque', 'San José de Maipo', 'Melipilla', 'Curacaví',
      'María Pinto', 'Alhué', 'San Pedro',
    ],
  },
  { region: 'Región de Valparaíso', comunas: ['Valparaíso', 'Viña del Mar', 'Quilpué', 'Villa Alemana', 'Quillota', 'San Antonio', 'Otra'] },
  { region: "Región del Libertador General Bernardo O'Higgins", comunas: ['Rancagua', 'San Fernando', 'Santa Cruz', 'Otra'] },
  { region: 'Región del Maule', comunas: ['Talca', 'Curicó', 'Linares', 'Constitución', 'Otra'] },
  { region: 'Región de Ñuble', comunas: ['Chillán', 'San Carlos', 'Bulnes', 'Otra'] },
  { region: 'Región del Biobío', comunas: ['Concepción', 'Talcahuano', 'Los Ángeles', 'Coronel', 'San Pedro de la Paz', 'Otra'] },
  { region: 'Región de La Araucanía', comunas: ['Temuco', 'Padre Las Casas', 'Villarrica', 'Pucón', 'Angol', 'Otra'] },
  { region: 'Región de Los Ríos', comunas: ['Valdivia', 'La Unión', 'Río Bueno', 'Otra'] },
  { region: 'Región de Los Lagos', comunas: ['Puerto Montt', 'Puerto Varas', 'Osorno', 'Castro', 'Ancud', 'Otra'] },
  { region: 'Región de Aysén del General Carlos Ibáñez del Campo', comunas: ['Coyhaique', 'Aysén', 'Chile Chico', 'Otra'] },
  { region: 'Región de Magallanes y de la Antártica Chilena', comunas: ['Punta Arenas', 'Puerto Natales', 'Porvenir', 'Otra'] },
  { region: 'Región de Atacama', comunas: ['Copiapó', 'Caldera', 'Vallenar', 'Otra'] },
  { region: 'Región de Coquimbo', comunas: ['La Serena', 'Coquimbo', 'Ovalle', 'Illapel', 'Otra'] },
  { region: 'Región de Antofagasta', comunas: ['Antofagasta', 'Calama', 'Tocopilla', 'Otra'] },
  { region: 'Región de Tarapacá', comunas: ['Iquique', 'Alto Hospicio', 'Otra'] },
  { region: 'Región de Arica y Parinacota', comunas: ['Arica', 'Camarones', 'Otra'] },
]

export const SPECIES_OPTIONS = ['Perro', 'Gato', 'Otro']

export const REGION_VIEW = {
  'Región Metropolitana de Santiago': { center: [-33.4489, -70.6693], zoom: 10 },
  'Región de Valparaíso': { center: [-33.0472, -71.6127], zoom: 10 },
  "Región del Libertador General Bernardo O'Higgins": { center: [-34.1701, -70.7406], zoom: 10 },
  'Región del Maule': { center: [-35.4264, -71.6554], zoom: 9 },
  'Región de Ñuble': { center: [-36.6063, -72.1034], zoom: 10 },
  'Región del Biobío': { center: [-36.827, -73.0503], zoom: 10 },
  'Región de La Araucanía': { center: [-38.7359, -72.5904], zoom: 10 },
  'Región de Los Ríos': { center: [-39.8174, -73.2459], zoom: 10 },
  'Región de Los Lagos': { center: [-41.4689, -72.9411], zoom: 9 },
  'Región de Aysén del General Carlos Ibáñez del Campo': { center: [-45.5712, -72.0683], zoom: 8 },
  'Región de Magallanes y de la Antártica Chilena': { center: [-53.1638, -70.9171], zoom: 9 },
  'Región de Atacama': { center: [-27.3668, -70.3322], zoom: 9 },
  'Región de Coquimbo': { center: [-29.9027, -71.2519], zoom: 9 },
  'Región de Antofagasta': { center: [-23.6509, -70.3975], zoom: 9 },
  'Región de Tarapacá': { center: [-20.2208, -70.1431], zoom: 10 },
  'Región de Arica y Parinacota': { center: [-18.4783, -70.3126], zoom: 10 },
}

export function getComunasForRegion(region) {
  const item = REGION_COMUNAS.find((r) => r.region === region)
  return item ? item.comunas : []
}

export function normalizeSpecies(species) {
  const s = (species || '').trim().toLowerCase()
  if (s === 'perro') return 'perro'
  if (s === 'gato') return 'gato'
  return 'otro'
}

export function normalizeStatus(status) {
  const s = (status || '').trim().toLowerCase()
  if (s === 'lost') return 'perdido'
  if (s === 'found') return 'encontrado'
  if (s === 'perdido') return 'perdido'
  if (s === 'encontrado') return 'encontrado'
  return (status || '').trim()
}

const petIconCache = new Map()

export function getPetIcon(species, { highlight = false } = {}) {
  const key = `${normalizeSpecies(species)}|${highlight ? '1' : '0'}`
  const cached = petIconCache.get(key)
  if (cached) return cached

  const kind = normalizeSpecies(species)
  const emoji = kind === 'perro' ? '🐶' : kind === 'gato' ? '🐱' : '🐾'
  const size = highlight ? 40 : 34
  const icon = L.divIcon({
    className: 'petMarkerWrapper',
    html: `<div class="petMarkerBubble${highlight ? ' isHighlight' : ''}">${emoji}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
  petIconCache.set(key, icon)
  return icon
}

export async function apiRequest(path, { method = 'GET', body } = {}) {
  const url = `${API_BASE}${path}`
  const headers = {}
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const resp = await fetch(url, {
    method,
    headers,
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const text = await resp.text()
  const data = text ? (() => { try { return JSON.parse(text) } catch { return text } })() : null
  return { ok: resp.ok, status: resp.status, data }
}

export async function refreshAccess() {
  const resp = await apiRequest('/api/auth/refresh/', { method: 'POST' })

  if (!resp.ok || !resp.data?.access) {
    setAccessToken(null)
    return false
  }

  setAccessToken(resp.data.access)
  return true
}

export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export function formatDateShort(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short' }).format(d)
}

export function formatFileSize(bytes) {
  const size = Number(bytes)
  if (!Number.isFinite(size) || size <= 0) return '0 B'
  if (size < 1024) return `${Math.round(size)} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export function getVeterinaryDocumentTypeLabel(value) {
  return VETERINARY_VERIFICATION_DOCUMENT_OPTIONS.find((item) => item.value === value)?.label || 'Documento'
}

function supportsMimeType(type) {
  try {
    const canvas = document.createElement('canvas')
    const data = canvas.toDataURL(type)
    return typeof data === 'string' && data.startsWith(`data:${type}`)
  } catch {
    return false
  }
}

async function blobToDataUrl(blob) {
  const reader = new FileReader()
  return await new Promise((resolve, reject) => {
    reader.onerror = () => reject(new Error('read_error'))
    reader.onload = () => resolve(String(reader.result || ''))
    reader.readAsDataURL(blob)
  })
}

export async function fileToDataUrl(file) {
  if (!file) return ''
  return await blobToDataUrl(file)
}

async function fileToBitmap(file) {
  if (typeof createImageBitmap === 'function') {
    return await createImageBitmap(file)
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
    })
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth || img.width
    canvas.height = img.naturalHeight || img.height
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0)
    return await createImageBitmap(canvas)
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function canvasToBlob(canvas, type, quality) {
  return await new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality)
  })
}

export async function optimizeImageFileToDataUrl(
  file,
  { maxEdge = 1400, maxBytes = MAX_IMAGE_OUTPUT_BYTES, mimePreference = 'image/webp' } = {}
) {
  if (!file) return ''
  const chosenMime = supportsMimeType(mimePreference) ? mimePreference : 'image/jpeg'
  const bitmap = await fileToBitmap(file)
  const srcW = bitmap.width || 0
  const srcH = bitmap.height || 0
  if (!srcW || !srcH) return ''

  let scale = Math.min(1, maxEdge / Math.max(srcW, srcH))
  let quality = chosenMime === 'image/webp' ? 0.82 : 0.86

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { alpha: false })
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  for (let attempt = 0; attempt < 8; attempt++) {
    const w = Math.max(1, Math.round(srcW * scale))
    const h = Math.max(1, Math.round(srcH * scale))
    canvas.width = w
    canvas.height = h
    ctx.clearRect(0, 0, w, h)
    ctx.drawImage(bitmap, 0, 0, w, h)

    const blob = await canvasToBlob(canvas, chosenMime, quality)
    if (!blob) break
    if (blob.size <= maxBytes) {
      return await blobToDataUrl(blob)
    }

    if (quality > 0.62) {
      quality = Math.max(0.62, quality - 0.08)
    } else {
      scale = Math.max(0.45, scale * 0.88)
    }
  }

  const fallbackBlob = await canvasToBlob(canvas, chosenMime, 0.62)
  if (!fallbackBlob) return ''
  return await blobToDataUrl(fallbackBlob)
}
