import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { TrendingUp, Clock, CheckCircle, Filter, Download } from 'lucide-react';
import api from '../../utils/api';
import { formatCurrency, formatDate } from '../../utils/format';

type BillingType = 'all' | 'paid' | 'pending';
type Period = 'week' | 'month' | 'year';

export default function BillingAdminPage() {
  const [type, setType] = useState<BillingType>('all');
  const [period, setPeriod] = useState<Period>('month');

  const { data, isLoading } = useQuery({
    queryKey: ['billing', type, period],
    queryFn: () =>
      api.get('/orders/admin/billing', { params: { type, period } }).then((r) => r.data),
  });

  const orders = data?.orders || [];
  const total = data?.total || 0;
  const count = data?.count || 0;

  const periodLabel: Record<Period, string> = {
    week: 'Esta semana',
    month: 'Este mes',
    year: 'Este año',
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="section-title flex items-center gap-2">
          <TrendingUp size={22} className="text-gold-500" /> Facturación
        </h1>
        <p className="text-dark-400 text-sm">Historial de pedidos cobrados y pendientes</p>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <Filter size={16} className="text-dark-400" />

        {/* Type */}
        <div className="flex gap-1 bg-dark-800 rounded-xl p-1">
          {([['all', 'Todos'], ['paid', 'Cobrados'], ['pending', 'Pendientes']] as [BillingType, string][]).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setType(val)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                type === val ? 'bg-gold-600 text-dark-950' : 'text-dark-400 hover:text-dark-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Period */}
        <div className="flex gap-1 bg-dark-800 rounded-xl p-1">
          {(['week', 'month', 'year'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                period === p ? 'bg-dark-600 text-dark-100' : 'text-dark-400 hover:text-dark-200'
              }`}
            >
              {periodLabel[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="stat-card border-gold-600/20">
          <div className="flex items-center gap-2 text-gold-400">
            <TrendingUp size={18} />
            <span className="text-xs uppercase tracking-wide">Total facturado</span>
          </div>
          <p className="text-2xl font-black text-dark-50">{formatCurrency(total)}</p>
          <p className="text-xs text-dark-500">{count} pedidos — {periodLabel[period]}</p>
        </div>

        <div className="stat-card border-emerald-600/20">
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle size={18} />
            <span className="text-xs uppercase tracking-wide">Cobrados</span>
          </div>
          <p className="text-2xl font-black text-dark-50">
            {formatCurrency(orders.filter((o: any) => o.status === 'DELIVERED').reduce((s: number, o: any) => s + o.totalAmount, 0))}
          </p>
          <p className="text-xs text-dark-500">{orders.filter((o: any) => o.status === 'DELIVERED').length} entregados</p>
        </div>

        <div className="stat-card border-amber-600/20">
          <div className="flex items-center gap-2 text-amber-400">
            <Clock size={18} />
            <span className="text-xs uppercase tracking-wide">Pendientes</span>
          </div>
          <p className="text-2xl font-black text-dark-50">
            {formatCurrency(orders.filter((o: any) => ['PENDING','PREPARING'].includes(o.status)).reduce((s: number, o: any) => s + o.totalAmount, 0))}
          </p>
          <p className="text-xs text-dark-500">{orders.filter((o: any) => ['PENDING','PREPARING'].includes(o.status)).length} sin cobrar</p>
        </div>
      </div>

      {/* Orders table */}
      {isLoading ? (
        <div className="space-y-2">{Array.from({length:5}).map((_,i)=><div key={i} className="card h-14 animate-pulse"/>)}</div>
      ) : orders.length === 0 ? (
        <div className="card p-8 text-center text-dark-500">No hay pedidos en el período seleccionado.</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-800 text-dark-500 text-xs uppercase tracking-wide">
                <th className="text-left p-4">#</th>
                <th className="text-left p-4">Establecimiento</th>
                <th className="text-left p-4 hidden md:table-cell">Ciudad</th>
                <th className="text-left p-4 hidden sm:table-cell">Fecha</th>
                <th className="text-center p-4">Estado</th>
                <th className="text-right p-4">Monto</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order: any) => (
                <motion.tr
                  key={order.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="border-b border-dark-800/50 hover:bg-dark-800/30 transition-colors"
                >
                  <td className="p-4 text-dark-500">#{order.id}</td>
                  <td className="p-4 font-medium text-dark-100 max-w-[160px] truncate">{order.client?.localName}</td>
                  <td className="p-4 text-dark-400 hidden md:table-cell">{order.client?.city?.name || '—'}</td>
                  <td className="p-4 text-dark-400 hidden sm:table-cell">{formatDate(order.createdAt)}</td>
                  <td className="p-4 text-center">
                    <span className={`badge text-xs ${
                      order.status === 'DELIVERED' ? 'badge-green' :
                      order.status === 'CANCELLED' ? 'badge-red' :
                      order.status === 'PREPARING' ? 'badge-blue' : 'badge-gold'
                    }`}>
                      {order.status === 'DELIVERED' ? 'Cobrado' :
                       order.status === 'CANCELLED' ? 'Cancelado' :
                       order.status === 'PREPARING' ? 'En preparación' : 'Pendiente'}
                    </span>
                  </td>
                  <td className="p-4 text-right font-bold text-dark-100">{formatCurrency(order.totalAmount)}</td>
                </motion.tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-dark-700 bg-dark-800/30">
                <td colSpan={4} className="p-4 text-sm font-semibold text-dark-300">Total</td>
                <td className="p-4 text-right font-black text-xl text-gold-400" colSpan={2}>{formatCurrency(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
