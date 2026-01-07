"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    HelpCircle,
    ChevronDown,
    ChevronRight,
    BookOpen,
    FileText,
    DollarSign,
    Package,
    Users,
    Building2,
    Mail,
    Phone,
    MessageCircle,
    Search,
    CheckCircle,
    AlertCircle,
    Briefcase,
    ClipboardList,
    Receipt,
    Settings,
    ArrowLeft
} from "lucide-react";
import Link from "next/link";

interface FAQItem {
    question: string;
    answer: string;
    category: string;
}

const faqData: FAQItem[] = [
    // Requerimientos
    {
        category: "Requerimientos",
        question: "¿Cómo creo un nuevo requerimiento?",
        answer: "Ve a 'Solicitudes' → 'Nueva Solicitud'. Selecciona el presupuesto del cual se descontará, completa el título, descripción, cantidad y adjunta los archivos necesarios. Puedes agregar múltiples ítems a una misma solicitud."
    },
    {
        category: "Requerimientos",
        question: "¿Qué significan los estados de un requerimiento?",
        answer: "PENDIENTE_APROBACIÓN: Esperando aprobación del líder/coordinador/director. APROBADO: Listo para gestión de compras. RECHAZADO: No fue aprobado, revisa los comentarios. EN_TRÁMITE: Se está gestionando la compra. FINALIZADO: Proceso completado."
    },
    {
        category: "Requerimientos",
        question: "¿Puedo editar un requerimiento después de enviarlo?",
        answer: "Solo puedes editar requerimientos que estén en estado PENDIENTE_APROBACIÓN y que hayas creado tú. Una vez aprobado o rechazado, no se puede modificar."
    },
    // Presupuestos
    {
        category: "Presupuestos",
        question: "¿Cómo funciona el sistema de presupuestos?",
        answer: "Cada presupuesto tiene un monto asignado y un saldo disponible. Cuando se aprueba un requerimiento, el monto estimado se descuenta del saldo disponible. El Director es el único que puede crear y aprobar presupuestos."
    },
    {
        category: "Presupuestos",
        question: "¿Qué es un ajuste de presupuesto?",
        answer: "Un ajuste puede ser: INCREMENTO (agregar fondos) o TRANSFERENCIA (mover fondos entre presupuestos). Ambos requieren aprobación del Director."
    },
    {
        category: "Presupuestos",
        question: "¿Por qué no veo todos los presupuestos?",
        answer: "Solo puedes ver los presupuestos donde eres Manager o Sublíder. Los administradores y directores ven todos los presupuestos."
    },
    // Pagos y Facturas
    {
        category: "Pagos y Facturas",
        question: "¿Cómo registro un pago o abono?",
        answer: "Accede al detalle del requerimiento, activa la opción 'Pagos Múltiples', y usa el botón 'Agregar Abono'. Ingresa el monto, número de factura, orden de compra y fecha de pago."
    },
    {
        category: "Pagos y Facturas",
        question: "¿Cuántos pagos puedo registrar por requerimiento?",
        answer: "Puedes registrar hasta 12 pagos por requerimiento. El sistema calculará automáticamente el progreso y saldo pendiente."
    },
    // Usuarios y Roles
    {
        category: "Usuarios y Roles",
        question: "¿Qué permisos tiene cada rol?",
        answer: "USER: Crea requerimientos y ve solo sus proyectos asignados. LEADER: Aprueba requerimientos de su área. COORDINATOR: Aprueba después del líder. DIRECTOR: Aprobación final, gestión de presupuestos. ADMIN: Acceso total al sistema."
    },
    {
        category: "Usuarios y Roles",
        question: "¿Cómo cambio mi contraseña?",
        answer: "Ve a tu perfil haciendo clic en tu avatar → 'Mi Cuenta'. Ahí encontrarás la opción para cambiar tu contraseña."
    },
    // General
    {
        category: "General",
        question: "¿Cómo descargo reportes?",
        answer: "Ve a la sección 'Reportes' en el menú lateral. Encontrarás diferentes tipos de reportes que puedes filtrar por fecha, área, proyecto y exportar a Excel."
    },
    {
        category: "General",
        question: "¿Qué hago si encuentro un error?",
        answer: "Contacta al equipo de soporte usando la información en la sección 'Contacto' de esta página. Incluye una descripción detallada del problema y capturas de pantalla si es posible."
    }
];

const moduleGuides = [
    {
        icon: ClipboardList,
        title: "Requerimientos",
        description: "Crea solicitudes de compra, adjunta documentos y haz seguimiento a las aprobaciones.",
        steps: ["Selecciona presupuesto", "Completa información", "Adjunta archivos", "Envía solicitud"]
    },
    {
        icon: DollarSign,
        title: "Presupuestos",
        description: "Consulta el estado de los presupuestos asignados y su saldo disponible.",
        steps: ["Ve a Presupuestos", "Filtra por año/proyecto", "Revisa saldos", "Solicita ajustes"]
    },
    {
        icon: Receipt,
        title: "Facturas",
        description: "Registra facturas y asocia los pagos correspondientes.",
        steps: ["Crea nueva factura", "Selecciona proveedor", "Ingresa montos", "Adjunta documento"]
    },
    {
        icon: Users,
        title: "Proveedores",
        description: "Consulta y gestiona la información de los proveedores del sistema.",
        steps: ["Busca proveedor", "Revisa datos", "Actualiza información", "Verifica documentos"]
    },
    {
        icon: Building2,
        title: "Proyectos",
        description: "Visualiza los proyectos activos y sus presupuestos asociados.",
        steps: ["Selecciona proyecto", "Revisa presupuestos", "Consulta requerimientos", "Ve el histórico"]
    },
    {
        icon: Settings,
        title: "Configuración",
        description: "Ajusta las preferencias del sistema y gestiona usuarios (solo administradores).",
        steps: ["Accede a config", "Modifica parámetros", "Gestiona roles", "Guarda cambios"]
    }
];

const categories = ["Todos", "Requerimientos", "Presupuestos", "Pagos y Facturas", "Usuarios y Roles", "General"];

export default function HelpPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("Todos");
    const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);

    const filteredFAQ = faqData.filter(item => {
        const matchesSearch = item.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.answer.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === "Todos" || item.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
            <div className="p-6 lg:p-10 max-w-[1600px] mx-auto">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-12"
                >
                    <Link
                        href="/"
                        className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-primary-600 flex items-center gap-2 mb-4 transition-colors"
                    >
                        <ArrowLeft size={12} /> Volver al Inicio
                    </Link>
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-4 bg-gradient-to-br from-amber-400 to-orange-500 rounded-3xl shadow-lg">
                            <HelpCircle className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h1 className="text-4xl font-black tracking-tight">Centro de Ayuda</h1>
                            <p className="text-gray-500 font-medium">Encuentra respuestas y aprende a usar el sistema</p>
                        </div>
                    </div>
                </motion.div>

                {/* Search Bar */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="mb-8"
                >
                    <div className="relative max-w-2xl">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Buscar en la ayuda..."
                            className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-2xl py-4 pl-14 pr-6 outline-none focus:ring-2 focus:ring-amber-500 text-lg font-medium shadow-sm"
                        />
                    </div>
                </motion.div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* Module Guides */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 shadow-xl border border-gray-100 dark:border-gray-700"
                        >
                            <div className="flex items-center gap-3 mb-6">
                                <BookOpen className="text-amber-500" size={24} />
                                <h2 className="text-2xl font-black">Guías por Módulo</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {moduleGuides.map((guide, index) => (
                                    <div
                                        key={index}
                                        className="group p-5 bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-900 dark:to-slate-800 rounded-2xl border border-gray-100 dark:border-gray-700 hover:border-amber-300 dark:hover:border-amber-500 transition-all hover:shadow-lg cursor-pointer"
                                    >
                                        <div className="flex items-start gap-4">
                                            <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-xl text-amber-600 group-hover:scale-110 transition-transform">
                                                <guide.icon size={20} />
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="font-black text-lg mb-1">{guide.title}</h3>
                                                <p className="text-sm text-gray-500 mb-3">{guide.description}</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {guide.steps.map((step, i) => (
                                                        <span key={i} className="text-[10px] bg-white dark:bg-slate-700 px-2 py-1 rounded-lg font-bold text-gray-600 dark:text-gray-300 border border-gray-100 dark:border-gray-600">
                                                            {i + 1}. {step}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>

                        {/* FAQ Section */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 shadow-xl border border-gray-100 dark:border-gray-700"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <MessageCircle className="text-amber-500" size={24} />
                                    <h2 className="text-2xl font-black">Preguntas Frecuentes</h2>
                                </div>
                                <span className="text-sm text-gray-400 font-bold">{filteredFAQ.length} resultados</span>
                            </div>

                            {/* Category Filter */}
                            <div className="flex flex-wrap gap-2 mb-6">
                                {categories.map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => setSelectedCategory(cat)}
                                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${selectedCategory === cat
                                            ? 'bg-amber-500 text-white'
                                            : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                                            }`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>

                            {/* FAQ Items */}
                            <div className="space-y-3">
                                {filteredFAQ.length === 0 ? (
                                    <div className="text-center py-12 text-gray-400">
                                        <AlertCircle className="mx-auto mb-3 opacity-50" size={40} />
                                        <p className="font-bold">No se encontraron resultados</p>
                                        <p className="text-sm">Intenta con otros términos de búsqueda</p>
                                    </div>
                                ) : (
                                    <AnimatePresence>
                                        {filteredFAQ.map((item, index) => (
                                            <motion.div
                                                key={index}
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                className="border border-gray-100 dark:border-gray-700 rounded-2xl overflow-hidden"
                                            >
                                                <button
                                                    onClick={() => setExpandedFAQ(expandedFAQ === index ? null : index)}
                                                    className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-600 text-[10px] font-black rounded-lg uppercase">
                                                            {item.category}
                                                        </span>
                                                        <span className="font-bold text-gray-800 dark:text-white">{item.question}</span>
                                                    </div>
                                                    <ChevronDown className={`text-gray-400 transition-transform ${expandedFAQ === index ? 'rotate-180' : ''}`} size={20} />
                                                </button>
                                                <AnimatePresence>
                                                    {expandedFAQ === index && (
                                                        <motion.div
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: 'auto', opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            className="overflow-hidden"
                                                        >
                                                            <div className="p-5 pt-0 text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-slate-700/30">
                                                                <p className="leading-relaxed">{item.answer}</p>
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                )}
                            </div>
                        </motion.div>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Quick Actions */}
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.4 }}
                            className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-[2rem] p-6 text-white shadow-xl"
                        >
                            <h3 className="text-xl font-black mb-4">Accesos Rápidos</h3>
                            <div className="space-y-3">
                                <Link href="/requirements/new" className="flex items-center gap-3 p-3 bg-white/20 rounded-xl hover:bg-white/30 transition-colors">
                                    <ClipboardList size={20} />
                                    <span className="font-bold text-sm">Nueva Solicitud</span>
                                </Link>
                                <Link href="/requirements" className="flex items-center gap-3 p-3 bg-white/20 rounded-xl hover:bg-white/30 transition-colors">
                                    <FileText size={20} />
                                    <span className="font-bold text-sm">Mis Requerimientos</span>
                                </Link>
                                <Link href="/budget" className="flex items-center gap-3 p-3 bg-white/20 rounded-xl hover:bg-white/30 transition-colors">
                                    <DollarSign size={20} />
                                    <span className="font-bold text-sm">Ver Presupuestos</span>
                                </Link>
                            </div>
                        </motion.div>

                        {/* Contact Support */}
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.5 }}
                            className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 shadow-xl border border-gray-100 dark:border-gray-700"
                        >
                            <h3 className="text-xl font-black mb-4 flex items-center gap-2">
                                <Mail className="text-amber-500" size={20} />
                                Contacto de Soporte
                            </h3>
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
                                    <Mail size={18} className="text-primary-500" />
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-gray-400">Email</p>
                                        <a href="mailto:daironmoreno24@gmail.com" className="font-bold hover:text-amber-500 transition-colors">
                                            daironmoreno24@gmail.com
                                        </a>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
                                    <svg className="w-[18px] h-[18px] text-green-500" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                    </svg>
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-gray-400">WhatsApp</p>
                                        <a href="https://wa.me/573195342608" target="_blank" className="font-bold hover:text-green-500 transition-colors">
                                            +57 319 534 2608
                                        </a>
                                    </div>
                                </div>
                                <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                                    <p className="text-xs text-gray-500">
                                        <strong>Horario de atención:</strong><br />
                                        Lunes a Viernes, 7:30 AM - 9:30 AM
                                    </p>
                                </div>
                            </div>
                        </motion.div>

                        {/* Tips */}
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.6 }}
                            className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-[2rem] p-6 border border-green-200 dark:border-green-800"
                        >
                            <h3 className="text-lg font-black mb-3 text-green-700 dark:text-green-400 flex items-center gap-2">
                                <CheckCircle size={18} />
                                Tips Útiles
                            </h3>
                            <ul className="space-y-2 text-sm text-green-700 dark:text-green-300">
                                <li className="flex items-start gap-2">
                                    <ChevronRight size={16} className="mt-0.5 flex-shrink-0" />
                                    <span>Adjunta siempre cotizaciones para agilizar la aprobación.</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <ChevronRight size={16} className="mt-0.5 flex-shrink-0" />
                                    <span>Usa títulos descriptivos en tus requerimientos.</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <ChevronRight size={16} className="mt-0.5 flex-shrink-0" />
                                    <span>Revisa el saldo disponible antes de crear una solicitud.</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <ChevronRight size={16} className="mt-0.5 flex-shrink-0" />
                                    <span>Activa las notificaciones para no perder actualizaciones.</span>
                                </li>
                            </ul>
                        </motion.div>
                    </div>
                </div>
            </div>
        </div>
    );
}
