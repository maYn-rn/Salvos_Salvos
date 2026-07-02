import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { getComunasForRegion, optimizeImageFileToDataUrl, REGION_VIEW } from '../shared/appCore';

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
  const esVeterinaria = (authForm.account_type || 'usuario') === 'veterinaria';

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
            documento_verificacion_local: null,
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
    const file = e.target.files?.[0];
    if (!file) {
      onAuthFormChange({ documento_verificacion_local: null });
      return;
    }

    if (!file.type.startsWith('image/')) {
      setLocalError('El documento debe subirse como imagen escaneada o foto.');
      e.target.value = '';
      return;
    }

    if (file.size > 10_000_000) {
      setLocalError('El documento es muy grande. Usa una imagen de máximo 10MB.');
      e.target.value = '';
      return;
    }

    setDocumentoBusy(true);
    setLocalError('');
    try {
      const dataUrl = await optimizeImageFileToDataUrl(file, { maxEdge: 1800, maxBytes: 900_000, mimePreference: 'image/jpeg' });
      if (!dataUrl) {
        setLocalError('No se pudo procesar el documento de verificación.');
        e.target.value = '';
        return;
      }
      onAuthFormChange({
        documento_verificacion_local: {
          nombre_original: file.name,
          contenido_base64: dataUrl,
          vista_previa: dataUrl,
        },
      });
    } catch {
      setLocalError('No se pudo procesar el documento de verificación.');
      e.target.value = '';
    } finally {
      setDocumentoBusy(false);
    }
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
              <input value={authForm.first_name || ''} onChange={(e) => onAuthFormChange({ first_name: e.target.value })} autoComplete="given-name" placeholder="Ej: Matias" required />
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
              <input value={authForm.last_name || ''} onChange={(e) => onAuthFormChange({ last_name: e.target.value })} autoComplete="family-name" placeholder="Ej: Gonzalez" required />
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
              <input value={authForm.username || ''} onChange={(e) => onAuthFormChange({ username: e.target.value })} autoComplete="username" placeholder="Ej: matias123" required />
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
              <input value={authForm.rut || ''} onChange={handleRutChange} placeholder="Ej: 12.345.678-9" maxLength={12} required />
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
              <input type="email" value={authForm.email || ''} onChange={(e) => onAuthFormChange({ email: e.target.value })} autoComplete="email" placeholder="Ej: correo@ejemplo.com" required />
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
                <input value={authForm.nombre_veterinaria || ''} onChange={(e) => onAuthFormChange({ nombre_veterinaria: e.target.value })} placeholder="Ej: Veterinaria Sanos y Salvos" required />
              </label>

              <label className="field">
                <span>Teléfono de la veterinaria</span>
                <input value={authForm.telefono_veterinaria || ''} onChange={(e) => onAuthFormChange({ telefono_veterinaria: e.target.value })} placeholder="Ej: +56 9 1234 5678" required />
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
                <input value={authForm.direccion_veterinaria || ''} onChange={(e) => onAuthFormChange({ direccion_veterinaria: e.target.value })} placeholder="Ej: Alameda 1234, frente a la plaza" required />
              </label>

              <label className="field">
                <span>Sitio web</span>
                <input value={authForm.sitio_web_veterinaria || ''} onChange={(e) => onAuthFormChange({ sitio_web_veterinaria: e.target.value })} placeholder="Ej: www.veterinaria.cl" />
              </label>

              <label className="field registerFormFull">
                <span>Descripción</span>
                <textarea value={authForm.descripcion_veterinaria || ''} onChange={(e) => onAuthFormChange({ descripcion_veterinaria: e.target.value })} rows={4} placeholder="Servicios, horarios o especialidades..." />
              </label>

              <label className="field registerFormFull">
                <span>Documento de verificación</span>
                <input type="file" accept="image/*" onChange={handleDocumentoVerificacion} required />
                <div className="mutedText">Sube una imagen o escaneo del documento que acredite la veterinaria.</div>
              </label>

              {authForm.documento_verificacion_local?.vista_previa ? (
                <div className="registerFormFull" style={{ border: '1px solid rgba(6, 74, 85, 0.12)', borderRadius: '14px', padding: '12px' }}>
                  <div className="mutedText" style={{ marginBottom: '8px' }}>
                    {documentoBusy ? 'Procesando documento...' : `Documento listo: ${authForm.documento_verificacion_local.nombre_original}`}
                  </div>
                  <img
                    src={authForm.documento_verificacion_local.vista_previa}
                    alt="Documento de verificación"
                    style={{ width: '100%', maxHeight: '260px', objectFit: 'contain', borderRadius: '10px', background: '#f8f9fa' }}
                  />
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
              <input type="password" value={authForm.password || ''} onChange={(e) => onAuthFormChange({ password: e.target.value })} autoComplete="new-password" placeholder="Ej: MiClave123" required />
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
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" placeholder="Repite tu contraseña" required />
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
