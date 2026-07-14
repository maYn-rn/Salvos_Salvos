import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  fileToDataUrl,
  formatFileSize,
  getComunasForRegion,
  getVeterinaryDocumentTypeLabel,
  MAX_DOCUMENT_OUTPUT_BYTES,
  MAX_IMAGE_UPLOAD_BYTES,
  optimizeImageFileToDataUrl,
  REGION_VIEW,
  VETERINARY_VERIFICATION_DOCUMENT_OPTIONS,
} from '../shared/appCore';

// Función de ayuda para formatear el RUT chileno (agrega puntos y guion)
const formatearRUT = (valor) => {
  const limpio = valor.replace(/[^0-9kK]/g, '').toUpperCase();
  if (limpio.length <= 1) return limpio;
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  const cuerpoFormateado = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${cuerpoFormateado}-${dv}`;
};

// NUEVA FUNCIÓN: Valida matemáticamente que el RUT sea real (Módulo 11)
const validarRutChileno = (rutCompleto) => {
  if (!rutCompleto) return false;

  // Limpiamos el texto dejando solo números y la K
  const valor = rutCompleto.replace(/[^0-9kK]/g, '').toUpperCase();
  
  // Si tiene muy pocos caracteres, es inválido
  if (valor.length < 8) return false;

  // Separamos el cuerpo numérico y el dígito verificador
  const cuerpo = valor.slice(0, -1);
  const dvIngresado = valor.slice(-1);

  // El cuerpo solo puede tener números, si tiene "K" en el cuerpo está malo
  if (!/^[0-9]+$/.test(cuerpo)) return false;

  // Calculamos el dígito verificador real usando Módulo 11
  let suma = 0;
  let multiplo = 2;
  
  for (let i = 1; i <= cuerpo.length; i++) {
    const digito = parseInt(cuerpo.charAt(cuerpo.length - i), 10);
    suma += digito * multiplo;
    multiplo = multiplo < 7 ? multiplo + 1 : 2;
  }
  
  const dvEsperado = 11 - (suma % 11);
  let dvCalculado = dvEsperado === 11 ? '0' : dvEsperado === 10 ? 'K' : dvEsperado.toString();
  
  // Comparamos si el dígito calculado coincide con el que ingresó el usuario
  return dvCalculado === dvIngresado;
};

export default function PaginaRegistro({ error, busy, authForm, onAuthFormChange, onSubmitAuth, locationSearch, onSwitchToLogin }) {
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [ubicacionBusy, setUbicacionBusy] = useState(false);
  const [ubicacionInfo, setUbicacionInfo] = useState('');
  const [documentoBusy, setDocumentoBusy] = useState(false);
  const [mostrarContrasena, setMostrarContrasena] = useState(false);
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false);
  const esVeterinaria = (authForm.account_type || 'usuario') === 'veterinaria';
  const documentosLocales = authForm.documentos_verificacion_locales || [];

  const handleLocalSubmit = (e) => {
    e.preventDefault();

    // 1. Validar contraseñas
    if (authForm.password !== confirmPassword) {
      setLocalError('Las contraseñas no coinciden.');
      return;
    }

    // 2. Validar RUT (usa la fórmula matemática)
    if (!validarRutChileno(authForm.rut)) {
      setLocalError('Por favor ingresa un RUT válido y real.');
      return;
    }

    if (esVeterinaria) {
      if (!authForm.nombre_veterinaria || !authForm.telefono_veterinaria || !authForm.region || !authForm.comuna || !authForm.direccion_veterinaria) {
        setLocalError('Completa los datos principales de la veterinaria.');
        return;
      }
      if (!documentosLocales.length) {
        setLocalError('Adjunta al menos un documento de verificación.');
        return;
      }
      if (authForm.latitude == null || authForm.longitude == null) {
        setLocalError('Debes fijar la ubicación de la veterinaria para que aparezca en el mapa.');
        return;
      }
    }

    // Si todo está bien, limpiamos errores y enviamos al servidor
    setLocalError('');
    onSubmitAuth(e);
  };

  const handleRutChange = (e) => {
    const rutFormateado = formatearRUT(e.target.value);
    onAuthFormChange({ rut: rutFormateado });
  };

  const handleTipoCuentaChange = (e) => {
    const nextType = e.target.value;
    onAuthFormChange({
      account_type: nextType,
      ...(nextType === 'usuario'
        ? {
            nombre_veterinaria: '',
            telefono_veterinaria: '',
            region: '',
            comuna: '',
            direccion_veterinaria: '',
            descripcion_veterinaria: '',
            sitio_web_veterinaria: '',
            documentos_verificacion_locales: [],
            latitude: null,
            longitude: null,
          }
        : {}),
    });
    setUbicacionInfo('');
  };

  const handleRegionVeterinaria = (e) => {
    onAuthFormChange({ region: e.target.value, comuna: '' });
    setUbicacionInfo('');
  };

  const buscarUbicacionVeterinaria = async ({ mostrarErrores = true } = {}) => {
    const direccion = (authForm.direccion_veterinaria || '').trim();
    const comuna = (authForm.comuna || '').trim();
    const region = (authForm.region || '').trim();

    if (!direccion || !comuna || !region) {
      if (mostrarErrores) setLocalError('Ingresa dirección, comuna y región para ubicar la veterinaria.');
      return;
    }

    setUbicacionBusy(true);
    setLocalError('');
    setUbicacionInfo('');
    try {
      const query = encodeURIComponent(`${direccion}, ${comuna}, ${region}, Chile`);
      const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${query}`, {
        headers: { Accept: 'application/json' },
      });
      if (!resp.ok) throw new Error('No se pudo buscar la dirección');
      const data = await resp.json();
      if (!Array.isArray(data) || !data.length) {
        if (mostrarErrores) setLocalError('No se encontró la dirección de la veterinaria.');
        return;
      }
      const item = data[0];
      const latitude = Number(item.lat);
      const longitude = Number(item.lon);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        if (mostrarErrores) setLocalError('La ubicación encontrada no es válida.');
        return;
      }
      onAuthFormChange({ latitude, longitude });
      setUbicacionInfo(`Ubicación lista: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
    } catch (err) {
      if (mostrarErrores) setLocalError(err?.message || 'No se pudo ubicar la veterinaria.');
    } finally {
      setUbicacionBusy(false);
    }
  };

  useEffect(() => {
    if (!esVeterinaria) return undefined;
    const direccion = (authForm.direccion_veterinaria || '').trim();
    const comuna = (authForm.comuna || '').trim();
    const region = (authForm.region || '').trim();
    if (!direccion || !comuna || !region) return undefined;

    const timeoutId = window.setTimeout(() => {
      buscarUbicacionVeterinaria({ mostrarErrores: false });
    }, 700);

    return () => window.clearTimeout(timeoutId);
  }, [esVeterinaria, authForm.direccion_veterinaria, authForm.comuna, authForm.region]);

  const handleDocumentoVerificacion = async (e) => {
    const archivos = Array.from(e.target.files || []);
    if (!archivos.length) {
      onAuthFormChange({ documentos_verificacion_locales: [] });
      return;
    }

    setDocumentoBusy(true);
    setLocalError('');
    try {
      const nuevosDocumentos = [];
      for (const file of archivos) {
        const esImagen = file.type.startsWith('image/');
        const esPdf = file.type === 'application/pdf';
        if (!esImagen && !esPdf) {
          setLocalError('Solo se admiten imágenes o archivos PDF para la verificación.');
          e.target.value = '';
          return;
        }

        if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
          setLocalError(`El documento "${file.name}" es muy grande. Usa un archivo de máximo ${formatFileSize(MAX_IMAGE_UPLOAD_BYTES)}.`);
          e.target.value = '';
          return;
        }

        const dataUrl = esImagen
          ? await optimizeImageFileToDataUrl(file, { maxEdge: 1800, maxBytes: MAX_DOCUMENT_OUTPUT_BYTES, mimePreference: 'image/jpeg' })
          : await fileToDataUrl(file);
        if (!dataUrl) {
          setLocalError(`No se pudo procesar el documento "${file.name}".`);
          e.target.value = '';
          return;
        }

        nuevosDocumentos.push({
          nombre_original: file.name,
          contenido_base64: dataUrl,
          vista_previa: esImagen ? dataUrl : '',
          tipo_documento: VETERINARY_VERIFICATION_DOCUMENT_OPTIONS[0].value,
          tipo_mime: file.type,
        });
      }

      onAuthFormChange({
        documentos_verificacion_locales: [...documentosLocales, ...nuevosDocumentos].slice(0, 6),
      });
      e.target.value = '';
    } catch {
      setLocalError('No se pudo procesar el documento de verificación.');
      e.target.value = '';
    } finally {
      setDocumentoBusy(false);
    }
  };

  const actualizarTipoDocumento = (index, tipo_documento) => {
    const next = documentosLocales.map((documento, idx) => (
      idx === index ? { ...documento, tipo_documento } : documento
    ));
    onAuthFormChange({ documentos_verificacion_locales: next });
  };

  const eliminarDocumento = (index) => {
    onAuthFormChange({
      documentos_verificacion_locales: documentosLocales.filter((_, idx) => idx !== index),
    });
  };

  return (
    <div className="mainInner">
      <section className="card authCard">
        <div className="authHeader">
          <img className="authHeaderLogo" src="/logo_nuevo_sys.png" alt="" />
          <div className="authHeaderTitle">Crea tu cuenta</div>
          <div className="authHeaderSubtitle">Únete a la comunidad de amantes de mascotas</div>
        </div>
        
        {(error || localError) ? (
          <div className="formError" style={{ color: 'red', marginBottom: '10px' }}>
            {localError || error}
          </div>
        ) : null}

        <form className="form registerForm" onSubmit={handleLocalSubmit}>
          <label className="field">
            <span>Nombre</span>
            <div className="fieldControl">
              <span className="fieldIcon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20 21a8 8 0 0 0-16 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <input value={authForm.first_name || ''} onChange={(e) => onAuthFormChange({ first_name: e.target.value })} autoComplete="given-name" placeholder="Ingresa tu nombre" required />
            </div>
          </label>

          <label className="field">
            <span>Apellido</span>
            <div className="fieldControl">
              <span className="fieldIcon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20 21a8 8 0 0 0-16 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <input value={authForm.last_name || ''} onChange={(e) => onAuthFormChange({ last_name: e.target.value })} autoComplete="family-name" placeholder="Ingresa tu apellido" required />
            </div>
          </label>

          <label className="field">
            <span>Usuario</span>
            <div className="fieldControl">
              <span className="fieldIcon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20 21a8 8 0 0 0-16 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <input value={authForm.username || ''} onChange={(e) => onAuthFormChange({ username: e.target.value })} autoComplete="username" placeholder="Elige un nombre de usuario" required />
            </div>
          </label>

          <label className="field">
            <span>RUT</span>
            <div className="fieldControl">
              <span className="fieldIcon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 7a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  <path d="M8 8h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M8 12h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M8 16h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
              <input value={authForm.rut || ''} onChange={handleRutChange} placeholder="Ingresa tu RUT" maxLength={12} required />
            </div>
          </label>

          <label className="field">
            <span>Email</span>
            <div className="fieldControl">
              <span className="fieldIcon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7Z" stroke="currentColor" strokeWidth="2" />
                  <path d="m6 8 6 5 6-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <input type="email" value={authForm.email || ''} onChange={(e) => onAuthFormChange({ email: e.target.value })} autoComplete="email" placeholder="nombre@dominio.cl" required />
            </div>
          </label>

          <label className="field">
            <span>Tipo de cuenta</span>
            <select value={authForm.account_type || 'usuario'} onChange={handleTipoCuentaChange}>
              <option value="usuario">Usuario común</option>
              <option value="veterinaria">Veterinaria</option>
            </select>
          </label>

          {esVeterinaria ? (
            <>
              <label className="field">
                <span>Nombre de la veterinaria</span>
                <input value={authForm.nombre_veterinaria || ''} onChange={(e) => onAuthFormChange({ nombre_veterinaria: e.target.value })} placeholder="Nombre comercial de la veterinaria" required />
              </label>

              <label className="field">
                <span>Teléfono de la veterinaria</span>
                <input value={authForm.telefono_veterinaria || ''} onChange={(e) => onAuthFormChange({ telefono_veterinaria: e.target.value })} placeholder="+56 9 1234 5678" required />
              </label>

              <label className="field">
                <span>Región</span>
                <select value={authForm.region || ''} onChange={handleRegionVeterinaria} required>
                  <option value="">Selecciona una región</option>
                  {Object.keys(REGION_VIEW).map((region) => <option key={region} value={region}>{region}</option>)}
                </select>
              </label>

              <label className="field">
                <span>Comuna</span>
                <select value={authForm.comuna || ''} onChange={(e) => onAuthFormChange({ comuna: e.target.value })} disabled={!authForm.region} required>
                  <option value="">{authForm.region ? 'Selecciona una comuna' : 'Primero elige una región'}</option>
                  {getComunasForRegion(authForm.region).map((comuna) => <option key={comuna} value={comuna}>{comuna}</option>)}
                </select>
              </label>

              <label className="field registerFormFull">
                <span>Dirección o referencia</span>
                <input value={authForm.direccion_veterinaria || ''} onChange={(e) => onAuthFormChange({ direccion_veterinaria: e.target.value })} placeholder="Dirección completa y referencia" required />
              </label>

              <label className="field">
                <span>Sitio web</span>
                <input value={authForm.sitio_web_veterinaria || ''} onChange={(e) => onAuthFormChange({ sitio_web_veterinaria: e.target.value })} placeholder="https://www.tuveterinaria.cl" />
              </label>

              <label className="field registerFormFull">
                <span>Descripción</span>
                <textarea value={authForm.descripcion_veterinaria || ''} onChange={(e) => onAuthFormChange({ descripcion_veterinaria: e.target.value })} rows={4} placeholder="Describe servicios, horarios y especialidades" />
              </label>

              <label className="field registerFormFull">
                <span>Documentos de verificación</span>
                <input type="file" accept="image/*,application/pdf" onChange={handleDocumentoVerificacion} multiple required={!documentosLocales.length} />
                <div className="mutedText">Puedes subir varios respaldos, por ejemplo patente comercial, RUT empresa, inicio de actividades, certificado sanitario o título profesional.</div>
              </label>

              {documentosLocales.length ? (
                <div className="registerFormFull" style={{ display: 'grid', gap: '12px' }}>
                  {documentosLocales.map((documento, index) => (
                    <div key={`${documento.nombre_original || 'documento'}-${index}`} style={{ border: '1px solid rgba(6, 74, 85, 0.12)', borderRadius: '14px', padding: '12px', display: 'grid', gap: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <strong>{documento.nombre_original}</strong>
                        <button type="button" className="miniBtn danger" onClick={() => eliminarDocumento(index)}>Quitar</button>
                      </div>
                      <label className="field" style={{ marginBottom: 0 }}>
                        <span>Tipo de documento</span>
                        <select value={documento.tipo_documento || 'otro'} onChange={(e) => actualizarTipoDocumento(index, e.target.value)}>
                          {VETERINARY_VERIFICATION_DOCUMENT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </label>
                      <div className="mutedText">
                        {documentoBusy ? 'Procesando documento...' : `Documento cargado como ${getVeterinaryDocumentTypeLabel(documento.tipo_documento)}`}
                      </div>
                      {documento.vista_previa ? (
                        <img
                          src={documento.vista_previa}
                          alt={documento.nombre_original || 'Documento de verificación'}
                          style={{ width: '100%', maxHeight: '260px', objectFit: 'contain', borderRadius: '10px', background: '#f8f9fa' }}
                        />
                      ) : (
                        <div style={{ padding: '14px', borderRadius: '10px', background: '#f8f9fa', color: '#475569', fontWeight: 700 }}>
                          PDF listo para revisión
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}

              {ubicacionInfo ? <div className="mutedText registerFormFull">{ubicacionBusy ? 'Buscando ubicación...' : ubicacionInfo}</div> : null}
            </>
          ) : null}

          <label className="field">
            <span>Contraseña</span>
            <div className="fieldControl">
              <span className="fieldIcon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M7 11V8a5 5 0 0 1 10 0v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M6 11h12a2 2 0 0 1 2 2v6a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-6a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                </svg>
              </span>
              <input type={mostrarContrasena ? "text" : "password"} value={authForm.password || ''} onChange={(e) => onAuthFormChange({ password: e.target.value })} autoComplete="new-password" placeholder="Crea una contraseña segura" required />
              <button
                className="fieldToggleBtn"
                type="button"
                onClick={() => setMostrarContrasena((valor) => !valor)}
                aria-label={mostrarContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {mostrarContrasena ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </label>

          <label className="field">
            <span>Confirmar Contraseña</span>
            <div className="fieldControl">
              <span className="fieldIcon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M7 11V8a5 5 0 0 1 10 0v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M6 11h12a2 2 0 0 1 2 2v6a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-6a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  <path d="m9.2 16.1 1.8 1.8 3.8-3.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <input type={mostrarConfirmacion ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" placeholder="Confirma tu contraseña" required />
              <button
                className="fieldToggleBtn"
                type="button"
                onClick={() => setMostrarConfirmacion((valor) => !valor)}
                aria-label={mostrarConfirmacion ? 'Ocultar confirmación de contraseña' : 'Mostrar confirmación de contraseña'}
              >
                {mostrarConfirmacion ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </label>

          <button className="primaryBtn registerFormFull" type="submit" disabled={busy}>
            {busy ? 'Creando...' : 'Crear cuenta'}
          </button>
        </form>
        
        <div className="mutedText">
          ¿Ya tienes cuenta? <Link to={`/login${locationSearch || ''}`} onClick={onSwitchToLogin}>Inicia sesión</Link>
        </div>
      </section>
    </div>
  );
}
