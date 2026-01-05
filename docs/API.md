# 🔌 API Documentation - MIS COMPRAS

## Base URL

```
Producción: https://miscompras-api-prod.azurewebsites.net/api
Desarrollo: http://localhost:4000/api
```

## Autenticación

Todas las rutas protegidas requieren el header:

```
Authorization: Bearer <token>
```

El token se obtiene al hacer login.

---

## 🔐 Auth Endpoints

### POST /auth/login

Iniciar sesión.

**Request Body:**
```json
{
  "email": "usuario@museo.co",
  "password": "contraseña123"
}
```

**Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "usuario@museo.co",
    "name": "Juan Pérez",
    "role": "USER",
    "area": { "id": "uuid", "name": "Comunicaciones" }
  }
}
```

### POST /auth/register

Registrar nuevo usuario.

**Request Body:**
```json
{
  "email": "nuevo@museo.co",
  "password": "contraseña123",
  "name": "María García",
  "areaId": "uuid"
}
```

### GET /auth/me

Obtener usuario autenticado.

**Response (200):**
```json
{
  "id": "uuid",
  "email": "usuario@museo.co",
  "name": "Juan Pérez",
  "role": "USER",
  "area": { "id": "uuid", "name": "Comunicaciones" },
  "createdAt": "2024-01-15T10:30:00Z"
}
```

---

## 📋 Requirements Endpoints

### GET /requirements

Listar requerimientos.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| year | number | Filtrar por año (default: actual) |
| status | string | Filtrar por estado |
| projectId | string | Filtrar por proyecto |
| areaId | string | Filtrar por área |
| page | number | Número de página |
| limit | number | Resultados por página |

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Compra de laptop",
      "description": "Laptop para diseño gráfico",
      "status": "PENDING_APPROVAL",
      "createdAt": "2024-01-15T10:30:00Z",
      "project": { "id": "uuid", "name": "Proyecto X" },
      "area": { "id": "uuid", "name": "Diseño" },
      "createdBy": { "id": "uuid", "name": "Juan Pérez" }
    }
  ],
  "total": 100,
  "page": 1,
  "limit": 10
}
```

### GET /requirements/:id

Obtener detalle de requerimiento.

**Response (200):**
```json
{
  "id": "uuid",
  "title": "Compra de laptop",
  "description": "Laptop para diseño gráfico",
  "quantity": "1",
  "status": "APPROVED",
  "procurementStatus": "IN_PROCESS",
  "estimatedAmount": 5000000,
  "actualAmount": 4800000,
  "project": { "id": "uuid", "name": "Proyecto X" },
  "area": { "id": "uuid", "name": "Diseño" },
  "budget": { "id": "uuid", "title": "Equipos de Cómputo" },
  "supplier": { "id": "uuid", "name": "TechStore" },
  "createdBy": { "id": "uuid", "name": "Juan Pérez" },
  "attachments": [
    { "id": "uuid", "fileName": "cotizacion.pdf", "fileUrl": "https://..." }
  ],
  "logs": [
    { "id": "uuid", "action": "CREATED", "details": "...", "createdAt": "..." }
  ],
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-16T14:00:00Z"
}
```

### POST /requirements

Crear requerimiento.

**Request (multipart/form-data):**
| Field | Type | Required |
|-------|------|----------|
| title | string | ✅ |
| description | string | ✅ |
| quantity | string | ❌ |
| projectId | string | ✅ |
| areaId | string | ✅ |
| budgetId | string | ❌ |
| supplierId | string | ❌ |
| manualSupplierName | string | ❌ |
| suggestedSupplier | string | ❌ |
| attachments | File[] | ❌ |

**Response (201):**
```json
{
  "id": "uuid",
  "title": "Compra de laptop",
  "status": "PENDING_APPROVAL",
  "groupId": 123,
  "createdAt": "2024-01-15T10:30:00Z"
}
```

### PUT /requirements/:id

Actualizar requerimiento.

### PATCH /requirements/:id/status

Cambiar estado del requerimiento.

**Request Body:**
```json
{
  "status": "APPROVED",
  "procurementStatus": "IN_PROCESS",
  "remarks": "Aprobado por cumplir requisitos",
  "receivedAtSatisfaction": true
}
```

---

## 💰 Budgets Endpoints

### GET /budgets

Listar presupuestos.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| year | number | Año fiscal |
| projectId | string | Filtrar por proyecto |
| areaId | string | Filtrar por área |

**Response (200):**
```json
[
  {
    "id": "uuid",
    "title": "Equipos de Cómputo",
    "code": "EC-001",
    "amount": 50000000,
    "available": 35000000,
    "year": 2024,
    "project": { "id": "uuid", "name": "Proyecto X" },
    "area": { "id": "uuid", "name": "Sistemas" },
    "category": { "id": "uuid", "name": "Tecnología", "code": "TEC" }
  }
]
```

### POST /budgets

Crear presupuesto.

### PUT /budgets/:id

Actualizar presupuesto.

### POST /budgets/:id/approve

Aprobar presupuesto (requiere rol DIRECTOR o ADMIN).

---

## ✅ Approvals Endpoints

### GET /requirements/groups

Obtener grupos de requerimientos pendientes de aprobación.

**Response (200):**
```json
[
  {
    "id": 123,
    "creator": { "id": "uuid", "name": "Juan Pérez", "email": "juan@museo.co" },
    "createdAt": "2024-01-15T10:30:00Z",
    "requirements": [
      { "id": "uuid", "title": "Laptop", "status": "PENDING_APPROVAL" }
    ]
  }
]
```

### POST /requirements/group/:id/approve

Aprobar grupo de requerimientos.

**Request Body:**
```json
{
  "comments": "Aprobado según política de compras"
}
```

### POST /requirements/group/:id/reject

Rechazar grupo de requerimientos.

**Request Body:**
```json
{
  "comments": "Rechazado por falta de cotizaciones"
}
```

---

## 📊 Reports Endpoints

### GET /reports/executive-summary

Resumen ejecutivo.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| year | number | Año fiscal |
| projectId | string | Filtrar por proyecto |
| areaId | string | Filtrar por área |

**Response (200):**
```json
{
  "budget": {
    "total": 500000000,
    "executed": 150000000,
    "available": 350000000,
    "executionPercentage": 30
  },
  "requirements": {
    "total": 150,
    "pending": 25,
    "approved": 100,
    "rejected": 25
  },
  "invoices": {
    "total": 80,
    "totalAmount": 120000000,
    "paid": 60,
    "pending": 20
  },
  "year": 2024
}
```

### GET /reports/budget-execution/project

Ejecución presupuestal por proyecto.

**Response (200):**
```json
[
  {
    "id": "uuid",
    "name": "Proyecto Museo Digital",
    "code": "PMD-001",
    "budgeted": 100000000,
    "executed": 45000000,
    "available": 55000000,
    "percentage": "45.0"
  }
]
```

### GET /reports/requirements-by-status

Requerimientos agrupados por estado.

**Response (200):**
```json
[
  { "status": "PENDING_APPROVAL", "count": 25, "label": "Pendiente" },
  { "status": "APPROVED", "count": 100, "label": "Aprobado" },
  { "status": "REJECTED", "count": 25, "label": "Rechazado" }
]
```

### GET /reports/top-suppliers

Top proveedores por volumen de compras.

**Query Parameters:**
| Param | Type | Default |
|-------|------|---------|
| year | number | Actual |
| limit | number | 10 |

**Response (200):**
```json
[
  {
    "id": "uuid",
    "name": "TechStore S.A.S",
    "nit": "900123456-7",
    "totalPurchases": 85000000,
    "orderCount": 15
  }
]
```

### GET /reports/monthly-trend

Tendencia mensual de compras.

**Response (200):**
```json
[
  { "month": "Ene", "monthIndex": 0, "count": 12, "amount": 15000000 },
  { "month": "Feb", "monthIndex": 1, "count": 18, "amount": 22000000 }
]
```

---

## 🧾 Invoices Endpoints

### GET /invoices

Listar facturas.

### GET /invoices/:id

Detalle de factura.

### POST /invoices

Crear factura.

**Request (multipart/form-data):**
| Field | Type | Required |
|-------|------|----------|
| invoiceNumber | string | ✅ |
| requirementId | string | ✅ |
| supplierId | string | ✅ |
| amount | number | ✅ |
| issueDate | date | ✅ |
| dueDate | date | ❌ |
| file | File | ✅ |

### PATCH /invoices/:id/status

Cambiar estado de factura.

---

## 🔔 Notifications Endpoints

### GET /notifications

Obtener notificaciones del usuario.

**Response (200):**
```json
[
  {
    "id": "uuid",
    "title": "Solicitud Aprobada",
    "message": "Tu requerimiento 'Laptop' fue aprobado",
    "type": "APPROVAL",
    "isRead": false,
    "requirementId": "uuid",
    "createdAt": "2024-01-16T14:00:00Z"
  }
]
```

### PATCH /notifications/:id/read

Marcar notificación como leída.

### PATCH /notifications/read-all

Marcar todas las notificaciones como leídas.

---

## ⚠️ Códigos de Error

| Código | Significado |
|--------|-------------|
| 400 | Bad Request - Datos inválidos |
| 401 | Unauthorized - Token inválido o expirado |
| 403 | Forbidden - Sin permisos para esta acción |
| 404 | Not Found - Recurso no encontrado |
| 500 | Internal Server Error - Error del servidor |

**Formato de Error:**
```json
{
  "error": "Descripción del error",
  "details": "Información adicional (solo en desarrollo)"
}
```

---

## 📝 Notas

- Todos los timestamps están en formato ISO 8601 (UTC)
- Los montos están en pesos colombianos (COP) sin decimales
- Los IDs son UUIDs v4
- El límite de tamaño de archivos es 10 MB
