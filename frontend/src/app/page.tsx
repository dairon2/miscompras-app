"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/authStore";
import { Plus, CheckCircle, Clock, AlertCircle, TrendingUp, BarChart3, Users, Building2, Package, ArrowRight } from "lucide-react";
import api from "@/lib/api";

export default function HomePage() {
  const { user, isAuthenticated } = useAuthStore();
  const router = useRouter();
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, totalAmount: 0 });
  const [recentRequirements, setRecentRequirements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
    } else {
      fetchDashboardData();
    }
  }, [isAuthenticated, router]);

  const fetchDashboardData = async () => {
    try {
      const response = await api.get("/requirements/dashboard-stats");
      const { pending, approved, rejected, totalAmount, recent } = response.data;

      setStats({
        pending: pending || 0,
        approved: approved || 0,
        rejected: rejected || 0,
        totalAmount: totalAmount || 0
      });
      setRecentRequirements(recent || []);
    } catch (err) {
      console.error("Error fetching dashboard data", err);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div className="max-w-7xl mx-auto p-6 lg:p-12">
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-12"
      >
        <h2 className="text-4xl font-black tracking-tight mb-2">
          Bienvenido de nuevo, <span className="text-primary-600">{user?.name || user?.email}</span>
        </h2>
        <p className="text-gray-500 dark:text-gray-400 font-medium italic">
          Gestiona tus requerimientos de compra y presupuestos de forma eficiente.
        </p>
      </motion.section>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <StatCard title="Pendientes" value={stats.pending.toString()} sub="Requieren atención" icon={<Clock />} color="bg-yellow-50 text-yellow-600" />
        <StatCard title="Aprobados" value={stats.approved.toString()} sub="En proceso" icon={<CheckCircle />} color="bg-green-50 text-green-600" />
        <StatCard title="Total Solicitado" value={`$${(stats.totalAmount / 1e6).toFixed(1)}M`} sub="Consumido" icon={<BarChart3 />} color="bg-primary-50 text-primary-600" />
        <StatCard title="Rechazados" value={stats.rejected.toString()} sub="Corregir" icon={<AlertCircle />} color="bg-red-50 text-red-600" />
      </div>

      {/* Main Content Areas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 rounded-[2.5rem] bg-white dark:bg-slate-800 p-8 shadow-xl border border-gray-100 dark:border-gray-700">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-2xl font-black tracking-tight">Actividad Reciente</h3>
            <button
              onClick={() => router.push('/requirements')}
              className="text-primary-600 font-bold text-sm hover:underline flex items-center gap-1"
            >
              Ver todos los requerimientos
            </button>
          </div>

          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-12 text-gray-400 font-bold">Cargando actividad...</div>
            ) : recentRequirements.length === 0 ? (
              <div className="text-center py-12 text-gray-400 font-bold">No hay actividad reciente.</div>
            ) : (
              recentRequirements.map((req: any) => (
                <div
                  key={req.id}
                  onClick={() => router.push(`/requirements/${req.id}`)}
                  className="flex items-center justify-between p-5 rounded-3xl hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-all border border-transparent hover:border-gray-100 dark:hover:border-gray-600 group cursor-pointer"
                >
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-gray-50 dark:bg-primary-900/20 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                      <Package className="text-primary-500 w-7 h-7" />
                    </div>
                    <div>
                      <h4 className="font-bold text-lg">{req.title}</h4>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">ID: {req.id.substring(0, 8)} • {new Date(req.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${req.status === 'APPROVED' ? 'bg-green-50 text-green-700 border-green-100' :
                      req.status === 'REJECTED' ? 'bg-red-50 text-red-700 border-red-100' :
                        'bg-yellow-50 text-yellow-700 border-yellow-100'
                      }`}>
                      {req.status.replace('_', ' ')}
                    </span>
                    <p className="text-lg font-black mt-2 text-primary-900 dark:text-white">${parseFloat(req.totalAmount).toLocaleString()}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-[2.5rem] bg-slate-900 p-10 text-white shadow-2xl flex flex-col justify-between overflow-hidden relative group">
          <div className="relative z-10">
            <h3 className="text-2xl font-black mb-6 opacity-90 tracking-tight">Acciones Rápidas</h3>
            <div className="space-y-4">
              <button
                onClick={() => router.push('/requirements/new')}
                className="w-full py-5 bg-primary-600 hover:bg-primary-500 rounded-2xl font-black flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-primary-500/20"
              >
                <Plus size={20} /> Nuevo Requerimiento
              </button>
              <button
                onClick={() => router.push('/requirements')}
                className="w-full py-5 bg-white/5 hover:bg-white/10 rounded-2xl font-black flex items-center justify-center gap-3 transition-all border border-white/10"
              >
                Mis Solicitudes <ArrowRight size={18} />
              </button>
            </div>

            <div className="mt-12 p-6 bg-primary-500/10 rounded-3xl border border-primary-500/20">
              <p className="text-[10px] font-bold text-primary-400 uppercase tracking-widest mb-2">Tip del día</p>
              <p className="text-sm font-medium opacity-80">Recuerda adjuntar las cotizaciones para acelerar el proceso de aprobación.</p>
            </div>
          </div>

          {/* Abstract visuals */}
          <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-primary-500/10 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-1000"></div>
          <div className="absolute -left-10 -top-10 w-40 h-40 bg-accent-gold/5 rounded-full blur-2xl"></div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, sub, icon, color }: any) {
  return (
    <motion.div
      whileHover={{ y: -5 }}
      className="rounded-[2.5rem] bg-white dark:bg-slate-800 p-8 shadow-xl border border-gray-100 dark:border-gray-700 transition-all group"
    >
      <div className="flex justify-between items-start mb-6">
        <div className={`w-12 h-12 rounded-2xl ${color} flex items-center justify-center group-hover:rotate-12 transition-transform`}>
          {icon}
        </div>
      </div>
      <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">{title}</p>
      <h4 className="text-3xl font-black mb-1 tracking-tighter">{value}</h4>
      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tight opacity-70">{sub}</p>
    </motion.div>
  );
}
