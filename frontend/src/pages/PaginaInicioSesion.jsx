import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function PaginaInicioSesion({ error, busy, authForm, onAuthFormChange, onSubmitAuth, locationSearch, onSwitchToRegister }) {
  // Estado local para manejar si el usuario quiere ser recordado
  const [recordarme, setRecordarme] = useState(false);

  const handleSubmitLocal = (e) => {
    e.preventDefault();
    
    // Aquí se utiliza el valor de 'recordarme' para decidir la persistencia del token
    onSubmitAuth(e);
  };

  return (
    <div className="mainInner">
      <section className="card authCard">
        <h2 className="cardTitle">Iniciar sesión</h2>
        
        {/* Muestra el error que viene del backend (ej: Credenciales inválidas) */}
        {error ? <div className="formError" style={{ color: 'red', marginBottom: '10px' }}>{error}</div> : null}
        
        <form className="form" onSubmit={handleSubmitLocal}>
          <label className="field">
            <span>Usuario</span>
            <input 
              value={authForm.username || ''} 
              onChange={(e) => onAuthFormChange({ username: e.target.value })} 
              autoComplete="username" 
              required 
            />
          </label>
          
          <label className="field">
            <span>Contraseña</span>
            <input 
              type="password" 
              value={authForm.password || ''} 
              onChange={(e) => onAuthFormChange({ password: e.target.value })} 
              autoComplete="current-password" 
              required 
            />
          </label>

          {/* Opciones adicionales: Recordarme y Olvidé mi contraseña */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', fontSize: '0.9em' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={recordarme}
                onChange={(e) => setRecordarme(e.target.checked)}
                style={{ marginRight: '5px' }} 
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
        
        <div className="mutedText" style={{ marginTop: '15px' }}>
          ¿No tienes cuenta? <Link to={`/register${locationSearch || ''}`} onClick={onSwitchToRegister}>Regístrate</Link>
        </div>
      </section>
    </div>
  );
}