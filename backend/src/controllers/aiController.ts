
import { Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../db'; // Import prisma client
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

        if (userRole === 'USER') {
            // USER: Fetch specific lists
            const [myReqs, myBudgets, myProjects] = await Promise.all([
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
            
            NOTA: Este usuario tiene rol 'USER'. Solo ve su propia información.
            `;
        } else {
            // ADMIN, DIRECTOR, COORDINATOR: Global lists
            const [projects, budgets, reqsPending] = await Promise.all([
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
                })
            ]);

            contextData = `
            DATOS GENERALES DEL SISTEMA (Rol: ${userRole}):
            
            PROYECTOS RECIENTES (Total: ${await prisma.project.count()}):
            ${projects.map(p => `- ${p.name} (${p.code})`).join('\n')}
            
            PRESUPUESTOS RECIENTES (Total: ${await prisma.budget.count()}):
            ${budgets.map(b => `- ${b.title} (Proyecto: ${b.project.name}): Disp. ${formatMoney(b.available)}`).join('\n')}
            
            REQUERIMIENTOS PENDIENTES DE APROBACIÓN (Total: ${await prisma.requirement.count({ where: { status: 'PENDING_APPROVAL' } })}):
            ${reqsPending.map(r => `- ${r.title} (Solicitado por: ${r.createdBy.email})`).join('\n')}
            `;
        }

        // 2. Prepare System Prompt with Knowledge Base (imported from aiKnowledge.ts)

        const systemPrompt = `
        Eres "MisCompras Bot", asistente experto del sistema de gestión de compras del Museo de Antioquia.
        
        ${SYSTEM_FAQ}

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

        const result = await chat.sendMessage(message);
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
