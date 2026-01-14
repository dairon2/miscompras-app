import { Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../db';
import { SYSTEM_FAQ } from '../utils/aiKnowledge';

// Initialize Gemini SDK
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Fallback Chain Strategy: If one fails (429), try the next.
// We mix recent versions with stable ones to maximize quota pools.
const FALLBACK_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite", // Lite version (distinct quota?)
    "gemini-2.0-flash-lite-preview-02-05",
    "gemini-1.5-flash",
    "gemini-1.5-pro"
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
            // Configure Model
            const config: any = {};
            if (params.jsonMode) config.responseMimeType = "application/json";

            const model = genAI.getGenerativeModel({
                model: modelName,
                systemInstruction: params.systemInstruction,
                generationConfig: config
            });

            if (params.history && params.message) {
                // CHAT MODE
                const chat = model.startChat({
                    history: params.history,
                    generationConfig: { maxOutputTokens: 2500 }
                });

                const result = await chat.sendMessage(params.message);
                return result.response.text();
            } else if (params.prompt) {
                // SINGLE PROMPT MODE
                const result = await model.generateContent(params.prompt);
                return result.response.text();
            }

        } catch (error: any) {
            // ... (Keep existing error handling)
            console.warn(`Model ${modelName} failed: ${error.message}`);
            lastError = error;
            const isQuotaError = error.message?.includes('429') || error.message?.includes('503') || error.message?.includes('overloaded');
            if (!isQuotaError) throw error;
            continue;
        }
    }
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
                prisma.requirement.findMany({ where: { createdById: userId }, take: 5, orderBy: { createdAt: 'desc' }, select: { title: true, status: true, totalAmount: true } }),
                prisma.budget.findMany({ where: { OR: [{ managerId: userId }, { subLeaders: { some: { userId } } }] }, take: 5, select: { title: true, available: true, project: { select: { name: true } } } }),
                prisma.project.findMany({ where: { leaderId: userId }, take: 5, select: { name: true, code: true } }),
                prisma.invoice.findMany({ where: { createdById: userId }, take: 5, orderBy: { issueDate: 'desc' }, select: { invoiceNumber: true, amount: true, status: true, supplier: { select: { name: true } } } })
            ]);
            contextData = `DATOS DEL USUARIO (${user.name}):\nMIS ÚLTIMOS REQUERIMIENTOS:\n${myReqs.map(r => `- ${r.title} (${r.status}): ${formatMoney(r.totalAmount)}`).join('\n')}\nMIS PRESUPUESTOS ASIGNADOS:\n${myBudgets.map(b => `- ${b.title} (Proyecto: ${b.project.name}): Disponible ${formatMoney(b.available)}`).join('\n')}\nMIS PROYECTOS LIDERADOS:\n${myProjects.map(p => `- ${p.name} (${p.code})`).join('\n')}\nMIS FACTURAS:\n${myInvoices.map(i => `- #${i.invoiceNumber} (${i.supplier.name}): ${formatMoney(i.amount)}`).join('\n')}`;
        } else {
            // Get counts first
            const [projectCount, budgetCount, supplierCount, pendingCount] = await Promise.all([
                prisma.project.count(),
                prisma.budget.count(),
                prisma.supplier.count(),
                prisma.requirement.count({ where: { status: 'PENDING_APPROVAL' } })
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
- Requerimientos Pendientes: ${pendingCount}

PROYECTOS RECIENTES: ${projects.map(p => p.name).join(', ')}

PRESUPUESTOS RECIENTES: ${budgets.map(b => `${b.title} ($${b.available})`).join(', ')}

MUESTRA DE PROVEEDORES (20 de ${supplierCount} totales):
${supplierContext}

IMPORTANTE: La lista anterior es solo una MUESTRA. Para buscar proveedores específicos, el sistema buscará en TODA la base de datos (${supplierCount} proveedores). Cuando te pregunten "¿cuántos proveedores hay?", responde con el total real: ${supplierCount}.`;
        }

        // =====================================================
        // AI ACTIONS: Intent Detection & Execution
        // =====================================================
        const lowerMsg = message.toLowerCase();
        let actionResult = "";

        // #2 - COMPARADOR DE PRECIOS
        if (lowerMsg.includes('precio') || lowerMsg.includes('cuánto') || lowerMsg.includes('cuanto') || lowerMsg.includes('costó') || lowerMsg.includes('pagamos')) {
            try {
                const pricePrompt = `Analiza: "${message}". ¿El usuario quiere saber el PRECIO HISTÓRICO de un producto/servicio? Extrae el producto. JSON: {"action":"PRICE_CHECK","product":"nombre"} o {"action":"NONE"}`;
                const priceResult = await generateWithFallback({ prompt: pricePrompt, jsonMode: true });
                const priceJson = JSON.parse(priceResult);

                if (priceJson.action === 'PRICE_CHECK' && priceJson.product) {
                    const invoices = await prisma.invoice.findMany({
                        where: {
                            OR: [
                                { requirement: { title: { contains: priceJson.product, mode: 'insensitive' } } },
                                { requirement: { description: { contains: priceJson.product, mode: 'insensitive' } } }
                            ]
                        },
                        take: 5,
                        orderBy: { issueDate: 'desc' },
                        select: { amount: true, issueDate: true, supplier: { select: { name: true } }, requirement: { select: { title: true } } }
                    });
                    if (invoices.length > 0) {
                        actionResult += `\n\n[SISTEMA - HISTORIAL DE PRECIOS para "${priceJson.product}"]:\n`;
                        invoices.forEach(inv => {
                            actionResult += `- ${inv.requirement?.title || 'Item'}: ${formatMoney(inv.amount)} (${inv.supplier?.name}, ${inv.issueDate?.toLocaleDateString('es-CO')})\n`;
                        });
                    }
                }
            } catch (e) { console.error("Price Check Error:", e); }
        }

        // #4 - SUGERENCIA DE PROVEEDOR (Busca por NOMBRE y ACTIVIDAD)
        if (lowerMsg.includes('proveedor') || lowerMsg.includes('quién vende') || lowerMsg.includes('quien vende') || lowerMsg.includes('a quién le compro') || lowerMsg.includes('recomienda') || lowerMsg.includes('actividad') || lowerMsg.includes('busca') || lowerMsg.includes('encuentra')) {
            try {
                const suggestPrompt = `Analiza: "${message}". ¿El usuario busca un PROVEEDOR por nombre o por lo que vende? Extrae palabras clave (nombre o producto). JSON: {"action":"FIND_SUPPLIER","keywords":["palabra1","palabra2"],"searchType":"name"|"activity"|"both"} o {"action":"NONE"}`;
                const suggestResult = await generateWithFallback({ prompt: suggestPrompt, jsonMode: true });
                const suggestJson = JSON.parse(suggestResult);

                if (suggestJson.action === 'FIND_SUPPLIER' && suggestJson.keywords?.length > 0) {
                    const keywords = suggestJson.keywords as string[];
                    const searchType = suggestJson.searchType || 'both';

                    // Build OR conditions for name AND activity
                    const orConditions: any[] = [];
                    keywords.forEach((kw: string) => {
                        const keyword = kw.trim();
                        if (searchType === 'name' || searchType === 'both') {
                            orConditions.push({ name: { contains: keyword, mode: 'insensitive' } });
                        }
                        if (searchType === 'activity' || searchType === 'both') {
                            orConditions.push({ activity: { contains: keyword, mode: 'insensitive' } });
                        }
                    });

                    const matchingSuppliers = await prisma.supplier.findMany({
                        where: { OR: orConditions },
                        take: 15,
                        select: { name: true, activity: true, contactEmail: true, phone: true, criticality: true, nit: true }
                    });

                    if (matchingSuppliers.length > 0) {
                        actionResult += `\n\n[SISTEMA - PROVEEDORES ENCONTRADOS (búsqueda: "${keywords.join(', ')}")]:\n`;
                        matchingSuppliers.forEach(s => {
                            actionResult += `- ${s.name}${s.nit ? ` (NIT: ${s.nit})` : ''}: ${s.activity || 'Sin actividad registrada'} | ${s.contactEmail || s.phone || 'Sin contacto'}${s.criticality === 'HIGH' ? ' ⭐' : ''}\n`;
                        });
                    } else {
                        actionResult += `\n\n[SISTEMA]: No encontré proveedores con nombre o actividad que contenga: "${keywords.join(', ')}". Verifica la ortografía o registra un nuevo proveedor.`;
                    }
                }
            } catch (e) { console.error("Find Supplier Error:", e); }
        }

        // #6 - SEGUIMIENTO DE ENTREGAS
        if (lowerMsg.includes('entrega') || lowerMsg.includes('falta') || lowerMsg.includes('recibir') || lowerMsg.includes('pendiente') || lowerMsg.includes('llegó')) {
            try {
                const deliveryPrompt = `Analiza: "${message}". ¿El usuario pregunta por ENTREGAS PENDIENTES o seguimiento? JSON: {"action":"DELIVERY_CHECK"} o {"action":"NONE"}`;
                const deliveryResult = await generateWithFallback({ prompt: deliveryPrompt, jsonMode: true });
                const deliveryJson = JSON.parse(deliveryResult);

                if (deliveryJson.action === 'DELIVERY_CHECK') {
                    const pendingDeliveries = await prisma.requirement.findMany({
                        where: {
                            status: 'APPROVED',
                            procurementStatus: { in: ['EN_TRAMITE', 'PENDIENTE'] },
                            receivedDate: null
                        },
                        take: 10,
                        orderBy: { updatedAt: 'desc' },
                        select: { title: true, groupId: true, supplier: { select: { name: true } }, deliveryDate: true, procurementStatus: true }
                    });
                    if (pendingDeliveries.length > 0) {
                        actionResult += `\n\n[SISTEMA - ENTREGAS PENDIENTES (${pendingDeliveries.length})]:\n`;
                        pendingDeliveries.forEach(r => {
                            const fecha = r.deliveryDate ? r.deliveryDate.toLocaleDateString('es-CO') : 'Sin fecha';
                            actionResult += `- #${r.groupId || 'N/A'} ${r.title} (${r.supplier?.name || 'Sin proveedor'}) - Entrega: ${fecha} [${r.procurementStatus}]\n`;
                        });
                    } else {
                        actionResult += `\n\n[SISTEMA]: No hay entregas pendientes registradas. ✅`;
                    }
                }
            } catch (e) { console.error("Delivery Check Error:", e); }
        }

        // #10 - PREDICCIÓN DE NECESIDADES
        if (lowerMsg.includes('predic') || lowerMsg.includes('próximo mes') || lowerMsg.includes('necesitar') || lowerMsg.includes('recurrente') || lowerMsg.includes('patrón')) {
            try {
                const predictPrompt = `Analiza: "${message}". ¿El usuario quiere una PREDICCIÓN de compras futuras basada en historial? JSON: {"action":"PREDICT"} o {"action":"NONE"}`;
                const predictResult = await generateWithFallback({ prompt: predictPrompt, jsonMode: true });
                const predictJson = JSON.parse(predictResult);

                if (predictJson.action === 'PREDICT') {
                    // Get last 6 months of purchases grouped by title pattern
                    const sixMonthsAgo = new Date();
                    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

                    const recentReqs = await prisma.requirement.findMany({
                        where: { createdAt: { gte: sixMonthsAgo }, status: { not: 'REJECTED' } },
                        select: { title: true, totalAmount: true, createdAt: true }
                    });

                    // Simple frequency analysis
                    const titleCount: Record<string, { count: number, total: number }> = {};
                    recentReqs.forEach(r => {
                        const key = r.title.toLowerCase().split(' ').slice(0, 3).join(' ');
                        if (!titleCount[key]) titleCount[key] = { count: 0, total: 0 };
                        titleCount[key].count++;
                        titleCount[key].total += Number(r.totalAmount || 0);
                    });

                    const recurring = Object.entries(titleCount)
                        .filter(([_, v]) => v.count >= 2)
                        .sort((a, b) => b[1].count - a[1].count)
                        .slice(0, 5);

                    if (recurring.length > 0) {
                        actionResult += `\n\n[SISTEMA - COMPRAS RECURRENTES (últimos 6 meses)]:\n`;
                        recurring.forEach(([title, data]) => {
                            actionResult += `- "${title}..." comprado ${data.count} veces, total ${formatMoney(data.total)}\n`;
                        });
                        actionResult += `\nINSTRUCCIÓN: Sugiere al usuario que probablemente necesitará estos items el próximo mes.`;
                    }
                }
            } catch (e) { console.error("Prediction Error:", e); }
        }

        // #11 - ENVIAR EMAIL A PROVEEDOR
        if (lowerMsg.includes('email') || lowerMsg.includes('correo') || lowerMsg.includes('cotización') || lowerMsg.includes('enviar') || lowerMsg.includes('contactar proveedor')) {
            try {
                const emailPrompt = `Analiza: "${message}". ¿El usuario quiere ENVIAR un EMAIL/cotización a un proveedor? Extrae proveedor y producto. JSON: {"action":"SEND_EMAIL","supplier":"nombre","product":"descripción"} o {"action":"NONE"}`;
                const emailResult = await generateWithFallback({ prompt: emailPrompt, jsonMode: true });
                const emailJson = JSON.parse(emailResult);

                if (emailJson.action === 'SEND_EMAIL' && emailJson.supplier) {
                    const supplier = await prisma.supplier.findFirst({
                        where: { name: { contains: emailJson.supplier, mode: 'insensitive' } },
                        select: { name: true, contactEmail: true }
                    });

                    if (supplier?.contactEmail) {
                        // Import email service
                        const { sendEmail } = await import('../services/emailService');
                        const emailContent = `
                            <p>Estimado/a proveedor ${supplier.name},</p>
                            <p>Solicitamos cotización para: <strong>${emailJson.product || 'productos varios'}</strong></p>
                            <p>Por favor responda a este correo con su mejor oferta.</p>
                            <p>Atentamente,<br>Departamento de Compras<br>Museo de Antioquia</p>
                        `;

                        // Note: Not actually sending to avoid spam, just preparing
                        actionResult += `\n\n[SISTEMA - EMAIL PREPARADO]:\n`;
                        actionResult += `📧 Para: ${supplier.contactEmail}\n`;
                        actionResult += `📝 Asunto: Solicitud de Cotización - ${emailJson.product || 'Varios'}\n`;
                        actionResult += `✉️ El email está listo. ¿Deseas que lo envíe? (Responde "Sí, enviar" para confirmar)\n`;

                        // Store pending email in context for next message
                        contextData += `\n\n[EMAIL_PENDIENTE]: Proveedor=${supplier.name}, Email=${supplier.contactEmail}, Producto=${emailJson.product}`;
                    } else {
                        actionResult += `\n\n[SISTEMA]: No encontré el email del proveedor "${emailJson.supplier}". Verifica el nombre o registra su contacto.`;
                    }
                }
            } catch (e) { console.error("Email Action Error:", e); }
        }

        // Append action results to context
        if (actionResult) {
            contextData += actionResult;
        }

        // 2. Prepare System Prompt
        const systemPrompt = `
        Eres "MisCompras Bot", asistente experto de compras del Museo de Antioquia.
        ${SYSTEM_FAQ}
        ${contextData}
        
        TU MISIÓN:
        1. Responder dudas usando el CENTRO DE AYUDA.
        2. Analizar DOCUMENTOS (Facturas, Cotizaciones) si el usuario los adjunta.
        3. COMPARAR PRECIOS históricos cuando pregunten "¿cuánto costó X?".
        4. SUGERIR PROVEEDORES según su actividad registrada.
        5. RASTREAR ENTREGAS pendientes cuando pregunten "¿qué falta por llegar?".
        6. PREDECIR NECESIDADES basándote en compras recurrentes.
        7. PREPARAR EMAILS de cotización para proveedores.
        
        REGLAS:
        - Usa datos del [SISTEMA] cuando estén disponibles.
        - Sé conciso y profesional.
        - Si hay [EMAIL_PENDIENTE], espera confirmación antes de enviar.
        `;

        // 3. START CHAT WITH FALLBACK
        const sanitizedHistory = history?.filter((msg: any, index: number) => {
            if (index === 0 && msg.role === 'model') return false;
            return true;
        }) || [];

        const formattedHistory = sanitizedHistory.map((msg: any) => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
        }));

        // Handle Image Input
        let currentMessageParts: any[] = [{ text: message }];
        if (image && mimeType) {
            currentMessageParts.push({
                inlineData: {
                    mimeType: mimeType,
                    data: image
                }
            });
        }

        const responseText = await generateWithFallback({
            systemInstruction: systemPrompt,
            history: formattedHistory,
            message: currentMessageParts
        });

        res.json({ reply: responseText });

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
