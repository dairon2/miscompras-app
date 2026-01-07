"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/authStore";
import { Plus, CheckCircle, Clock, AlertCircle, TrendingUp, BarChart3, Users, Building2, Package, ArrowRight, CalendarClock, DollarSign, FileText, Briefcase, Mail } from "lucide-react";
import api from "@/lib/api";
import { translateStatus } from "@/lib/translations";

export default function HomePage() {
  const { user, isAuthenticated } = useAuthStore();
  const router = useRouter();
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, totalAmount: 0 });
  const [recentRequirements, setRecentRequirements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submissionInfo, setSubmissionInfo] = useState<{
    canSubmit: boolean;
    message: string;
    nextAvailable?: { day: string; date: string; startTime: string; endTime: string };
  } | null>(null);

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

      // Verificar si el usuario puede enviar requerimientos
      try {
        const submissionRes = await api.get("/submission-rules/can-submit");
        setSubmissionInfo(submissionRes.data);
      } catch (e) {
        console.error("Error checking submission:", e);
      }
    } catch (err) {
      console.error("Error fetching dashboard data", err);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div className="max-w-[1600px] mx-auto p-6 lg:p-10">
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10"
      >
        <h2 className="text-4xl font-black tracking-tight mb-2">
          Bienvenido de nuevo, <span className="text-primary-600">{user?.name || user?.email}</span>
        </h2>
        <p className="text-gray-500 dark:text-gray-400 font-medium">
          Resumen de tus actividades de compras y aprobaciones pendientes.
        </p>

        {/* Submission Schedule Banner */}
        {submissionInfo && !submissionInfo.canSubmit && submissionInfo.nextAvailable && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-200 dark:border-amber-800 flex items-start gap-4"
          >
            <div className="p-3 bg-amber-100 dark:bg-amber-900/40 rounded-xl">
              <CalendarClock className="text-amber-600" size={24} />
            </div>
            <div>
              <p className="font-bold text-amber-800 dark:text-amber-200">Horario de Envío de Solicitudes</p>
              <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                Próximo horario disponible: <strong>{submissionInfo.nextAvailable.day} {submissionInfo.nextAvailable.date}</strong>
              </p>
              <p className="text-sm text-amber-600 dark:text-amber-400">
                De {submissionInfo.nextAvailable.startTime} a {submissionInfo.nextAvailable.endTime}
              </p>
            </div>
          </motion.div>
        )}
      </motion.section>

      {/* Stats Grid - Enhanced with mini charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 mb-10">
        <StatCard
          title="Pendientes"
          value={stats.pending.toString()}
          sub="Requieren atención"
          icon={<Clock />}
          color="bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400"
          trend={[30, 45, 35, 50, 40, stats.pending]}
          trendColor="text-yellow-500"
        />
        <StatCard
          title="Aprobados"
          value={stats.approved.toString()}
          sub="En proceso"
          icon={<CheckCircle />}
          color="bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400"
          trend={[20, 35, 45, 55, 70, stats.approved]}
          trendColor="text-green-500"
        />
        <StatCard
          title="Total Solicitado"
          value={`$${(stats.totalAmount / 1e6).toFixed(1)}M`}
          sub="Consumido"
          icon={<DollarSign />}
          color="bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400"
          trend={[40, 60, 55, 80, 75, 90]}
          trendColor="text-primary-500"
        />
        <StatCard
          title="Rechazados"
          value={stats.rejected.toString()}
          sub="Corregir"
          icon={<AlertCircle />}
          color="bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"
          trend={[10, 15, 8, 12, 5, stats.rejected]}
          trendColor="text-red-500"
        />
      </div>

      {/* Main Content Areas - Better proportions */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Recent Activity - Takes 3 columns */}
        <div className="xl:col-span-3 rounded-[2rem] bg-white dark:bg-slate-800 p-8 shadow-xl border border-gray-100 dark:border-gray-700">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-black tracking-tight">Actividad Reciente</h3>
            <button
              onClick={() => router.push('/requirements')}
              className="text-primary-600 font-bold text-sm hover:underline flex items-center gap-1"
            >
              Ver todos los requerimientos <ArrowRight size={16} />
            </button>
          </div>

          {/* Table-like header */}
          <div className="hidden md:grid md:grid-cols-12 gap-4 px-5 py-3 bg-gray-50 dark:bg-slate-900 rounded-xl mb-4 text-[10px] font-black uppercase tracking-widest text-gray-400">
            <div className="col-span-5">Proyecto / Descripción</div>
            <div className="col-span-2">Categoría</div>
            <div className="col-span-2 text-center">Estado</div>
            <div className="col-span-2 text-right">Monto</div>
            <div className="col-span-1"></div>
          </div>

          <div className="space-y-3">
            {loading ? (
              <div className="text-center py-12 text-gray-400 font-bold">Cargando actividad...</div>
            ) : recentRequirements.length === 0 ? (
              <div className="text-center py-12 text-gray-400 font-bold">No hay actividad reciente.</div>
            ) : (
              recentRequirements.map((item: any) => {
                const getIcon = () => {
                  if (item.type === 'budget') return <BarChart3 className="text-indigo-500 w-5 h-5" />;
                  if (item.type === 'invoice') return <FileText className="text-purple-500 w-5 h-5" />;
                  return <Briefcase className="text-primary-500 w-5 h-5" />;
                };
                const getTypeLabel = () => {
                  if (item.type === 'budget') return 'Presupuesto';
                  if (item.type === 'invoice') return 'Factura';
                  return 'Requerimiento';
                };
                const getRoute = () => {
                  if (item.type === 'budget') return `/budget/${item.id}`;
                  if (item.type === 'invoice') return `/invoices`;
                  return `/requirements/${item.id}`;
                };
                return (
                  <div
                    key={`${item.type}-${item.id}`}
                    onClick={() => router.push(getRoute())}
                    className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center p-4 rounded-2xl hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-all border border-transparent hover:border-gray-100 dark:hover:border-gray-600 group cursor-pointer"
                  >
                    <div className="col-span-5 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-primary-900/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                        {getIcon()}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm truncate">{item.title}</h4>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest truncate">
                          {getTypeLabel()} • {new Date(item.createdAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                          {item.createdBy && ` • ${item.createdBy}`}
                        </p>
                      </div>
                    </div>
                    <div className="col-span-2 hidden md:block">
                      <span className="text-xs font-bold text-gray-600 dark:text-gray-300">{item.category || '-'}</span>
                    </div>
                    <div className="col-span-2 text-center">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border ${item.status === 'APPROVED' || item.status === 'PAID' ? 'bg-green-50 text-green-700 border-green-100 dark:bg-green-900/20 dark:border-green-800' :
                        item.status === 'REJECTED' ? 'bg-red-50 text-red-700 border-red-100 dark:bg-red-900/20 dark:border-red-800' :
                          'bg-yellow-50 text-yellow-700 border-yellow-100 dark:bg-yellow-900/20 dark:border-yellow-800'
                        }`}>
                        {translateStatus(item.status || 'PENDIENTE')}
                      </span>
                    </div>
                    <div className="col-span-2 text-right">
                      {item.totalAmount > 0 ? (
                        <p className="text-sm font-black text-primary-900 dark:text-white">${parseFloat(item.totalAmount).toLocaleString()}</p>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>
                    <div className="col-span-1 text-right">
                      <ArrowRight size={16} className="text-gray-300 group-hover:text-primary-500 transition-colors inline" />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Sidebar - Takes 1 column */}
        <div className="space-y-5">
          {/* Quick Actions */}
          <div className="rounded-[2rem] bg-slate-900 p-8 text-white shadow-2xl overflow-hidden relative group">
            <div className="relative z-10">
              <h3 className="text-xl font-black mb-5 opacity-90 tracking-tight">Acciones Rápidas</h3>
              <div className="space-y-3">
                <button
                  onClick={() => router.push('/requirements/new')}
                  className="w-full py-4 bg-primary-600 hover:bg-primary-500 rounded-xl font-black flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-primary-500/20 text-sm"
                >
                  <Plus size={18} /> Nuevo Requerimiento
                </button>
                <button
                  onClick={() => router.push('/requirements')}
                  className="w-full py-4 bg-white/5 hover:bg-white/10 rounded-xl font-bold flex items-center justify-center gap-2 transition-all border border-white/10 text-sm"
                >
                  Mis Solicitudes <ArrowRight size={16} />
                </button>
                <button
                  onClick={() => router.push('/budget')}
                  className="w-full py-4 bg-white/5 hover:bg-white/10 rounded-xl font-bold flex items-center justify-center gap-2 transition-all border border-white/10 text-sm"
                >
                  <DollarSign size={16} /> Ver Presupuestos
                </button>
              </div>
            </div>

            {/* Abstract visuals */}
            <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-primary-500/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000"></div>
          </div>

          {/* Tip of the day */}
          <div className="rounded-[2rem] bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 p-6 border border-amber-200 dark:border-amber-800">
            <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-2">💡 Tip del día</p>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Recuerda adjuntar las cotizaciones para acelerar el proceso de aprobación.
            </p>
          </div>

          {/* Support contact */}
          <div className="rounded-[2rem] bg-white dark:bg-slate-800 p-6 shadow-lg border border-gray-100 dark:border-gray-700">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Contacto de Soporte</p>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Mail size={14} className="text-primary-500" />
                <a href="mailto:daironmoreno24@gmail.com" className="text-sm font-bold text-gray-700 dark:text-gray-200 hover:text-primary-600 transition-colors">
                  daironmoreno24@gmail.com
                </a>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                <a href="https://wa.me/573195342608" target="_blank" className="text-sm font-bold text-gray-700 dark:text-gray-200 hover:text-green-500 transition-colors">
                  +57 319 534 2608
                </a>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">Lun - Vie, 7:30 AM - 9:30 AM</p>
          </div>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  color: string;
  trend?: number[];
  trendColor?: string;
}

function StatCard({ title, value, sub, icon, color, trend = [], trendColor = "text-gray-400" }: StatCardProps) {
  // Calculate SVG path for mini sparkline
  const maxVal = Math.max(...trend, 1);
  const width = 80;
  const height = 30;
  const points = trend.map((v, i) => {
    const x = (i / (trend.length - 1)) * width;
    const y = height - (v / maxVal) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <motion.div
      whileHover={{ y: -3 }}
      className="rounded-[2rem] bg-white dark:bg-slate-800 p-6 shadow-lg border border-gray-100 dark:border-gray-700 transition-all group"
    >
      <div className="flex justify-between items-start mb-4">
        <div className={`w-11 h-11 rounded-xl ${color} flex items-center justify-center group-hover:rotate-12 transition-transform`}>
          {icon}
        </div>
        {trend.length > 1 && (
          <svg width={width} height={height} className={`${trendColor} opacity-50`}>
            <polyline
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={points}
            />
          </svg>
        )}
      </div>
      <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">{title}</p>
      <h4 className="text-3xl font-black mb-1 tracking-tighter">{value}</h4>
      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tight opacity-70">{sub}</p>
    </motion.div>
  );
}
