import { Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../db';
import { SYSTEM_FAQ } from '../utils/aiKnowledge';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

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

        // Retry Helper for 503 and 429 Errors
        const retryOperation = async <T>(operation: () => Promise<T>, retries = 5, delay = 1000): Promise<T> => {
            for (let i = 0; i < retries; i++) {
                try {
                    return await operation();
                } catch (error: any) {
                    const isTransient = error.message?.includes('503') || error.message?.includes('overloaded') || error.message?.includes('429');
                    if (isTransient && i < retries - 1) {
                        console.warn(`Gemini Busy (503/429). Retrying in ${delay}ms... (Attempt ${i + 1}/${retries})`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        delay *= 2; // Exponential backoff: 1, 2, 4, 8, 16 seconds
                        continue;
                    }
                    throw error;
                }
            }
            throw new Error('Max retries reached');
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
             Responde JSON: { "action": "GENERATE_REPORT", "type": "USER_REQUIREMENTS" } o { "action": "NONE" }
             `;

            try {
                const actionModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash", generationConfig: { responseMimeType: "application/json" } });
                const actionResult = await retryOperation(() => actionModel.generateContent(actionPrompt));
                const actionJson = JSON.parse(actionResult.response.text());

                if (actionJson.action === 'GENERATE_REPORT' && actionJson.type === 'USER_REQUIREMENTS') {
                    // Import dynamically to avoid circular issues or top-level import conflicts if any
                    const { generateUserRequirementsExcel } = await import('../services/reportService');
                    if (userId) {
                        const fileUrl = await generateUserRequirementsExcel(userId);
                        contextData += `\n\n[SISTEMA]: SE HA GENERADO UN REPORTE EXCEL PARA EL USUARIO. URL: ${fileUrl}\nINSTRUCCIÓN: Dile al usuario que su reporte está listo y dale el enlace exacto: [Descargar Reporte Excel](${fileUrl})`;
                    }
                }
            } catch (e) {
                console.error("Action Detection Failed", e);
            }
        }

        // 1.6. DYNAMIC CONTEXT: Check if specific PROJECT is mentioned for "Executive Report"
        // Get all projects references (lightweight)
        const allProjectsRef = await prisma.project.findMany({ select: { id: true, name: true, code: true } });
        const mentionedProject = allProjectsRef.find(p =>
            message.toLowerCase().includes(p.name.toLowerCase()) ||
            message.toLowerCase().includes(p.code.toLowerCase())
        );

        if (mentionedProject) {
            // Fetch DEEP analytics for this project
            const fullProject = await prisma.project.findUnique({
                where: { id: mentionedProject.id },
                include: {
                    leader: { select: { name: true, email: true } },
                    budgets: true,
                    requirements: { select: { status: true, totalAmount: true, title: true } }
                }
            });

            if (fullProject) {
                // Calculate Financials
                const totalBudget = fullProject.budgets.reduce((sum, b) => sum + Number(b.amount), 0);
                const totalAvailable = fullProject.budgets.reduce((sum, b) => sum + Number(b.available), 0);
                const totalExecuted = totalBudget - totalAvailable;
                const executionPercentage = totalBudget > 0 ? ((totalExecuted / totalBudget) * 100).toFixed(1) : '0';

                // Requirement Stats
                const reqsPending = fullProject.requirements.filter(r => r.status === 'PENDING_APPROVAL').length;
                const reqsApproved = fullProject.requirements.filter(r => r.status === 'APPROVED').length;

                contextData += `
                
                ---------------------------------------------------------
                📊 DATOS PROFUNDOS DE PROYECTO IDENTIFICADO: "${fullProject.name}" (${fullProject.code})
                ---------------------------------------------------------
                Líder: ${fullProject.leader?.name || 'N/A'}
                
                FINANZAS:
                - Presupuesto Total Asignado: ${formatMoney(totalBudget)}
                - Ejecutado (Gastado): ${formatMoney(totalExecuted)}
                - Disponible: ${formatMoney(totalAvailable)}
                - % Ejecución: ${executionPercentage}%
                
                ACTIVIDAD OPERATIVA:
                - Requerimientos Aprobados: ${reqsApproved}
                - Requerimientos Pendientes: ${reqsPending}
                
                PRESUPUESTOS INDIVIDUALES:
                ${fullProject.budgets.map(b => `- ${b.title}: ${formatMoney(b.amount)} (Disp: ${formatMoney(b.available)})`).join('\n')}
                
                INSTRUCCIÓN CLAVE: El usuario está preguntando por este proyecto. USA ESTOS DATOS para generar el reporte ejecutivo o responder la duda.
                ---------------------------------------------------------
                `;
            }
        }

        // 2. Prepare System Prompt with Knowledge Base (imported from aiKnowledge.ts)
        const systemPrompt = `
        Eres "MisCompras Bot", asistente experto del sistema de gestión de compras del Museo de Antioquia.
        
        ${SYSTEM_FAQ}

        ${contextData}
        
        TU MISIÓN:
        1. Responder dudas sobre CÓMO usar el sistema basándote en el CENTRO DE AYUDA.
        2. Responder preguntas sobre el estado actual del usuario (contexto provisto).
        3. SI TE PIDEN EL REPORTE DE UN PROYECTO ("Dame un resumen...", "Cómo va el proyecto X"): Actúa como un Analista Financiero Senior. Genera un texto narrativo profesional que incluya:
            - Estado financiero general (% ejecución).
            - Alertas (si el presupuesto está bajo).
            - Actividad reciente.
            - Conclusión ejecutiva.
            - Usa negritas para cifras clave.
        
        REGLAS:
        - Responde SIEMPRE en español, amable y profesional.
        - Sé conciso. Máximo 4 párrafos para reportes.
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
        const sanitizedHistory = history?.filter((msg: any, index: number) => {
            // If it's the very first message and it's from model, skip it.
            if (index === 0 && msg.role === 'model') return false;
            return true;
        }) || [];

        const chat = model.startChat({
            history: sanitizedHistory.map((msg: any) => ({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
            })),
            generationConfig: {
                maxOutputTokens: 2500,
            },
        });

        const result = await retryOperation(() => chat.sendMessage(message));
        const response = result.response;
        const text = response.text();

        res.json({ reply: text });

    } catch (error: any) {
        console.error("AI Controller Error:", error);
        console.log("API Key present:", !!process.env.GEMINI_API_KEY);
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

        // Retry helper local for this function
        const retryOperation = async <T>(operation: () => Promise<T>, retries = 5, delay = 1000): Promise<T> => {
            for (let i = 0; i < retries; i++) {
                try {
                    return await operation();
                } catch (error: any) {
                    const isTransient = error.message?.includes('503') || error.message?.includes('overloaded') || error.message?.includes('429');
                    if (isTransient && i < retries - 1) {
                        await new Promise(resolve => setTimeout(resolve, delay));
                        delay *= 2;
                        continue;
                    }
                    throw error;
                }
            }
            throw new Error('Max retries reached');
        };

        const result = await retryOperation(() => model.generateContent(extractionPrompt));
        const jsonResponse = JSON.parse(result.response.text());

        res.json(jsonResponse);

    } catch (error: any) {
        console.error("AI Extraction Error:", error);
        res.status(500).json({
            error: "Error procesando el texto.",
            details: error.message
        });
    }
};
