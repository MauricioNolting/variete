import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { User, Gift, Package, TrendingUp, ChevronDown, ChevronUp, Award } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import api from '../utils/api';
import { useAuthStore } from '../store/auth';
import { Order, CashbackTransaction } from '../types';
import { formatCurrency, formatDate, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, getCashbackTier } from '../utils/format';

export default function ProfilePage() {
  const { client } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'orders' | 'cashback'>('orders');
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);

  const { data: orders = [] } = useQuery<Order[]>({
    queryKey: ['my-orders'],
    queryFn: () => api.get('/orders/my').then((r) => r.data),
    enabled: !!client,
  });

  const { data: transactions = [] } = useQuery<CashbackTransaction[]>({
    queryKey: ['my-cashback'],
    queryFn: () => api.get('/cashback/my/transactions').then((r) => r.data),
    enabled: !!client,
  });

  const tier = getCashbackTier(client?.totalCashbackEarned || 0);

  const cashbackChartData = transactions
    .filter((t) => t.type === 'EARNED')
    .slice(0, 10)
    .reverse()
    .map((t) => ({
      fecha: formatDate(t.createdAt),
      beneficio: t.amount,
    }));

  if (!client) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Profile header */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 bg-gold-600/20 rounded-2xl flex items-center justify-center flex-shrink-0">
            <User size={28} className="text-gold-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-dark-50 truncate">{client.localName}</h1>
            <p className="text-dark-400 text-sm">{client.address}</p>
            <p className="text-dark-500 text-sm">{client.city?.name} · {client.phone}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <span className={`text-sm font-semibold ${tier.color}`}>{tier.label}</span>
            {tier.next && <p className="text-xs text-dark-500 mt-0.5">{tier.next}</p>}
          </div>
        </div>
      </motion.div>

      {/* Cashback balance */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="card p-5 border-emerald-600/30 bg-emerald-950/10"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-600/20 rounded-xl flex items-center justify-center">
              <Gift size={24} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-dark-500 uppercase tracking-wide">Saldo de beneficios disponible</p>
              <p className="text-3xl font-black text-emerald-400">{formatCurrency(client.cashbackBalance)}</p>
              <p className="text-xs text-dark-500 mt-0.5">Acumulado histórico: {formatCurrency(client.totalCashbackEarned)}</p>
            </div>
          </div>
          <Award size={40} className={`opacity-30 ${tier.color}`} />
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1 bg-dark-900 rounded-xl p-1 border border-dark-800">
        {[
          { id: 'orders', label: 'Mis pedidos', icon: Package },
          { id: 'cashback', label: 'Mis beneficios', icon: Gift },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as typeof activeTab)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === id ? 'bg-dark-800 text-dark-50' : 'text-dark-400 hover:text-dark-200'
            }`}
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {/* Orders tab */}
      {activeTab === 'orders' && (
        <div className="space-y-3">
          {orders.length === 0 ? (
            <div className="card p-8 text-center text-dark-500">
              <Package size={40} className="mx-auto mb-3 opacity-30" />
              <p>Aún no ha realizado ningún pedido.</p>
            </div>
          ) : orders.map((order) => (
            <motion.div key={order.id} layout className="card overflow-hidden">
              <button
                onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-dark-800/50 transition-colors"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div>
                    <p className="font-semibold text-dark-100">Pedido #{order.id}</p>
                    <p className="text-xs text-dark-500">{formatDate(order.createdAt)}</p>
                  </div>
                  <span className={ORDER_STATUS_COLORS[order.status]}>
                    {ORDER_STATUS_LABELS[order.status]}
                  </span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="font-bold text-dark-100">{formatCurrency(order.totalAmount)}</span>
                  {expandedOrder === order.id ? <ChevronUp size={16} className="text-dark-400" /> : <ChevronDown size={16} className="text-dark-400" />}
                </div>
              </button>

              {expandedOrder === order.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t border-dark-800 px-4 pb-4 pt-3 space-y-3"
                >
                  <div className="space-y-2">
                    {order.items?.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span className="text-dark-300">{item.product?.name} <span className="text-dark-500">x{item.quantity}</span></span>
                        <span className="text-dark-200">{formatCurrency(item.subtotal)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-dark-800 pt-2 space-y-1 text-sm">
                    {order.cashbackUsed > 0 && (
                      <div className="flex justify-between text-emerald-400">
                        <span>Saldo de beneficios utilizado:</span>
                        <span>-{formatCurrency(order.cashbackUsed)}</span>
                      </div>
                    )}
                    {order.cashbackEarned > 0 && (
                      <div className="flex justify-between text-emerald-400">
                        <span>Beneficio acumulado:</span>
                        <span>+{formatCurrency(order.cashbackEarned)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs text-dark-500 pt-1">
                      <span>Entrega: {formatDate(order.deliveryDate)} — {order.preferredTimeRange}</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Cashback tab */}
      {activeTab === 'cashback' && (
        <div className="space-y-5">
          {cashbackChartData.length > 1 && (
            <div className="card p-5">
              <h3 className="font-semibold text-dark-100 flex items-center gap-2 mb-4">
                <TrendingUp size={18} className="text-gold-500" /> Evolución de beneficios
              </h3>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={cashbackChartData}>
                  <defs>
                    <linearGradient id="cashGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2d2d2d" />
                  <XAxis dataKey="fecha" tick={{ fill: '#666', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#666', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: '#1a1a1a', border: '1px solid #2d2d2d', borderRadius: 8 }}
                    formatter={(v: number) => [formatCurrency(v), 'Beneficio']}
                  />
                  <Area type="monotone" dataKey="beneficio" stroke="#10b981" fill="url(#cashGradient)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="space-y-2">
            {transactions.length === 0 ? (
              <div className="card p-8 text-center text-dark-500">
                <Gift size={40} className="mx-auto mb-3 opacity-30" />
                <p>Aún no hay transacciones de beneficios registradas.</p>
              </div>
            ) : transactions.map((t) => (
              <div key={t.id} className="card p-4 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-dark-100">
                    {t.type === 'EARNED' ? 'Beneficio acumulado' : 'Saldo utilizado'}
                    {t.orderId && <span className="text-dark-500"> — Pedido #{t.orderId}</span>}
                  </p>
                  <p className="text-xs text-dark-500">{formatDate(t.createdAt)} · {t.ruleDescription}</p>
                </div>
                <span className={`font-bold flex-shrink-0 ml-4 ${t.type === 'EARNED' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {t.type === 'EARNED' ? '+' : '-'}{formatCurrency(t.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
