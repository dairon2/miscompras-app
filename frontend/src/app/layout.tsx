"use client";

import { Outfit } from "next/font/google";
import "./globals.css";
import { useAuthStore } from "@/store/authStore";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import api from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, User as UserIcon, Bell, Package, LayoutDashboard, Database, Briefcase, FileText, Users, Building2, Settings, Shield, Mail, MapPin, X, BookOpen, UserCog } from "lucide-react";
import ToastContainer from "@/components/ToastContainer";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user, logout, isAuthenticated } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const fetchNotifications = async () => {
    if (!isAuthenticated) return;
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data);
    } catch (err) {
      console.error("Error fetching notifications", err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Polling every 30s
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifs(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markRead = async (id: string, reqId?: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(notifications.map(n => n.id === id ? { ...n, isRead: true } : n));
      if (reqId) {
        setShowNotifs(false);
        router.push(`/requirements/${reqId}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications(notifications.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const isAuthPage = pathname === "/login" || pathname === "/register";

  return (
    <html lang="es">
      <body className={`${outfit.variable} font-sans antialiased text-slate-900 bg-[#fdfdfd] dark:bg-[#0f172a] dark:text-slate-100`}>
        <div className="min-h-screen flex flex-col">
          {!isAuthPage && (
            <header className="glass fixed top-0 left-0 right-0 z-50 border-b border-gray-100 dark:border-white/5 px-8 py-4">
              <div className="max-w-7xl mx-auto flex justify-between items-center">
                <div
                  className="flex items-center gap-6 cursor-pointer group"
                  onClick={() => router.push("/")}
                >
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    className="relative"
                  >
                    <img
                      src="/images/logo-museo.png"
                      alt="Museo de Antioquia"
                      className="h-12 w-auto object-contain hover:scale-105 transition-all duration-500"
                    />
                  </motion.div>
                  <div className="h-10 w-[2px] bg-gray-100 dark:bg-gray-800 hidden sm:block"></div>
                  <div className="hidden sm:block">
                    <h1 className="text-xl font-black tracking-tighter leading-none mb-1 text-slate-900 dark:text-white">MIS COMPRAS</h1>
                    <p className="text-[9px] text-primary-600 uppercase tracking-[0.3em] font-black">Museo de Antioquia</p>
                  </div>
                </div>

                <nav className="hidden lg:flex items-center gap-10 text-[11px] font-black uppercase tracking-widest text-gray-400">
                  <NavItem href="/" icon={<LayoutDashboard size={14} />} label="Inicio" active={pathname === "/"} />
                  <NavItem icon={<FileText size={14} />} label="Requerimientos" href="/requirements" active={pathname === "/requirements" || pathname.startsWith("/requirements/")} />
                  {['ADMIN', 'DIRECTOR', 'LEADER'].includes(user?.role || '') && (
                    <NavItem icon={<BookOpen size={14} />} label="Asientos" href="/asientos" active={pathname === "/asientos" || pathname.startsWith("/asientos/")} />
                  )}
                  <NavItem icon={<Users size={14} />} label="Proveedores" href="/suppliers" active={pathname === "/suppliers"} />
                  <NavItem icon={<Building2 size={14} />} label="Presupuestos" href="/budget" active={pathname === "/budget" && !pathname.includes("/adjustments")} />
                  {user?.role === 'DIRECTOR' && (
                    <NavItem icon={<FileText size={14} />} label="Ajustes" href="/budget/adjustments" active={pathname === "/budget/adjustments"} />
                  )}
                </nav>

                <div className="flex items-center gap-6">
                  <div className="relative" ref={notifRef}>
                    <button
                      onClick={() => setShowNotifs(!showNotifs)}
                      className="p-3 text-gray-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-2xl transition-all relative"
                    >
                      <Bell className="w-5 h-5" />
                      {unreadCount > 0 && (
                        <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-[#0f172a] animate-pulse"></span>
                      )}
                    </button>

                    <AnimatePresence>
                      {showNotifs && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute right-0 mt-4 w-80 bg-white dark:bg-slate-800 rounded-[2rem] shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden z-[60]"
                        >
                          <div className="p-6 border-b border-gray-50 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-slate-900/50">
                            <h3 className="text-xs font-black uppercase tracking-widest">Notificaciones</h3>
                            {unreadCount > 0 && (
                              <button onClick={markAllRead} className="text-[10px] font-black text-primary-600 hover:underline uppercase">Marcar todas</button>
                            )}
                          </div>
                          <div className="max-h-96 overflow-y-auto">
                            {notifications.length === 0 ? (
                              <div className="p-10 text-center">
                                <p className="text-xs text-gray-400 font-bold">No tienes notificaciones</p>
                              </div>
                            ) : (
                              notifications.map((n) => (
                                <div
                                  key={n.id}
                                  onClick={() => markRead(n.id, n.requirementId)}
                                  className={`p-5 border-b border-gray-50 dark:border-gray-700 cursor-pointer transition-colors ${!n.isRead ? 'bg-primary-50/30 dark:bg-primary-900/10' : 'hover:bg-gray-50 dark:hover:bg-slate-700/50'}`}
                                >
                                  <div className="flex gap-3">
                                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${!n.isRead ? 'bg-primary-500' : 'bg-transparent'}`}></div>
                                    <div>
                                      <p className={`text-xs mb-1 ${!n.isRead ? 'font-black' : 'font-bold text-gray-500'}`}>{n.title}</p>
                                      <p className="text-[11px] text-gray-400 font-medium leading-relaxed">{n.message}</p>
                                      <p className="text-[9px] text-gray-300 font-bold uppercase mt-2">{new Date(n.createdAt).toLocaleTimeString()}</p>
                                    </div>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="h-8 w-[1px] bg-gray-100 dark:bg-gray-800"></div>

                  <div className="relative" ref={profileRef}>
                    <button
                      onClick={() => setShowProfileMenu(!showProfileMenu)}
                      className="flex items-center gap-3 group p-1 pr-3 rounded-2xl hover:bg-gray-50 dark:hover:bg-slate-800 transition-all"
                    >
                      <div className="w-10 h-10 rounded-xl bg-premium-gradient flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                        <UserIcon className="w-5 h-5 text-white" />
                      </div>
                      <div className="text-left hidden sm:block">
                        <p className="text-xs font-black text-gray-800 dark:text-gray-100 leading-none mb-0.5">{user?.name || "Usuario"}</p>
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">{user?.role || "Personal"}</p>
                      </div>
                    </button>

                    <AnimatePresence>
                      {showProfileMenu && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute right-0 mt-4 w-64 bg-white dark:bg-slate-800 rounded-[2rem] shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden z-[60]"
                        >
                          <div className="p-6 border-b border-gray-50 dark:border-gray-700 bg-gray-50/50 dark:bg-slate-900/50">
                            <p className="text-[10px] font-black text-primary-600 uppercase tracking-[0.2em] mb-2 text-center">Sesión Activa</p>
                            <div className="flex flex-col items-center pt-2">
                              <div className="w-16 h-16 rounded-full bg-premium-gradient flex items-center justify-center mb-3 shadow-xl">
                                <UserIcon className="w-8 h-8 text-white" />
                              </div>
                              <h4 className="text-sm font-black text-center">{user?.name}</h4>
                              <p className="text-[10px] text-gray-400 font-bold mb-1">{user?.email}</p>
                              <span className="px-3 py-1 bg-primary-50 dark:bg-primary-900/30 text-primary-600 rounded-full text-[9px] font-black uppercase">{user?.role}</span>
                            </div>
                          </div>

                          <div className="p-2">
                            <button
                              onClick={() => { setShowAccountModal(true); setShowProfileMenu(false); }}
                              className="w-full flex items-center gap-3 p-4 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-600 rounded-2xl transition-all"
                            >
                              <Shield className="w-4 h-4" />
                              <span>Mi Cuenta</span>
                            </button>

                            {user?.role === 'ADMIN' && (
                              <>
                                <a
                                  href="/users"
                                  onClick={() => setShowProfileMenu(false)}
                                  className="w-full flex items-center gap-3 p-4 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-600 rounded-2xl transition-all"
                                >
                                  <UserCog className="w-4 h-4" />
                                  <span>Usuarios</span>
                                </a>
                                <a
                                  href="/admin"
                                  onClick={() => setShowProfileMenu(false)}
                                  className="w-full flex items-center gap-3 p-4 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-600 rounded-2xl transition-all"
                                >
                                  <Settings className="w-4 h-4" />
                                  <span>Configuración</span>
                                </a>
                              </>
                            )}

                            <div className="h-[1px] bg-gray-50 dark:bg-gray-700 my-1 mx-4"></div>

                            <button
                              onClick={handleLogout}
                              className="w-full flex items-center gap-3 p-4 text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-2xl transition-all"
                            >
                              <LogOut className="w-4 h-4" />
                              <span>Cerrar Sesión</span>
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </header>
          )}

          <AnimatePresence>
            {showAccountModal && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowAccountModal(false)}
                  className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-[3rem] shadow-3xl overflow-hidden border border-white/20"
                >
                  <div className="p-10 pt-12 text-center relative">
                    <button
                      onClick={() => setShowAccountModal(false)}
                      className="absolute top-8 right-8 p-3 text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 rounded-2xl transition-all"
                    >
                      <X className="w-5 h-5" />
                    </button>

                    <div className="w-24 h-24 rounded-[2rem] bg-premium-gradient flex items-center justify-center mx-auto mb-6 shadow-2xl rotate-3">
                      <UserIcon className="w-12 h-12 text-white -rotate-3" />
                    </div>

                    <h2 className="text-3xl font-black tracking-tighter mb-2">Detalles de la Cuenta</h2>
                    <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest mb-10">Gestión de Perfil Institucional</p>

                    <div className="grid grid-cols-1 gap-6 text-left">
                      <InfoCard icon={<UserIcon size={18} />} label="Nombre Completo" value={user?.name || 'No definido'} />
                      <InfoCard icon={<Mail size={18} />} label="Correo Electrónico" value={user?.email || 'No definido'} />
                      <div className="grid grid-cols-2 gap-6">
                        <InfoCard icon={<Shield size={18} />} label="Rol del Sistema" value={user?.role || 'No definido'} highlight />
                        <InfoCard icon={<MapPin size={18} />} label="Área / Departamento" value={(user as any)?.areaId === 'area-1' ? 'Curaduría' : (user as any)?.areaId === 'area-3' ? 'Administración' : 'Museo'} />
                      </div>
                    </div>

                    <div className="mt-12 p-8 bg-gray-50/50 dark:bg-slate-900/50 rounded-[2rem] border border-gray-100 dark:border-white/5">
                      <p className="text-xs text-gray-500 font-medium leading-relaxed">
                        Esta cuenta está vinculada al sistema de adquisiciones del Museo de Antioquia.
                        Para cambios en tus permisos o roles, contacta al departamento de IT.
                      </p>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          <main className={`flex-1 ${isAuthPage ? "" : "pt-28 pb-20"}`}>
            {children}
          </main>

          {!isAuthPage && (
            <footer className="py-12 border-t border-gray-100 dark:border-gray-800">
              <div className="max-w-7xl mx-auto px-8 flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-4 opacity-70 group cursor-pointer" onClick={() => router.push("/")}>
                  <img src="/images/logo-museo.png" alt="Museo de Antioquia" className="h-10 w-auto grayscale group-hover:grayscale-0 transition-all" />
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-white">Mis Compras</span>
                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter">Versión 1.0</span>
                  </div>
                </div>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                  &copy; {new Date().getFullYear()} Museo de Antioquia - Departamento de Operaciones
                </p>
              </div>
            </footer>
          )}
        </div>
        <ToastContainer />
      </body>
    </html>
  );
}

function NavItem({ href, icon, label, active }: any) {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push(href)}
      className={`flex items-center gap-2 group transition-all ${active ? 'text-primary-600' : 'hover:text-primary-500'}`}
    >
      <div className={`p-1.5 rounded-lg transition-colors ${active ? 'bg-primary-50 dark:bg-primary-900/30' : 'bg-transparent group-hover:bg-gray-50 dark:group-hover:bg-slate-800'}`}>
        {icon}
      </div>
      <span>{label}</span>
    </button>
  );
}

function InfoCard({ icon, label, value, highlight = false }: any) {
  return (
    <div className={`p-6 rounded-[2rem] border transition-all ${highlight ? 'bg-primary-50/30 border-primary-100 dark:bg-primary-900/10 dark:border-primary-900/20' : 'bg-white dark:bg-slate-800/50 border-gray-50 dark:border-gray-700'}`}>
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-2xl ${highlight ? 'bg-primary-500 text-white shadow-lg' : 'bg-gray-50 dark:bg-slate-700 text-gray-400'}`}>
          {icon}
        </div>
        <div>
          <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{label}</h5>
          <p className={`text-sm font-black ${highlight ? 'text-primary-700 dark:text-primary-400' : 'text-gray-800 dark:text-gray-100'}`}>{value}</p>
        </div>
      </div>
    </div>
  );
}
