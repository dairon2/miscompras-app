# Documentación del Sistema: Miscompras App

## 1. Visión General
**Miscompras App** es una plataforma integral diseñada para la gestión de compras, presupuestos y requerimientos del **Museo de Antioquia** (Coordinación de Compras). El sistema centraliza el flujo de solicitudes desde la creación hasta el pago, integrando controles presupuestales y flujos de aprobación jerárquicos.

**URL de Producción**: [miscompras-front-prod-g4akhtbsagfpefbk.canadacentral-01.azurewebsites.net](https://miscompras-front-prod-g4akhtbsagfpefbk.canadacentral-01.azurewebsites.net/)

---

## 2. Arquitectura del Sistema
El sistema sigue una arquitectura de cliente-servidor desacoplada:

- **Frontend**: Aplicación Web Single Page (SPA) construida con **Next.js 15+** (App Router).
- **Backend**: API REST robusta desarrollada en **Node.js** con **Express**.
- **Base de Datos**: PostgreSQL, gestionado mediante el ORM **Prisma**.
- **Infraestructura**: Desplegado en **Azure App Services** utilizando contenedores **Docker**.

---

## 3. Stack Tecnológico

### Frontend
- **Framework**: Next.js (React 19)
- **Estilos**: Tailwind CSS 4.0 (Diseño Premium Dark/Light)
- **Estado**: Zustand (Gestión ligera de autenticación y datos)
- **Animaciones**: Framer Motion (Transiciones fluidas)
- **Iconos**: Lucide React
- **Comunicación**: Axios

### Backend
- **Runtime**: Node.js v20+
- **Framework**: Express.js (TypeScript)
- **Seguridad**: JWT (JSON Web Tokens), Bcryptjs, Helmet, CORS
- **Persistencia**: Prisma ORM
- **Servicios**:
  - Emails: Azure Communication Services
  - Archivos: Sistema de archivos local (volúmenes de contenedor)
  - Reportes: ExcelJS, PDFKit

---

## 4. Funcionalidades Principales

### 4.1 Gestión Presupuestal
- Control de presupuestos por **Proyecto** y **Área**.
- **Ajustes Presupuestales**: Módulo exclusivo para el rol `DIRECTOR` que permite trasladar fondos entre presupuestos para cubrir imprevistos.
- Visualización de ejecución en tiempo real (Disponible vs Ejecutado).

### 4.2 Requerimientos de Compra
- Formulario de creación con adjuntos técnicos (PDF, Imágenes).
- **Flujo de Aprobación**: Dependiendo del rol y monto, las solicitudes pasan por estados (Pendiente, Aprobado, Rechazado).
- **Seguimiento de Pagos**: Registro de múltiples pagos por requerimiento. El sistema actualiza automáticamente el estado de adquisición a `FINALIZADO` cuando el pago total cubre el monto del requerimiento.

### 4.3 Reportes y Auditoría
- Generación de reportes dinámicos en Excel para exportación de datos contables.
- Historial de cambios (`HistoryLog`) por cada requerimiento para auditoría interna.

### 4.4 Sistema de Notificaciones
- Notificaciones internas en la campana del dashboard.
- Notificaciones vía email para cambios críticos de estado (Aprobaciones/Rechazos).

---

## 5. Roles y Permisos (RBAC)

1. **ADMIN (Administrador del Sistema)**: Acceso total, gestión de usuarios, catálogos (Proveedores, Áreas, Proyectos) y configuración técnica.
2. **DIRECTOR (Coordinación de Compras)**: Supervisión global de presupuestos, realización de ajustes presupuestales y aprobación de montos críticos.
3. **LEADER (Líder de Área)**: Gestión de presupuestos asignados a su área, creación de requerimientos y aprobación de solicitudes de su equipo.
4. **USER (Personal)**: Creación de requerimientos básicos y seguimiento de sus propias solicitudes.

---

## 6. Despliegue y Mantenimiento

### CI/CD (Integración y Entrega Continua)
El despliegue está automatizado mediante **GitHub Actions**:
- **Triggers**: Push a la rama `main`.
- **Proceso**:
    1. Construcción de imágenes Docker (Backend y Frontend).
    2. Envío a **Azure Container Registry (ACR)**.
    3. Actualización de los **Azure App Services**.

### Variables de Entorno Críticas (Backend)
- `DATABASE_URL`: Conexión a la base de datos PostgreSQL en Azure.
- `JWT_SECRET`: Llave para encriptación de tokens.
- `FRONTEND_URL`: URL oficial de la aplicación (usada para los enlaces en los correos).
- `AZURE_COMMUNICATION_CONNECTION_STRING`: Credencial para el servicio de envío de correos.

---

## 7. Mantenimiento de Archivos
- Los archivos adjuntos se almacenan en el directorio `/app/uploads` dentro del contenedor.
- El sistema cuenta con lógica de limpieza automática: al eliminar un requerimiento, se borran físicamente los archivos asociados para optimizar el almacenamiento.

---
*Última actualización: 28 de diciembre de 2024*
