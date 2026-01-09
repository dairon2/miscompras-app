"use strict";
/**
 * Logger## 1. Arquitectura y Código
### Hallazgos
- **Híbrido Moderno**: Uso de Next.js (App Router) y Node.js con Prisma es una elección excelente y actual.
- **Separación de Responsabilidades**: Existen servicios dedicados para Email, PDF y Almacenamiento, lo cual es muy profesional.
- **Lógica en el Punto de Entrada**: Se detectó lógica de negocio y rutas directamente en `index.ts`. Se recomienda mover esto a controladores para mantener el código limpio.
- **Validación**: Falta un uso sistemático de validación de esquemas (como Zod) en todos los puntos de entrada de la API para prevenir datos corruptos.

## 2. Seguridad y Cumplimiento
### Hallazgos
- **Riesgo Crítico (Mock Token)**: Existe un token de prueba hardcodeado en el middleware de autenticación. Debe eliminarse o protegerse con banderas de entorno.
- **Almacenamiento de Tokens**: El JWT se guarda en `localStorage` en el frontend. Para máxima seguridad profesional (evitar XSS), es preferible usar Cookies `HttpOnly`.
- **Habeas Data (Colombia)**: El sistema maneja datos personales (nombres, correos, NIT). Cumple técnicamente, pero se debe añadir una política de términos y condiciones visible en el registro.
- **Integridad Financiera**: Uso correcto de tipos `Decimal` en base de datos para evitar errores de redondeo en pesos.

## 3. Calidad y Mantenibilidad
### Hallazgos
- **Observabilidad**: El sistema usa `console.log`. Se recomienda implementar **Azure Application Insights** o Winston para tener trazabilidad real de errores en producción.
- **Pruebas Automatizadas**: Existe una carpeta de tests, pero la cobertura de las reglas de negocio críticas (como los horarios de envío y festivos) parece baja.
- **Plantillas de Email**: Están escritas directamente en el código. Usar un motor de plantillas (Handlebars) facilitaría el diseño sin tocar lógica.

## 4. Propuestas de Valor (Roadmap)
Para subir el nivel y dar más valor al negocio:

### A. Inteligencia Artificial (IA)
- **OCR de Facturas**: Integrar **Azure AI Document Intelligence** para leer automáticamente el PDF de la factura y llenar los campos (Monto, NIT, Fecha) sin que el usuario escriba nada.

### B. Flujos de Aprobación Avanzados
- **Delegación**: Permitir que un Director delegue su firma a un Coordinador por un tiempo limitado (ej. por vacaciones).
- **Notificaciones Push**: Notificaciones directas al navegador para aprobaciones urgentes.

### C. Análisis y Reportes
- **Dashboard de Ahorro**: Gráficos que comparen presupuesto proyectado vs ejecutado real con alertas de desviación.
- **Integración Power BI**: Un endpoint dedicado para que gerencia pueda conectar sus tableros de control directamente a la base de datos de Miscompras.

### D. Firma Digital
- Integrar servicios de firma electrónica para que los documentos PDF generados tengan validez legal completa.
*/
Object.defineProperty(exports, "__esModule", { value: true });
const isDev = process.env.NODE_ENV !== 'production';
const logger = {
    info: (message, ...args) => {
        console.log(`[INFO] ${message}`, ...args);
    },
    warn: (message, ...args) => {
        console.warn(`[WARN] ${message}`, ...args);
    },
    error: (message, ...args) => {
        console.error(`[ERROR] ${message}`, ...args);
    },
    debug: (message, ...args) => {
        if (isDev) {
            console.log(`[DEBUG] ${message}`, ...args);
        }
    },
    // Service-specific loggers
    pdf: (message, ...args) => {
        console.log(`[PDF Service] ${message}`, ...args);
    },
    blob: (message, ...args) => {
        console.log(`[Blob Storage] ${message}`, ...args);
    },
    email: (message, ...args) => {
        console.log(`[Email Service] ${message}`, ...args);
    },
    db: (message, ...args) => {
        console.log(`[Database] ${message}`, ...args);
    }
};
exports.default = logger;
