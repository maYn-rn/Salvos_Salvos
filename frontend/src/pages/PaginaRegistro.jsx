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
        <h2 className="cardTitle">Registro</h2>
        
        {(error || localError) ? (
          <div className="formError" style={{ color: 'red', marginBottom: '10px' }}>
            {localError || error}
          </div>
        ) : null}

        <form className="form" onSubmit={handleLocalSubmit}>
          <label className="field">
            <span>Usuario</span>
            <input value={authForm.username || ''} onChange={(e) => onAuthFormChange({ username: e.target.value })} autoComplete="username" required />
          </label>

          <label className="field">
            <span>RUT</span>
            <input value={authForm.rut || ''} onChange={handleRutChange} placeholder="12.345.678-9" maxLength={12} required />
          </label>

          <label className="field">
            <span>Email</span>
            <input type="email" value={authForm.email || ''} onChange={(e) => onAuthFormChange({ email: e.target.value })} autoComplete="email" required />
          </label>

          <label className="field">
            <span>Contraseña</span>
            <input type="password" value={authForm.password || ''} onChange={(e) => onAuthFormChange({ password: e.target.value })} autoComplete="new-password" required />
          </label>

          <label className="field">
            <span>Confirmar Contraseña</span>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" required />
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