"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractRequirement = exports.chatWithAI = void 0;
const generative_ai_1 = require("@google/generative-ai");
const db_1 = require("../db"); // Import prisma client
const aiKnowledge_1 = require("../utils/aiKnowledge");
// Initialize Gemini
const genAI = new generative_ai_1.GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const chatWithAI = async (req, res) => {
    try {
        const { message, history } = req.body;
        const user = req.user;
        const userId = user?.id;
        const userRole = user?.role || 'USER';
        // 1. Fetch Context Based on Role (Security & Business Rules)
        let contextData = "";
        // Helper for currency formatting
        const formatMoney = (amount) => {
            return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(Number(amount) || 0);
        };
        if (userRole === 'USER') {
            // USER: Fetch specific lists
            const [myReqs, myBudgets, myProjects, myInvoices] = await Promise.all([
                db_1.prisma.requirement.findMany({
                    where: { createdById: userId },
                    take: 5,
                    orderBy: { createdAt: 'desc' },
                    select: { title: true, status: true, totalAmount: true }
                }),
                db_1.prisma.budget.findMany({
                    where: {
                        OR: [{ managerId: userId }, { subLeaders: { some: { userId } } }]
                    },
                    take: 5,
                    select: { title: true, available: true, project: { select: { name: true } } }
                }),
                db_1.prisma.project.findMany({
                    where: { leaderId: userId },
                    take: 5,
                    select: { name: true, code: true }
                }),
                db_1.prisma.invoice.findMany({
                    where: { createdById: userId },
                    take: 5,
                    orderBy: { issueDate: 'desc' },
                    select: { invoiceNumber: true, amount: true, status: true, supplier: { select: { name: true } } }
                })
            ]);
            contextData = `
            DATOS DEL USUARIO (${user.name}):
            
            MIS ÚLTIMOS REQUERIMIENTOS:
            ${myReqs.map(r => `- ${r.title} (${r.status}): ${formatMoney(r.totalAmount)}`).join('\n')}
            
            MIS PRESUPUESTOS ASIGNADOS:
            ${myBudgets.map(b => `- ${b.title} (Proyecto: ${b.project.name}): Disponible ${formatMoney(b.available)}`).join('\n')}
            
            MIS PROYECTOS LIDERADOS:
            ${myProjects.map(p => `- ${p.name} (${p.code})`).join('\n')}

            MIS FACTURAS REGISTRADAS RECIENTES:
            ${myInvoices.map(i => `- #${i.invoiceNumber} (${i.supplier.name}): ${formatMoney(i.amount)} [State: ${i.status}]`).join('\n')}
            
            NOTA: Este usuario tiene rol 'USER'. Solo ve su propia información.
            `;
        }
        else {
            // ADMIN, DIRECTOR, COORDINATOR: Global lists
            const [projects, budgets, reqsPending, suppliers, invoices] = await Promise.all([
                db_1.prisma.project.findMany({
                    take: 10,
                    orderBy: { updatedAt: 'desc' },
                    select: { name: true, code: true }
                }),
                db_1.prisma.budget.findMany({
                    take: 10,
                    orderBy: { createdAt: 'desc' },
                    select: { title: true, available: true, project: { select: { name: true } } }
                }),
                db_1.prisma.requirement.findMany({
                    where: { status: 'PENDING_APPROVAL' },
                    take: 10,
                    select: { title: true, createdBy: { select: { email: true } }, estimatedAmount: true }
                }),
                db_1.prisma.supplier.findMany({
                    take: 10,
                    orderBy: { createdAt: 'desc' },
                    select: { name: true, supplierType: true, criticality: true }
                }),
                db_1.prisma.invoice.findMany({
                    take: 5,
                    orderBy: { issueDate: 'desc' },
                    select: { invoiceNumber: true, amount: true, supplier: { select: { name: true } }, status: true }
                })
            ]);
            const supplierCount = await db_1.prisma.supplier.count();
            const invoiceCount = await db_1.prisma.invoice.count();
            contextData = `
            DATOS GENERALES DEL SISTEMA (Rol: ${userRole}):
            
            PROYECTOS RECIENTES (Total: ${await db_1.prisma.project.count()}):
            ${projects.map(p => `- ${p.name} (${p.code})`).join('\n')}
            
            PRESUPUESTOS RECIENTES (Total: ${await db_1.prisma.budget.count()}):
            ${budgets.map(b => `- ${b.title} (Proyecto: ${b.project.name}): Disp. ${formatMoney(b.available)}`).join('\n')}
            
            REQUERIMIENTOS PENDIENTES DE APROBACIÓN (Total: ${await db_1.prisma.requirement.count({ where: { status: 'PENDING_APPROVAL' } })}):
            ${reqsPending.map(r => `- ${r.title} (Solicitado por: ${r.createdBy.email})`).join('\n')}

            PROVEEDORES REGISTRADOS (Total: ${supplierCount}):
            ${suppliers.map(s => `- ${s.name} (${s.supplierType}, Criticality: ${s.criticality})`).join('\n')}
            ${supplierCount > 10 ? `... y ${supplierCount - 10} más.` : ''}

            FACTURAS RECIENTES (Total: ${invoiceCount}):
            ${invoices.map(i => `- Factura #${i.invoiceNumber} de ${i.supplier.name}: ${formatMoney(i.amount)} (${i.status})`).join('\n')}
            `;
        }
        // 2. Prepare System Prompt with Knowledge Base (imported from aiKnowledge.ts)
        const systemPrompt = `
        Eres "MisCompras Bot", asistente experto del sistema de gestión de compras del Museo de Antioquia.
        
        ${aiKnowledge_1.SYSTEM_FAQ}

        ${contextData}
        
        TU MISIÓN:
        1. Responder dudas sobre CÓMO usar el sistema basándote en el CENTRO DE AYUDA.
        2. Responder preguntas sobre el estado actual del usuario (contexto provisto).
        3. Si te preguntan "qué puedo hacer", guíate por su rol y el apartado ROLES Y PERMISOS.
        
        REGLAS:
        - Responde SIEMPRE en español, amable y profesional.
        - Sé conciso. Máximo 3 párrafos para explicaciones.
        - CUANDO TE PIDAN LISTAR PROYECTOS, PRESUPUESTOS O REQUERIMIENTOS: Usa la información EXACTA de la sección de DATOS (arriba). Copia y pega la lista usando viñetas. No omitas información visible en el contexto.
        - Si la lista está vacía en el contexto, dilo claramente ("No veo items en este momento").
        - Si no sabes algo o no está en el contexto, di que no tienes esa información y sugiere contactar a soporte.
        `;
        // 3. Configure Model
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            systemInstruction: systemPrompt
        });
        // 4. Start Chat
        // Sanitize history: Gemini requires history to start with 'user' role.
        // We filter out any initial 'model' messages (like the welcome message).
        const sanitizedHistory = history?.filter((msg, index) => {
            // If it's the very first message and it's from model, skip it.
            if (index === 0 && msg.role === 'model')
                return false;
            return true;
        }) || [];
        const chat = model.startChat({
            history: sanitizedHistory.map((msg) => ({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
            })),
            generationConfig: {
                maxOutputTokens: 2500,
            },
        });
        const result = await chat.sendMessage(message);
        const response = result.response;
        const text = response.text();
        res.json({ reply: text });
    }
    catch (error) {
        console.error("AI Controller Error:", error);
        console.log("API Key present:", !!process.env.GEMINI_API_KEY);
        res.status(500).json({
            error: "Error interno del asistente.",
            details: error.message,
            keyPresent: !!process.env.GEMINI_API_KEY
        });
    }
};
exports.chatWithAI = chatWithAI;
const extractRequirement = async (req, res) => {
    try {
        const { text } = req.body;
        const extractionPrompt = `
        Actúa como un asistente administrativo experto. Analiza el siguiente texto y extrae los datos para crear un Requerimiento de Compra.
        
        TEXTO DEL USUARIO: "${text}"
        
        Debes generar un JSON con esta estructura exacta:
        {
            "title": "Un título corto y profesional para el requerimiento (ej: 'Compra de Sillas' o 'Mantenimiento X')",
            "description": "Una descripción detallada y técnica redactada profesionalmente. Incluye el propósito si se infiere. NO inventes datos, pero redacta bonito para rellenar el campo.",
            "quantity": "La cantidad mencionada (ej: '5', '10 cajas'). Si no dice, pon '1'.",
            "estimatedAmount": 0, // El valor numérico estimado en pesos (sin puntos ni signos). Si no se menciona, intenta estimar un valor de mercado realista en Colombia para ese item o pon 0.
            "suggestedSupplier": "Nombre del proveedor si se menciona, o null"
        }

        IMPORTANTE: 'estimatedAmount' debe ser un NÚMERO (Number).
        `;
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: { responseMimeType: "application/json" }
        });
        const result = await model.generateContent(extractionPrompt);
        const jsonResponse = JSON.parse(result.response.text());
        res.json(jsonResponse);
    }
    catch (error) {
        console.error("AI Extraction Error:", error);
        res.status(500).json({
            error: "Error procesando el texto.",
            details: error.message
        });
    }
};
exports.extractRequirement = extractRequirement;
