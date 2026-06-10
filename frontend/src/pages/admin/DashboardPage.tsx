import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ShoppingBag, TrendingUp, AlertTriangle, Gift, Clock, CheckCircle, Users } from 'lucide-react';
import api from '../../utils/api';
import { formatCurrency } from '../../utils/format';
import { Link } from 'react-router-dom';
import QRCodeDisplay from '../../components/QRCodeDisplay';

interface OnlineClient {
  id: number;
  localName: string;
  lastSeenAt: string;
  city?: { name: string };
}

export default function DashboardPage() {
  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/orders/admin/stats').then((r) => r.data),
    refetchInterval: 30000,
  });

  const { data: online } = useQuery<{ count: number; windowMinutes: number; clients: OnlineClient[] }>({
    queryKey: ['online-clients'],
    queryFn: () => api.get('/clients/online').then((r) => r.data),
    refetchInterval: 20000, // refresh presence every 20s
  });

  const statCards = [
    { label: 'Pedidos pendientes', value: stats?.pendingOrders || 0, icon: Clock, color: 'text-gold-400', bg: 'bg-gold-600/20', link: '/admin/pedidos?status=PENDING' },
    { label: 'Pedidos del día', value: stats?.todayOrders || 0, icon: ShoppingBag, color: 'text-blue-400', bg: 'bg-blue-600/20', link: '/admin/pedidos' },
    { label: 'Facturación semanal', value: formatCurrency(stats?.weekRevenue || 0), icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-600/20', link: '/admin/facturacion' },
    { label: 'Saldo emitido total', value: formatCurrency(stats?.cashbackEmitted || 0), icon: Gift, color: 'text-purple-400', bg: 'bg-purple-600/20', link: '/admin/cashback' },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="section-title">Dashboard</h1>
        <p className="text-dark-400 text-sm mt-1">Resumen de operaciones</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <Link to={card.link} className="stat-card hover:border-dark-700 transition-colors block">
              <div className={`w-10 h-10 ${card.bg} rounded-xl flex items-center justify-center`}>
                <card.icon size={20} className={card.color} />
              </div>
              <p className="text-2xl font-bold text-dark-50">{card.value}</p>
              <p className="text-xs text-dark-500 uppercase tracking-wide">{card.label}</p>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Cashback summary */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <p className="text-sm text-dark-400">Saldo utilizado</p>
            <CheckCircle size={16} className="text-emerald-400" />
          </div>
          <p className="text-xl font-bold text-dark-50">{formatCurrency(stats?.cashbackUsed || 0)}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <p className="text-sm text-dark-400">Saldo pendiente</p>
            <Gift size={16} className="text-gold-400" />
          </div>
          <p className="text-xl font-bold text-dark-50">
            {formatCurrency((stats?.cashbackEmitted || 0) - (stats?.cashbackUsed || 0))}
          </p>
        </div>
      </div>

      {/* Online users */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-dark-100 flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              {(online?.count ?? 0) > 0 && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${(online?.count ?? 0) > 0 ? 'bg-emerald-500' : 'bg-dark-600'}`} />
            </span>
            <Users size={18} className="text-emerald-400" /> Usuarios conectados
          </h3>
          <span className="text-2xl font-black text-emerald-400">{online?.count ?? 0}</span>
        </div>
        {(online?.clients?.length ?? 0) === 0 ? (
          <p className="text-sm text-dark-500">No hay clientes activos en este momento.</p>
        ) : (
          <div className="space-y-2">
            {online!.clients.map((c) => {
              const secsAgo = Math.max(0, Math.round((Date.now() - new Date(c.lastSeenAt).getTime()) / 1000));
              const activity = secsAgo < 60 ? 'activo ahora' : `hace ${Math.round(secsAgo / 60)} min`;
              return (
                <div key={c.id} className="flex items-center justify-between py-2 border-b border-dark-800 last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="relative flex h-2 w-2 flex-shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    <span className="text-dark-200 text-sm truncate">{c.localName}</span>
                    {c.city?.name && <span className="text-dark-500 text-xs flex-shrink-0">· {c.city.name}</span>}
                  </div>
                  <span className="text-xs text-emerald-500/80 flex-shrink-0">{activity}</span>
                </div>
              );
            })}
          </div>
        )}
        <p className="text-xs text-dark-600 mt-3">
          Se consideran conectados los clientes con actividad en los últimos {online?.windowMinutes ?? 5} minutos.
        </p>
      </div>

      {/* QR Code */}
      <div className="flex justify-end">
        <QRCodeDisplay />
      </div>

      {/* Low stock */}
      {stats?.lowStockProducts?.length > 0 && (
        <div className="card p-5">
          <h3 className="font-semibold text-dark-100 flex items-center gap-2 mb-4">
            <AlertTriangle size={18} className="text-gold-500" />
            Productos con stock bajo
          </h3>
          <div className="space-y-2">
            {stats.lowStockProducts.map((p: { id: number; name: string; stock: number }) => (
              <div key={p.id} className="flex items-center justify-between py-2 border-b border-dark-800 last:border-0">
                <span className="text-dark-200 text-sm">{p.name}</span>
                <div className="flex items-center gap-3">
                  <span className="badge-red">{p.stock} unidades</span>
                  <Link to={`/admin/productos`} className="text-xs text-gold-500 hover:text-gold-400">Editar</Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
