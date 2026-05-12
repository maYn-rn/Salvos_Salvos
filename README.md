🐾 Sanos y Salvos - Plataforma de Localización de Mascotas
Sanos y Salvos es una aplicación web diseñada para facilitar la búsqueda y reporte de mascotas perdidas en la comunidad. Este proyecto fue desarrollado como parte de la Evaluación Parcial 2 para la carrera de Ingeniería en Informática en Duoc UC.

🚀 Propósito del Proyecto
El objetivo principal es centralizar los reportes de mascotas perdidas y encontradas en una interfaz intuitiva, accesible y funcional, permitiendo una respuesta rápida de la comunidad ante emergencias veterinarias o extravíos.

✨ Características Principales
Reporte de Mascotas: Formulario dinámico para registrar mascotas desaparecidas o encontradas.
Visualización en Tiempo Real: Galería de tarjetas con información clave de los reportes recientes.
Búsqueda y Filtros: Filtrado por nombre, raza o comuna para agilizar la localización.
Panel Administrativo (Dashboard): * Gráficas estadísticas de reportes por especie utilizando Recharts.
Gestión de datos (CRUD) para administradores.
Sistema de Roles: Acceso diferenciado entre usuarios ciudadanos y administradores.
Accesibilidad: Paleta de colores optimizada para usuarios con daltonismo (azul y amarillo de alto contraste).
🛠️ Tecnologías Utilizadas
Frontend: React.js (Vite)
Estilos: CSS3 (Variables personalizadas y Diseño Responsivo)
Gráficas: Recharts
Testing: Vitest y React Testing Library
Iconos: Emojis y SVG para optimización de carga.
📦 Instalación y Configuración
Sigue estos pasos para ejecutar el proyecto localmente:

Clonar el repositorio:

git clone [https://github.com/tu-usuario/proyecto-sanos-y-salvos.git](https://github.com/tu-usuario/proyecto-sanos-y-salvos.git)
cd proyecto-sanos-y-salvos
Instalar dependencias:

npm install
Instalar librerías adicionales (si no están):

npm install recharts
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom
Ejecutar en modo desarrollo:

npm run dev
Ejecutar pruebas unitarias:

npm test
🔑 Acceso de Prueba (Credenciales)
Para probar las funcionalidades de administrador y ver el Dashboard:

Correo: admin@sanosysalvos.cl
Contraseña: (Cualquier combinación de caracteres)
🧪 Calidad de Software (Testing)
El proyecto incluye una suite de pruebas unitarias que validan:

El renderizado correcto de los componentes clave.
La seguridad de la sección de comentarios (restricción por login).
La funcionalidad lógica del CRUD en el Dashboard.
👨‍💻 Autor
Estudiantes: luis paredes, luis santa crus, matias medina
Institución: Duoc UC
Sede: antonio varas
Carrera: Ingeniería en Informática
