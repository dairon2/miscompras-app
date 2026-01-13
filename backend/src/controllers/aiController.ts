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

/**
 * Execute a generation task with model fallback strategy.
 * This wraps the entire "Get Model -> Generate" process.
 */
async function generateWithFallback(
    params: {
        systemInstruction?: string,
        prompt?: string,
        history?: any[],     // For Chat
        message?: string,    // For Chat
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
                // We use a simple retry for transient errors on the SAME model first
                // But if it persists as 429, the loop continues to next model
                const result = await chat.sendMessage(params.message);
                return result.response.text();
            } else if (params.prompt) {
                // SINGLE PROMPT MODE
                const result = await model.generateContent(params.prompt);
                return result.response.text();
            }

        } catch (error: any) {
            console.warn(`Model ${modelName} failed: ${error.message}`);
            lastError = error;

            // If error is NOT a quota/availability error, throw immediately (e.g. Invalid Argument)
            const isQuotaError = error.message?.includes('429') || error.message?.includes('503') || error.message?.includes('overloaded');

            if (!isQuotaError) throw error;

            // If it IS a quota error, continue to next model in loop
            continue;
        }
    }

    // If we get here, all models failed
    throw lastError || new Error("All fallback models failed.");
}

export const chatWithAI = async (req: Request, res: Response) => {
    try {
        const { message, history } = req.body;
        const user = (req as any).user;
        const userId = user?.id;
        const userRole = user?.role || 'USER';

        // 1. Fetch Context Based on Role (Security & Business Rules)
        let contextData = "";

        // Helper for currency formatting
        const formatMoney = (amount: any) => {
            return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(Number(amount) || 0);
        };

        if (userRole === 'USER') {
            // USER: Fetch specific lists
            const [myReqs, myBudgets, myProjects, myInvoices] = await Promise.all([
                prisma.requirement.findMany({
                    where: { createdById: userId },
                    take: 5,
                    orderBy: { createdAt: 'desc' },
                    select: { title: true, status: true, totalAmount: true }
                }),
                prisma.budget.findMany({
                    where: {
                        OR: [{ managerId: userId }, { subLeaders: { some: { userId } } }]
                    },
                    take: 5,
                    select: { title: true, available: true, project: { select: { name: true } } }
                }),
                prisma.project.findMany({
                    where: { leaderId: userId },
                    take: 5,
                    select: { name: true, code: true }
                }),
                prisma.invoice.findMany({
                    where: { createdById: userId },
                    take: 5, // Access to their invoices
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
        } else {
            // ADMIN, DIRECTOR, COORDINATOR: Global lists
            // ... (keep existing code)
            const [projects, budgets, reqsPending, suppliers, invoices] = await Promise.all([
                // ... (keep existing queries)
                prisma.project.findMany({
                    take: 10,
                    orderBy: { updatedAt: 'desc' },
                    select: { name: true, code: true }
                }),
                prisma.budget.findMany({
                    take: 10,
                    orderBy: { createdAt: 'desc' },
                    select: { title: true, available: true, project: { select: { name: true } } }
                }),
                prisma.requirement.findMany({
                    where: { status: 'PENDING_APPROVAL' },
                    take: 10,
                    select: { title: true, createdBy: { select: { email: true } }, estimatedAmount: true }
                }),
                prisma.supplier.findMany({
                    take: 10,
                    orderBy: { createdAt: 'desc' },
                    select: { name: true, supplierType: true, criticality: true }
                }),
                prisma.invoice.findMany({
                    take: 5,
                    orderBy: { issueDate: 'desc' },
                    select: { invoiceNumber: true, amount: true, supplier: { select: { name: true } }, status: true }
                })
            ]);

            const supplierCount = await prisma.supplier.count();
            const invoiceCount = await prisma.invoice.count();

            contextData = `
            DATOS GENERALES DEL SISTEMA (Rol: ${userRole}):
            
            PROYECTOS RECIENTES (Total: ${await prisma.project.count()}):
            ${projects.map(p => `- ${p.name} (${p.code})`).join('\n')}
            
            PRESUPUESTOS RECIENTES (Total: ${await prisma.budget.count()}):
            ${budgets.map(b => `- ${b.title} (Proyecto: ${b.project.name}): Disp. ${formatMoney(b.available)}`).join('\n')}
            
            REQUERIMIENTOS PENDIENTES DE APROBACIÓN (Total: ${await prisma.requirement.count({ where: { status: 'PENDING_APPROVAL' } })}):
            ${reqsPending.map(r => `- ${r.title} (Solicitado por: ${r.createdBy.email})`).join('\n')}

            PROVEEDORES REGISTRADOS (Total: ${supplierCount}):
            ${suppliers.map(s => `- ${s.name} (${s.supplierType}, Criticality: ${s.criticality})`).join('\n')}
            ${supplierCount > 10 ? `... y ${supplierCount - 10} más.` : ''}

            FACTURAS RECIENTES (Total: ${invoiceCount}):
            ${invoices.map(i => `- Factura #${i.invoiceNumber} de ${i.supplier.name}: ${formatMoney(i.amount)} (${i.status})`).join('\n')}
            `;
        }

        // 1.5. DATA ANALYSIS & ACTION DETECTION (NEW)
        const lowerMsg = message.toLowerCase();
        if (lowerMsg.includes('excel') || lowerMsg.includes('reporte') || lowerMsg.includes('descargar')) {
            // Heuristic trigger for Action Check
            const actionPrompt = `
             Analiza la intención del usuario.
             Mensaje: "${message}"
             
             ¿El usuario quiere GENERAR un archivo (Excel, reporte) de sus requerimientos?
             Si menciona un proyecto específico (ej: "del proyecto X"), extrae el nombre/código en el campo "project".
             
             Responde JSON: { "action": "GENERATE_REPORT", "type": "USER_REQUIREMENTS", "project": "Nombre o null" } o { "action": "NONE" }
             `;

            try {
                // Use Fallback for Action Detection too
                const actionText = await generateWithFallback({
                    prompt: actionPrompt,
                    jsonMode: true
                });
                const actionJson = JSON.parse(actionText);

                if (actionJson.action === 'GENERATE_REPORT' && actionJson.type === 'USER_REQUIREMENTS') {
                    // Import service dynamically
                    const { generateUserRequirementsExcel } = await import('../services/reportService');

                    let projectId: string | undefined = undefined;
                    let projectName: string | undefined = undefined;

                    // Resolve Project ID if mentioned
                    if (actionJson.project) {
                        const p = await prisma.project.findFirst({
                            where: {
                                OR: [
                                    { name: { contains: actionJson.project, mode: 'insensitive' } },
                                    { code: { contains: actionJson.project, mode: 'insensitive' } }
                                ]
                            },
                            select: { id: true, name: true }
                        });
                        if (p) {
                            projectId = p.id;
                            projectName = p.name;
                        }
                    }

                    if (userId) {
                        const fileUrl = await generateUserRequirementsExcel(userId, projectId);
                        const msgDetail = projectName ? `del proyecto "${projectName}"` : 'general';
                        contextData += `\n\n[SISTEMA]: REPORTE EXCEL GENERADO (${msgDetail}). URL: ${fileUrl}\nINSTRUCCIÓN: Dile al usuario que su reporte ${msgDetail} está listo: [Descargar Reporte Excel](${fileUrl}). Si no se encontraron datos, dilo.`;
                    }
                }
            } catch (e) {
                console.error("Action Detection Failed", e);
            }
        }

        // 1.6. DYNAMIC CONTEXT: Check if specific PROJECT is mentioned
        const allProjectsRef = await prisma.project.findMany({ select: { id: true, name: true, code: true } });
        const mentionedProject = allProjectsRef.find(p =>
            message.toLowerCase().includes(p.name.toLowerCase()) ||
            message.toLowerCase().includes(p.code.toLowerCase())
        );

        if (mentionedProject) {
            const fullProject = await prisma.project.findUnique({
                where: { id: mentionedProject.id },
                include: {
                    leader: { select: { name: true, email: true } },
                    budgets: true,
                    requirements: { select: { status: true, totalAmount: true, title: true } }
                }
            });

            if (fullProject) {
                const totalBudget = fullProject.budgets.reduce((sum, b) => sum + Number(b.amount), 0);
                const totalAvailable = fullProject.budgets.reduce((sum, b) => sum + Number(b.available), 0);
                const totalExecuted = totalBudget - totalAvailable;
                const executionPercentage = totalBudget > 0 ? ((totalExecuted / totalBudget) * 100).toFixed(1) : '0';

                const reqsPending = fullProject.requirements.filter(r => r.status === 'PENDING_APPROVAL').length;
                const reqsApproved = fullProject.requirements.filter(r => r.status === 'APPROVED').length;

                contextData += `
                ---------------------------------------------------------
                📊 DATOS PROFUNDOS DE PROYECTO IDENTIFICADO: "${fullProject.name}" (${fullProject.code})
                ---------------------------------------------------------
                Líder: ${fullProject.leader?.name || 'N/A'}
                FINANZAS:
                - Presupuesto Total: ${formatMoney(totalBudget)}
                - Ejecutado: ${formatMoney(totalExecuted)}
                - Disponible: ${formatMoney(totalAvailable)}
                - % Ejecución: ${executionPercentage}%
                ACTIVIDAD:
                - Aprobados: ${reqsApproved}, Pendientes: ${reqsPending}
                PRESUPUESTOS INDIVIDUALES:
                ${fullProject.budgets.map(b => `- ${b.title}: ${formatMoney(b.amount)} (Disp: ${formatMoney(b.available)})`).join('\n')}
                INSTRUCCIÓN CLAVE: El usuario pregunta por este proyecto. USA ESTOS DATOS.
                ---------------------------------------------------------
                `;
            }
        }

        // 2. Prepare System Prompt
        const systemPrompt = `
        Eres "MisCompras Bot", asistente experto del sistema de gestión de compras.
        ${SYSTEM_FAQ}
        ${contextData}
        
        TU MISIÓN:
        1. Responder dudas usando el CENTRO DE AYUDA.
        2. Contextualizar respuestas con los datos del usuario.
        3. Para REPORTE DE PROYECTO: Actúa como Analista Financiero Senior. Texto narrativo, conciso, alerta financiera si aplica.
        
        REGLAS:
        - Español, profesional, conciso.
        - Listas: Usa datos exactos del contexto.
        `;

        // 3. START CHAT WITH FALLBACK
        // Sanitize history
        const sanitizedHistory = history?.filter((msg: any, index: number) => {
            if (index === 0 && msg.role === 'model') return false;
            return true;
        }) || [];

        const formattedHistory = sanitizedHistory.map((msg: any) => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
        }));

        const responseText = await generateWithFallback({
            systemInstruction: systemPrompt,
            history: formattedHistory,
            message: message
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
