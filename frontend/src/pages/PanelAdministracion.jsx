import { useState } from 'react'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'

import PaginaAdminResumen from './PaginaAdminResumen'
import PaginaAdminReportes from './PaginaAdminReportes'
import PaginaAdminUsuarios from './PaginaAdminUsuarios'
import PaginaAdminAdopciones from './PaginaAdminAdopciones' // ◄ Importamos la nueva página

export default function PanelAdministracion({ user, onLogout, busy }) {
  const isAdmin = Boolean(user?.is_staff || user?.is_superuser)
  const location = useLocation()
  const [search, setSearch] = useState('')

  if (!isAdmin) {
    return (
      <div className="mainInner">
        <section className="card">
          <h2 className="cardTitle">Backoffice</h2>
          <div className="mutedText">Acceso restringido.</div>
        </section>
      </div>
    )
  }

  const path = location.pathname
  const active = (suffix) => (path === `/admin/${suffix}` ? ' isActive' : '')
  
  const title =
    path.startsWith('/admin/reportes') ? 'Reportes' :
    path.startsWith('/admin/usuarios') ? 'Usuarios' :
    path.startsWith('/admin/adopciones') ? 'Adopciones' : // ◄ Título dinámico para adopciones
    'Dashboard'
    
  const initials = (user?.username || 'A').slice(0, 1).toUpperCase()

  return (
    <div className="boApp">
      <div className="boLayout">
        <aside className="boSidebar" aria-label="Navegación del backoffice">
          <Link className="boBrand" to="/">
            <img className="boLogo" src="/logo_nuevo_sys.png" alt="Sanos y Salvos" />
            <div className="boBrandText">
              <div className="boBrandName">Sanos y Salvos</div>
              <div className="boBrandSub">Backoffice</div>
            </div>
          </Link>
          <nav className="boNav">
            <Link className={`boNavLink${active('dashboard')}`} to="/admin/dashboard">
              <span className="boNavIcon" aria-hidden="true">
                <svg viewBox="0 0 24 24" role="presentation"><path fill="currentColor" d="M4 13h7V4H4v9Zm9 7h7V11h-7v9ZM4 20h7v-5H4v5Zm9-18v7h7V2h-7Z"/></svg>
              </span>
              <span>Dashboard</span>
            </Link>
            <Link className={`boNavLink${active('reportes')}`} to="/admin/reportes">
              <span className="boNavIcon" aria-hidden="true">
                <svg viewBox="0 0 24 24" role="presentation"><path fill="currentColor" d="M7 2h10a2 2 0 0 1 2 2v16l-4-2-4 2-4-2-4 2V4a2 2 0 0 1 2-2Zm2 5h6v2H9V7Zm0 4h6v2H9v-2Z"/></svg>
              </span>
              <span>Reportes</span>
            </Link>
            {/* NUEVO BOTÓN EN LA BARRA LATERAL DEL ADMIN */}
            <Link className={`boNavLink${active('adopciones')}`} to="/admin/adopciones">
              <span className="boNavIcon" aria-hidden="true">
                <svg viewBox="0 0 24 24" role="presentation"><path fill="currentColor" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35Z"/></svg>
              </span>
              <span>Adopciones</span>
            </Link>
            <Link className={`boNavLink${active('usuarios')}`} to="/admin/usuarios">
              <span className="boNavIcon" aria-hidden="true">
                <svg viewBox="0 0 24 24" role="presentation"><path fill="currentColor" d="M12 12a4.5 4.5 0 1 0-4.5-4.5A4.505 4.505 0 0 0 12 12Zm0 2c-4.42 0-8 2.35-8 5.25V21h16v-1.75c0-2.9-3.58-5.25-8-5.25Z"/></svg>
              </span>
              <span>Usuarios</span>
            </Link>
          </nav>
        </aside>

        <div className="boMain">
          <div className="boTopbar">
            <div className="boTopbarLeft">
              <div className="boPageTitle">{title}</div>
              <div className="boSearch">
                <svg className="boSearchIcon" viewBox="0 0 24 24" aria-hidden="true" role="presentation">
                  <path
                    fill="currentColor"
                    d="M10.5 3a7.5 7.5 0 1 1 4.61 13.41l3.24 3.25a1 1 0 0 1-1.41 1.41l-3.25-3.24A7.5 7.5 0 0 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11a5.5 5.5 0 0 0 0-11Z"
                  />
                </svg>
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar en la sección…" />
              </div>
            </div>

            <div className="boTopbarRight">
              <Link className="boTopBtn" to="/">Ir al sitio</Link>
              <button className="boTopBtn" type="button" disabled={busy} onClick={onLogout}>Salir</button>
              <div className="boUserChip" title={user?.username || ''}>
                <div className="boAvatar" aria-hidden="true">{initials}</div>
                <div className="boUserText">
                  <div className="boUserName">{user?.username || '-'}</div>
                  <div className="boUserRole">Admin</div>
                </div>
              </div>
            </div>
          </div>

          <Routes>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<PaginaAdminResumen />} />
            <Route path="reportes" element={<PaginaAdminReportes search={search} />} />
            {/* NUEVA RUTA PARA RENDERIZAR EL COMPONENTE */}
            <Route path="adopciones" element={<PaginaAdminAdopciones search={search} />} />
            <Route path="usuarios" element={<PaginaAdminUsuarios search={search} />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}