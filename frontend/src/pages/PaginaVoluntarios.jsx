import { useState } from 'react';
import { Link } from 'react-router-dom';

// LA PALABRA "default" AQUÍ ES LA QUE ARREGLA EL ERROR
export default function PaginaVoluntarios({ user }) {
  const [success, setSuccess] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSuccess(true);
  };

  return (
    <div className="mainInner">
      <div style={{ marginBottom: '16px' }}>
        <Link className="miniBtn" to="/">← Volver al inicio</Link>
      </div>
      
      <section className="card" style={{ padding: '40px 24px', textAlign: 'center', backgroundColor: '#e6fcf5', border: '1px solid #19a6b6' }}>
        <h1 style={{ color: '#064a55', fontSize: '2.5rem', marginTop: 0 }}>¡Únete como Voluntario!</h1>
        <p style={{ fontSize: '1.2rem', color: '#444', maxWidth: '600px', margin: '0 auto 24px auto', lineHeight: '1.5' }}>
          Sanos y Salvos funciona gracias a una red de voluntarios. Ayúdanos a revisar reportes, organizar rescates y moderar las adopciones en tu comuna.
        </p>
      </section>

      <section className="card" style={{ maxWidth: '600px', margin: '30px auto', padding: '30px' }}>
        <h2 style={{ color: '#064a55', marginTop: 0, marginBottom: '20px' }}>Formulario de Postulación</h2>
        
        {success ? (
          <div className="formSuccess" style={{ padding: '20px', textAlign: 'center', fontSize: '1.1rem', borderRadius: '8px' }}>
            🎉 ¡Gracias por postularte! Nos pondremos en contacto contigo pronto al correo registrado.
          </div>
        ) : (
          <form className="form" onSubmit={handleSubmit}>
            <label className="field">
              <span>Nombre Completo</span>
              <input required placeholder="Nombre completo" defaultValue={user?.username || ''} />
            </label>
            <label className="field">
              <span>Email de contacto</span>
              <input type="email" required placeholder="nombre@dominio.cl" defaultValue={user?.email || ''} />
            </label>
            <label className="field">
              <span>¿Por qué quieres ser voluntario?</span>
              <textarea required rows="4" placeholder="Describe tu experiencia, disponibilidad y cómo te gustaría colaborar" style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '1rem', fontFamily: 'inherit' }}></textarea>
            </label>
            <button className="primaryBtn" type="submit" style={{ width: '100%', padding: '14px', fontSize: '1.1rem', marginTop: '10px' }}>
              Enviar Postulación
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
