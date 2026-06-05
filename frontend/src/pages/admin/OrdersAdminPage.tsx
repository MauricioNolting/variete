import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, Filter, RefreshCw } from 'lucide-react';
import api from '../../utils/api';
import { Order, City, OrderStatus } from '../../types';
import { formatCurrency, formatDate, formatDateLong, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '../../utils/format';
import toast from 'react-hot-toast';

const STATUSES: OrderStatus[] = ['PENDING', 'PREPARING', 'DELIVERED', 'CANCELLED'];

export default function OrdersAdminPage() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState({ status: '', city: '', date: '' });
  const [expanded, setExpanded] = useState<number | null>(null);

  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['admin-orders', filters],
    queryFn: () => api.get('/orders', { params: { ...filters, limit: 100 } }).then((r) => r.data),
    refetchInterval: 20000,
  });

  const { data: cities = [] } = useQuery<City[]>({
    queryKey: ['cities-admin'],
    queryFn: () => api.get('/cities/admin/all').then((r) => r.data),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.patch(`/orders/${id}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success('Estado del pedido actualizado.');
    },
    onError: () => toast.error('Error al actualizar el estado del pedido.'),
  });

  const orders: Order[] = ordersData?.orders || [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="section-title">Gestión de pedidos</h1>
          <p className="text-dark-400 text-sm">{ordersData?.total || 0} pedidos registrados</p>
        </div>
        <button onClick={() => qc.invalidateQueries({ queryKey: ['admin-orders'] })}
          className="btn-ghost">
          <RefreshCw size={16} /> Actualizar
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-end">
        <div className="flex items-center gap-2 text-dark-400">
          <Filter size={16} />
          <span className="text-sm">Filtros:</span>
        </div>
        <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} className="w-40">
          <option value="">Todos los estados</option>
          {STATUSES.map((s) => <option key={s} value={s}>{ORDER_STATUS_LABELS[s]}</option>)}
        </select>
        <select value={filters.city} onChange={(e) => setFilters((f) => ({ ...f, city: e.target.value }))} className="w-44">
          <option value="">Todas las ciudades</option>
          {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input type="date" value={filters.date} onChange={(e) => setFilters((f) => ({ ...f, date: e.target.value }))} className="w-40" />
        {(filters.status || filters.city || filters.date) && (
          <button onClick={() => setFilters({ status: '', city: '', date: '' })} className="btn-ghost text-sm">
            Limpiar
          </button>
        )}
      </div>

      {/* Orders list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="card h-16 animate-pulse" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="card p-8 text-center text-dark-500">No se encontraron pedidos con los filtros seleccionados.</div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <motion.div key={order.id} layout className="card overflow-hidden">
              <button
                onClick={() => setExpanded(expanded === order.id ? null : order.id)}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-dark-800/40 transition-colors"
              >
                <div className="flex items-center gap-4 min-w-0 flex-wrap">
                  <span className="font-bold text-dark-100">#{order.id}</span>
                  <span className="text-sm text-dark-300 truncate">{order.client?.localName}</span>
                  <span className="text-xs text-dark-500">{order.client?.city?.name}</span>
                  <span className={ORDER_STATUS_COLORS[order.status]}>{ORDER_STATUS_LABELS[order.status]}</span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="font-bold text-dark-100">{formatCurrency(order.totalAmount)}</span>
                  <span className="text-xs text-dark-500">{formatDate(order.createdAt)}</span>
                  {expanded === order.id ? <ChevronUp size={16} className="text-dark-400" /> : <ChevronDown size={16} className="text-dark-400" />}
                </div>
              </button>

              {expanded === order.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  className="border-t border-dark-800 p-4 space-y-4"
                >
                  <div className="grid sm:grid-cols-2 gap-4 text-sm">
                    <div className="space-y-1">
                      <p><span className="text-dark-500">Establecimiento:</span> <span className="text-dark-200">{order.client?.localName}</span></p>
                      <p><span className="text-dark-500">Ciudad:</span> <span className="text-dark-200">{order.client?.city?.name}</span></p>
                      <p><span className="text-dark-500">Teléfono:</span> <span className="text-dark-200">{order.client?.phone}</span></p>
                      <p><span className="text-dark-500">Email:</span> <span className="text-dark-200">{order.client?.email || '—'}</span></p>
                    </div>
                    <div className="space-y-1">
                      <p><span className="text-dark-500">Entrega:</span> <span className="text-dark-200 capitalize">{formatDateLong(order.deliveryDate)}</span></p>
                      <p><span className="text-dark-500">Horario:</span> <span className="text-dark-200">{order.preferredTimeRange}</span></p>
                      <p><span className="text-dark-500">Registrado:</span> <span className="text-dark-200">{formatDate(order.createdAt)}</span></p>
                      {order.notes && <p><span className="text-dark-500">Notas:</span> <span className="text-dark-200">{order.notes}</span></p>}
                    </div>
                  </div>

                  {/* Items */}
                  <div className="space-y-1">
                    {order.items?.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span className="text-dark-300">{item.product?.name} x{item.quantity}</span>
                        <span className="text-dark-200">{formatCurrency(item.subtotal)}</span>
                      </div>
                    ))}
                    <div className="border-t border-dark-800 pt-2 flex justify-between font-semibold">
                      <span>Total:</span>
                      <span className="text-gold-400">{formatCurrency(order.totalAmount)}</span>
                    </div>
                    {order.cashbackUsed > 0 && (
                      <p className="text-emerald-400 text-xs">Saldo de beneficios utilizado: -{formatCurrency(order.cashbackUsed)}</p>
                    )}
                    {order.cashbackEarned > 0 && (
                      <p className="text-emerald-400 text-xs">Beneficio generado: +{formatCurrency(order.cashbackEarned)}</p>
                    )}
                  </div>

                  {/* Status update */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-dark-800">
                    <span className="text-sm text-dark-400">Cambiar estado:</span>
                    {STATUSES.map((s) => (
                      <button
                        key={s}
                        disabled={order.status === s || statusMutation.isPending}
                        onClick={() => statusMutation.mutate({ id: order.id, status: s })}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50 ${
                          order.status === s ? 'bg-gold-600 text-dark-950' : 'bg-dark-800 text-dark-300 hover:text-dark-100'
                        }`}
                      >
                        {ORDER_STATUS_LABELS[s]}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
