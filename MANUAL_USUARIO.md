# 📘 Manual de Usuario - MIS COMPRAS

<p align="center">
  <img src="frontend/public/images/logo-museo.png" alt="Museo de Antioquia" width="100" />
</p>

<p align="center">
  <strong>Sistema de Gestión de Compras</strong><br>
  Museo de Antioquia
</p>

---

## 📑 Tabla de Contenidos

1. [Introducción](#introducción)
2. [Acceso al Sistema](#acceso-al-sistema)
3. [Panel Principal (Dashboard)](#panel-principal-dashboard)
4. [Gestión de Requerimientos](#gestión-de-requerimientos)
5. [Presupuestos](#presupuestos)
6. [Aprobaciones](#aprobaciones)
7. [Proveedores](#proveedores)
8. [Facturas](#facturas)
9. [Informes Financieros](#informes-financieros)
10. [Configuración de Cuenta](#configuración-de-cuenta)
11. [Preguntas Frecuentes](#preguntas-frecuentes)

---

## Introducción

**MIS COMPRAS** es el sistema oficial para gestionar todas las solicitudes de compra del Museo de Antioquia. Este manual te guiará paso a paso en el uso de todas las funcionalidades disponibles.

### ¿Qué puedes hacer?

- ✅ Crear solicitudes de compra (requerimientos)
- ✅ Adjuntar cotizaciones y documentos
- ✅ Seguir el estado de tus solicitudes
- ✅ Ver el presupuesto disponible
- ✅ Aprobar o rechazar solicitudes (según tu rol)
- ✅ Consultar reportes financieros

---

## Acceso al Sistema

### Iniciar Sesión

1. Abre tu navegador web
2. Ingresa a la dirección: **https://miscompras.museodeantioquia.co**
3. Ingresa tu **correo electrónico** institucional
4. Ingresa tu **contraseña**
5. Haz clic en **"Iniciar Sesión"**

> 💡 **Tip:** Si olvidaste tu contraseña, contacta al administrador del sistema.

### Registro de Nuevo Usuario

Si eres nuevo en el sistema:

1. En la pantalla de inicio, haz clic en **"Registrarse"**
2. Completa el formulario:
   - Nombre completo
   - Correo electrónico institucional
   - Contraseña (mínimo 8 caracteres)
   - Selecciona tu **Área**
3. Haz clic en **"Crear Cuenta"**
4. Espera la aprobación del administrador

---

## Panel Principal (Dashboard)

Al ingresar, verás el **Dashboard** con:

### Tarjetas de Estadísticas
- **Requerimientos del Mes**: Total de solicitudes creadas
- **Aprobados**: Solicitudes aprobadas
- **Pendientes**: Solicitudes en espera de aprobación
- **Rechazados**: Solicitudes rechazadas

### Acciones Rápidas
- **Nueva Solicitud**: Crear un nuevo requerimiento
- **Ver Todas**: Ir a la lista completa de requerimientos

### Últimas Solicitudes
Tabla con tus solicitudes más recientes, mostrando:
- Título
- Estado (color indicador)
- Fecha de creación

---

## Gestión de Requerimientos

### Crear un Nuevo Requerimiento

1. Haz clic en **"Nueva Solicitud"** en el Dashboard o en el menú
2. Completa el formulario:

| Campo | Descripción | Obligatorio |
|-------|-------------|-------------|
| Título | Nombre breve de lo que necesitas | ✅ Sí |
| Descripción | Detalle de la solicitud | ✅ Sí |
| Cantidad | Número de unidades | ❌ No |
| Proyecto | Proyecto al que pertenece | ✅ Sí |
| Área | Tu área de trabajo | ✅ Sí |
| Presupuesto | Rubro presupuestal a afectar | ❌ No |
| Proveedor Sugerido | Si tienes un proveedor en mente | ❌ No |

3. **Adjunta documentos** (cotizaciones, especificaciones)
   - Haz clic en **"Adjuntar Archivos"**
   - Selecciona los archivos (PDF, imágenes, Excel)
   - Máximo 10 MB por archivo

4. Haz clic en **"Enviar Solicitud"**

> ⚠️ **Importante:** Una vez enviada, la solicitud pasa a estado **"Pendiente de Aprobación"** y no puede ser editada hasta que sea procesada.

### Estados del Requerimiento

| Estado | Significado | Color |
|--------|-------------|-------|
| 📝 Borrador | Aún no enviado | Gris |
| ⏳ Pendiente | Esperando aprobación | Amarillo |
| ✅ Aprobado | Aprobado por Coordinador y Director | Verde |
| ❌ Rechazado | No aprobado | Rojo |
| 🛒 En Compra | En proceso de adquisición | Azul |
| 📦 Recibido | Producto/Servicio recibido | Verde oscuro |
| 💰 Pagado | Factura pagada | Verde brillante |

### Ver Detalle de un Requerimiento

1. En la lista de requerimientos, haz clic sobre el título
2. Verás:
   - Información general
   - Estado actual
   - Historial de cambios
   - Archivos adjuntos
   - Comentarios de aprobación/rechazo

### Editar un Requerimiento

Solo puedes editar si:
- Eres el creador
- El estado es **Borrador** o fue **Rechazado**

Para editar:
1. Abre el detalle del requerimiento
2. Haz clic en **"Editar"**
3. Modifica los campos necesarios
4. Haz clic en **"Guardar Cambios"**

---

## Presupuestos

### Ver Presupuestos Disponibles

1. En el menú, haz clic en **"Presupuesto"**
2. Selecciona el **Año** usando el selector
3. Verás una lista de rubros presupuestales con:
   - Nombre del rubro
   - Proyecto asociado
   - Monto presupuestado
   - Monto ejecutado
   - Saldo disponible
   - Barra de progreso visual

### Entender los Colores

| Color | Significado |
|-------|-------------|
| 🟢 Verde | Menos del 50% ejecutado |
| 🟡 Amarillo | Entre 50% y 80% ejecutado |
| 🔴 Rojo | Más del 80% ejecutado |

### Solicitar un Ajuste Presupuestal

Si necesitas más presupuesto:

1. En la pantalla de Presupuestos, haz clic en **"Solicitar Ajuste"**
2. Selecciona:
   - **Tipo**: Aumento o Movimiento entre rubros
   - **Rubro destino**: Donde necesitas el dinero
   - **Monto solicitado**
   - **Justificación** (obligatoria)
3. Haz clic en **"Enviar Solicitud"**

> 📌 Los ajustes requieren aprobación de Dirección.

---

## Aprobaciones

### ¿Quién puede aprobar?

| Rol | Nivel de Aprobación |
|-----|---------------------|
| Coordinador | Primera aprobación (Nivel 1) |
| Director | Aprobación final (Nivel 2) |
| Administrador | Ambos niveles |

### Aprobar Solicitudes

1. En el menú, haz clic en **"Aprobaciones"**
2. Verás dos secciones:
   - **Requerimientos Pendientes**
   - **Ajustes Pendientes**
3. Haz clic en el grupo o solicitud que deseas revisar
4. Lee los detalles y archivos adjuntos
5. Decide tu acción:

**Para Aprobar:**
1. Haz clic en **"Aprobar"**
2. Escribe un comentario (opcional pero recomendado)
3. Haz clic en **"Confirmar"**

**Para Rechazar:**
1. Haz clic en **"Rechazar"**
2. Escribe el **motivo del rechazo** (obligatorio)
3. Haz clic en **"Confirmar"**

> 💡 El solicitante recibirá una notificación por email con tu decisión.

---

## Proveedores

### Ver Catálogo de Proveedores

1. En el menú, haz clic en **"Proveedores"**
2. Verás una lista con:
   - Nombre del proveedor
   - NIT
   - Contacto
   - Total de compras históricas

### Ver Detalle de Proveedor

1. Haz clic sobre el nombre del proveedor
2. Verás:
   - Información de contacto completa
   - Historial de requerimientos con ese proveedor
   - Facturas asociadas
   - Estadísticas de compras

---

## Facturas

### Registrar una Factura

1. En el menú, haz clic en **"Facturas"**
2. Haz clic en **"Nueva Factura"**
3. Completa:
   - Número de factura
   - Proveedor
   - Requerimiento asociado
   - Monto
   - Fecha de emisión
   - Fecha de vencimiento
   - Adjuntar PDF de la factura
4. Haz clic en **"Guardar"**

### Estados de Factura

| Estado | Significado |
|--------|-------------|
| 📥 Recibida | Factura registrada |
| ✔️ Verificada | Validada por compras |
| ✅ Aprobada | Aprobada para pago |
| 💰 Pagada | Pago realizado |

### Registrar un Pago

1. Abre el detalle de la factura
2. Haz clic en **"Registrar Pago"**
3. Ingresa:
   - Monto del pago
   - Fecha del pago
   - Comprobante (opcional)
4. Haz clic en **"Confirmar"**

> 📌 Puedes registrar pagos parciales si la factura se paga en cuotas.

---

## Informes Financieros

### Acceder a Informes

1. En el menú, haz clic en **"Informes"**
2. Selecciona el **Año** a consultar

### Panel Ejecutivo

Verás 4 tarjetas principales:
- **Presupuesto Total**: Suma de todos los rubros
- **Ejecutado**: Monto ya comprometido/pagado
- **Disponible**: Saldo restante
- **Requerimientos**: Total de solicitudes

### Pestañas de Información

#### Resumen General
- **Gráfico de Dona**: Requerimientos por estado
- **Gráfico de Línea**: Tendencia mensual de compras

#### Ejecución Presupuestal
- **Gráfico de Barras**: Comparativo Presupuestado vs Ejecutado por proyecto

#### Proveedores
- **Tabla**: Top 10 proveedores con mayor volumen de compras

---

## Configuración de Cuenta

### Acceder a tu Perfil

1. Haz clic en tu **nombre/foto** en la esquina superior derecha
2. Selecciona **"Mi Cuenta"**

### Cambiar Contraseña

1. En tu perfil, haz clic en **"Cambiar Contraseña"**
2. Ingresa tu contraseña actual
3. Ingresa la nueva contraseña (2 veces)
4. Haz clic en **"Guardar"**

### Cambiar Tema (Modo Oscuro)

1. Haz clic en tu perfil
2. Busca la opción **"Tema"**
3. Selecciona:
   - ☀️ Claro
   - 🌙 Oscuro
   - 💻 Sistema (automático)

---

---

## 12. Asistente Virtual Inteligente (IA)

MIS COMPRAS integra un potente **Asistente Virtual** basado en Inteligencia Artificial (Google Gemini) que te ayuda a realizar tareas complejas usando lenguaje natural.

### ¿Cómo acceder?
Haz clic en el botón flotante ✨ (chispas mágicas) ubicado en la esquina inferior derecha de la pantalla.

### Funcionalidades del Asistente
El asistente conoce tu contexto y puede realizar las siguientes acciones:

> **Seguridad:** las operaciones que crean, aprueban, asignan o envían información muestran una tarjeta con los datos exactos. Nada cambia hasta seleccionar **Confirmar**. El botón **Cancelar** descarta la operación.

#### 1. 📧 Envío de Correos a Proveedores
Puedes pedirle al bot que contacte a un proveedor directamente.
- **Ejemplo**: *"Envía un correo a Papelería S.A.S solicitando cotización de resmas de papel"*
- **Confirmación**: El bot mostrará destinatario y propósito en una tarjeta firmada antes de enviar nada.
- **Contexto**: Si dices *"envía un correo a este proveedor"* mientras ves un requerimiento, ¡el bot sabrá a quién te refieres!

#### 2. 🔍 Búsqueda de Proveedores
Encuentra rápidamente proveedores por nombre o actividad económica.
- **Por Nombre**: *"Busca el proveedor DistriHogar"*
- **Por Actividad**: *"Necesito proveedores de tecnología"*
- **Resultado**: El bot te mostrará una lista con nombre, NIT, email y criticidad.

#### 3. 🚚 Verificación de Entregas
Consulta qué pedidos están pendientes de llegar.
- **Ejemplo**: *"¿Qué entregas tengo pendientes?"* o *"¿Falta algo por recibir?"*
- **Resultado**: Lista de requerimientos aprobados que aún no tienen fecha de recepción registrada.

#### 4. 📊 Consultas y Reportes
- *"¿Cuánto presupuesto me queda en el proyecto Colores de la Montaña?"*
- *"Descarga un reporte del proyecto [Nombre]"* (Genera Excel automático)

#### 5. 🧾 Facturas y Anticipos
- *"Busca la factura FE-1234"*
- *"¿Cuál es el estado del anticipo 4634?"*
- Los resultados respetan el alcance del rol y enlazan directamente al registro.

> **Nota:** El asistente utiliza proveedores alternativos ante fallos recuperables. Siempre verifica la información crítica antes de tomar decisiones financieras.

---

## 13. Soporte Técnico

Si tienes problemas con el sistema, cuentas con un plan de soporte dedicado:

### Horario de Atención Prioritaria
**Lunes a Viernes, 7:30 a.m. - 9:50 a.m.**

### Canales de Contacto
- **Email**: soporte@museodeantioquia.co
- **WhatsApp Institucional**: [Número de contacto]
- **Soporte Remoto**: Vía AnyDesk o Microsoft Teams

### Tiempos de Respuesta (SLA)
- **Críticos (Bloqueantes)**: Respuesta inmediata, solución < 2 horas.
- **Medios/Menores**: Respuesta < 2 horas, solución < 24 horas.

---

<p align="center">
  <em>MIS COMPRAS v1.0 - Museo de Antioquia © 2026</em>
</p>
