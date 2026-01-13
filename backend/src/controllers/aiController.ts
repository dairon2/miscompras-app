
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

        if (userRole === 'USER') {
            // USER: Only sees their own data
            const [myReqsPending, myReqsApproved, myBudgets] = await Promise.all([
                prisma.requirement.count({ where: { createdById: userId, status: 'PENDING_APPROVAL' } }),
                prisma.requirement.count({ where: { createdById: userId, status: 'APPROVED' } }),
                prisma.budget.count({
                    where: {
                        OR: [
                            { managerId: userId },
                            { subLeaders: { some: { userId } } }
                        ]
                    }
                })
            ]);
            contextData = `
            DATOS DEL USUARIO (${user.name}):
            - Mis Requerimientos Pendientes: ${myReqsPending}
            - Mis Requerimientos Aprobados: ${myReqsApproved}
            - Mis Presupuestos Asignados: ${myBudgets}
            
            NOTA: Este usuario tiene rol 'USER'. SOLO puede ver información sobre SUS requerimientos y presupuestos asignados. Si pregunta por datos generales o de otros, explica que no tiene permisos.
            `;
        } else {
            // ADMIN, DIRECTOR, COORDINATOR: See global stats
            const [projectsCount, budgetsCount, reqsPending] = await Promise.all([
                prisma.project.count(),
                prisma.budget.count(),
                prisma.requirement.count({ where: { status: 'PENDING_APPROVAL' } })
            ]);
            contextData = `
            DATOS GENERALES DEL SISTEMA (Rol: ${userRole}):
            - Proyectos Activos: ${projectsCount}
            - Presupuestos Totales: ${budgetsCount}
            - Requerimientos Pendientes de Aprobación Globales: ${reqsPending}
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
        - Sé conciso. Máximo 3 párrafos.
        - Si no sabes algo o no está en el contexto, di que no tienes esa información y sugiere contactar a soporte.
        `;

        // 3. Configure Model
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
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
                maxOutputTokens: 800,
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
