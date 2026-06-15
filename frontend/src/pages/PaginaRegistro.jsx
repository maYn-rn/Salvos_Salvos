import { useState } from 'react';
import { Link } from 'react-router-dom';

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

    // Si todo está bien, limpiamos errores y enviamos al servidor
    setLocalError('');
    onSubmitAuth(e);
  };

  const handleRutChange = (e) => {
    const rutFormateado = formatearRUT(e.target.value);
    onAuthFormChange({ rut: rutFormateado });
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

        <form className="form" onSubmit={handleLocalSubmit}>
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

          <button className="primaryBtn" type="submit" disabled={busy}>
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
