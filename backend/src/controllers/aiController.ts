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
    "groq/deepseek-r1-distill-llama-70b" // Reasoning Fallback
];

// ... (Imports and previous code)

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

        try {
            // Context for classification: message and limited history
            const historyText = history?.slice(-6).map((h: any) => {
                const content = typeof h.content === 'string' ? h.content : (h.parts?.[0]?.text || '');
                return `${h.role === 'user' ? 'Usuario' : 'Asistente'}: ${content}`;
            }).join('\n') || '';

            const classifierPrompt = `
            Actúa como el motor de intenciones de "MisCompras Bot". Analiza el mensaje del usuario y el historial para categorizar la acción.
            
            HISTORIAL RECIENTE:
            ${historyText}
            
            MENSAJE DEL USUARIO: "${message}"
            
            CATEGORÍAS DE ACCIÓN:
            - FIND_SUPPLIER: Buscar proveedores (Ej: "busca proveedor x", "quien vende y"). Parámetros: keywords (array de palabras clave), type (name|activity|both).
            - DELETE_SUPPLIER: Eliminar un proveedor. Si el usuario dice "eliminalo", "borralo" o "quita a ese" refiriéndose al último mencionado, detecta a quién se refiere. Parámetros: name (nombre del proveedor).
            - FIND_REQ: Buscar un requerimiento específico. Parámetros: groupId (number), id (uuid), title (string).
            - COUNT_GLOBAL: Estadísticas generales (Ej: "¿cuántos requerimientos hay?", "¿total de proveedores?", "¿cuántos proyectos?"). Parámetros: entity (requirement|supplier|project|budget).
            - SEND_QUOTE: Preparar solicitud de cotización para un proveedor. Parámetros: supplierName, product, groupId.
            - CONFIRM_ACTION: El usuario confirma una acción propuesta anteriormente (Ej: "sí, enviar", "confirmar", "hazlo", "sí").
            - PRICE_HISTORY: Consultar precios históricos o historial de pagos de un producto/item. Parámetros: item.
            - EXEC_SUMMARY: Reporte ejecutivo/resumen de un proyecto o área específica. Parámetros: target (project|area), name.
            - APPROVE_REQ: Autorizar o aprobar un requerimiento. Parámetros: groupId.
            - NONE: Si es saludo, charla informal o duda sobre cómo usar el sistema sin pedir una acción específica.

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
                            include: { project: true, area: true, supplier: true, budget: true }
                        });
                        if (req) {
                            actionResult += `\n\n[SISTEMA - REQUERIMIENTO ENCONTRADO]:\n`;
                            actionResult += `📋 #${req.groupId} - ${req.title}\n`;
                            actionResult += `📊 Estado: ${req.status} | Trámite: ${req.procurementStatus}\n`;
                            actionResult += `💰 Monto: ${formatMoney(req.totalAmount || req.estimatedAmount)}\n`;
                            actionResult += `🏢 Proyecto: ${req.project?.name || 'N/A'} | Área: ${req.area?.name || 'N/A'}\n`;
                            if (req.supplier) actionResult += `🏪 Proveedor: ${req.supplier.name}\n`;
                        } else {
                            actionResult += `\n\n[SISTEMA]: No encontré ningún requerimiento que coincida con la búsqueda.`;
                        }
                    }
                    break;
                }

                case 'COUNT_GLOBAL': {
                    const entity = intent.params.entity;
                    if (entity === 'requirement') {
                        const count = await prisma.requirement.count();
                        actionResult += `\n\n[SISTEMA - ESTADÍSTICA]: Actualmente existen **${count} requerimientos** registrados en total.`;
                    } else if (entity === 'supplier') {
                        const count = await prisma.supplier.count();
                        actionResult += `\n\n[SISTEMA - ESTADÍSTICA]: Hay **${count} proveedores** en tu base de datos.`;
                    } else if (entity === 'project') {
                        const count = await prisma.project.count();
                        actionResult += `\n\n[SISTEMA - ESTADÍSTICA]: Gestionas un total de **${count} proyectos**.`;
                    } else if (entity === 'budget') {
                        const count = await prisma.budget.count();
                        actionResult += `\n\n[SISTEMA - ESTADÍSTICA]: Hay **${count} presupuestos** configurados.`;
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
            }
        } catch (e: any) {
            console.error("Intent Classifier Error:", e.message);
        }


        // Append action results to context
        if (actionResult) {
            contextData += actionResult;
        }

        // 2. Prepare System Prompt (MisCompras Bot Identity)
        const systemRules = `Eres MisCompras Bot, un asistente virtual profesional y eficiente creado por el equipo de desarrollo de MisCompras para el Museo de Antioquia.
        
        IDENTIDAD Y TONO:
        - Tu nombre es MisCompras Bot.
        - Eres servicial, técnico y muy conciso.
        - Si te preguntan quién te creó, responde: "Fui creado por el equipo de desarrollo de MisCompras". No menciones modelos de lenguaje (Gemini, OpenAI, etc.).

        REGLAS DE RESPUESTA:
        - NO saludes ("Hola", "Buen día"). Ve directo al grano.
        - Máximo 3 oraciones, a menos que presentes datos tabulares o listas del sistema.
        - Usa solo los datos proporcionados en el contexto (Action Results y Database Context).
        - Si una acción se realizó (ej. eliminación), confírmala brevemente.

        CENTRO DE CONOCIMIENTO:
        ${SYSTEM_FAQ}
        
        CONTEXTO DE LA OPERACIÓN ACTUAL:
        ${contextData}
        
        ⚠️ REGLA DE ORO: Si no tienes datos específicos para responder una duda técnica, invita al usuario a consultar el manual o contactar a soporte.`;

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

        // CLEAN GREETINGS (Forceful Removal)
        const cleanResponse = (text: string) => {
            return text.replace(/^(¡?hola!?[,.]?|¡?buenos d[íi]as!?[,.]?|¡?buenas tardes!?[,.]?|soy miscompras bot[,.]?|estoy aqu[íi] para ayudarte[,.]?)/gim, '')
                .replace(/^(\s*y tú\??\s*|\s*miscompras bot\s*)/gim, '')
                .trim();
        };

        if (finalReply) {
            // Only clean if we have system data to show, to ensure we don't return empty on casual chat
            if (actionResult || contextData.length > 500) {
                finalReply = cleanResponse(finalReply);
            }
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
        res.json({ reply: finalReply });

    } catch (error: any) {
        console.error("AI Controller Error:", error);
        res.status(500).json({
            error: "Error interno del asistente.",
            details: error.message,
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
