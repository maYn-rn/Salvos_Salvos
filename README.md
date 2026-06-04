# Sanos y Salvos - Plataforma de Reporte de Mascotas

Este proyecto es una aplicación full-stack basada en una **arquitectura de microservicios**, diseñada para la gestión y reporte de mascotas perdidas o encontradas. Desarrollado como parte de la Evaluación 2 para la carrera de Ingeniería en Informática.

## 🚀 Arquitectura del Sistema

La solución se divide en cuatro componentes principales que interactúan a través de una red local:

1.  **Frontend (React + Vite):** Interfaz de usuario dinámica con mapas georreferenciados.
2.  **BFF / API Gateway (Django):** Orquestador que centraliza las peticiones del frontend y las deriva a los servicios correspondientes.
3.  **MS Seguridad (Django):** Servicio encargado de la autenticación JWT, registro de usuarios y gestión de roles (RBAC).
4.  **MS Mascotas (Django):** Servicio de persistencia y lógica de negocio para los reportes de mascotas.

## 🛠️ Tecnologías Utilizadas

* **Frontend:** React, Tailwind CSS, Leaflet (Mapas).
* **Backend:** Python 3.14+, Django, Django REST Framework.
* **Autenticación:** JSON Web Tokens (JWT).
* **Control de Versiones:** Git & GitHub.

## 📋 Requisitos Previos

* Python instalado.
* Node.js para el Frontend.
* Instalar dependencias en cada microservicio:
    ```bash
    pip install django django-cors-headers djangorestframework djangorestframework-simplejwt requests
    ```

## 🔧 Configuración y Ejecución

Para levantar el sistema completo, se deben iniciar los servicios en el siguiente orden:

1.  **Microservicio de Seguridad (Puerto 8002):**
    ```bash
    cd ms_seguridad
    py manage.py migrate
    python manage.py runserver 8002
    ```
2.  **Microservicio de Mascotas (Puerto 8001):**
    ```bash
    cd ms_mascotas
    py manage.py migrate
    python manage.py runserver 8001
    ```
3.  **BFF / Gateway (Puerto 8000):**
    ```bash
    cd bff_web
    py manage.py migrate
    python manage.py runserver 8000
    ```
4.  **Frontend:**
    ```bash
    cd frontend
    npm install 
    npm run dev
    ```

## 🔐 Gestión de Administradores

Para acceder al panel de administración en el frontend, es necesario crear un superusuario en el servicio de seguridad:
```bash
cd ms_seguridad
python manage.py createsuperuser
