import { Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../db';
import { SYSTEM_FAQ } from '../utils/aiKnowledge';

// Initialize Gemini SDK
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Fallback Chain Strategy: If one fails (429/404), try the next.
// Each model has separate quota, so more models = more daily requests
const FALLBACK_MODELS = [
    "gemini-2.5-flash",       // Primary (20/day free)
    "gemini-2.5-flash-lite",  // Fallback 1 (20/day free)
    "gemini-2.0-flash",       // Fallback 2 (20/day free)
    "gemini-1.5-flash",       // Fallback 3 (20/day free)
    "gemini-1.5-pro"          // Fallback 4 (20/day free)
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

        // #0 - CONFIRMAR ENVÍO DE EMAIL
        if (lowerMsg.includes('sí') && (lowerMsg.includes('enviar') || lowerMsg.includes('confirmo') || lowerMsg.includes('envía') || lowerMsg.includes('envíalo'))) {
            try {
                // Build history context from messages
                const historyText = history?.map((h: any) => {
                    if (typeof h.content === 'string') return h.content;
                    if (Array.isArray(h.parts)) return h.parts.map((p: any) => p.text || '').join(' ');
                    return '';
                }).join(' ') || '';

                // Use AI to extract the pending email details from context
                const extractPrompt = `Analiza este historial de chat: "${historyText}". 
                Busca si hay un email PREPARADO para enviar a un proveedor. Extrae el nombre del proveedor, su email, y el producto.
                JSON: {"found":true,"supplierName":"nombre","supplierEmail":"email@example.com","product":"descripción"} o {"found":false}`;

                const extractResult = await generateWithFallback({ prompt: extractPrompt, jsonMode: true });
                const extractJson = JSON.parse(extractResult);

                if (extractJson.found && extractJson.supplierEmail) {
                    // Get requirement details if mentioned in history
                    const groupIdMatch = historyText.match(/[Rr]eq(?:uerimiento)?\s*#?(\d+)/);
                    let reqDetails = '';
                    if (groupIdMatch) {
                        const req = await prisma.requirement.findFirst({
                            where: { groupId: parseInt(groupIdMatch[1]) },
                            select: { title: true, description: true, quantity: true, estimatedAmount: true }
                        });
                        if (req) {
                            reqDetails = `<br><br><strong>Detalle del Requerimiento #${groupIdMatch[1]}:</strong><br>- ${req.title}<br>- ${req.description || 'Sin descripción adicional'}<br>- Cantidad: ${req.quantity || 'A definir'}<br>- Presupuesto estimado: ${formatMoney(req.estimatedAmount)}`;
                        }
                    }

                    // Build and send email
                    const { sendEmail, getEmailTemplate } = await import('../services/emailService');
                    const emailContent = `
                        <p>Estimado/a proveedor <strong>${extractJson.supplierName}</strong>,</p>
                        <p>Desde el Museo de Antioquia, solicitamos cotización para:</p>
                        <div style="background:#f5f5f5; padding:15px; border-radius:8px; margin:15px 0;">
                            <strong>${extractJson.product || 'Productos/Servicios'}</strong>
                            ${reqDetails}
                        </div>
                        <p>Por favor responda a este correo con su mejor oferta, incluyendo:</p>
                        <ul>
                            <li>Precio unitario y total</li>
                            <li>Tiempo de entrega</li>
                            <li>Condiciones de pago</li>
                            <li>Vigencia de la cotización</li>
                        </ul>
                        <p>Atentamente,<br><strong>Departamento de Compras</strong><br>Museo de Antioquia</p>
                    `;

                    const subject = `Solicitud de Cotización - ${extractJson.product || 'Varios'}`;
                    const htmlContent = getEmailTemplate(subject, emailContent);

                    await sendEmail(extractJson.supplierEmail.trim(), subject, htmlContent);

                    actionResult += `\n\n[SISTEMA - EMAIL ENVIADO ✅]:\n`;
                    actionResult += `📧 Enviado a: ${extractJson.supplierEmail}\n`;
                    actionResult += `📝 Asunto: ${subject}\n`;
                    actionResult += `✅ El correo fue enviado exitosamente.\n`;
                } else {
                    actionResult += `\n\n[SISTEMA]: No encontré un email pendiente para enviar. Primero prepara un correo diciendo "Envía cotización a [proveedor] para [producto]".`;
                }
            } catch (e: any) {
                console.error("Email Send Error:", e);
                actionResult += `\n\n[SISTEMA - ERROR AL ENVIAR EMAIL]: ${e.message}\nVerifica la configuración de Azure Communication Services.`;
            }
        }

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

        // #4 - SUGERENCIA DE PROVEEDOR (Busca por NOMBRE y ACTIVIDAD) - Skip if edit/delete action
        const isEditOrDeleteAction = /\b(elimina|borra|quita|edita|actualiza|cambia|modifica)\b/i.test(lowerMsg);
        if (!isEditOrDeleteAction && (lowerMsg.includes('proveedor') || lowerMsg.includes('quién vende') || lowerMsg.includes('quien vende') || lowerMsg.includes('a quién le compro') || lowerMsg.includes('recomienda') || lowerMsg.includes('actividad') || lowerMsg.includes('busca') || lowerMsg.includes('encuentra'))) {
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
                    const sixMonthsAgo = new Date();
                    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

                    const recentReqs = await prisma.requirement.findMany({
                        where: { createdAt: { gte: sixMonthsAgo }, status: { not: 'REJECTED' } },
                        select: { title: true, totalAmount: true, createdAt: true }
                    });

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
                    }
                }
            } catch (e) { console.error("Prediction Error:", e); }
        }

        // #NEW - BUSCAR REQUERIMIENTO POR ID/GROUPID/TITULO
        if (lowerMsg.includes('requerimiento') || lowerMsg.includes('solicitud') || lowerMsg.includes('groupid') || lowerMsg.match(/\b#?\d+\b/) || lowerMsg.includes('req')) {
            try {
                const reqPrompt = `Analiza: "${message}". ¿El usuario busca información de un REQUERIMIENTO específico? Extrae identificadores. JSON: {"action":"FIND_REQ","groupId":number|null,"id":"uuid"|null,"title":"texto"|null} o {"action":"NONE"}`;
                const reqResult = await generateWithFallback({ prompt: reqPrompt, jsonMode: true });
                const reqJson = JSON.parse(reqResult);

                if (reqJson.action === 'FIND_REQ' && (reqJson.groupId || reqJson.id || reqJson.title)) {
                    let whereClause: any = {};
                    if (reqJson.groupId) whereClause.groupId = reqJson.groupId;
                    else if (reqJson.id) whereClause.id = reqJson.id;
                    else if (reqJson.title) whereClause.title = { contains: reqJson.title, mode: 'insensitive' };

                    const requirement = await prisma.requirement.findFirst({
                        where: whereClause,
                        select: {
                            id: true,
                            title: true,
                            description: true,
                            groupId: true,
                            status: true,
                            procurementStatus: true,
                            totalAmount: true,
                            estimatedAmount: true,
                            quantity: true,
                            createdAt: true,
                            deliveryDate: true,
                            purchaseOrderNumber: true,
                            invoiceNumber: true,
                            createdBy: { select: { name: true, email: true } },
                            project: { select: { name: true, code: true } },
                            area: { select: { name: true } },
                            budget: { select: { title: true, available: true } },
                            supplier: { select: { name: true, contactEmail: true, activity: true } }
                        }
                    });

                    if (requirement) {
                        actionResult += `\n\n[SISTEMA - REQUERIMIENTO ENCONTRADO]:\n`;
                        actionResult += `📋 #${requirement.groupId || 'N/A'} - ${requirement.title}\n`;
                        actionResult += `📝 Descripción: ${requirement.description || 'Sin descripción'}\n`;
                        actionResult += `📊 Estado: ${requirement.status} | Trámite: ${requirement.procurementStatus}\n`;
                        actionResult += `💰 Monto: ${formatMoney(requirement.totalAmount || requirement.estimatedAmount)}\n`;
                        actionResult += `📦 Cantidad: ${requirement.quantity || 'N/A'}\n`;
                        actionResult += `🏢 Proyecto: ${requirement.project?.name || 'N/A'} | Área: ${requirement.area?.name || 'N/A'}\n`;
                        actionResult += `💼 Presupuesto: ${requirement.budget?.title || 'No asignado'}\n`;
                        actionResult += `👤 Solicitante: ${requirement.createdBy?.name || 'N/A'} (${requirement.createdBy?.email || 'N/A'})\n`;
                        if (requirement.supplier) {
                            actionResult += `🏪 Proveedor: ${requirement.supplier.name} (${requirement.supplier.contactEmail || 'Sin email'})\n`;
                        }
                        if (requirement.purchaseOrderNumber) actionResult += `📑 O.C.: ${requirement.purchaseOrderNumber}\n`;
                        if (requirement.invoiceNumber) actionResult += `🧾 Factura: ${requirement.invoiceNumber}\n`;
                        actionResult += `📅 Creado: ${requirement.createdAt?.toLocaleDateString('es-CO')}\n`;

                        // Store for email use
                        contextData += `\n\n[REQ_ENCONTRADO]: ID=${requirement.id}, GroupId=${requirement.groupId}, Title="${requirement.title}", Desc="${requirement.description}", Supplier=${requirement.supplier?.name || 'N/A'}, SupplierEmail=${requirement.supplier?.contactEmail || 'N/A'}`;
                    } else {
                        actionResult += `\n\n[SISTEMA]: No encontré un requerimiento con ese identificador.`;
                    }
                }
            } catch (e) { console.error("Find Requirement Error:", e); }
        }

        // #11 - ENVIAR EMAIL A PROVEEDOR (MEJORADO: Incluye datos del requerimiento)
        if (lowerMsg.includes('email') || lowerMsg.includes('correo') || lowerMsg.includes('cotización') || lowerMsg.includes('enviar') || lowerMsg.includes('contactar')) {
            try {
                const emailPrompt = `Analiza: "${message}". ¿El usuario quiere ENVIAR un EMAIL a un proveedor? Extrae: proveedor, producto, y groupId del requerimiento si se menciona. JSON: {"action":"SEND_EMAIL","supplier":"nombre","product":"descripción","groupId":number|null} o {"action":"NONE"}`;
                const emailResult = await generateWithFallback({ prompt: emailPrompt, jsonMode: true });
                const emailJson = JSON.parse(emailResult);

                if (emailJson.action === 'SEND_EMAIL' && emailJson.supplier) {
                    const supplier = await prisma.supplier.findFirst({
                        where: { name: { contains: emailJson.supplier, mode: 'insensitive' } },
                        select: { name: true, contactEmail: true, nit: true }
                    });

                    // If groupId provided, get requirement details
                    let reqDetails = '';
                    if (emailJson.groupId) {
                        const req = await prisma.requirement.findFirst({
                            where: { groupId: emailJson.groupId },
                            select: { title: true, description: true, quantity: true, estimatedAmount: true }
                        });
                        if (req) {
                            reqDetails = `\n\n**Detalle del Requerimiento #${emailJson.groupId}:**\n- ${req.title}\n- ${req.description || 'Sin descripción adicional'}\n- Cantidad: ${req.quantity || 'A definir'}\n- Presupuesto estimado: ${formatMoney(req.estimatedAmount)}`;
                        }
                    }

                    if (supplier?.contactEmail) {
                        const { sendEmail, getEmailTemplate } = await import('../services/emailService');
                        const emailBody = `
                            <p>Estimado/a proveedor <strong>${supplier.name}</strong>,</p>
                            <p>Desde el Museo de Antioquia, solicitamos cotización para:</p>
                            <div style="background:#f5f5f5; padding:15px; border-radius:8px; margin:15px 0;">
                                <strong>${emailJson.product || 'Productos/Servicios varios'}</strong>
                                ${reqDetails ? reqDetails.replace(/\n/g, '<br>') : ''}
                            </div>
                            <p>Por favor responda a este correo con su mejor oferta, incluyendo:</p>
                            <ul>
                                <li>Precio unitario y total</li>
                                <li>Tiempo de entrega</li>
                                <li>Condiciones de pago</li>
                                <li>Vigencia de la cotización</li>
                            </ul>
                            <p>Atentamente,<br><strong>Departamento de Compras</strong><br>Museo de Antioquia</p>
                        `;

                        actionResult += `\n\n[SISTEMA - EMAIL PREPARADO]:\n`;
                        actionResult += `📧 Para: ${supplier.contactEmail}\n`;
                        actionResult += `📝 Asunto: Solicitud de Cotización - ${emailJson.product || 'Varios'}${emailJson.groupId ? ` (Req #${emailJson.groupId})` : ''}\n`;
                        actionResult += `📋 Contenido: Incluye${reqDetails ? ` detalles del Requerimiento #${emailJson.groupId}` : ' solicitud genérica de cotización'}\n`;
                        actionResult += `✉️ ¿Deseas que lo envíe? (Responde "Sí, enviar" para confirmar)\n`;

                        contextData += `\n\n[EMAIL_PENDIENTE]: Proveedor=${supplier.name}, Email=${supplier.contactEmail}, Producto=${emailJson.product}, GroupId=${emailJson.groupId || 'N/A'}`;
                    } else {
                        actionResult += `\n\n[SISTEMA]: No encontré el email del proveedor "${emailJson.supplier}". Verifica el nombre o registra su contacto.`;
                    }
                }
            } catch (e) { console.error("Email Action Error:", e); }
        }


        // #12 - EDITAR PROVEEDOR (Role-based)
        const canManageSuppliers = ['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER'].includes(userRole);
        const hasEditKeyword = /\b(edita|actualiza|cambia|modifica|pon|agrega|asigna)/i.test(lowerMsg);
        const hasSupplierKeyword = /\b(proveedor|supplier|actividad del)/i.test(lowerMsg);

        if (hasEditKeyword && hasSupplierKeyword) {
            try {
                if (!canManageSuppliers) {
                    actionResult += `\n\n[SISTEMA]: ⛔ No tienes permisos para editar proveedores. Tu rol es: ${userRole}`;
                } else {
                    const editPrompt = `Analiza: "${message}". ¿El usuario quiere EDITAR un campo de un proveedor? Extrae nombre del proveedor, campo a editar y nuevo valor. JSON: {"action":"EDIT_SUPPLIER","supplierName":"nombre","field":"activity|email|phone|address|contactName|nit","newValue":"valor"} o {"action":"NONE"}`;
                    const editResult = await generateWithFallback({ prompt: editPrompt, jsonMode: true });
                    const editJson = JSON.parse(editResult);

                    if (editJson.action === 'EDIT_SUPPLIER' && editJson.supplierName && editJson.field && editJson.newValue) {
                        const supplier = await prisma.supplier.findFirst({
                            where: { name: { contains: editJson.supplierName, mode: 'insensitive' } },
                            select: { id: true, name: true }
                        });

                        if (supplier) {
                            const allowedFields = ['activity', 'email', 'phone', 'address', 'contactName', 'nit', 'contactEmail'];
                            const field = editJson.field === 'email' ? 'contactEmail' : editJson.field;

                            if (allowedFields.includes(field)) {
                                await prisma.supplier.update({
                                    where: { id: supplier.id },
                                    data: { [field]: editJson.newValue.trim() }
                                });
                                actionResult += `\n\n[SISTEMA - PROVEEDOR ACTUALIZADO ✅]:\n`;
                                actionResult += `🏪 Proveedor: ${supplier.name}\n`;
                                actionResult += `📝 Campo: ${editJson.field}\n`;
                                actionResult += `➡️ Nuevo valor: ${editJson.newValue}\n`;
                            } else {
                                actionResult += `\n\n[SISTEMA]: Campo "${editJson.field}" no es editable. Campos válidos: activity, email, phone, address, contactName, nit.`;
                            }
                        } else {
                            actionResult += `\n\n[SISTEMA]: No encontré el proveedor "${editJson.supplierName}".`;
                        }
                    }
                }
            } catch (e) { console.error("Edit Supplier Error:", e); }
        }


        // #13 - ELIMINAR PROVEEDOR (Role-based)
        const hasDeleteKeyword = /\b(elimina|borra|quita|borrar|eliminar|quitar)\b/i.test(lowerMsg);
        if (hasDeleteKeyword && /\b(proveedor|supplier|este)\b/i.test(lowerMsg)) {
            try {
                const canDelete = ['ADMIN', 'DIRECTOR', 'COORDINATOR', 'DEVELOPER'].includes(userRole);
                if (!canDelete) {
                    actionResult += `\n\n[SISTEMA]: ⛔ No tienes permisos para eliminar proveedores. Tu rol es: ${userRole}`;
                } else {
                    const deletePrompt = `Analiza: "${message}". ¿El usuario quiere ELIMINAR un proveedor específico? Extrae el nombre. JSON: {"action":"DELETE_SUPPLIER","supplierName":"nombre","confirmed":boolean} o {"action":"NONE"}`;
                    const deleteResult = await generateWithFallback({ prompt: deletePrompt, jsonMode: true });
                    const deleteJson = JSON.parse(deleteResult);

                    if (deleteJson.action === 'DELETE_SUPPLIER' && deleteJson.supplierName) {
                        const supplier = await prisma.supplier.findFirst({
                            where: { name: { contains: deleteJson.supplierName, mode: 'insensitive' } },
                            select: { id: true, name: true, _count: { select: { requirements: true, invoices: true } } }
                        });

                        if (supplier) {
                            if (supplier._count.requirements > 0 || supplier._count.invoices > 0) {
                                actionResult += `\n\n[SISTEMA]: ⚠️ No se puede eliminar "${supplier.name}" porque tiene ${supplier._count.requirements} requerimiento(s) y ${supplier._count.invoices} factura(s) asociadas.`;
                            } else if (!deleteJson.confirmed && !lowerMsg.includes('confirmo')) {
                                actionResult += `\n\n[SISTEMA - CONFIRMAR ELIMINACIÓN]:\n`;
                                actionResult += `🗑️ ¿Estás seguro de eliminar el proveedor "${supplier.name}"?\n`;
                                actionResult += `⚠️ Esta acción no se puede deshacer.\n`;
                                actionResult += `✅ Responde "Sí, confirmo eliminar ${supplier.name}" para continuar.`;
                                contextData += `\n\n[DELETE_PENDING]: ${supplier.name}`;
                            } else {
                                await prisma.supplier.delete({ where: { id: supplier.id } });
                                actionResult += `\n\n[SISTEMA - PROVEEDOR ELIMINADO ✅]:\n`;
                                actionResult += `🗑️ "${supplier.name}" ha sido eliminado del sistema.`;
                            }
                        } else {
                            actionResult += `\n\n[SISTEMA]: No encontré el proveedor "${deleteJson.supplierName}".`;
                        }
                    }
                }
            } catch (e) { console.error("Delete Supplier Error:", e); }
        }

        // #14 - BUSCAR Y ELIMINAR DUPLICADOS
        if (lowerMsg.includes('duplicado') || lowerMsg.includes('repetido')) {
            try {
                if (!canManageSuppliers) {
                    actionResult += `\n\n[SISTEMA]: ⛔ No tienes permisos para gestionar duplicados. Tu rol es: ${userRole}`;
                } else {
                    // Find potential duplicates by NIT
                    const duplicates = await prisma.$queryRaw<any[]>`
                        SELECT nit, COUNT(*) as count, array_agg(name) as names
                        FROM "Supplier"
                        WHERE nit IS NOT NULL AND nit != ''
                        GROUP BY nit
                        HAVING COUNT(*) > 1
                        LIMIT 10
                    `;

                    if (duplicates.length > 0) {
                        actionResult += `\n\n[SISTEMA - PROVEEDORES DUPLICADOS ENCONTRADOS]:\n`;
                        duplicates.forEach((d: any) => {
                            actionResult += `🔄 NIT ${d.nit}: ${d.count} registros\n`;
                            actionResult += `   Nombres: ${d.names.join(', ')}\n`;
                        });
                        actionResult += `\n📌 Para eliminar un duplicado, dime: "Eliminar proveedor [nombre exacto]"`;
                    } else {
                        actionResult += `\n\n[SISTEMA]: ✅ No encontré proveedores duplicados por NIT.`;
                    }
                }
            } catch (e) { console.error("Duplicates Error:", e); }
        }

        // #15 - RESUMEN EJECUTIVO DE PROYECTO/ÁREA
        if (/\b(resumen|reporte|informe|estadísticas|stats)\b/i.test(lowerMsg) && /\b(proyecto|area|área|ejecutivo)\b/i.test(lowerMsg)) {
            try {
                const summaryPrompt = `Analiza: "${message}". ¿El usuario quiere un RESUMEN EJECUTIVO? Extrae el nombre del proyecto o área. JSON: {"action":"EXEC_SUMMARY","entityType":"project|area","name":"nombre"} o {"action":"NONE"}`;
                const summaryResult = await generateWithFallback({ prompt: summaryPrompt, jsonMode: true });
                const summaryJson = JSON.parse(summaryResult);

                if (summaryJson.action === 'EXEC_SUMMARY' && summaryJson.name) {
                    let stats: any = null;

                    if (summaryJson.entityType === 'project') {
                        const project = await prisma.project.findFirst({
                            where: { name: { contains: summaryJson.name, mode: 'insensitive' } },
                            include: {
                                budgets: { include: { _count: { select: { requirements: true } } } },
                                requirements: { select: { status: true, totalAmount: true, procurementStatus: true } }
                            }
                        });
                        if (project) {
                            const totalBudget = project.budgets.reduce((sum, b) => sum + Number(b.amount || 0), 0);
                            const availableBudget = project.budgets.reduce((sum, b) => sum + Number(b.available || 0), 0);
                            const executedBudget = totalBudget - availableBudget;
                            const totalReqs = project.requirements.length;
                            const approvedReqs = project.requirements.filter(r => r.status === 'APPROVED').length;
                            const pendingReqs = project.requirements.filter(r => r.status === 'PENDING_APPROVAL').length;

                            actionResult += `\n\n[SISTEMA - RESUMEN EJECUTIVO: ${project.name}]\n`;
                            actionResult += `📊 **PRESUPUESTO**\n`;
                            actionResult += `   Total: ${formatMoney(totalBudget)}\n`;
                            actionResult += `   Ejecutado: ${formatMoney(executedBudget)} (${totalBudget > 0 ? Math.round((executedBudget / totalBudget) * 100) : 0}%)\n`;
                            actionResult += `   Disponible: ${formatMoney(availableBudget)}\n`;
                            actionResult += `📋 **REQUERIMIENTOS**\n`;
                            actionResult += `   Total: ${totalReqs} | Aprobados: ${approvedReqs} | Pendientes: ${pendingReqs}\n`;
                            actionResult += `💼 **PRESUPUESTOS ASIGNADOS**: ${project.budgets.length}\n`;
                        } else {
                            actionResult += `\n\n[SISTEMA]: No encontré el proyecto "${summaryJson.name}".`;
                        }
                    } else if (summaryJson.entityType === 'area') {
                        const area = await prisma.area.findFirst({
                            where: { name: { contains: summaryJson.name, mode: 'insensitive' } },
                            include: {
                                requirements: { select: { status: true, totalAmount: true } },
                                _count: { select: { users: true } }
                            }
                        });
                        if (area) {
                            const totalAmount = area.requirements.reduce((sum, r) => sum + Number(r.totalAmount || 0), 0);
                            actionResult += `\n\n[SISTEMA - RESUMEN EJECUTIVO: Área ${area.name}]\n`;
                            actionResult += `👥 Usuarios: ${area._count.users}\n`;
                            actionResult += `📋 Requerimientos: ${area.requirements.length}\n`;
                            actionResult += `💰 Monto Total: ${formatMoney(totalAmount)}\n`;
                        } else {
                            actionResult += `\n\n[SISTEMA]: No encontré el área "${summaryJson.name}".`;
                        }
                    }
                }
            } catch (e) { console.error("Exec Summary Error:", e); }
        }

        // #16 - APROBAR REQUERIMIENTO
        const canApprove = ['DIRECTOR', 'COORDINATOR', 'DEVELOPER'].includes(userRole);
        if (/\b(aprueba|aprobar|aprobado|autoriza|autorizar)\b/i.test(lowerMsg) && /\b(req|requerimiento|solicitud|#\d+)\b/i.test(lowerMsg)) {
            try {
                if (!canApprove) {
                    actionResult += `\n\n[SISTEMA]: ⛔ No tienes permisos para aprobar requerimientos. Tu rol es: ${userRole}`;
                } else {
                    const approvePrompt = `Analiza: "${message}". ¿El usuario quiere APROBAR un requerimiento? Extrae el ID o GroupId. JSON: {"action":"APPROVE_REQ","groupId":number|null,"id":"uuid"|null} o {"action":"NONE"}`;
                    const approveResult = await generateWithFallback({ prompt: approvePrompt, jsonMode: true });
                    const approveJson = JSON.parse(approveResult);

                    if (approveJson.action === 'APPROVE_REQ' && (approveJson.groupId || approveJson.id)) {
                        const whereClause = approveJson.groupId ? { groupId: approveJson.groupId } : { id: approveJson.id };
                        const req = await prisma.requirement.findFirst({
                            where: whereClause,
                            select: { id: true, title: true, groupId: true, status: true }
                        });

                        if (req) {
                            if (req.status === 'APPROVED') {
                                actionResult += `\n\n[SISTEMA]: ℹ️ El requerimiento #${req.groupId} "${req.title}" ya está aprobado.`;
                            } else {
                                await prisma.requirement.update({
                                    where: { id: req.id },
                                    data: { status: 'APPROVED' }
                                });
                                actionResult += `\n\n[SISTEMA - REQUERIMIENTO APROBADO ✅]:\n`;
                                actionResult += `📋 #${req.groupId} - ${req.title}\n`;
                                actionResult += `✅ Estado cambiado a: APPROVED\n`;
                                actionResult += `👤 Aprobado por: ${user?.name || user?.email}`;
                            }
                        } else {
                            actionResult += `\n\n[SISTEMA]: No encontré el requerimiento especificado.`;
                        }
                    }
                }
            } catch (e) { console.error("Approve Req Error:", e); }
        }

        // #17 - CAMBIAR ESTADO DE TRÁMITE (procurementStatus)
        if (/\b(marca|cambiar?|actualiza|estado|trámite|tramite)\b/i.test(lowerMsg) && /\b(pendiente|en_tramite|en tramite|comprado|entregado|completado)\b/i.test(lowerMsg)) {
            try {
                if (!canManageSuppliers) {
                    actionResult += `\n\n[SISTEMA]: ⛔ No tienes permisos para cambiar estados de trámite. Tu rol es: ${userRole}`;
                } else {
                    const statusPrompt = `Analiza: "${message}". ¿El usuario quiere cambiar el ESTADO DE TRÁMITE de un requerimiento? Extrae groupId y nuevo estado. JSON: {"action":"CHANGE_STATUS","groupId":number,"newStatus":"PENDIENTE|EN_TRAMITE|COMPRADO|ENTREGADO|COMPLETADO"} o {"action":"NONE"}`;
                    const statusResult = await generateWithFallback({ prompt: statusPrompt, jsonMode: true });
                    const statusJson = JSON.parse(statusResult);

                    if (statusJson.action === 'CHANGE_STATUS' && statusJson.groupId && statusJson.newStatus) {
                        const validStatuses = ['PENDIENTE', 'EN_TRAMITE', 'COMPRADO', 'ENTREGADO', 'COMPLETADO'];
                        if (!validStatuses.includes(statusJson.newStatus)) {
                            actionResult += `\n\n[SISTEMA]: Estado inválido. Estados válidos: ${validStatuses.join(', ')}`;
                        } else {
                            const req = await prisma.requirement.findFirst({
                                where: { groupId: statusJson.groupId },
                                select: { id: true, title: true, groupId: true }
                            });

                            if (req) {
                                await prisma.requirement.update({
                                    where: { id: req.id },
                                    data: { procurementStatus: statusJson.newStatus }
                                });
                                actionResult += `\n\n[SISTEMA - ESTADO ACTUALIZADO ✅]:\n`;
                                actionResult += `📋 #${req.groupId} - ${req.title}\n`;
                                actionResult += `🔄 Nuevo estado de trámite: ${statusJson.newStatus}`;
                            } else {
                                actionResult += `\n\n[SISTEMA]: No encontré el requerimiento #${statusJson.groupId}.`;
                            }
                        }
                    }
                }
            } catch (e) { console.error("Change Status Error:", e); }
        }

        // #18 - REASIGNAR RESPONSABLE DE PRESUPUESTO
        if (/\b(asigna|reasigna|cambia|pon)\b/i.test(lowerMsg) && /\b(líder|lider|responsable|manager|encargado)\b/i.test(lowerMsg) && /\b(presupuesto|budget)\b/i.test(lowerMsg)) {
            try {
                const canReassign = ['ADMIN', 'DIRECTOR', 'COORDINATOR', 'DEVELOPER'].includes(userRole);
                if (!canReassign) {
                    actionResult += `\n\n[SISTEMA]: ⛔ No tienes permisos para reasignar responsables. Tu rol es: ${userRole}`;
                } else {
                    const reassignPrompt = `Analiza: "${message}". ¿El usuario quiere REASIGNAR el responsable de un presupuesto? Extrae nombre del presupuesto y nombre/email del nuevo responsable. JSON: {"action":"REASSIGN_BUDGET","budgetName":"nombre","newManagerName":"nombre o email"} o {"action":"NONE"}`;
                    const reassignResult = await generateWithFallback({ prompt: reassignPrompt, jsonMode: true });
                    const reassignJson = JSON.parse(reassignResult);

                    if (reassignJson.action === 'REASSIGN_BUDGET' && reassignJson.budgetName && reassignJson.newManagerName) {
                        const budget = await prisma.budget.findFirst({
                            where: { title: { contains: reassignJson.budgetName, mode: 'insensitive' } },
                            select: { id: true, title: true, manager: { select: { name: true } } }
                        });

                        const newManager = await prisma.user.findFirst({
                            where: {
                                OR: [
                                    { name: { contains: reassignJson.newManagerName, mode: 'insensitive' } },
                                    { email: { contains: reassignJson.newManagerName, mode: 'insensitive' } }
                                ]
                            },
                            select: { id: true, name: true, email: true }
                        });

                        if (!budget) {
                            actionResult += `\n\n[SISTEMA]: No encontré el presupuesto "${reassignJson.budgetName}".`;
                        } else if (!newManager) {
                            actionResult += `\n\n[SISTEMA]: No encontré el usuario "${reassignJson.newManagerName}".`;
                        } else {
                            await prisma.budget.update({
                                where: { id: budget.id },
                                data: { managerId: newManager.id }
                            });
                            actionResult += `\n\n[SISTEMA - RESPONSABLE REASIGNADO ✅]:\n`;
                            actionResult += `💼 Presupuesto: ${budget.title}\n`;
                            actionResult += `👤 Anterior: ${budget.manager?.name || 'Sin asignar'}\n`;
                            actionResult += `➡️ Nuevo: ${newManager.name} (${newManager.email})`;
                        }
                    }
                }
            } catch (e) { console.error("Reassign Budget Error:", e); }
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
