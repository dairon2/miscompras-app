
export const SYSTEM_FAQ = `
CENTRO DE AYUDA Y REGLAS DE NEGOCIO:

1. REQUERIMIENTOS:
- Creación: 'Solicitudes' -> 'Nueva Solicitud'. Se descuenta del presupuesto seleccionado.
- Estados: 
  * PENDIENTE_APROBACIÓN: Esperando aprobación de Coordinación y Finanzas.
  * APROBADO: Listo para gestión de compras.
  * EN_TRÁMITE: Gestión en curso.
  * ENTREGADO: Producto/servicio recibido.
  * FINALIZADO: Confirmado recibido a satisfacción por el usuario.
- Edición: No se pueden editar tras enviar.
- Confirmar Recibido: En detalle del requerimiento (estado ENTREGADO), panel verde 'Confirmar Recibido'. Requerido comentario.

2. PRESUPUESTOS:
- Funcionamiento: Monto asignado vs Saldo disponible. Al aprobar req, se descuenta.
- Ajustes: INCREMENTO (agregar) o TRANSFERENCIA (mover entre presupuestos). Requieren aprobación Financiera.
- Visibilidad: Líderes y Sublíderes ven sus presupuestos. Admin ve todos.
- Aprobación de Asignación (USER): Los usuarios deben "Aceptar" la responsabilidad de los presupuestos asignados por el Director. Esto se hace en 'Presupuestos' -> 'Pendientes por Aprobar' (/budget/pending).

3. PAGOS Y FACTURAS:
- Facturas: Se registran en el módulo Facturas y pueden vincularse con requerimiento, presupuesto y anticipo.
- Conciliación: La relación con el requerimiento debe confirmarse desde Conciliación de factura o durante creación/edición.
- Flujo: Compras, Comercial, Jurídica y Contabilidad completan únicamente las secciones permitidas para su rol.
- Pagos: Una factura solo puede marcarse pagada según el flujo de aprobación configurado.

4. ANTICIPOS:
- Registro: El módulo Anticipos reemplaza el archivo histórico de Excel.
- Seguimiento: Incluye solicitud, aprobación, desembolso y legalización.
- Relación: Un anticipo puede vincularse con requerimientos, presupuestos, proyectos y facturas.
- Formatos: Hay formatos diferenciados para empleados y para proveedores/contratistas.

5. ROLES Y PERMISOS:
- Usuario: Crea requerimientos, ve sus proyectos/presupuestos asignados.
- Coordinador: Aprueba requerimientos, visualiza estadísticas globales del sistema.
- Director Financiero: Aprobación final, crea/gestiona presupuestos y ajustes.
- Admin: Control total.
- Auditor: Consulta global sin ejecutar acciones administrativas.
- Validador de facturas: Consulta y edita únicamente la sección Comercial, Jurídica o Contable asignada.

6. SEGURIDAD DEL ASISTENTE:
- Las consultas respetan el alcance del usuario autenticado.
- Crear, aprobar, asignar o enviar información requiere una tarjeta de confirmación explícita.
- El asistente no elimina proveedores.
- Cancelar una tarjeta de confirmación no modifica datos.

7. TIPS GENERALES:
- Adjuntar cotizaciones agiliza aprobación.
- Usar títulos descriptivos.
- Revisar saldo antes de pedir.
`;

export const MODULE_DESCRIPTIONS = `
- Requerimientos: Solicitudes de compra.
- Presupuestos: Control financiero.
- Proveedores: Gestión de terceros.
- Facturas: Recepción, validación, conciliación y pagos.
- Anticipos: Solicitud, desembolso, formatos y legalización.
- Aprobaciones: Panel para directores/coordinadores.
- Informes: Reportes y estadísticas (Excel).
`;
