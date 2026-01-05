# MIS COMPRAS - Sistema de Gestión de Compras

<p align="center">
  <img src="frontend/public/images/logo-museo.png" alt="Museo de Antioquia" width="120" />
</p>

<p align="center">
  <strong>Sistema integral de gestión de requerimientos, presupuestos y compras</strong><br>
  Desarrollado para el Museo de Antioquia
</p>

---

## 📋 Descripción

**MIS COMPRAS** es una aplicación web empresarial diseñada para gestionar el ciclo completo de compras institucionales, desde la solicitud de requerimientos hasta el pago de facturas. Incluye control presupuestal, flujos de aprobación multinivel, y reportes ejecutivos.

---

## 🚀 Características Principales

### Módulos del Sistema

| Módulo | Descripción |
|--------|-------------|
| **Dashboard** | Panel principal con estadísticas y accesos rápidos |
| **Requerimientos** | Creación, seguimiento y gestión de solicitudes de compra |
| **Presupuestos** | Control de rubros presupuestales por proyecto y área |
| **Aprobaciones** | Flujo de aprobación multinivel (Coordinador → Director) |
| **Proveedores** | Catálogo de proveedores y análisis de compras |
| **Facturas** | Gestión de facturas y pagos parciales |
| **Informes** | Dashboard ejecutivo con KPIs y gráficos interactivos |
| **Administración** | Gestión de usuarios, áreas, proyectos y categorías |

### Funcionalidades Clave

- ✅ Autenticación JWT con roles y permisos
- ✅ Flujo de aprobación de 2 niveles (Coordinador + Director)
- ✅ Generación automática de PDFs para solicitudes
- ✅ Control presupuestal con validación de saldo
- ✅ Notificaciones por email y en la aplicación
- ✅ Adjuntos de archivos (Azure Blob Storage)
- ✅ Reportes con gráficos interactivos (Recharts)
- ✅ Modo oscuro / claro
- ✅ Diseño responsive

---

## 🛠️ Stack Tecnológico

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **ORM**: Prisma
- **Base de Datos**: PostgreSQL (Azure Database)
- **Autenticación**: JWT + bcrypt
- **Almacenamiento**: Azure Blob Storage
- **Email**: Nodemailer (SMTP)
- **PDF**: PDFKit

### Frontend
- **Framework**: Next.js 14 (App Router)
- **UI**: React 18 + Tailwind CSS
- **Animaciones**: Framer Motion
- **Gráficos**: Recharts
- **Iconos**: Lucide React
- **Estado**: Zustand
- **HTTP Client**: Axios

### Infraestructura
- **Hosting**: Azure App Service
- **CI/CD**: GitHub Actions
- **Contenedores**: Docker

---

## 📁 Estructura del Proyecto

```
miscompras-app/
├── backend/
│   ├── src/
│   │   ├── controllers/      # Lógica de endpoints
│   │   ├── middlewares/      # Auth, validación
│   │   ├── routes/           # Definición de rutas
│   │   ├── services/         # Servicios (email, PDF, blob)
│   │   └── index.ts          # Entry point
│   ├── prisma/
│   │   └── schema.prisma     # Modelos de datos
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── app/              # Páginas (App Router)
│   │   ├── components/       # Componentes reutilizables
│   │   ├── lib/              # Utilidades (API, formatters)
│   │   └── store/            # Estado global (Zustand)
│   └── package.json
│
├── docker-compose.yml
├── .github/workflows/        # CI/CD pipelines
└── README.md
```

---

## 🔧 Instalación Local

### Prerrequisitos
- Node.js 18+
- PostgreSQL 14+
- Git

### 1. Clonar el repositorio
```bash
git clone https://github.com/dairon2/miscompras-app.git
cd miscompras-app
```

### 2. Configurar Backend
```bash
cd backend
npm install

# Crear archivo .env
cp .env.example .env
# Editar .env con tus credenciales

# Generar cliente Prisma
npx prisma generate

# Aplicar migraciones
npx prisma migrate dev

# Iniciar servidor
npm run dev
```

### 3. Configurar Frontend
```bash
cd frontend
npm install

# Crear archivo .env.local
echo "NEXT_PUBLIC_API_URL=http://localhost:4000/api" > .env.local

# Iniciar aplicación
npm run dev
```

### 4. Acceder
- Frontend: http://localhost:3000
- Backend API: http://localhost:4000/api
- Health Check: http://localhost:4000/health

---

## 🔐 Variables de Entorno

### Backend (.env)
```env
# Database
DATABASE_URL="postgresql://user:password@host:5432/database"

# Authentication
JWT_SECRET="your-secret-key"

# Azure Blob Storage
AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;..."
AZURE_STORAGE_CONTAINER="pdfs"

# Email (SMTP)
SMTP_HOST="smtp.office365.com"
SMTP_PORT=587
SMTP_USER="no-reply@example.com"
SMTP_PASS="your-password"

# General
PORT=4000
CORS_ORIGIN="http://localhost:3000"
BACKEND_URL="http://localhost:4000"
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

---

## 📊 Modelo de Datos

### Entidades Principales

```mermaid
erDiagram
    User ||--o{ Requirement : creates
    User ||--o{ Budget : manages
    Requirement }o--|| Project : belongs_to
    Requirement }o--|| Area : belongs_to
    Requirement }o--|| Budget : uses
    Requirement }o--|| Supplier : has
    Requirement ||--o{ Attachment : has
    Requirement ||--o{ Invoice : has
    Requirement ||--o{ HistoryLog : has
    Budget }o--|| Project : belongs_to
    Budget }o--|| Area : belongs_to
    Budget }o--|| Category : has
    RequirementGroup ||--o{ Requirement : contains
```

### Roles de Usuario

| Rol | Permisos |
|-----|----------|
| `USER` | Crear requerimientos, ver propios |
| `COORDINATOR` | Aprobar nivel 1, ver de su área |
| `DIRECTOR` | Aprobar nivel 2, ver todos |
| `ADMIN` | Acceso total, gestión de usuarios |
| `AUDITOR` | Solo lectura de reportes |
| `DEVELOPER` | Acceso total (desarrollo) |

---

## 🔌 API Endpoints

### Autenticación
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/auth/login` | Iniciar sesión |
| POST | `/api/auth/register` | Registrar usuario |
| GET | `/api/auth/me` | Obtener usuario actual |

### Requerimientos
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/requirements` | Listar requerimientos |
| GET | `/api/requirements/:id` | Detalle de requerimiento |
| POST | `/api/requirements` | Crear requerimiento |
| PUT | `/api/requirements/:id` | Actualizar requerimiento |
| PATCH | `/api/requirements/:id/status` | Cambiar estado |

### Presupuestos
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/budgets` | Listar presupuestos |
| GET | `/api/budgets/:id` | Detalle de presupuesto |
| POST | `/api/budgets` | Crear presupuesto |
| PUT | `/api/budgets/:id` | Actualizar presupuesto |

### Reportes
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/reports/executive-summary` | Resumen ejecutivo |
| GET | `/api/reports/budget-execution/project` | Ejecución por proyecto |
| GET | `/api/reports/requirements-by-status` | Por estado |
| GET | `/api/reports/top-suppliers` | Top proveedores |
| GET | `/api/reports/monthly-trend` | Tendencia mensual |

---

## 🚢 Despliegue

### Docker
```bash
docker-compose up --build
```

### Azure App Service
El proyecto incluye GitHub Actions para despliegue automático:
- Push a `main` → Despliegue a producción
- Push a `develop` → Despliegue a staging

---

## 🧪 Testing

```bash
# Backend tests
cd backend
npm run test

# Frontend tests
cd frontend
npm run test
```

---

## 📄 Licencia

Este proyecto es propiedad del **Museo de Antioquia**. Todos los derechos reservados.

---

## 👥 Equipo de Desarrollo

- **Desarrollo**: Dairon García
- **Fecha**: Enero 2026

---

## 📞 Soporte

Para soporte técnico, contactar a:
- Email: soporte@museodeantioquia.co
- Interno: Ext. 123
