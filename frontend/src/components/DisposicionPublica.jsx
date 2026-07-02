import { Link, Outlet, useLocation } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'

export default function DisposicionPublica({ user, isAdmin, canModerateReports, busy, onLogout, year }) {
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const publishRef = useRef(null)
  const adoptionNext = encodeURIComponent('/adopciones/publicar')

  // Cierra el menú automáticamente si cambias de página
  useEffect(() => {
    setMenuOpen(false)
    setPublishOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!publishOpen) return undefined
    const onPointerDown = (e) => {
      if (!publishRef.current) return
      if (!publishRef.current.contains(e.target)) setPublishOpen(false)
    }
    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('touchstart', onPointerDown, { passive: true })
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('touchstart', onPointerDown)
    }
  }, [publishOpen])

  if (String(location.pathname || '').includes('admin')) return null

  return (
    <div className="appShell">
      <header className="siteHeader">
        <div className="headerInner">
          <Link className="brand" to="/">
            <img className="brandLogo" src="/logo_nuevo_sys.png" alt="Sanos y Salvos" />
            <span className="brandName">Sanos y Salvos</span>
          </Link>

          {/* BOTÓN HAMBURGUESA */}
          <button
            type="button"
            className="mobileMenuBtn"
            aria-label={menuOpen ? 'Cerrar menu principal' : 'Abrir menu principal'}
            aria-expanded={menuOpen}
            aria-controls="site-navigation"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? '✖' : '☰'}
          </button>

          {/* CONTENEDOR MAESTRO: En PC es horizontal, en Móvil es un panel flotante */}
          <div className={`navAndActions ${menuOpen ? 'open' : ''}`}>
            <nav id="site-navigation" className="siteNav" aria-label="Navegación principal">
              <Link className="navLink" to="/">Inicio</Link>
              <Link className="navLink" to="/mapa">Mapa</Link>
              <Link className="navLink" to="/adopciones">Adopciones</Link>
              <Link className="navLink" to="/voluntarios">Voluntarios</Link>
              <Link className="navLink" to="/preguntas-frecuentes">Consejos</Link>
            </nav>

            <div className="headerActions">
              {canModerateReports ? (
                <Link className="adminBtn" to="/admin">
                  Moderación
                </Link>
              ) : null}
              
              {user ? (
                <Link className="loginBtn" to="/perfil">
                  <svg className="userIcon" viewBox="0 0 24 24" role="presentation" aria-hidden="true">
                    <path fill="currentColor" d="M12 12a4.5 4.5 0 1 0-4.5-4.5A4.505 4.505 0 0 0 12 12Zm0 2.25c-4.135 0-7.5 2.52-7.5 5.625A1.125 1.125 0 0 0 5.625 21h12.75a1.125 1.125 0 0 0 1.125-1.125c0-3.105-3.365-5.625-7.5-5.625Z" />
                  </svg>
                  <span className="mobileTextOnly" style={{ marginLeft: '8px' }}>Mi Perfil</span>
                </Link>
              ) : (
                <Link className="loginBtn" to="/login?next=/perfil">
                  <svg className="userIcon" viewBox="0 0 24 24" role="presentation" aria-hidden="true">
                    <path fill="currentColor" d="M12 12a4.5 4.5 0 1 0-4.5-4.5A4.505 4.505 0 0 0 12 12Zm0 2.25c-4.135 0-7.5 2.52-7.5 5.625A1.125 1.125 0 0 0 5.625 21h12.75a1.125 1.125 0 0 0 1.125-1.125c0-3.105-3.365-5.625-7.5-5.625Z" />
                  </svg>
                  <span className="mobileTextOnly" style={{ marginLeft: '8px' }}>Iniciar Sesión</span>
                </Link>
              )}

              <div className="publishMenuWrap" ref={publishRef}>
                <button
                  className="reportBtn publishBtn"
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={publishOpen}
                  onClick={() => setPublishOpen((v) => !v)}
                >
                  + Publicar
                </button>
                {publishOpen ? (
                  <div className="publishMenu" role="menu" aria-label="Opciones de publicación">
                    <Link
                      className="publishMenuItem"
                      role="menuitem"
                      to={user ? '/reportar' : '/login?next=/reportar'}
                      onClick={() => setPublishOpen(false)}
                    >
                      + Publicar reporte
                    </Link>
                    <Link
                      className="publishMenuItem"
                      role="menuitem"
                      to={user ? '/adopciones/publicar' : `/login?next=${adoptionNext}`}
                      onClick={() => setPublishOpen(false)}
                    >
                      + Publicar adopción
                    </Link>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="siteMain" role="main">
        <Outlet />
      </main>

      <footer className="siteFooter">
         <div className="footerInner">
          <div className="footerGrid">
            <div className="footerBrand">
              <div className="footerBrandTop">
                <img className="footerLogo" src="/logo_nuevo_sys.png" alt="Sanos y Salvos" />
                <div className="footerBrandName">Sanos y Salvos</div>
              </div>
              <div className="footerText footerTagline">
                Plataforma comunitaria para reportar mascotas perdidas y ayudar a reencontrarlas.
              </div>
            </div>

            <div className="footerCol">
              <div className="footerTitle">Navegación</div>
              <div className="footerLinks">
                <Link className="footerLink" to="/">Inicio</Link>
                <Link className="footerLink" to="/adopciones">Adopciones</Link>
                <Link className="footerLink" to="/voluntarios">Voluntarios</Link>
                <Link className="footerLink" to="/preguntas-frecuentes">Preguntas frecuentes</Link>
                <Link className="footerLink" to="/reportar">Reportar mascota</Link>
              </div>
            </div>
            
            <div className="footerCol">
              <div className="footerTitle">Empresa</div>
              <div className="footerLinks">
                <Link className="footerLink" to="/#sobre-nosotros">Nosotros</Link>
                <Link className="footerLink" to="/politicas-de-privacidad">Políticas de privacidad</Link>
                <Link className="footerLink" to="/terminos-y-condiciones">Términos y condiciones</Link>
              </div>
            </div>

          </div>
          <div className="footerBottom">
            <div>© {year} Sanos y Salvos</div>
            <div className="footerSmall">Hecho para la comunidad</div>
          </div>
        </div>
      </footer>
    </div>
  )
}
