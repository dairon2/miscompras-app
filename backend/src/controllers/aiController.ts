
import { Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../db'; // Import prisma client

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export const chatWithAI = async (req: Request, res: Response) => {
    try {
        const { message, history } = req.body;
        const userId = (req as any).user?.id;

        // 1. Fetch Basic Context (Summary Stats)
        // This gives the AI "awareness" of the current system state
        const [
            projectsCount,
            budgetsCount,
            requirementsPending,
            requirementsApproved
        ] = await Promise.all([
            prisma.project.count(),
            prisma.budget.count(),
            prisma.requirement.count({ where: { status: 'PENDING_APPROVAL' } }),
            prisma.requirement.count({ where: { status: 'APPROVED' } })
        ]);

        // 2. Prepare System Prompt
        const systemPrompt = `
        Eres "MisCompras Bot", un asistente inteligente experto en gestión de compras y presupuestos.
        
        CONTEXTO DEL SISTEMA EN TIEMPO REAL:
        - Proyectos Activos: ${projectsCount}
        - Presupuestos Registrados: ${budgetsCount}
        - Requerimientos Pendientes de Aprobación: ${requirementsPending}
        - Requerimientos Aprobados: ${requirementsApproved}
        
        TU MISIÓN:
        Ayudar a los usuarios a navegar por el sistema, entender sus datos y resolver dudas sobre procesos de compras.
        
        REGLAS:
        1. Responde SIEMPRE en español, de forma amable y profesional pero concisa.
        2. Si te preguntan por datos específicos que no tienes en el contexto (como detalles de una factura específica), explica amablemente que puedes ver resúmenes generales pero para detalles específicos deben ir a la sección correspondiente.
        3. Usa formato Markdown para resaltar cifras importantes o listas.
        4. Tus respuestas no deben exceder los 3 párrafos a menos que sea necesario.
        `;

        // 3. Configure Model
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            systemInstruction: systemPrompt
        });

        // 4. Start Chat
        // Transform history to Gemini format if needed, or rely on simple prompt for now if complexity is high.
        // For simplicity and robustness, we'll use a simple generation for now, passing history as context if provided.
        // But startChat is better for multi-turn.

        const chat = model.startChat({
            history: history?.map((msg: any) => ({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
            })) || [],
            generationConfig: {
                maxOutputTokens: 800,
            },
        });

        const result = await chat.sendMessage(message);
        const response = result.response;
        const text = response.text();

        res.json({ reply: text });

    } catch (error) {
        console.error("AI Controller Error:", error);
        res.status(500).json({ error: "Lo siento, tuve un problema procesando tu consulta. Intenta de nuevo." });
    }
};
