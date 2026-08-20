
"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Bot, User, Sparkles, Loader2, Paperclip, FileText, Image as ImageIcon, ShieldCheck, AlertTriangle, RotateCcw } from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { resolveApiUrl } from "@/lib/utils";

interface Message {
    role: 'user' | 'model';
    content: string;
    actions?: AssistantAction[];
    pendingAction?: PendingAssistantAction;
}

interface AssistantAction {
    label: string;
    type: 'link' | 'prompt' | 'download';
    value: string;
}

interface PendingAssistantAction {
    token: string;
    action: string;
    title: string;
    description: string;
    confirmLabel: string;
    severity: 'info' | 'warning';
}

interface Attachment {
    name: string;
    type: string;
    data: string; // Base64
}

interface AssistantApiError {
    code?: string;
    message?: string;
    response?: {
        data?: {
            details?: string;
            error?: string;
            keyPresent?: boolean;
        };
    };
}

export default function AIAssistant() {
    const { user } = useAuthStore();
    const canUseExecutiveAI = ['DEVELOPER', 'DIRECTOR', 'COORDINATOR', 'ADMIN'].includes(user?.role || '');
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            role: 'model',
            content: '🤖 **MisCompras Bot activo**\n\nConsulta proyectos, presupuestos, requerimientos, facturas, anticipos o proveedores. Las acciones que cambian datos siempre requerirán tu confirmación.'
        }
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [attachment, setAttachment] = useState<Attachment | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const skipNextHistorySaveRef = useRef(false);
    const storageKey = user?.id ? `miscompras-ai-history:${user.id}` : null;

    useEffect(() => {
        if (!storageKey) return;
        try {
            const stored = sessionStorage.getItem(storageKey);
            if (stored) {
                const parsed = JSON.parse(stored) as Message[];
                if (Array.isArray(parsed) && parsed.length > 0) {
                    skipNextHistorySaveRef.current = true;
                    setMessages(parsed.slice(-30));
                }
            }
        } catch {
            sessionStorage.removeItem(storageKey);
        }
    }, [storageKey]);

    useEffect(() => {
        if (!storageKey) return;
        if (skipNextHistorySaveRef.current) {
            skipNextHistorySaveRef.current = false;
            return;
        }
        const safeMessages = messages.slice(-30).map(message => ({ ...message, pendingAction: undefined }));
        sessionStorage.setItem(storageKey, JSON.stringify(safeMessages));
    }, [messages, storageKey]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen, attachment]);

    useEffect(() => {
        setMessages(prev => {
            if (prev.length === 0 || !prev[0].content.includes('MisCompras Bot activo')) return prev;
            const executiveActions: AssistantAction[] = canUseExecutiveAI ? [
                { label: 'Generar resumen', type: 'prompt', value: 'Genera un análisis ejecutivo completo' },
                { label: 'Qué está atrasado', type: 'prompt', value: '¿Qué está atrasado?' },
                { label: 'Dónde se gasta más', type: 'prompt', value: '¿Dónde se está gastando más?' }
            ] : [];
            return [{ ...prev[0], actions: executiveActions }, ...prev.slice(1)];
        });
    }, [canUseExecutiveAI]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert("El archivo es muy grande. Máximo 5MB.");
            return;
        }

        const reader = new FileReader();
        reader.onload = (ev) => {
            const base64 = ev.target?.result as string;
            // Remove prefix data:image/png;base64,
            const content = base64.split(',')[1];
            setAttachment({
                name: file.name,
                type: file.type,
                data: content
            });
        };
        reader.readAsDataURL(file);
    };

    const sendMessage = async (rawMessage: string, currentAttachment?: Attachment | null) => {
        if ((!rawMessage.trim() && !currentAttachment) || isLoading) return;

        const userMessage = rawMessage.trim();

        let displayText = userMessage;
        if (currentAttachment) {
            displayText += `\n[Archivo adjunto: ${currentAttachment.name}]`;
        }

        setMessages(prev => [...prev, { role: 'user', content: displayText }]);
        setIsLoading(true);

        try {
            const historyToSend = messages.slice(1).slice(-16).map(m => ({ role: m.role, content: m.content }));
            const { data } = await api.post('/ai/chat', {
                message: userMessage || (currentAttachment ? "Analiza este archivo" : ""),
                history: historyToSend,
                image: currentAttachment?.data,
                mimeType: currentAttachment?.type
            });

            setMessages(prev => [...prev, {
                role: 'model',
                content: data.reply,
                actions: data.actions || [],
                pendingAction: data.pendingAction
            }]);
        } catch (error: unknown) {
            const apiError = error as AssistantApiError;
            console.error(error);
            let errorMessage = apiError.response?.data?.details || apiError.response?.data?.error || 'Lo siento, tuve un problema conectando con mi cerebro. 🧠💥';

            if (apiError.code === 'ERR_NETWORK' || apiError.message === 'Network Error') {
                errorMessage = "⚠️ Error de Conexión: No pude contactar al servidor. Verifica tu conexión o la configuración de URL.";
            }

            setMessages(prev => [...prev, { role: 'model', content: `${errorMessage} Por favor intenta de nuevo.` }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if ((!input.trim() && !attachment) || isLoading) return;

        const userMessage = input.trim();
        const currentAttachment = attachment; // Capture current state

        setInput("");
        setAttachment(null);
        if (fileInputRef.current) fileInputRef.current.value = "";

        await sendMessage(userMessage, currentAttachment);
    };

    const handleActionClick = async (action: AssistantAction) => {
        if (action.type === 'download') {
            try {
                const response = await api.get(action.value, { responseType: 'blob' });
                const disposition = response.headers['content-disposition'] || '';
                const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] || action.value.split('/').pop() || 'reporte.xlsx';
                const objectUrl = URL.createObjectURL(response.data);
                const anchor = document.createElement('a');
                anchor.href = objectUrl;
                anchor.download = filename;
                anchor.click();
                URL.revokeObjectURL(objectUrl);
            } catch {
                setMessages(prev => [...prev, { role: 'model', content: 'No pude descargar el archivo. Intenta generarlo nuevamente.' }]);
            }
            return;
        }
        if (action.type === 'link') {
            window.location.href = action.value.startsWith('/api/') || action.value.startsWith('http')
                ? resolveApiUrl(action.value)
                : action.value;
            return;
        }

        await sendMessage(action.value);
    };

    const handlePendingAction = async (messageIndex: number, pendingAction: PendingAssistantAction, confirm: boolean) => {
        setMessages(prev => prev.map((message, index) => index === messageIndex ? { ...message, pendingAction: undefined } : message));
        if (!confirm) {
            setMessages(prev => [...prev, { role: 'model', content: 'Acción cancelada. No se modificó ningún dato.' }]);
            return;
        }

        setIsLoading(true);
        try {
            const { data } = await api.post('/ai/confirm', { token: pendingAction.token });
            setMessages(prev => [...prev, { role: 'model', content: data.reply, actions: data.actions || [] }]);
        } catch (error: unknown) {
            const apiError = error as AssistantApiError;
            setMessages(prev => [...prev, {
                role: 'model',
                content: apiError.response?.data?.error || 'No fue posible confirmar la acción. No se aplicaron cambios.'
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const clearConversation = () => {
        if (storageKey) sessionStorage.removeItem(storageKey);
        setMessages([{
            role: 'model',
            content: '🤖 **MisCompras Bot activo**\n\nConsulta proyectos, presupuestos, requerimientos, facturas, anticipos o proveedores. Las acciones que cambian datos siempre requerirán tu confirmación.'
        }]);
    };

    return (
        <>
            {/* Floating Trigger Button */}
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsOpen(true)}
                className={`fixed bottom-6 right-6 z-[60] width-[60px] height-[60px] p-4 rounded-full shadow-2xl transition-all duration-300 ${isOpen ? 'scale-0 opacity-0 pointer-events-none' : 'scale-100 opacity-100'
                    } bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center`}
            >
                <Sparkles size={28} className="animate-pulse" />
            </motion.button>

            {/* Chat Window */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className="fixed bottom-6 right-6 z-[60] w-[380px] md:w-[450px] max-w-[calc(100vw-48px)] h-[600px] max-h-[calc(100vh-100px)] bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-gray-100 dark:border-gray-800 flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white">
                                    <Bot size={24} />
                                </div>
                                <div>
                                    <h3 className="font-black text-white text-lg leading-tight">MisCompras AI</h3>
                                    <p className="text-white/70 text-xs font-medium">Asistente Virtual</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={clearConversation}
                                    className="p-2 hover:bg-white/10 rounded-full text-white transition-colors"
                                    title="Nueva conversación"
                                    aria-label="Nueva conversación"
                                >
                                    <RotateCcw size={18} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsOpen(false)}
                                    className="p-2 hover:bg-white/10 rounded-full text-white transition-colors"
                                    aria-label="Cerrar asistente"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-slate-950/50 scroll-smooth">
                            {messages.map((msg, idx) => (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    key={idx}
                                    className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    {msg.role === 'model' && (
                                        <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 shrink-0 mb-1">
                                            <Bot size={14} />
                                        </div>
                                    )}
                                    <div
                                        className={`max-w-[80%] p-3.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${msg.role === 'user'
                                            ? 'bg-indigo-600 text-white rounded-br-none'
                                            : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 rounded-bl-none border border-gray-100 dark:border-gray-700'
                                            }`}
                                    >
                                        {msg.content.split(/(\[[^\]]+\]\([^)]+\))/g).map((part, i) => {
                                            const match = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
                                            if (match) {
                                                return (
                                                    <a
                                                        key={i}
                                                        href={resolveApiUrl(match[2])}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="underline font-bold text-inherit hover:opacity-80"
                                                    >
                                                        {match[1]}
                                                    </a>
                                                );
                                            }
                                            return part;
                                        })}
                                        {msg.role === 'model' && msg.actions && msg.actions.length > 0 && (
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {msg.actions.map((action, actionIdx) => (
                                                    <button
                                                        key={`${action.label}-${actionIdx}`}
                                                        type="button"
                                                        disabled={isLoading}
                                                        onClick={() => handleActionClick(action)}
                                                        className="px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-200 text-xs font-black hover:bg-indigo-100 dark:hover:bg-indigo-800 disabled:opacity-50 transition-colors"
                                                    >
                                                        {action.label}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        {msg.role === 'model' && msg.pendingAction && (
                                            <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-slate-800 shadow-sm dark:border-amber-700 dark:bg-amber-950/30 dark:text-slate-100">
                                                <div className="flex items-start gap-2">
                                                    <div className="mt-0.5 rounded-lg bg-amber-100 p-1.5 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                                                        <ShieldCheck size={17} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">Confirmación requerida</p>
                                                        <p className="mt-1 font-black text-sm">{msg.pendingAction.title}</p>
                                                        <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{msg.pendingAction.description}</p>
                                                    </div>
                                                </div>
                                                <div className="mt-3 flex gap-2">
                                                    <button
                                                        type="button"
                                                        disabled={isLoading}
                                                        onClick={() => handlePendingAction(idx, msg.pendingAction!, false)}
                                                        className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                                                    >
                                                        Cancelar
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={isLoading}
                                                        onClick={() => handlePendingAction(idx, msg.pendingAction!, true)}
                                                        className="flex-1 rounded-lg bg-amber-600 px-3 py-2 text-xs font-black text-white hover:bg-amber-700 disabled:opacity-50"
                                                    >
                                                        {msg.pendingAction.confirmLabel}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    {msg.role === 'user' && (
                                        <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-slate-800 flex items-center justify-center text-gray-500 shrink-0 mb-1">
                                            <User size={14} />
                                        </div>
                                    )}
                                </motion.div>
                            ))}
                            {isLoading && (
                                <div className="flex justify-start gap-2">
                                    <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 shrink-0">
                                        <Bot size={14} />
                                    </div>
                                    <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl rounded-bl-none border border-gray-100 dark:border-gray-700 flex gap-1 items-center">
                                        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></div>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-4 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-gray-800 shrink-0 flex flex-col gap-2">
                            {/* Attachment Preview */}
                            <AnimatePresence>
                                {attachment && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded-xl text-xs text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800"
                                    >
                                        <div className="p-1.5 bg-indigo-100 dark:bg-indigo-800 rounded-lg">
                                            {attachment.type.startsWith('image/') ? <ImageIcon size={14} /> : <FileText size={14} />}
                                        </div>
                                        <span className="truncate max-w-[200px] font-medium">{attachment.name}</span>
                                        <button
                                            onClick={() => { setAttachment(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                                            className="ml-auto p-1 hover:bg-indigo-200 dark:hover:bg-indigo-700 rounded-full transition-colors"
                                        >
                                            <X size={14} />
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <form onSubmit={handleSubmit} className="flex gap-2 items-center">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept="image/*,application/pdf"
                                    onChange={handleFileSelect}
                                />
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="p-3 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-xl transition-colors"
                                    title="Adjuntar archivo"
                                    aria-label="Adjuntar archivo"
                                >
                                    <Paperclip size={20} />
                                </button>
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder={attachment ? "Describe el archivo..." : "Pregunta sobre tus presupuestos..."}
                                    className="flex-1 bg-gray-100 dark:bg-slate-800 border-0 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                    disabled={isLoading}
                                />
                                <button
                                    type="submit"
                                    disabled={(!input.trim() && !attachment) || isLoading}
                                    className="p-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors shadow-lg shadow-indigo-200 dark:shadow-none"
                                    aria-label="Enviar mensaje"
                                >
                                    {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                                </button>
                            </form>
                            <p className="text-[10px] text-center text-gray-400 mt-1">
                                Respuestas con IA · <span className="text-amber-600 inline-flex items-center gap-1"><AlertTriangle size={10} /> Verifica la información crítica.</span>
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
