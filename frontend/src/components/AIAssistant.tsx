
"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, X, Send, Bot, User, Sparkles, Loader2, Paperclip, FileText, Image as ImageIcon, Trash2 } from "lucide-react";
import api from "@/lib/api";

interface Message {
    role: 'user' | 'model';
    content: string;
}

interface Attachment {
    name: string;
    type: string;
    data: string; // Base64
}

export default function AIAssistant() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { role: 'model', content: '¡Hola! Soy tu asistente virtual de MisCompras. 🤖\n\nPuedo ayudarte a consultar el estado de tus proyectos, presupuestos o requerimientos.\n\n¿En qué te puedo ayudar hoy?' }
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [attachment, setAttachment] = useState<Attachment | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen, attachment]);

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

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if ((!input.trim() && !attachment) || isLoading) return;

        const userMessage = input.trim();
        const currentAttachment = attachment; // Capture current state

        // Optimistic update
        let displayText = userMessage;
        if (currentAttachment) {
            displayText += `\n[Archivo adjunto: ${currentAttachment.name}]`;
        }

        setInput("");
        setAttachment(null);
        if (fileInputRef.current) fileInputRef.current.value = "";

        setMessages(prev => [...prev, { role: 'user', content: displayText }]);
        setIsLoading(true);

        try {
            const { data } = await api.post('/ai/chat', {
                message: userMessage || (currentAttachment ? "Analiza este archivo" : ""),
                history: messages.map(m => ({ role: m.role, content: m.content })),
                image: currentAttachment?.data,
                mimeType: currentAttachment?.type
            });

            setMessages(prev => [...prev, { role: 'model', content: data.reply }]);
        } catch (error: any) {
            console.error(error);
            let errorMessage = error.response?.data?.details || error.response?.data?.error || 'Lo siento, tuve un problema conectando con mi cerebro. 🧠💥';
            const apiKeyStatus = error.response?.data?.keyPresent !== undefined ? `(Key Present: ${error.response.data.keyPresent})` : '';

            if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
                errorMessage = "⚠️ Error de Conexión: No pude contactar al servidor. Verifica tu conexión o la configuración de URL.";
            }

            setMessages(prev => [...prev, { role: 'model', content: `${errorMessage} ${apiKeyStatus} Por favor intenta de nuevo.` }]);
        } finally {
            setIsLoading(false);
        }
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
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-2 hover:bg-white/10 rounded-full text-white transition-colors"
                            >
                                <X size={20} />
                            </button>
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
                                                        href={match[2]}
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
                                >
                                    {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                                </button>
                            </form>
                            <p className="text-[10px] text-center text-gray-400 mt-1">
                                Impulsado por Google Gemini AI
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
