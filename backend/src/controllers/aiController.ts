import { Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../db';
import { SYSTEM_FAQ } from '../utils/aiKnowledge';
import OpenAI from 'openai';

// Initialize Gemini SDK
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Initialize OpenSource Provider (Groq example)
const groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY || '',
    baseURL: 'https://api.groq.com/openai/v1'
});

// Fallback Chain Strategy: If one fails (429/404), try the next.
// Each model has separate quota, so more models = more daily requests.
const FALLBACK_MODELS = [
    "gemini-2.0-flash",       // Primary (Reliable)
    "groq/llama-3.3-70b-versatile", // Fast OpenSource Fallback
    "gemini-2.0-flash-lite",
    "groq/llama-3.1-8b-instant" // Small fast fallback
];

// Roles that can see ALL data (global statistics, all suppliers, all budgets, etc.)
const FULL_ACCESS_ROLES = ['ADMIN', 'DIRECTOR', 'COORDINATOR'];

// ... (Imports and previous code)

type AiActionButton = {
    label: string;
    type: 'link' | 'prompt';
    value: string;
};

/**
 * Execute a generation task with model fallback strategy.
 * This wraps the entire "Get Model -> Generate" process.
 */
async function generateWithFallback(
    params: {
        systemInstruction?: string,
        prompt?: string,
        history?: any[],     // For Chat
        message?: string | any[],    // Supports Multimodal Part[]
        jsonMode?: boolean
    }
) {
    let lastError: any = null;

    for (const modelName of FALLBACK_MODELS) {
        try {
            // OPTION A: OpenSource Fallback (Groq)
            if (modelName.startsWith('groq/')) {
                const actualModel = modelName.replace('groq/', '');
                const messages: any[] = [];

                if (params.systemInstruction) {
                    messages.push({ role: 'system', content: params.systemInstruction });
                }

                if (params.history) {
                    params.history.forEach((h: any) => {
                        const role = h.role === 'user' ? 'user' : 'assistant';
                        let content = '';
                        if (typeof h.content === 'string') content = h.content;
                        else if (Array.isArray(h.parts)) content = h.parts.map((p: any) => p.text || '').join(' ');
                        messages.push({ role, content });
                    });
                }

                const userContent = typeof params.message === 'string' ? params.message : params.prompt || '';
                if (userContent) {
                    messages.push({ role: 'user', content: userContent });
                }

                const completion = await groq.chat.completions.create({
                    model: actualModel,
                    messages: messages,
                    response_format: params.jsonMode ? { type: 'json_object' } : undefined,
                    max_tokens: 2000
                });

                return completion.choices[0].message.content || '';
            }

            // OPTION B: Gemini (Native)
            const config: any = {};
            if (params.jsonMode) config.responseMimeType = "application/json";

            const model = genAI.getGenerativeModel({
                model: modelName,
                systemInstruction: params.systemInstruction,
                generationConfig: config
            });

            if (params.history && params.message) {
                const chat = model.startChat({
                    history: params.history,
                    generationConfig: { maxOutputTokens: 2500 }
                });

                const result = await chat.sendMessage(params.message);
                return result.response.text();
            } else if (params.prompt) {
                const result = await model.generateContent(params.prompt);
                return result.response.text();
            }

        } catch (error: any) {
            console.error(`[AI ERROR] Model ${modelName} failed:`, error.message);
            lastError = error;
            const shouldFallback = error.message?.includes('429') ||
                error.message?.includes('503') ||
                error.message?.includes('overloaded') ||
                error.message?.includes('404') ||
                error.message?.includes('401') ||
                error.message?.includes('403') ||
                error.message?.includes('invalid_api_key') ||
                error.message?.includes('API key not found');

            if (!shouldFallback) throw error;
            continue;
        }
    }
    console.error("[AI ERROR] All models failed in generateWithFallback");
    throw lastError || new Error("All fallback models failed.");
}

export const chatWithAI = async (req: Request, res: Response) => {
    const startedAt = Date.now();
    try {
        const { message, history, image, mimeType } = req.body;
        const user = (req as any).user;
        const userId = user?.id;
        const userRole = user?.role || 'USER';

        // ... (Keep Context Fetching Logic) ...
        // 1. Fetch Context Based on Role (Security & Business Rules)
        let contextData = "";
        const formatMoney = (amount: any) => {
            return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(Number(amount) || 0);
        };

        if (userRole === 'USER') {
            const [myReqs, myBudgets, myProjects, myInvoices] = await Promise.all([
                prisma.requirement.findMany({
                    where: { createdById: userId },
                    take: 5,
                    orderBy: { createdAt: 'desc' },
                    select: { title: true, status: true, procurementStatus: true, totalAmount: true }
                }),
                prisma.budget.findMany({ where: { OR: [{ managerId: userId }, { subLeaders: { some: { userId } } }] }, take: 5, select: { title: true, available: true, project: { select: { name: true } } } }),
                prisma.project.findMany({ where: { leaderId: userId }, take: 5, select: { name: true, code: true } }),
                prisma.invoice.findMany({ where: { createdById: userId }, take: 5, orderBy: { issueDate: 'desc' }, select: { invoiceNumber: true, amount: true, status: true, supplier: { select: { name: true } } } })
            ]);
            contextData = `DATOS DEL USUARIO (${user.name}):
MIS ÚLTIMOS REQUERIMIENTOS:
${myReqs.map(r => `- ${r.title} (Aprobación: ${r.status}, Trámite: ${r.procurementStatus}): ${formatMoney(r.totalAmount)}`).join('\n')}
MIS PRESUPUESTOS ASIGNADOS:
${myBudgets.map(b => `- ${b.title} (Proyecto: ${b.project.name}): Disponible ${formatMoney(b.available)}`).join('\n')}
MIS PROYECTOS LIDERADOS:
${myProjects.map(p => `- ${p.name} (${p.code})`).join('\n')}
MIS FACTURAS:
${myInvoices.map(i => `- #${i.invoiceNumber} (${i.supplier.name}): ${formatMoney(i.amount)}`).join('\n')}`;
        } else {
            // Get counts first
            const [projectCount, budgetCount, supplierCount, pendingApprovalCount, pendingProcurementCount] = await Promise.all([
                prisma.project.count(),
                prisma.budget.count(),
                prisma.supplier.count(),
                prisma.requirement.count({ where: { status: 'PENDING_APPROVAL' } }),
                prisma.requirement.count({ where: { status: 'APPROVED', procurementStatus: 'PENDIENTE' } })
            ]);

            const [projects, budgets, reqsPending, suppliers, invoices] = await Promise.all([
                prisma.project.findMany({ take: 10, orderBy: { updatedAt: 'desc' }, select: { name: true, code: true } }),
                prisma.budget.findMany({ take: 10, orderBy: { createdAt: 'desc' }, select: { title: true, available: true, project: { select: { name: true } } } }),
                prisma.requirement.findMany({ where: { status: 'PENDING_APPROVAL' }, take: 10, select: { title: true, createdBy: { select: { email: true } }, estimatedAmount: true } }),
                prisma.supplier.findMany({ take: 20, orderBy: { createdAt: 'desc' }, select: { name: true, supplierType: true, criticality: true, activity: true, contactEmail: true, phone: true } }),
                prisma.invoice.findMany({ take: 5, orderBy: { issueDate: 'desc' }, select: { invoiceNumber: true, amount: true, supplier: { select: { name: true } }, status: true } })
            ]);

            // Build rich supplier context (sample only)
            const supplierContext = suppliers.map(s => `- ${s.name} (${s.supplierType}): ${s.activity || 'Sin actividad'}${s.criticality === 'HIGH' ? ' ⚠️' : ''}`).join('\n');

            contextData = `ESTADÍSTICAS DEL SISTEMA (Rol: ${userRole}):
- Total Proveedores: ${supplierCount}
- Total Proyectos: ${projectCount}
- Total Presupuestos: ${budgetCount}
- Requerimientos PENDIENTES POR APROBACIÓN (status): ${pendingApprovalCount}
- Requerimientos EN TRÁMITE PENDIENTE (procurementStatus): ${pendingProcurementCount}

PROYECTOS RECIENTES: ${projects.map(p => p.name).join(', ')}

PRESUPUESTOS RECIENTES: ${budgets.map(b => `${b.title} ($${b.available})`).join(', ')}

MUESTRA DE PROVEEDORES (20 de ${supplierCount} totales):
${supplierContext}

IMPORTANTE: La lista anterior es solo una MUESTRA. Para buscar proveedores específicos, el sistema buscará en TODA la base de datos (${supplierCount} proveedores). Cuando te pregunten "¿cuántos proveedores hay?", responde con el total real: ${supplierCount}.`;
        }

        // =====================================================
        // AI ACTIONS: Unified Intent Classification & Execution
        // =====================================================
        let actionResult = "";
        const actionButtons: AiActionButton[] = [];

        try {
            // Context for classification: message and limited history
            const historyText = history?.slice(-6).map((h: any) => {
                const content = typeof h.content === 'string' ? h.content : (h.parts?.[0]?.text || '');
                return `${h.role === 'user' ? 'Usuario' : 'Asistente'}: ${content}`;
            }).join('\n') || '';

            // ========== MEMORY EXTRACTION: Extract context from history ==========
            let lastMentionedSupplier = "";
            let lastMentionedReqGroupId = "";
            let lastMentionedReqTitle = "";

            // Look through history for recently mentioned entities
            for (const h of (history || []).slice(-10).reverse()) {
                const content = typeof h.content === 'string' ? h.content : (h.parts?.[0]?.text || '');

                // Extract supplier from bot responses
                if (h.role === 'model' && !lastMentionedSupplier) {
                    // Pattern: "PROVEEDOR ASIGNADO:" or "Nombre: X"
                    const supplierMatch = content.match(/(?:PROVEEDOR ASIGNADO|Nombre):\s*\**([^*\n]+)/i);
                    if (supplierMatch) lastMentionedSupplier = supplierMatch[1].trim();

                    // Pattern: "proveedor ... es X"
                    const supplierMatch2 = content.match(/proveedor[^:]*es\s+([^,.\n]+)/i);
                    if (supplierMatch2 && !lastMentionedSupplier) lastMentionedSupplier = supplierMatch2[1].trim();
                }

                // Extract requirement from bot responses
                if (h.role === 'model' && !lastMentionedReqGroupId) {
                    // Pattern: "#6 - Lupas..."
                    const reqMatch = content.match(/#(\d+)\s*-\s*([^\n(]+)/);
                    if (reqMatch) {
                        lastMentionedReqGroupId = reqMatch[1];
                        lastMentionedReqTitle = reqMatch[2].trim();
                    }
                }

                // Stop if we have both
                if (lastMentionedSupplier && lastMentionedReqGroupId) break;
            }

            const memoryContext = `
CONTEXTO DE MEMORIA (entidades mencionadas recientemente):
${lastMentionedSupplier ? `- Último proveedor mencionado: "${lastMentionedSupplier}"` : '- No hay proveedor reciente'}
${lastMentionedReqGroupId ? `- Último requerimiento mencionado: #${lastMentionedReqGroupId} - ${lastMentionedReqTitle}` : '- No hay requerimiento reciente'}

IMPORTANTE para REFERENCIAS:
- Si el usuario dice "ese proveedor", "el mismo", "ese" refiriéndose a un proveedor, usa: "${lastMentionedSupplier || 'N/A'}"
- Si el usuario dice "ese requerimiento", "el mismo", "esa solicitud", usa groupId: ${lastMentionedReqGroupId || 'N/A'}
`;

            const classifierPrompt = `
            Actúa como el motor de intenciones de "MisCompras Bot". Analiza el mensaje del usuario y el historial para categorizar la acción.
            
            HISTORIAL RECIENTE:
            ${historyText}
            
            ${memoryContext}
            
            MENSAJE DEL USUARIO: "${message}"
            
            CATEGORÍAS DE ACCIÓN:
            - FIND_SUPPLIER: Buscar proveedores en el catálogo (Ej: "busca proveedor x", "quien vende y", "proveedores de papel"). Parámetros: keywords (array de palabras clave), type (name|activity|both).
            - DELETE_SUPPLIER: Eliminar un proveedor. Si el usuario dice "eliminalo", "borralo" o "quita a ese" refiriéndose al último mencionado, detecta a quién se refiere. Parámetros: name (nombre del proveedor).
            - FIND_REQ: Buscar un requerimiento específico O consultar el proveedor asignado a un requerimiento (Ej: "busca requerimiento #6", "dame info del req #6", "qué proveedor tiene el requerimiento X", "proveedor del requerimiento de lupas", "info de ESE requerimiento"). Usa el groupId del contexto de memoria si el usuario dice "ese/esa". Parámetros: groupId (number), id (uuid), title (string).
            - REQS_BY_SUPPLIER: Buscar todos los requerimientos asignados a un proveedor específico (Ej: "qué requerimientos tiene el proveedor X", "otros requerimientos de ESE proveedor", "trabajos asignados a Juan"). Parámetros: supplierName (string).
            - COUNT_GLOBAL: Estadísticas generales de CONTEO (Ej: "¿cuántos requerimientos hay?", "¿total de proveedores?", "¿cuántos proyectos?"). Parámetros: entity (requirement|supplier|project|budget).
            - BUDGET_SUMMARY: Resumen financiero, gasto total, dinero ejecutado, ejecución presupuestal (Ej: "cuánto dinero se ha gastado", "cuánto se ha ejecutado", "resumen de presupuestos", "dinero gastado total"). Parámetros: projectName (opcional, nombre del proyecto específico).
            - LOW_BUDGET_ALERT: Presupuestos con poco saldo disponible, alertas de presupuesto bajo (Ej: "¿qué presupuestos están bajos?", "alertas de presupuesto", "presupuestos críticos", "presupuestos con menos del 20%"). Sin parámetros.
            - EXECUTIVE_ANALYSIS: Análisis ejecutivo de riesgos y oportunidades (Ej: "analiza compras anómalas", "proveedores repetidos", "demoras por área", "requerimientos vencidos", "alertas ejecutivas", "dame diagnóstico ejecutivo"). Parámetros: focus (full|low_budget|repeated_suppliers|anomalies|area_delays|overdue).
            - WEEKLY_REPORT: Reporte ejecutivo semanal con resumen de actividad (Ej: "dame el resumen de la semana", "reporte semanal", "qué pasó esta semana", "resumen ejecutivo"). Sin parámetros.
            - SPENDING_TRENDS: Tendencias y comparativo de gastos por período (Ej: "cuánto gastamos este mes vs el anterior", "tendencia de gastos", "comparativo mensual", "evolución del gasto"). Parámetros: period (month|quarter|year).
            - COMPARE_SUPPLIERS: Comparar proveedores por precios/productos (Ej: "quién tiene mejores precios para X", "compara proveedores de papelería", "proveedor más barato para Y"). Parámetros: product (string).
            - EXPORT_DATA: Exportar datos a Excel o PDF (Ej: "exporta los requerimientos del proyecto X", "genera excel de proveedores", "descarga reporte en PDF"). Parámetros: entity (requirements|suppliers|budgets), projectName (opcional), format (excel|pdf).
            - CREATE_REQ: Crear un nuevo requerimiento via chat (Ej: "crea un requerimiento de papelería por 500mil para Mantenimiento", "nuevo requerimiento de transporte por 2 millones"). Parámetros: title (string), amount (number), projectName (string), description (opcional).
            - ASSIGN_SUPPLIER: Asignar un proveedor a un requerimiento (Ej: "asigna el proveedor X al requerimiento #5", "pon a Juan como proveedor del req #3"). Parámetros: supplierName (string), groupId (number).
            - TOP_PROJECT: Proyecto con más gastos/ejecución (Ej: "proyecto con más gastos", "cuál proyecto ha gastado más"). Sin parámetros.
            - TOP_REQUESTER: Usuario/área que más requerimientos ha creado (Ej: "quién más compra", "qué líder más compra", "área con más requerimientos"). Sin parámetros.
            - REQ_BY_STATUS: Listar requerimientos filtrados por estado de trámite (Ej: "requerimientos en trámite", "pendientes de entrega", "finalizados"). Parámetros: procurementStatus (PENDIENTE|EN_TRAMITE|ENTREGADO|FINALIZADO|ANULADO|POSTERGADO).
            - REQ_BY_CATEGORY: Contar o listar requerimientos por categoría (Ej: "cuántos son orden de servicio", "requerimientos de compra"). Parámetros: category (COMPRA|SERVICIO|ORDEN_COMPRA|ORDEN_SERVICIO|ANTICIPO|CONTRATO|ORDEN_PRODUCCION|COMPRA_ONLINE).
            - GENERATE_CONTRACT: Generar y enviar contrato al proveedor de un requerimiento (Ej: "genera contrato para req #4", "envía contrato del requerimiento X", "crea contrato para ESE requerimiento"). Parámetros: groupId (number) o title (string).
            - SEND_QUOTE: Preparar solicitud de cotización para un proveedor. Parámetros: supplierName, product, groupId.
            - CONFIRM_ACTION: El usuario confirma una acción propuesta anteriormente (Ej: "sí, enviar", "confirmar", "hazlo", "sí").
            - PRICE_HISTORY: Consultar precios históricos o historial de pagos de un producto/item. Parámetros: item.
            - EXEC_SUMMARY: Reporte ejecutivo/resumen de un proyecto o área específica. Parámetros: target (project|area), name.
            - APPROVE_REQ: Autorizar o aprobar un requerimiento. Parámetros: groupId.
            - NONE: Si es saludo, charla informal o duda sobre cómo usar el sistema sin pedir una acción específica.

            IMPORTANTE: 
            - Si el usuario pregunta por "dinero gastado", "cuánto se ha ejecutado", "gasto total" -> usa BUDGET_SUMMARY, NO COUNT_GLOBAL.
            - Si pregunta "gastos del mes", "resumen de gastos", "cuánto gastamos este mes", "gastos mensuales", "comparativo de gastos" -> usa SPENDING_TRENDS.
            - Si pregunta "cuál proyecto gastó más" -> usa TOP_PROJECT.
            - Si pregunta "quién más compra" o "qué líder" -> usa TOP_REQUESTER.
            - Si pregunta "en trámite", "pendientes", "finalizados" -> usa REQ_BY_STATUS.
            - Si pregunta "orden de compra", "orden de servicio", categorías -> usa REQ_BY_CATEGORY.
            - Si pregunta "qué proveedor tiene el requerimiento X" o "proveedor del requerimiento" -> usa FIND_REQ (NO FIND_SUPPLIER).
            - Si pregunta "qué requerimientos tiene ESE proveedor" o "otros requerimientos de X" -> usa REQS_BY_SUPPLIER con el supplierName del contexto de memoria.
            - Si el usuario dice "ese requerimiento", "info de ese", usa FIND_REQ con el groupId del contexto de memoria.
            - Si pregunta "presupuestos bajos", "alertas de presupuesto", "críticos" -> usa LOW_BUDGET_ALERT.
            - Si pide análisis ejecutivo, compras anómalas, proveedores repetidos, demoras por área o requerimientos vencidos -> usa EXECUTIVE_ANALYSIS.
            - Si pregunta "resumen de la semana", "reporte semanal", "qué pasó esta semana" -> usa WEEKLY_REPORT.
            - Si pregunta "exporta", "descarga", "genera excel/pdf", "exportar a excel", "exportar a pdf" -> usa EXPORT_DATA.
            - Si pregunta "crea requerimiento", "nuevo requerimiento" -> usa CREATE_REQ.
            - Si pregunta "asigna proveedor", "pon a X como proveedor" -> usa ASSIGN_SUPPLIER.
            - COUNT_GLOBAL es solo para CONTEOS numéricos simples de entidades.
            - FIND_SUPPLIER es para buscar proveedores en el catálogo, NO para consultar el proveedor de un requerimiento.

            Responde ÚNICAMENTE un JSON válido:
            {
              "action": "CATEGORIA",
              "params": { ... },
              "explanation": "breve razonamiento de por qué elegiste esta acción"
            }
            `;

            const classification = await generateWithFallback({ prompt: classifierPrompt, jsonMode: true });
            const intent = JSON.parse(classification);
            console.log(`[AI INTENT] Detected: ${intent.action}`, intent.params);

            // EXECUTE ACTION BASED ON INTENT
            switch (intent.action) {
                case 'FIND_SUPPLIER': {
                    const kws = intent.params.keywords || [];
                    const searchType = intent.params.type || 'both';
                    const orConditions: any[] = [];
                    kws.forEach((kw: string) => {
                        if (!kw || kw.length < 2) return;
                        if (searchType === 'both' || searchType === 'name') orConditions.push({ name: { contains: kw, mode: 'insensitive' } });
                        if (searchType === 'both' || searchType === 'activity') orConditions.push({ activity: { contains: kw, mode: 'insensitive' } });
                    });

                    if (orConditions.length > 0) {
                        const matching = await prisma.supplier.findMany({ where: { OR: orConditions }, take: 10 });
                        if (matching.length > 0) {
                            actionResult += `\n\n[SISTEMA - PROVEEDORES ENCONTRADOS]:\n${matching.map(s => `- ${s.name} ${s.nit ? `(NIT: ${s.nit})` : ''}: ${s.activity || 'Sin actividad'} | ${s.contactEmail || s.phone || 'Sin contacto'}`).join('\n')}`;
                        } else {
                            actionResult += `\n\n[SISTEMA]: No encontré proveedores con esos términos.`;
                        }
                    }
                    break;
                }

                case 'DELETE_SUPPLIER': {
                    if (!['ADMIN', 'DIRECTOR', 'COORDINATOR', 'DEVELOPER'].includes(userRole)) {
                        actionResult += `\n\n[SISTEMA]: ⛔ No tienes permisos suficientes para eliminar registros.`;
                    } else {
                        const nameToDelete = intent.params.name;
                        if (nameToDelete) {
                            const supplier = await prisma.supplier.findFirst({
                                where: { name: { contains: nameToDelete, mode: 'insensitive' } },
                                select: { id: true, name: true }
                            });
                            if (supplier) {
                                await prisma.supplier.delete({ where: { id: supplier.id } });
                                actionResult += `\n\n[SISTEMA - ACCIÓN REALIZADA ✅]: He eliminado el proveedor "**${supplier.name}**" de la base de datos satisfactoriamente.`;
                            } else {
                                actionResult += `\n\n[SISTEMA]: No encontré el proveedor "${nameToDelete}" para eliminar.`;
                            }
                        } else {
                            actionResult += `\n\n[SISTEMA]: No pude identificar a qué proveedor deseas eliminar. ¿Podrías decirme el nombre exacto?`;
                        }
                    }
                    break;
                }

                case 'FIND_REQ': {
                    const { groupId, id, title } = intent.params;
                    const where: any = {};
                    if (groupId) where.groupId = Number(groupId);
                    else if (id) where.id = id;
                    else if (title) where.title = { contains: title, mode: 'insensitive' };

                    if (Object.keys(where).length > 0) {
                        const req = await prisma.requirement.findFirst({
                            where,
                            include: { project: true, area: true, supplier: true, budget: true, createdBy: { select: { name: true, email: true } } }
                        });
                        if (req) {
                            actionResult += `\n\n[SISTEMA - REQUERIMIENTO ENCONTRADO]:\n`;
                            actionResult += `📋 **#${req.groupId} - ${req.title}**\n`;
                            actionResult += `📊 Estado: ${req.status} | Trámite: ${req.procurementStatus}\n`;
                            actionResult += `💰 Monto: ${formatMoney(req.totalAmount || req.estimatedAmount)}\n`;
                            actionResult += `🏢 Proyecto: ${req.project?.name || 'N/A'}\n`;
                            actionResult += `👤 Solicitante: ${req.createdBy?.name || req.createdBy?.email || 'N/A'}\n`;
                            if (req.supplier) {
                                actionResult += `\n🏪 **PROVEEDOR ASIGNADO:**\n`;
                                actionResult += `   Nombre: ${req.supplier.name}\n`;
                                actionResult += `   NIT: ${req.supplier.nit || req.supplier.taxId || 'N/A'}\n`;
                                actionResult += `   Email: ${req.supplier.contactEmail || 'N/A'}\n`;
                                actionResult += `   Teléfono: ${req.supplier.contactPhone || 'N/A'}\n`;
                            } else {
                                actionResult += `\n⚠️ **SIN PROVEEDOR ASIGNADO**\n`;
                            }
                            actionButtons.push({
                                label: 'Ver requerimiento',
                                type: 'link',
                                value: `/requirements/${req.id}`
                            });
                            if (!req.supplier) {
                                actionButtons.push({
                                    label: 'Asignar proveedor',
                                    type: 'prompt',
                                    value: `Asigna un proveedor al requerimiento #${req.groupId}`
                                });
                            }
                        } else {
                            actionResult += `\n\n[SISTEMA]: No encontré ningún requerimiento que coincida con la búsqueda.`;
                        }
                    }
                    break;
                }

                case 'REQS_BY_SUPPLIER': {
                    const supplierName = intent.params.supplierName;
                    if (supplierName) {
                        // Find supplier first
                        const supplier = await prisma.supplier.findFirst({
                            where: { name: { contains: supplierName, mode: 'insensitive' } },
                            select: { id: true, name: true }
                        });

                        if (supplier) {
                            const reqs = await prisma.requirement.findMany({
                                where: { supplierId: supplier.id },
                                orderBy: { createdAt: 'desc' },
                                select: { groupId: true, id: true, title: true, status: true, procurementStatus: true, totalAmount: true, project: { select: { name: true } } }
                            });

                            if (reqs.length > 0) {
                                const totalAmount = reqs.reduce((sum, r) => sum + Number(r.totalAmount || 0), 0);
                                actionResult += `\n\n[SISTEMA - REQUERIMIENTOS DE ${supplier.name}]:\n`;
                                actionResult += `📊 Total: **${reqs.length} requerimientos** por ${formatMoney(totalAmount)}\n\n`;
                                reqs.forEach(r => {
                                    actionResult += `• #${r.groupId || r.id.slice(0, 6)} - ${r.title} (${r.procurementStatus}) ${formatMoney(r.totalAmount || 0)}\n`;
                                });
                            } else {
                                actionResult += `\n\n[SISTEMA]: El proveedor "${supplier.name}" no tiene requerimientos asignados.`;
                            }
                        } else {
                            actionResult += `\n\n[SISTEMA]: No encontré ningún proveedor con el nombre "${supplierName}".`;
                        }
                    } else {
                        actionResult += `\n\n[SISTEMA]: No especificaste el nombre del proveedor.`;
                    }
                    break;
                }

                case 'COUNT_GLOBAL': {
                    const entity = intent.params.entity;
                    const hasFullAccess = FULL_ACCESS_ROLES.includes(userRole);

                    if (entity === 'requirement') {
                        if (hasFullAccess) {
                            const count = await prisma.requirement.count();
                            actionResult += `\n\n[SISTEMA - ESTADÍSTICA]: Actualmente existen **${count} requerimientos** registrados en total.`;
                        } else {
                            // Restricted: only count user's own requirements
                            const count = await prisma.requirement.count({ where: { createdById: userId } });
                            actionResult += `\n\n[SISTEMA - ESTADÍSTICA]: Tienes **${count} requerimientos** creados por ti.`;
                        }
                    } else if (entity === 'supplier') {
                        if (hasFullAccess) {
                            const count = await prisma.supplier.count();
                            actionResult += `\n\n[SISTEMA - ESTADÍSTICA]: Hay **${count} proveedores** en la base de datos.`;
                        } else {
                            // Restricted: only count suppliers they've used
                            const supplierIds = await prisma.requirement.findMany({
                                where: { createdById: userId, supplierId: { not: null } },
                                select: { supplierId: true },
                                distinct: ['supplierId']
                            });
                            actionResult += `\n\n[SISTEMA - ESTADÍSTICA]: Has trabajado con **${supplierIds.length} proveedores** en tus requerimientos.`;
                        }
                    } else if (entity === 'project') {
                        if (hasFullAccess) {
                            const count = await prisma.project.count();
                            actionResult += `\n\n[SISTEMA - ESTADÍSTICA]: Gestionas un total de **${count} proyectos**.`;
                        } else {
                            // Restricted: only count projects where user is leader or has budget
                            const projectCount = await prisma.project.count({
                                where: {
                                    OR: [
                                        { leaderId: userId },
                                        { budgets: { some: { OR: [{ managerId: userId }, { subLeaders: { some: { userId } } }] } } }
                                    ]
                                }
                            });
                            actionResult += `\n\n[SISTEMA - ESTADÍSTICA]: Tienes acceso a **${projectCount} proyectos** asignados a ti.`;
                        }
                    } else if (entity === 'budget') {
                        if (hasFullAccess) {
                            const count = await prisma.budget.count();
                            actionResult += `\n\n[SISTEMA - ESTADÍSTICA]: Hay **${count} presupuestos** configurados.`;
                        } else {
                            // Restricted: only count user's assigned budgets
                            const count = await prisma.budget.count({
                                where: { OR: [{ managerId: userId }, { subLeaders: { some: { userId } } }] }
                            });
                            actionResult += `\n\n[SISTEMA - ESTADÍSTICA]: Tienes **${count} presupuestos** asignados a ti.`;
                        }
                    }
                    break;
                }

                case 'SEND_QUOTE': {
                    const { supplierName, product, groupId } = intent.params;
                    const supplier = await prisma.supplier.findFirst({
                        where: { name: { contains: supplierName, mode: 'insensitive' } },
                        select: { name: true, contactEmail: true }
                    });
                    if (supplier?.contactEmail) {
                        actionResult += `\n\n[SISTEMA - EMAIL PREPARADO]:\n📨 Para: ${supplier.contactEmail}\n📋 Asunto: Solicitud de Cotización - ${product || 'Varios'}\n✉️ ¿Deseas que lo envíe ahora mismo? (Confirma con un "Sí, enviar")`;
                        contextData += `\n\n[PENDING_EMAIL]: supplierName="${supplier.name}", email="${supplier.contactEmail}", product="${product || 'Varios'}", groupId="${groupId || ''}"`;
                    } else {
                        actionResult += `\n\n[SISTEMA]: No encontré el email del proveedor "${supplierName}".`;
                    }
                    break;
                }

                case 'CONFIRM_ACTION': {
                    const emailMatch = contextData.match(/\[PENDING_EMAIL\]: supplierName="(.+?)", email="(.+?)", product="(.+?)", groupId="(.+?)"/);
                    if (emailMatch) {
                        const [_, sName, sEmail, sProd, sGroup] = emailMatch;
                        const { sendEmail, getEmailTemplate } = await import('../services/emailService');
                        const subject = `Solicitud de Cotización - ${sProd}`;
                        const html = getEmailTemplate(subject, `<p>Estimado ${sName},</p><p>Solicitamos cotización para: ${sProd}.</p><p>Gracias.</p>`);
                        await sendEmail(sEmail, subject, html);
                        actionResult += `\n\n[SISTEMA - ACCIÓN REALIZADA ✅]: ¡Correo enviado exitosamente a ${sEmail}!`;
                    }
                    break;
                }

                case 'GENERATE_CONTRACT': {
                    const { groupId, title } = intent.params;
                    const where: any = {};
                    if (groupId) where.groupId = Number(groupId);
                    else if (title) where.title = { contains: title, mode: 'insensitive' };

                    if (Object.keys(where).length > 0) {
                        const req = await prisma.requirement.findFirst({
                            where,
                            include: {
                                project: true,
                                supplier: true,
                                createdBy: { select: { name: true, email: true } }
                            }
                        });

                        if (req) {
                            if (!req.supplier) {
                                actionResult += `\n\n[SISTEMA - ERROR]: El requerimiento #${req.groupId} no tiene proveedor asignado. Debe asignar un proveedor antes de generar el contrato.`;
                            } else if (!req.supplier.contactEmail) {
                                actionResult += `\n\n[SISTEMA - ERROR]: El proveedor "${req.supplier.name}" no tiene email configurado. Actualice los datos del proveedor.`;
                            } else {
                                // Generate contract
                                const { getServiceContractTemplate } = await import('../utils/contractTemplates');
                                const { sendContractEmail } = await import('../services/emailService');

                                const contractNumber = `MC-${req.groupId}-${Date.now().toString(36).toUpperCase()}`;
                                const contractDate = new Date().toLocaleDateString('es-CO', {
                                    year: 'numeric', month: 'long', day: 'numeric'
                                });

                                const contractData = {
                                    contractNumber,
                                    contractDate,
                                    supplierName: req.supplier.name,
                                    supplierNit: req.supplier.nit || req.supplier.taxId || 'N/A',
                                    supplierEmail: req.supplier.contactEmail,
                                    supplierPhone: req.supplier.contactPhone || undefined,
                                    supplierAddress: req.supplier.address || undefined,
                                    requirementGroupId: req.groupId!,
                                    requirementTitle: req.title,
                                    requirementDescription: req.description || undefined,
                                    amount: Number(req.totalAmount || req.estimatedAmount || 0),
                                    projectName: req.project?.name || 'N/A',
                                    projectCode: req.project?.code || undefined,
                                    requesterName: req.createdBy?.name || req.createdBy?.email || 'N/A'
                                };

                                const contractHtml = getServiceContractTemplate(contractData);

                                await sendContractEmail({
                                    to: req.supplier.contactEmail,
                                    supplierName: req.supplier.name,
                                    contractNumber,
                                    requirementTitle: req.title,
                                    amount: contractData.amount,
                                    contractHtml
                                });

                                actionResult += `\n\n[SISTEMA - CONTRATO GENERADO ✅]:\n`;
                                actionResult += `📄 **Contrato No. ${contractNumber}**\n`;
                                actionResult += `👤 Proveedor: ${req.supplier.name}\n`;
                                actionResult += `📧 Enviado a: ${req.supplier.contactEmail}\n`;
                                actionResult += `💰 Monto: ${formatMoney(contractData.amount)}\n`;
                                actionResult += `📋 Requerimiento: #${req.groupId} - ${req.title}\n\n`;
                                actionResult += `El proveedor recibirá el contrato para revisión y firma.`;
                            }
                        } else {
                            actionResult += `\n\n[SISTEMA]: No encontré ningún requerimiento que coincida con la búsqueda.`;
                        }
                    } else {
                        actionResult += `\n\n[SISTEMA]: No especificaste qué requerimiento usar para el contrato.`;
                    }
                    break;
                }

                case 'PRICE_HISTORY': {
                    const item = intent.params.item;
                    if (item) {
                        const invoices = await prisma.invoice.findMany({
                            where: { requirement: { title: { contains: item, mode: 'insensitive' } } },
                            take: 5, orderBy: { issueDate: 'desc' }, include: { supplier: true, requirement: true }
                        });
                        if (invoices.length > 0) {
                            actionResult += `\n\n[SISTEMA - RECOPILACIÓN DE PRECIOS]:\n${invoices.map(inv => `- ${inv.requirement?.title || 'Item'}: ${formatMoney(inv.amount)} (${inv.supplier.name}, ${inv.issueDate?.toLocaleDateString()})`).join('\n')}`;
                        } else {
                            actionResult += `\n\n[SISTEMA]: No hay historial de facturación para "${item}".`;
                        }
                    }
                    break;
                }

                case 'EXEC_SUMMARY': {
                    const { target, name } = intent.params;
                    if (target === 'project') {
                        const project = await prisma.project.findFirst({
                            where: { name: { contains: name, mode: 'insensitive' } },
                            include: { budgets: true, _count: { select: { requirements: true } } }
                        });
                        if (project) {
                            const total = project.budgets.reduce((s, b) => s + Number(b.amount || 0), 0);
                            const available = project.budgets.reduce((s, b) => s + Number(b.available || 0), 0);
                            actionResult += `\n\n[SISTEMA - RESUMEN PROYECTO: ${project.name}]:\n💰 Presupuesto Total: ${formatMoney(total)}\n✅ Disponible: ${formatMoney(available)}\n📋 Requerimientos: ${project._count.requirements}`;
                        }
                    } else if (target === 'area') {
                        const area = await prisma.area.findFirst({
                            where: { name: { contains: name, mode: 'insensitive' } },
                            include: { _count: { select: { requirements: true, users: true } } }
                        });
                        if (area) {
                            actionResult += `\n\n[SISTEMA - RESUMEN ÁREA: ${area.name}]:\n👥 Usuarios: ${area._count.users}\n📋 Requerimientos: ${area._count.requirements}`;
                        }
                    }
                    break;
                }

                case 'APPROVE_REQ': {
                    if (!['ADMIN', 'DIRECTOR', 'COORDINATOR', 'DEVELOPER'].includes(userRole)) {
                        actionResult += `\n\n[SISTEMA]: ⛔ No tienes permisos para aprobar requerimientos.`;
                    } else {
                        const gId = Number(intent.params.groupId);
                        if (gId) {
                            const req = await prisma.requirement.findFirst({ where: { groupId: gId } });
                            if (req) {
                                await prisma.requirement.update({ where: { id: req.id }, data: { status: 'APPROVED' } });
                                actionResult += `\n\n[SISTEMA - ACCIÓN REALIZADA ✅]: Requerimiento #${gId} aprobado.`;
                            }
                        }
                    }
                    break;
                }

                case 'BUDGET_SUMMARY': {
                    const projectName = intent.params.projectName;
                    const hasFullAccess = FULL_ACCESS_ROLES.includes(userRole);

                    if (projectName) {
                        // Resumen de un proyecto específico
                        const project = await prisma.project.findFirst({
                            where: { name: { contains: projectName, mode: 'insensitive' } },
                            include: {
                                budgets: true,
                                requirements: { select: { totalAmount: true, actualAmount: true, status: true, procurementStatus: true } }
                            }
                        });

                        if (project) {
                            // For restricted users, check if they have access to this project
                            if (!hasFullAccess) {
                                const hasAccess = await prisma.budget.findFirst({
                                    where: {
                                        projectId: project.id,
                                        OR: [{ managerId: userId }, { subLeaders: { some: { userId } } }]
                                    }
                                });
                                if (!hasAccess) {
                                    actionResult += `\n\n[SISTEMA]: ⛔ No tienes acceso a la información financiera de este proyecto.`;
                                    break;
                                }
                            }

                            const totalBudget = project.budgets.reduce((sum, b) => sum + Number(b.amount || 0), 0);
                            const availableBudget = project.budgets.reduce((sum, b) => sum + Number(b.available || 0), 0);
                            const executedBudget = totalBudget - availableBudget;
                            const executionPercent = totalBudget > 0 ? ((executedBudget / totalBudget) * 100).toFixed(1) : 0;

                            actionResult += `\n\n[SISTEMA - RESUMEN FINANCIERO: ${project.name}]:\n`;
                            actionResult += `💰 Presupuesto Total: ${formatMoney(totalBudget)}\n`;
                            actionResult += `✅ Disponible: ${formatMoney(availableBudget)}\n`;
                            actionResult += `📊 Ejecutado: ${formatMoney(executedBudget)} (${executionPercent}%)\n`;
                            actionResult += `📋 Requerimientos: ${project.requirements.length}`;
                        } else {
                            actionResult += `\n\n[SISTEMA]: No encontré un proyecto con el nombre "${projectName}".`;
                        }
                    } else {
                        // Resumen global o de presupuestos asignados
                        let budgets;
                        if (hasFullAccess) {
                            budgets = await prisma.budget.findMany({
                                include: { project: { select: { name: true } } }
                            });
                        } else {
                            // Restricted: only user's assigned budgets
                            budgets = await prisma.budget.findMany({
                                where: { OR: [{ managerId: userId }, { subLeaders: { some: { userId } } }] },
                                include: { project: { select: { name: true } } }
                            });
                        }

                        const totalBudget = budgets.reduce((sum, b) => sum + Number(b.amount || 0), 0);
                        const availableBudget = budgets.reduce((sum, b) => sum + Number(b.available || 0), 0);
                        const executedBudget = totalBudget - availableBudget;
                        const executionPercent = totalBudget > 0 ? ((executedBudget / totalBudget) * 100).toFixed(1) : 0;

                        const title = hasFullAccess ? 'RESUMEN FINANCIERO GLOBAL' : 'RESUMEN DE TUS PRESUPUESTOS';
                        actionResult += `\n\n[SISTEMA - ${title}]:\n`;
                        actionResult += `💰 Presupuesto Total${hasFullAccess ? ' Asignado' : ''}: ${formatMoney(totalBudget)}\n`;
                        actionResult += `✅ Saldo Disponible: ${formatMoney(availableBudget)}\n`;
                        actionResult += `📊 **Dinero Ejecutado (Gastado): ${formatMoney(executedBudget)}** (${executionPercent}% de ejecución)\n`;
                        actionResult += `📁 Total de Presupuestos: ${budgets.length}`;
                    }
                    break;
                }

                case 'TOP_PROJECT': {
                    // Only allow for full access roles
                    if (!FULL_ACCESS_ROLES.includes(userRole)) {
                        actionResult += `\n\n[SISTEMA]: ⛔ Esta información está disponible solo para roles administrativos (Director, Coordinador, Admin).`;
                        break;
                    }

                    // Find project with most spending (amount - available = executed)
                    const projects = await prisma.project.findMany({
                        include: { budgets: true }
                    });

                    const projectSpending = projects.map(p => {
                        const totalBudget = p.budgets.reduce((sum, b) => sum + Number(b.amount || 0), 0);
                        const available = p.budgets.reduce((sum, b) => sum + Number(b.available || 0), 0);
                        const executed = totalBudget - available;
                        return { name: p.name, executed, totalBudget };
                    }).filter(p => p.totalBudget > 0).sort((a, b) => b.executed - a.executed);

                    if (projectSpending.length > 0) {
                        const top = projectSpending[0];
                        const percent = top.totalBudget > 0 ? ((top.executed / top.totalBudget) * 100).toFixed(1) : 0;
                        actionResult += `\n\n[SISTEMA - PROYECTO CON MÁS GASTOS]:\n`;
                        actionResult += `🏆 **${top.name}**\n`;
                        actionResult += `📊 Ejecutado: ${formatMoney(top.executed)} (${percent}% de ${formatMoney(top.totalBudget)})\n\n`;
                        actionResult += `📋 Top 5 Proyectos por Gasto:\n`;
                        projectSpending.slice(0, 5).forEach((p, i) => {
                            actionResult += `${i + 1}. ${p.name}: ${formatMoney(p.executed)}\n`;
                        });
                    } else {
                        actionResult += `\n\n[SISTEMA]: No hay proyectos con presupuesto asignado.`;
                    }
                    break;
                }

                case 'TOP_REQUESTER': {
                    // Only allow for full access roles
                    if (!FULL_ACCESS_ROLES.includes(userRole)) {
                        actionResult += `\n\n[SISTEMA]: ⛔ Esta información está disponible solo para roles administrativos (Director, Coordinador, Admin).`;
                        break;
                    }

                    // Find user/area with most requirements
                    const reqsByUser = await prisma.requirement.groupBy({
                        by: ['createdById'],
                        _count: { id: true },
                        _sum: { totalAmount: true },
                        orderBy: { _count: { id: 'desc' } },
                        take: 10
                    });

                    if (reqsByUser.length > 0) {
                        // Get user details
                        const userIds = reqsByUser.map(r => r.createdById);
                        const users = await prisma.user.findMany({
                            where: { id: { in: userIds } },
                            select: { id: true, name: true, email: true, area: { select: { name: true } } }
                        });

                        const userMap = new Map(users.map(u => [u.id, u]));

                        actionResult += `\n\n[SISTEMA - USUARIOS QUE MÁS COMPRAN]:\n`;
                        reqsByUser.slice(0, 5).forEach((r, i) => {
                            const user = userMap.get(r.createdById);
                            const name = user?.name || user?.email || 'Desconocido';
                            const area = user?.area?.name || 'Sin área';
                            actionResult += `${i + 1}. **${name}** (${area}): ${r._count.id} requerimientos - ${formatMoney(r._sum.totalAmount || 0)}\n`;
                        });
                    } else {
                        actionResult += `\n\n[SISTEMA]: No hay requerimientos registrados.`;
                    }
                    break;
                }

                case 'REQ_BY_STATUS': {
                    const status = intent.params.procurementStatus || 'PENDIENTE';
                    const hasFullAccess = FULL_ACCESS_ROLES.includes(userRole);

                    const whereClause: any = { procurementStatus: status };
                    if (!hasFullAccess) {
                        whereClause.createdById = userId;
                    }

                    const reqs = await prisma.requirement.findMany({
                        where: whereClause,
                        take: 15,
                        orderBy: { createdAt: 'desc' },
                        include: {
                            project: { select: { name: true } },
                            createdBy: { select: { name: true, email: true } }
                        }
                    });

                    const count = await prisma.requirement.count({ where: whereClause });

                    const statusLabels: Record<string, string> = {
                        'PENDIENTE': 'Pendientes',
                        'EN_TRAMITE': 'En Trámite',
                        'ENTREGADO': 'Entregados',
                        'FINALIZADO': 'Finalizados',
                        'ANULADO': 'Anulados',
                        'POSTERGADO': 'Postergados'
                    };

                    const scope = hasFullAccess ? '' : ' (tus requerimientos)';
                    actionResult += `\n\n[SISTEMA - REQUERIMIENTOS ${statusLabels[status] || status}${scope}]: (${count} total)\n`;
                    if (reqs.length > 0) {
                        reqs.forEach(r => {
                            actionResult += `• #${r.groupId || r.id.slice(0, 6)} - ${r.title} (${r.project?.name || 'Sin proyecto'})\n`;
                        });
                        if (count > 15) actionResult += `... y ${count - 15} más.`;
                    } else {
                        actionResult += `No hay requerimientos en estado "${statusLabels[status] || status}".`;
                    }
                    break;
                }

                case 'REQ_BY_CATEGORY': {
                    const category = intent.params.category || 'COMPRA';
                    const hasFullAccess = FULL_ACCESS_ROLES.includes(userRole);

                    const whereClause: any = { reqCategory: category };
                    if (!hasFullAccess) {
                        whereClause.createdById = userId;
                    }

                    const count = await prisma.requirement.count({ where: whereClause });
                    const reqs = await prisma.requirement.findMany({
                        where: whereClause,
                        take: 10,
                        orderBy: { createdAt: 'desc' },
                        select: { groupId: true, id: true, title: true, status: true, procurementStatus: true, totalAmount: true }
                    });

                    const categoryLabels: Record<string, string> = {
                        'COMPRA': 'Compra',
                        'SERVICIO': 'Servicio',
                        'ORDEN_COMPRA': 'Orden de Compra',
                        'ORDEN_SERVICIO': 'Orden de Servicio',
                        'ANTICIPO': 'Anticipo',
                        'CONTRATO': 'Contrato',
                        'ORDEN_PRODUCCION': 'Orden de Producción',
                        'COMPRA_ONLINE': 'Compra Online'
                    };

                    const scope = hasFullAccess ? '' : ' (tus requerimientos)';
                    actionResult += `\n\n[SISTEMA - REQUERIMIENTOS CATEGORÍA "${categoryLabels[category] || category}"${scope}]:\n`;
                    actionResult += `📊 Total: **${count} requerimientos**\n\n`;

                    if (reqs.length > 0) {
                        reqs.forEach(r => {
                            actionResult += `• #${r.groupId || r.id.slice(0, 6)} - ${r.title}: ${formatMoney(r.totalAmount || 0)} (${r.procurementStatus})\n`;
                        });
                    }
                    break;
                }

                case 'LOW_BUDGET_ALERT': {
                    const hasFullAccess = FULL_ACCESS_ROLES.includes(userRole);

                    // Find budgets with less than 20% available
                    let budgets;
                    if (hasFullAccess) {
                        budgets = await prisma.budget.findMany({
                            where: { amount: { gt: 0 } },
                            include: { project: { select: { name: true } } }
                        });
                    } else {
                        // Restricted: only user's assigned budgets
                        budgets = await prisma.budget.findMany({
                            where: {
                                amount: { gt: 0 },
                                OR: [{ managerId: userId }, { subLeaders: { some: { userId } } }]
                            },
                            include: { project: { select: { name: true } } }
                        });
                    }

                    const lowBudgets = budgets
                        .map(b => {
                            const total = Number(b.amount || 0);
                            const available = Number(b.available || 0);
                            const percent = total > 0 ? (available / total) * 100 : 0;
                            return { ...b, total, available, percent };
                        })
                        .filter(b => b.percent < 20)
                        .sort((a, b) => a.percent - b.percent);

                    const scope = hasFullAccess ? '' : ' (tus presupuestos)';
                    if (lowBudgets.length > 0) {
                        actionResult += `\n\n[SISTEMA - ⚠️ ALERTAS DE PRESUPUESTO BAJO${scope}]:\n`;
                        actionResult += `Hay **${lowBudgets.length} presupuestos** con menos del 20% disponible:\n\n`;
                        lowBudgets.forEach(b => {
                            const status = b.percent < 5 ? '🔴 CRÍTICO' : b.percent < 10 ? '🟠 BAJO' : '🟡 ALERTA';
                            actionResult += `${status} **${b.title || b.code}** (${b.project?.name || 'Sin proyecto'})\n`;
                            actionResult += `   Disponible: ${formatMoney(b.available)} de ${formatMoney(b.total)} (${b.percent.toFixed(1)}%)\n\n`;
                        });
                        actionButtons.push(
                            { label: 'Generar resumen', type: 'prompt', value: 'Genera un análisis ejecutivo completo' },
                            { label: 'Exportar presupuestos', type: 'prompt', value: 'Exporta los presupuestos a Excel' }
                        );
                    } else {
                        actionResult += `\n\n[SISTEMA]: ✅ No hay presupuestos${scope} con alertas. Todos tienen más del 20% disponible.`;
                    }
                    break;
                }

                case 'EXECUTIVE_ANALYSIS': {
                    const hasFullAccess = FULL_ACCESS_ROLES.includes(userRole);
                    const focus = intent.params.focus || 'full';

                    if (!hasFullAccess) {
                        actionResult += `\n\n[SISTEMA]: ⛔ El análisis ejecutivo global está disponible solo para Dirección, Coordinación o Admin. Puedo revisar tus requerimientos si me preguntas por "mis requerimientos vencidos".`;
                        break;
                    }

                    const now = new Date();
                    const thirtyDaysAgo = new Date();
                    thirtyDaysAgo.setDate(now.getDate() - 30);

                    const includeSection = (section: string) => focus === 'full' || focus === section;
                    const sectionResults: string[] = [];

                    if (includeSection('low_budget')) {
                        const budgets = await prisma.budget.findMany({
                            where: { amount: { gt: 0 } },
                            include: { project: { select: { name: true } } }
                        });
                        const lowBudgets = budgets
                            .map(b => {
                                const total = Number(b.amount || 0);
                                const available = Number(b.available || 0);
                                const percent = total > 0 ? (available / total) * 100 : 0;
                                return { title: b.title || b.code || 'Presupuesto', project: b.project?.name || 'Sin proyecto', available, total, percent };
                            })
                            .filter(b => b.percent < 20)
                            .sort((a, b) => a.percent - b.percent)
                            .slice(0, 5);

                        sectionResults.push(`**Presupuestos bajos:** ${lowBudgets.length ? lowBudgets.map(b => `${b.title} (${b.percent.toFixed(1)}%)`).join('; ') : 'sin alertas bajo 20%'}.`);
                    }

                    if (includeSection('repeated_suppliers')) {
                        const grouped = await prisma.requirement.groupBy({
                            by: ['supplierId'],
                            where: { supplierId: { not: null } },
                            _count: { id: true },
                            _sum: { totalAmount: true },
                            orderBy: { _count: { id: 'desc' } },
                            take: 5
                        });
                        const supplierIds = grouped.map(g => g.supplierId).filter(Boolean) as string[];
                        const suppliers = await prisma.supplier.findMany({
                            where: { id: { in: supplierIds } },
                            select: { id: true, name: true }
                        });
                        const supplierMap = new Map(suppliers.map(s => [s.id, s.name]));
                        const repeated = grouped
                            .filter(g => g._count.id > 1 && g.supplierId)
                            .map(g => `${supplierMap.get(g.supplierId!) || 'Proveedor'}: ${g._count.id} reqs, ${formatMoney(g._sum.totalAmount || 0)}`);
                        sectionResults.push(`**Proveedores repetidos:** ${repeated.length ? repeated.join('; ') : 'no se detectan concentraciones relevantes'}.`);
                    }

                    if (includeSection('anomalies')) {
                        const avgResult = await prisma.requirement.aggregate({
                            where: { totalAmount: { not: null } },
                            _avg: { totalAmount: true }
                        });
                        const avgAmount = Number(avgResult._avg.totalAmount || 0);
                        const threshold = avgAmount > 0 ? avgAmount * 2 : 0;
                        const anomalies = threshold > 0 ? await prisma.requirement.findMany({
                            where: { totalAmount: { gte: threshold } },
                            orderBy: { totalAmount: 'desc' },
                            take: 5,
                            select: { id: true, groupId: true, title: true, totalAmount: true, project: { select: { name: true } } }
                        }) : [];
                        sectionResults.push(`**Compras anómalas:** ${anomalies.length ? anomalies.map(r => `#${r.groupId || r.id.slice(0, 6)} ${r.title} (${formatMoney(r.totalAmount || 0)})`).join('; ') : 'no hay compras sobre 2x el promedio histórico'}.`);
                    }

                    if (includeSection('area_delays')) {
                        const delayed = await prisma.requirement.findMany({
                            where: {
                                createdAt: { lt: thirtyDaysAgo },
                                procurementStatus: { in: ['PENDIENTE', 'EN_TRAMITE', 'ENTREGADO'] as any }
                            },
                            include: { area: { select: { name: true } } },
                            take: 500
                        });
                        const byArea = new Map<string, number>();
                        delayed.forEach(r => byArea.set(r.area?.name || 'Sin área', (byArea.get(r.area?.name || 'Sin área') || 0) + 1));
                        const topAreas = Array.from(byArea.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
                        sectionResults.push(`**Demoras por área:** ${topAreas.length ? topAreas.map(([area, count]) => `${area}: ${count}`).join('; ') : 'sin demoras mayores a 30 días'}.`);
                    }

                    if (includeSection('overdue')) {
                        const overdue = await prisma.requirement.findMany({
                            where: {
                                deliveryDate: { lt: now },
                                procurementStatus: { not: 'FINALIZADO' as any }
                            },
                            orderBy: { deliveryDate: 'asc' },
                            take: 10,
                            select: { id: true, groupId: true, title: true, deliveryDate: true, procurementStatus: true, project: { select: { name: true } } }
                        });
                        sectionResults.push(`**Requerimientos vencidos:** ${overdue.length ? overdue.map(r => `#${r.groupId || r.id.slice(0, 6)} ${r.title} (${r.deliveryDate?.toLocaleDateString('es-CO')})`).join('; ') : 'no hay entregas vencidas abiertas'}.`);
                    }

                    actionResult += `\n\n[SISTEMA - ANÁLISIS EJECUTIVO]:\n${sectionResults.map(s => `• ${s}`).join('\n')}`;
                    actionResult += `\n\nRecomendación: prioriza vencidos y demoras por área antes de abrir nuevas compras del mismo tipo.`;
                    actionButtons.push(
                        { label: 'Requerimientos vencidos', type: 'prompt', value: 'Muéstrame los requerimientos vencidos' },
                        { label: 'Proveedores repetidos', type: 'prompt', value: 'Analiza proveedores repetidos' },
                        { label: 'Exportar requerimientos', type: 'prompt', value: 'Exporta los requerimientos a Excel' }
                    );
                    break;
                }

                case 'WEEKLY_REPORT': {
                    const hasFullAccess = FULL_ACCESS_ROLES.includes(userRole);

                    // Only allow for full access roles
                    if (!hasFullAccess) {
                        actionResult += `\n\n[SISTEMA]: ⛔ El reporte semanal global está disponible solo para roles administrativos. Puedes consultar tus propios requerimientos con "mis requerimientos pendientes".`;
                        break;
                    }

                    const oneWeekAgo = new Date();
                    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

                    // Requirements created this week
                    const newReqs = await prisma.requirement.count({
                        where: { createdAt: { gte: oneWeekAgo } }
                    });

                    // Requirements approved this week
                    const approvedReqs = await prisma.requirement.count({
                        where: { status: 'APPROVED', updatedAt: { gte: oneWeekAgo } }
                    });

                    // Requirements finalized this week
                    const finalizedReqs = await prisma.requirement.count({
                        where: { procurementStatus: 'FINALIZADO', updatedAt: { gte: oneWeekAgo } }
                    });

                    // Total spent this week (based on approved reqs)
                    const weekReqs = await prisma.requirement.aggregate({
                        where: { status: 'APPROVED', updatedAt: { gte: oneWeekAgo } },
                        _sum: { totalAmount: true }
                    });

                    // Pending requirements
                    const pendingReqs = await prisma.requirement.count({
                        where: { procurementStatus: 'PENDIENTE' }
                    });

                    // In progress requirements
                    const inProgressReqs = await prisma.requirement.count({
                        where: { procurementStatus: 'EN_TRAMITE' }
                    });

                    actionResult += `\n\n[SISTEMA - 📊 REPORTE SEMANAL]:\n`;
                    actionResult += `📅 Período: ${oneWeekAgo.toLocaleDateString('es-CO')} - ${new Date().toLocaleDateString('es-CO')}\n\n`;
                    actionResult += `**Actividad de la semana:**\n`;
                    actionResult += `• 📝 Nuevos requerimientos: ${newReqs}\n`;
                    actionResult += `• ✅ Aprobados: ${approvedReqs}\n`;
                    actionResult += `• 🏁 Finalizados: ${finalizedReqs}\n`;
                    actionResult += `• 💰 Monto aprobado: ${formatMoney(weekReqs._sum.totalAmount || 0)}\n\n`;
                    actionResult += `**Estado actual:**\n`;
                    actionResult += `• ⏳ Pendientes: ${pendingReqs}\n`;
                    actionResult += `• 🔄 En trámite: ${inProgressReqs}\n`;
                    break;
                }

                case 'SPENDING_TRENDS': {
                    const hasFullAccess = FULL_ACCESS_ROLES.includes(userRole);

                    // Only allow for full access roles
                    if (!hasFullAccess) {
                        actionResult += `\n\n[SISTEMA]: ⛔ Las tendencias de gasto globales están disponibles solo para roles administrativos (Director, Coordinador, Admin).`;
                        break;
                    }

                    const now = new Date();
                    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);

                    // This month spending
                    const thisMonthReqs = await prisma.requirement.aggregate({
                        where: { status: 'APPROVED', createdAt: { gte: thisMonth } },
                        _sum: { totalAmount: true },
                        _count: { id: true }
                    });

                    // Last month spending
                    const lastMonthReqs = await prisma.requirement.aggregate({
                        where: { status: 'APPROVED', createdAt: { gte: lastMonth, lt: thisMonth } },
                        _sum: { totalAmount: true },
                        _count: { id: true }
                    });

                    // Two months ago
                    const twoMonthsAgoReqs = await prisma.requirement.aggregate({
                        where: { status: 'APPROVED', createdAt: { gte: twoMonthsAgo, lt: lastMonth } },
                        _sum: { totalAmount: true },
                        _count: { id: true }
                    });

                    const thisMonthTotal = Number(thisMonthReqs._sum.totalAmount || 0);
                    const lastMonthTotal = Number(lastMonthReqs._sum.totalAmount || 0);
                    const twoMonthsAgoTotal = Number(twoMonthsAgoReqs._sum.totalAmount || 0);

                    const change = lastMonthTotal > 0 ? ((thisMonthTotal - lastMonthTotal) / lastMonthTotal * 100) : 0;
                    const changeIcon = change > 0 ? '📈' : change < 0 ? '📉' : '➡️';

                    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

                    actionResult += `\n\n[SISTEMA - 📈 TENDENCIAS DE GASTO]:\n\n`;
                    actionResult += `| Mes | Monto | Reqs |\n`;
                    actionResult += `|-----|-------|------|\n`;
                    actionResult += `| ${monthNames[now.getMonth()]} (actual) | ${formatMoney(thisMonthTotal)} | ${thisMonthReqs._count.id} |\n`;
                    actionResult += `| ${monthNames[now.getMonth() - 1 < 0 ? 11 : now.getMonth() - 1]} | ${formatMoney(lastMonthTotal)} | ${lastMonthReqs._count.id} |\n`;
                    actionResult += `| ${monthNames[now.getMonth() - 2 < 0 ? now.getMonth() + 10 : now.getMonth() - 2]} | ${formatMoney(twoMonthsAgoTotal)} | ${twoMonthsAgoReqs._count.id} |\n\n`;
                    actionResult += `${changeIcon} **Variación:** ${change >= 0 ? '+' : ''}${change.toFixed(1)}% vs mes anterior\n`;
                    break;
                }

                case 'COMPARE_SUPPLIERS': {
                    const product = intent.params.product || '';
                    if (product) {
                        // Find invoices/requirements related to this product
                        const reqs = await prisma.requirement.findMany({
                            where: {
                                title: { contains: product, mode: 'insensitive' },
                                supplierId: { not: null }
                            },
                            include: { supplier: true },
                            orderBy: { totalAmount: 'asc' }
                        });

                        if (reqs.length > 0) {
                            // Group by supplier
                            const supplierStats = new Map<string, { name: string, count: number, totalAmount: number, avgAmount: number }>();
                            reqs.forEach(r => {
                                if (r.supplier) {
                                    const existing = supplierStats.get(r.supplier.id) || { name: r.supplier.name, count: 0, totalAmount: 0, avgAmount: 0 };
                                    existing.count++;
                                    existing.totalAmount += Number(r.totalAmount || 0);
                                    existing.avgAmount = existing.totalAmount / existing.count;
                                    supplierStats.set(r.supplier.id, existing);
                                }
                            });

                            const sorted = Array.from(supplierStats.values()).sort((a, b) => a.avgAmount - b.avgAmount);

                            actionResult += `\n\n[SISTEMA - 🏆 COMPARATIVO DE PROVEEDORES para "${product}"]:\n\n`;
                            sorted.forEach((s, i) => {
                                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
                                actionResult += `${medal} **${s.name}**\n`;
                                actionResult += `   Promedio: ${formatMoney(s.avgAmount)} | ${s.count} trabajos | Total: ${formatMoney(s.totalAmount)}\n\n`;
                            });
                        } else {
                            actionResult += `\n\n[SISTEMA]: No encontré requerimientos de "${product}" con proveedores asignados para comparar.`;
                        }
                    } else {
                        actionResult += `\n\n[SISTEMA]: Especifica qué producto o servicio deseas comparar. Ej: "compara proveedores de transporte"`;
                    }
                    break;
                }

                case 'EXPORT_DATA': {
                    const entity = intent.params.entity || 'requirements';
                    const projectName = intent.params.projectName;
                    const format = intent.params.format || 'excel';

                    try {
                        const XLSX = await import('xlsx');
                        const fs = await import('fs');
                        const path = await import('path');

                        let data: any[] = [];
                        let filename = '';
                        let columns: string[] = [];

                        if (entity === 'requirements') {
                            const where: any = {};
                            if (projectName) {
                                const project = await prisma.project.findFirst({ where: { name: { contains: projectName, mode: 'insensitive' } } });
                                if (project) where.projectId = project.id;
                            }

                            const reqs = await prisma.requirement.findMany({
                                where,
                                include: { project: true, supplier: true, createdBy: { select: { name: true } } },
                                orderBy: { createdAt: 'desc' }
                            });

                            columns = ['#', 'Título', 'Proyecto', 'Estado', 'Trámite', 'Monto', 'Proveedor', 'Solicitante', 'Fecha'];
                            data = reqs.map(r => ({
                                '#': r.groupId || '',
                                'Título': r.title,
                                'Proyecto': r.project?.name || '',
                                'Estado': r.status,
                                'Trámite': r.procurementStatus,
                                'Monto': Number(r.totalAmount || 0),
                                'Proveedor': r.supplier?.name || 'Sin asignar',
                                'Solicitante': r.createdBy?.name || '',
                                'Fecha': r.createdAt ? new Date(r.createdAt).toLocaleDateString('es-CO') : ''
                            }));
                            filename = `requerimientos_${projectName?.replace(/\s+/g, '_') || 'todos'}_${Date.now()}`;
                        } else if (entity === 'suppliers') {
                            const suppliers = await prisma.supplier.findMany({ orderBy: { name: 'asc' } });
                            columns = ['Nombre', 'NIT', 'Email', 'Teléfono', 'Actividad', 'Dirección'];
                            data = suppliers.map(s => ({
                                'Nombre': s.name,
                                'NIT': s.nit || s.taxId || '',
                                'Email': s.contactEmail || '',
                                'Teléfono': s.contactPhone || '',
                                'Actividad': s.activity || '',
                                'Dirección': s.address || ''
                            }));
                            filename = `proveedores_${Date.now()}`;
                        } else if (entity === 'budgets') {
                            const budgets = await prisma.budget.findMany({ include: { project: true } });
                            columns = ['Código', 'Título', 'Proyecto', 'Monto Total', 'Disponible', 'Ejecutado', '% Ejecución'];
                            data = budgets.map(b => ({
                                'Código': b.code || '',
                                'Título': b.title,
                                'Proyecto': b.project?.name || '',
                                'Monto Total': Number(b.amount || 0),
                                'Disponible': Number(b.available || 0),
                                'Ejecutado': Number(b.amount || 0) - Number(b.available || 0),
                                '% Ejecución': b.amount ? ((Number(b.amount) - Number(b.available)) / Number(b.amount) * 100).toFixed(1) + '%' : '0%'
                            }));
                            filename = `presupuestos_${Date.now()}`;
                        }

                        if (data.length === 0) {
                            actionResult += `\n\n[SISTEMA]: No hay datos para exportar.`;
                        } else {
                            // Create workbook
                            const ws = XLSX.utils.json_to_sheet(data, { header: columns });
                            const wb = XLSX.utils.book_new();
                            XLSX.utils.book_append_sheet(wb, ws, 'Datos');

                            // Ensure exports directory exists
                            const exportsDir = path.join(process.cwd(), 'exports');
                            if (!fs.existsSync(exportsDir)) {
                                fs.mkdirSync(exportsDir, { recursive: true });
                            }

                            // Save file
                            const filePath = path.join(exportsDir, `${filename}.xlsx`);
                            XLSX.writeFile(wb, filePath);

                            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
                            const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';
                            const downloadUrl = `${backendUrl}/api/exports/${filename}.xlsx`;

                            actionResult += `\n\n[SISTEMA - ✅ ARCHIVO EXPORTADO]:\n`;
                            actionResult += `📊 **${data.length} registros** exportados\n`;
                            actionResult += `📋 Tipo: ${entity === 'requirements' ? 'Requerimientos' : entity === 'suppliers' ? 'Proveedores' : 'Presupuestos'}\n`;
                            if (projectName) actionResult += `📁 Proyecto: ${projectName}\n`;
                            actionResult += `\n📥 **Descarga tu archivo:** [${filename}.xlsx](${downloadUrl})`;
                            actionButtons.push({
                                label: 'Descargar archivo',
                                type: 'link',
                                value: downloadUrl
                            });
                        }
                    } catch (error: any) {
                        console.error('[Export Error]:', error);
                        actionResult += `\n\n[SISTEMA - ERROR]: No pude generar el archivo. ${error.message}`;
                    }
                    break;
                }

                case 'CREATE_REQ': {
                    const { title, amount, projectName, description } = intent.params;

                    if (!title || !amount || !projectName) {
                        actionResult += `\n\n[SISTEMA - CREAR REQUERIMIENTO]:\n`;
                        actionResult += `Para crear un requerimiento necesito:\n`;
                        actionResult += `• **Título**: ${title || '❌ No especificado'}\n`;
                        actionResult += `• **Monto**: ${amount ? formatMoney(amount) : '❌ No especificado'}\n`;
                        actionResult += `• **Proyecto**: ${projectName || '❌ No especificado'}\n\n`;
                        actionResult += `Ejemplo: "Crea un requerimiento de papelería por 500000 para Mantenimiento"`;
                    } else {
                        // Find project
                        const project = await prisma.project.findFirst({
                            where: { name: { contains: projectName, mode: 'insensitive' } }
                        });

                        if (!project) {
                            actionResult += `\n\n[SISTEMA]: No encontré el proyecto "${projectName}". Verifica el nombre.`;
                        } else {
                            // Get next groupId
                            const lastReq = await prisma.requirement.findFirst({ orderBy: { groupId: 'desc' } });
                            const nextGroupId = (lastReq?.groupId || 0) + 1;

                            // Get any area from the system (areas are not project-specific)
                            const area = await prisma.area.findFirst();

                            if (!area) {
                                actionResult += `\n\n[SISTEMA]: No hay áreas configuradas en el sistema. Crea el requerimiento desde la interfaz.`;
                            } else {
                                // Create requirement
                                const newReq = await prisma.requirement.create({
                                    data: {
                                        title,
                                        description: description || '',
                                        estimatedAmount: Number(amount),
                                        totalAmount: Number(amount),
                                        projectId: project.id,
                                        areaId: area.id,
                                        groupId: nextGroupId,
                                        status: 'PENDING_APPROVAL',
                                        procurementStatus: 'PENDIENTE',
                                        reqCategory: 'COMPRA',
                                        createdById: (req as any).userId || ''
                                    }
                                });

                                actionResult += `\n\n[SISTEMA - ✅ REQUERIMIENTO CREADO]:\n`;
                                actionResult += `📋 **#${newReq.groupId} - ${newReq.title}**\n`;
                                actionResult += `💰 Monto: ${formatMoney(Number(amount))}\n`;
                                actionResult += `📁 Proyecto: ${project.name}\n`;
                                actionResult += `📝 Estado: Pendiente de aprobación\n\n`;
                                actionResult += `El requerimiento ha sido creado y está pendiente de aprobación.`;
                                actionButtons.push({
                                    label: 'Ver requerimiento',
                                    type: 'link',
                                    value: `/requirements/${newReq.id}`
                                });
                            }
                        }
                    }
                    break;
                }

                case 'ASSIGN_SUPPLIER': {
                    const { supplierName, groupId } = intent.params;

                    if (!supplierName || !groupId) {
                        actionResult += `\n\n[SISTEMA]: Especifica el proveedor y el requerimiento. Ej: "Asigna Juan Pérez al requerimiento #5"`;
                    } else {
                        // Find supplier
                        const supplier = await prisma.supplier.findFirst({
                            where: { name: { contains: supplierName, mode: 'insensitive' } }
                        });

                        if (!supplier) {
                            actionResult += `\n\n[SISTEMA]: No encontré el proveedor "${supplierName}".`;
                        } else {
                            // Find requirement
                            const requirement = await prisma.requirement.findFirst({
                                where: { groupId: Number(groupId) }
                            });

                            if (!requirement) {
                                actionResult += `\n\n[SISTEMA]: No encontré el requerimiento #${groupId}.`;
                            } else {
                                // Update requirement
                                await prisma.requirement.update({
                                    where: { id: requirement.id },
                                    data: { supplierId: supplier.id }
                                });

                                actionResult += `\n\n[SISTEMA - ✅ PROVEEDOR ASIGNADO]:\n`;
                                actionResult += `👤 Proveedor: **${supplier.name}**\n`;
                                actionResult += `📋 Requerimiento: #${groupId} - ${requirement.title}\n`;
                                actionButtons.push({
                                    label: 'Ver requerimiento',
                                    type: 'link',
                                    value: `/requirements/${requirement.id}`
                                });
                            }
                        }
                    }
                    break;
                }
            }
        } catch (e: any) {
            console.error("[AI ERROR] Intent Classifier/Action Execution Error:", e.message);
            console.error("[AI ERROR] Stack:", e.stack);
            // Add error to action result so user knows something went wrong
            actionResult += `\n\n[SISTEMA - ERROR]: Hubo un problema ejecutando la acción. Detalle técnico: ${e.message}`;
        }


        // Append action results to context
        if (actionResult) {
            contextData += actionResult;
        }

        // 2. Prepare System Prompt (MisCompras Bot Identity)
        const systemRules = `Eres MisCompras Bot, un asistente virtual profesional creado por el equipo de desarrollo de MisCompras para el Museo de Antioquia.
        
        ⛔ PROHIBIDO ABSOLUTAMENTE:
        - NO digas "Hola", "¡Hola!", "Buenos días", "Buenas tardes" ni NINGÚN saludo.
        - NO te presentes ("Soy MisCompras Bot", "Estoy aquí para ayudarte").
        - NO ofrezcas ayuda genérica ("¿En qué puedo ayudarte?", "¿Qué necesitas?").
        
        ✅ QUÉ HACER:
        - Responde DIRECTO a la pregunta con datos concretos.
        - Si hay datos del sistema en [SISTEMA], úsalos para responder.
        - Máximo 3 oraciones, a menos que presentes datos tabulares o listas.
        - Si te preguntan quién te creó: "El equipo de desarrollo de MisCompras" (NO menciones IA, Gemini, OpenAI).
        
        📚 REGLAS DE NEGOCIO:
        ${SYSTEM_FAQ}
        
        📊 DATOS ACTUALES DEL SISTEMA:
        ${contextData}
        
        ⚠️ REGLA DE ORO: Si no tienes datos específicos para responder, invita al usuario a consultar el manual o contactar a soporte. NUNCA inventes datos.`;

        // 3. START CHAT WITH CORRECT HISTORY PATTERN
        console.log(`[AI DEBUG] User Message: "${message}"`);
        console.log(`[AI DEBUG] System Rules Length: ${systemRules.length}`);

        // Gemini history MUST alternate: user, model, user, model...
        // We ensure sanitizedHistory starts with 'user' and alternates.
        let sanitizedHistory: any[] = [];
        let nextExpectedRole = 'user';

        if (history && Array.isArray(history)) {
            history.forEach((msg: any) => {
                if (msg.role === 'model' && msg.content?.includes('¡Hola! Soy tu asistente virtual')) return;

                const role = msg.role === 'user' ? 'user' : 'model';
                if (role === nextExpectedRole) {
                    sanitizedHistory.push({
                        role,
                        parts: [{ text: msg.content }]
                    });
                    nextExpectedRole = role === 'user' ? 'model' : 'user';
                }
            });
        }

        // If history ends with 'user', we need a dummy 'model' response or remove the last 'user'
        // But better: startChat only with what complies with [user, model] pairs.
        if (sanitizedHistory.length > 0 && sanitizedHistory[sanitizedHistory.length - 1].role === 'user') {
            // If the last one is user, we can't send another user message via startChat.
            // We'll just take the last (model) pair if possible, or clear it if it's just one user message.
            // Actually, the most reliable is to only keep complete pairs.
            const lastRole = sanitizedHistory[sanitizedHistory.length - 1].role;
            if (lastRole === 'user') {
                // For Gemini, history must have even number of items if we are about to send a user message? 
                // Actually, it can be odd if it ends with model.
            }
        }

        // Handle Image Input
        let currentMessageParts: any[] = [{ text: `${message}\n\n(RECORDATORIO: No saludes, responde directo)` }];
        if (image && mimeType) {
            currentMessageParts.push({
                inlineData: {
                    mimeType: mimeType,
                    data: image
                }
            });
        }

        const responseText = await generateWithFallback({
            systemInstruction: systemRules,
            history: sanitizedHistory,
            message: currentMessageParts
        });

        console.log(`[AI DEBUG] AI Response Text length: ${responseText?.length || 0}`);
        if (responseText) console.log(`[AI DEBUG] AI Response start: "${responseText.substring(0, 50)}..."`);

        // Handle empty responses AND Cleaning
        let finalReply = responseText?.trim() || '';

        // CLEAN GREETINGS (Aggressive Removal - Always Applied!)
        const cleanResponse = (text: string) => {
            return text
                // Remove greetings at the start
                .replace(/^[¡!]*(hola|buenos?\s*d[íi]as?|buenas?\s*(tardes?|noches?))[¡!.,\s]*/gim, '')
                // Remove self-introductions
                .replace(/^(soy\s+miscompras\s*bot[.,]?\s*)/gim, '')
                .replace(/^(como\s+(tu\s+)?asistente[.,]?\s*)/gim, '')
                .replace(/^(estoy\s+(listo|aquí|disponible)\s+(para\s+)?(proporcionar|ayudar)[^.]*\.?\s*)/gim, '')
                // Remove generic help offers
                .replace(/^(¿en\s+qu[ée]\s+(te\s+)?puedo\s+ayudar(te)?(\s+hoy)?\??[.,]?\s*)/gim, '')
                .replace(/^(¿qu[ée]\s+necesitas\??[.,]?\s*)/gim, '')
                // Clean extra whitespace
                .replace(/^\s+/, '')
                .trim();
        };

        // ALWAYS clean the response - no conditions!
        if (finalReply) {
            finalReply = cleanResponse(finalReply);
        }

        // Fallback Logic
        if (!finalReply) {
            if (actionResult) {
                finalReply = `He realizado la acción solicitada:\n${actionResult.replace(/\[SISTEMA[^\]]*\]/g, '').trim() || 'Completado.'}`;
            } else {
                finalReply = 'Entendido. ¿Deseas consultar algo más sobre tus requerimientos o proveedores?';
            }
        }

        console.log(`[AI DEBUG] Final Reply length: ${finalReply.length}`);
        console.log(`[AI PERF] Chat completed in ${Date.now() - startedAt}ms with ${actionButtons.length} action button(s)`);
        res.json({ reply: finalReply, actions: actionButtons.slice(0, 4) });

    } catch (error: any) {
        console.error("AI Controller Error:", error);
        res.status(500).json({
            error: "Hubo un problema al procesar tu solicitud. Por favor intenta de nuevo.",
            // details removed - never expose model names
            keyPresent: !!process.env.GEMINI_API_KEY
        });
    }
};

export const extractRequirement = async (req: Request, res: Response) => {
    try {
        const { text } = req.body;

        const extractionPrompt = `
        Actúa como un asistente experto. Extrae datos para Requerimiento de Compra.
        TEXTO: "${text}"
        JSON Output: { "title", "description", "quantity", "estimatedAmount" (number), "suggestedSupplier" }
        `;

        const responseText = await generateWithFallback({
            prompt: extractionPrompt,
            jsonMode: true
        });

        const jsonResponse = JSON.parse(responseText);
        res.json(jsonResponse);

    } catch (error: any) {
        console.error("AI Extraction Error:", error);
        res.status(500).json({
            error: "Error procesando el texto.",
            details: error.message
        });
    }
};
