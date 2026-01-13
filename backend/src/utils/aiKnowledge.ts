
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

3. PAGOS Y FACTURAS:
- Registro: En detalle requerimiento -> 'Pagos Múltiples' -> 'Agregar Abono'.
- Límites: Hasta 12 pagos por requerimiento.

4. ROLES Y PERMISOS:
- Usuario: Crea requerimientos, ve sus proyectos/presupuestos asignados.
- Coordinador: Aprueba requerimientos.
- Director Financiero: Aprobación final, crea/gestiona presupuestos y ajustes.
- Admin: Control total.

5. TIPS GENERALES:
- Adjuntar cotizaciones agiliza aprobación.
- Usar títulos descriptivos.
- Revisar saldo antes de pedir.
`;

export const MODULE_DESCRIPTIONS = `
- Requerimientos: Solicitudes de compra.
- Presupuestos: Control financiero.
- Proveedores: Gestión de terceros.
- Aprobaciones: Panel para directores/coordinadores.
- Informes: Reportes y estadísticas (Excel).
`;
