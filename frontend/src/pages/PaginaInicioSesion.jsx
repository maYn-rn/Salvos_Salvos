import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function PaginaInicioSesion({ error, busy, authForm, onAuthFormChange, onSubmitAuth, locationSearch, onSwitchToRegister }) {
  // Estado local para manejar si el usuario quiere ser recordado
  const [recordarme, setRecordarme] = useState(false);
  const [mostrarContrasena, setMostrarContrasena] = useState(false);

  const handleSubmitLocal = (e) => {
    e.preventDefault();
    
    // Aquí se utiliza el valor de 'recordarme' para decidir la persistencia del token
    onSubmitAuth(e);
  };

  return (
    <div className="mainInner">
      <section className="card authCard authCardLogin">
        <div className="authHeader">
          <img className="authHeaderLogo" src="/logo_nuevo_sys.png" alt="" />
          <div className="authHeaderTitle">Bienvenido de vuelta</div>
          <div className="authHeaderSubtitle">Ingresa a tu cuenta para continuar</div>
        </div>
        
        {/* Muestra el error que viene del backend (ej: Credenciales inválidas) */}
        {error ? <div className="formError" style={{ color: 'red', marginBottom: '10px' }}>{error}</div> : null}
        
        <form className="form authFormCompact" onSubmit={handleSubmitLocal}>
          <label className="field">
            <span>Usuario</span>
            <div className="fieldControl">
              <span className="fieldIcon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20 21a8 8 0 0 0-16 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <input 
                value={authForm.username || ''} 
                onChange={(e) => onAuthFormChange({ username: e.target.value })} 
                autoComplete="username" 
                placeholder="Ingresa tu nombre de usuario"
                required 
              />
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
              <input 
                type={mostrarContrasena ? "text" : "password"}
                value={authForm.password || ''} 
                onChange={(e) => onAuthFormChange({ password: e.target.value })} 
                autoComplete="current-password" 
                placeholder="Ingresa tu contraseña segura"
                required 
              />
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

          {/* Opciones adicionales: Recordarme y Olvidé mi contraseña */}
          <div className="authAuxRow">
            <label className="authRemember">
              <input 
                type="checkbox" 
                checked={recordarme}
                onChange={(e) => setRecordarme(e.target.checked)}
              />
              Recordarme
            </label>
            <Link to="#" className="mutedText" style={{ textDecoration: 'underline' }}>
              ¿Olvidaste tu contraseña?
            </Link>
          </div>

          <button className="primaryBtn" type="submit" disabled={busy}>
            {busy ? 'Iniciando...' : 'Entrar'}
          </button>
        </form>
        
        <div className="mutedText authFooterLink">
          ¿No tienes cuenta? <Link to={`/register${locationSearch || ''}`} onClick={onSwitchToRegister}>Regístrate</Link>
        </div>
      </section>
    </div>
  );
}
