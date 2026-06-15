# Sanos y Salvos - Plataforma de Reporte de Mascotas

Este proyecto es una aplicación full-stack basada en una **arquitectura de microservicios**, diseñada para la gestión y reporte de mascotas perdidas o encontradas. Desarrollado como parte de la Evaluación 2 para la carrera de Ingeniería en Informática.

## 🚀 Arquitectura del Sistema

La solución se divide en cinco componentes principales que interactúan a través de una red local:

1. **Frontend (React + Vite):** Interfaz de usuario dinámica con mapas georreferenciados.
2. **BFF / API Gateway (Django):** Orquestador que centraliza las peticiones del frontend y las deriva a los servicios correspondientes.
3. **MS Seguridad (Django):** Servicio encargado de la autenticación JWT, registro de usuarios y gestión de roles (RBAC).
4. **MS Mascotas (Django):** Servicio de persistencia y lógica de negocio para los reportes de mascotas.
5. **MS Adopciones (Django):** Servicio encargado de gestionar publicaciones de mascotas en adopción, ya sea de albergues o de usuarios particulares.

## 🛠️ Tecnologías Utilizadas

* **Frontend:** React, Tailwind CSS, Leaflet (Mapas).
* **Backend:** Python 3.14+, Django, Django REST Framework.
* **Autenticación:** JSON Web Tokens (JWT).
* **Control de Versiones:** Git & GitHub.

## 📋 Requisitos Previos

* Python 3.12+ y Node.js instalados en el sistema.
* Un proyecto de Supabase con acceso a PostgreSQL.
* Instalar las dependencias del backend desde la raíz del proyecto:

```powershell
py -m pip install -r requirements.txt
```

* Instalar las dependencias del frontend:

```powershell
cd frontend
npm install
cd ..
```

## 🗄️ Configuración de Supabase

1. En Supabase abre tu proyecto y entra a `Settings > Database`.
2. Copia la cadena de conexión PostgreSQL.
3. En la raíz del proyecto crea un archivo `.env` tomando `.env.example` como referencia.
4. Pega la conexión en `DATABASE_URL`.

Ejemplo:

```env
DATABASE_URL=postgresql://postgres.tu-proyecto:TU_PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres
DB_SSLMODE=require
DB_CONN_MAX_AGE=60
JWT_SECRET=dev-jwt-secret-change-me
```

Notas:

* Si defines `DATABASE_URL`, los cuatro servicios usarán la misma base de Supabase.
* Si quieres una base distinta por servicio, puedes definir `BFF_DATABASE_URL`, `SEGURIDAD_DATABASE_URL`, `MASCOTAS_DATABASE_URL` y `ADOPCIONES_DATABASE_URL`.
* Si no configuras ninguna variable de base de datos, el proyecto seguirá usando `sqlite3` local.

## 🔧 Configuración, Inicialización y Ejecución

Para levantar el sistema completo con Supabase, primero se deben crear las tablas ejecutando las migraciones, luego crear el administrador del sistema y finalmente iniciar todos los servicios en paralelo:

```powershell
# 1. Microservicio de Seguridad (Puerto 8002)
cd ms_seguridad
py manage.py migrate
py manage.py createsuperuser
py manage.py runserver 8002

# 2. Microservicio de Mascotas (Puerto 8001)
cd ..
cd ms_mascotas
py manage.py migrate
py manage.py runserver 8001

# 3. BFF / Gateway (Puerto 8000)
cd ..
cd bff_web
py manage.py migrate
py manage.py runserver 8000

# 4. Microservicio de Adopciones (Puerto 8003)
cd ..
cd ms_adopciones
py manage.py migrate
py manage.py runserver 8003

# 5. Frontend (React)
cd ..
cd frontend
npm run dev
```
