import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { User, Gift, Package, TrendingUp, ChevronDown, ChevronUp, AlertCircle, CheckCircle, Clock, Star, Lock, CalendarClock } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import api from '../utils/api';
import { useAuthStore } from '../store/auth';
import { Order, CashbackTransaction } from '../types';
import { formatCurrency, formatDate, formatDateLong, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '../utils/format';

interface TierData {
  tier: 'BRONZE' | 'SILVER' | 'GOLD';
  label: string;
  emoji: string;
  color: string;
  inGracePeriod: boolean;
  gracePeriodEnd?: string;
  graceRetained: boolean;
  graceSpending?: number;
  graceThreshold?: number;
  tierValidUntil?: string;
  message?: string;
}

interface TierBenefit {
  id: number;
  tier: 'BRONZE' | 'SILVER' | 'GOLD';
  title: string;
  percentage?: number;
  description?: string;
}

const TIER_META: Record<string, { emoji: string; color: string; label: string }> = {
  GOLD:   { emoji: '🥇', color: 'text-yellow-400', label: 'Oro' },
  SILVER: { emoji: '🥈', color: 'text-gray-300',   label: 'Plata' },
  BRONZE: { emoji: '🥉', color: 'text-amber-600',  label: 'Bronce' },
};

export default function ProfilePage() {
  const { client } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'orders' | 'cashback'>('orders');
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);

  const { data: tierData } = useQuery<TierData>({
    queryKey: ['my-tier'],
    queryFn: () => api.get('/clients/me/tier').then((r) => r.data),
    enabled: !!client,
  });

  const { data: cashbackData } = useQuery({
    queryKey: ['my-cashback-balance'],
    queryFn: () => api.get('/cashback/my/transactions').then((r) => r.data),
    enabled: !!client,
  });

  const { data: orders = [] } = useQuery<Order[]>({
    queryKey: ['my-orders'],
    queryFn: () => api.get('/orders/my').then((r) => r.data),
    enabled: !!client,
  });

  const { data: tierBenefits = [] } = useQuery<TierBenefit[]>({
    queryKey: ['tier-benefits', tierData?.tier],
    queryFn: () => api.get(`/cashback/tier-benefits?tier=${tierData?.tier}`).then((r) => r.data),
    enabled: !!tierData?.tier,
  });

  const transactions: CashbackTransaction[] = cashbackData?.transactions || [];
  const effectiveBalance = cashbackData?.effectiveBalance ?? client?.cashbackBalance ?? 0;
  const nextExpiry = cashbackData?.nextExpiry;
  const pendingExpirations: { expiresAt: string; amount: number; ordersCount: number }[] =
    cashbackData?.pendingExpirations || [];

  // Build cumulative step chart — only EARNED, ascending, with starting zero point
  const earnedSorted = [...transactions]
    .filter((t) => t.type === 'EARNED')
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const cashbackChartData: { fecha: string; beneficio: number }[] = [];
  if (earnedSorted.length > 0) {
    let cumulative = 0;
    const firstDate = new Date(earnedSorted[0].createdAt);
    firstDate.setDate(firstDate.getDate() - 1);
    cashbackChartData.push({ fecha: formatDate(firstDate.toISOString()), beneficio: 0 });
    for (const t of earnedSorted) {
      cumulative += t.amount;
      cashbackChartData.push({ fecha: formatDate(t.createdAt), beneficio: cumulative });
    }
  }

  if (!client) return null;

  const tierColor = tierData?.color || 'text-dark-400';

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Profile header */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 bg-gold-600/20 rounded-2xl flex items-center justify-center flex-shrink-0">
            <User size={28} className="text-gold-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-dark-50 truncate">{client.localName}</h1>
              {tierData && <span className="text-xl">{tierData.emoji}</span>}
              {tierData && <span className={`text-sm font-semibold ${tierColor}`}>{tierData.label}</span>}
            </div>
            <p className="text-dark-400 text-sm">{client.address}</p>
            <p className="text-dark-500 text-sm">{client.city?.name} · {client.phone}</p>
          </div>
        </div>
      </motion.div>

      {/* Grace period alerts */}
      {tierData?.inGracePeriod && !tierData.graceRetained && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="card p-4 border-yellow-500/30 bg-yellow-950/20">
          <div className="flex items-start gap-3">
            <Clock size={20} className="text-yellow-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-yellow-300">Período de gracia Oro activo</p>
              <p className="text-xs text-yellow-500/80 mt-1">{tierData.message}</p>
              {tierData.graceThreshold !== undefined && tierData.graceSpending !== undefined && (
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-dark-400 mb-1">
                    <span>Progreso</span>
                    <span>{formatCurrency(tierData.graceSpending)} / {formatCurrency(tierData.graceThreshold)}</span>
                  </div>
                  <div className="h-1.5 bg-dark-700 rounded-full overflow-hidden">
                    <div className="h-full bg-yellow-400 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (tierData.graceSpending / tierData.graceThreshold) * 100)}%` }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
      {tierData?.inGracePeriod && tierData.graceRetained && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="card p-4 border-emerald-500/30 bg-emerald-950/20">
          <div className="flex items-center gap-3">
            <CheckCircle size={20} className="text-emerald-400 flex-shrink-0" />
            <p className="text-sm text-emerald-300">{tierData.message}</p>
          </div>
        </motion.div>
      )}

      {/* Cashback balance */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="card p-5 border-emerald-600/30 bg-emerald-950/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-600/20 rounded-xl flex items-center justify-center">
              <Gift size={24} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-dark-500 uppercase tracking-wide">Saldo de beneficios disponible</p>
              <p className="text-3xl font-black text-emerald-400">{formatCurrency(effectiveBalance)}</p>
              <p className="text-xs text-dark-500 mt-0.5">Acumulado histórico: {formatCurrency(client.totalCashbackEarned)}</p>
              {nextExpiry && (
                <p className="text-xs text-amber-500 mt-0.5">
                  <AlertCircle size={10} className="inline mr-1" />
                  Próximo vencimiento: {formatDateLong(nextExpiry)}
                </p>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Tier benefits — always shown once tier is known */}
      {tierData?.tier && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="card p-5 space-y-3">
          <h3 className="font-semibold text-dark-100 flex items-center gap-2">
            <Star size={16} className="text-gold-500" /> Beneficios por categoría
          </h3>
          {tierBenefits.length === 0 ? (
            <p className="text-sm text-dark-500 italic py-2">
              No hay beneficios de categoría configurados aún.
            </p>
          ) : (
            <div className="space-y-2">
              {tierBenefits.map((b) => {
                const meta = TIER_META[b.tier];
                const isOwn = b.tier === tierData?.tier;
                const isHigher = (b.tier === 'GOLD' && tierData?.tier !== 'GOLD') ||
                                 (b.tier === 'SILVER' && tierData?.tier === 'BRONZE');
                return (
                  <div key={b.id}
                    className={`flex items-start gap-3 p-3 rounded-xl ${isOwn ? 'bg-dark-800' : 'bg-dark-900/50'}`}>
                    <span className="text-base flex-shrink-0 mt-0.5">{meta.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${isHigher ? 'text-dark-400' : 'text-dark-100'}`}>
                        {isHigher && <Lock size={12} className="inline mr-1 mb-0.5" />}
                        Por ser <span className={meta.color}>{meta.label}</span>:{' '}
                        {b.title}
                        {b.percentage ? (
                          <span className={`ml-1 font-bold ${meta.color}`}>{b.percentage}%</span>
                        ) : null}
                      </p>
                      {b.description && (
                        <p className="text-xs text-dark-500 mt-0.5">{b.description}</p>
                      )}
                      {isHigher && (
                        <p className="text-xs text-dark-600 mt-0.5 italic">
                          Suba a {meta.label} para desbloquear este beneficio
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      )}

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

          {/* ── Saldos a vencer ─────────────────────────────────────── */}
          {pendingExpirations.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="card p-5 space-y-3"
            >
              <div className="flex items-center gap-2">
                <CalendarClock size={18} className="text-amber-400" />
                <h3 className="font-semibold text-dark-100">Saldos a vencer</h3>
              </div>
              <p className="text-xs text-dark-500">
                Tu saldo disponible total es {' '}
                <span className="text-emerald-400 font-semibold">{formatCurrency(effectiveBalance)}</span>.
                A continuación el detalle de cada lote y cuándo vence:
              </p>
              <div className="space-y-2">
                {pendingExpirations.map((exp, i) => {
                  const expDate = new Date(exp.expiresAt);
                  const now = new Date();
                  const daysLeft = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                  const isUrgent = daysLeft <= 7;
                  const isSoon   = daysLeft <= 30;
                  return (
                    <div
                      key={i}
                      className={`flex items-center justify-between rounded-xl px-4 py-3 ${
                        isUrgent ? 'bg-red-950/30 border border-red-700/30'
                        : isSoon  ? 'bg-amber-950/30 border border-amber-700/30'
                        :            'bg-dark-800/60 border border-dark-700/30'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <CalendarClock
                          size={16}
                          className={isUrgent ? 'text-red-400' : isSoon ? 'text-amber-400' : 'text-dark-400'}
                        />
                        <div>
                          <p className={`text-sm font-medium ${
                            isUrgent ? 'text-red-300' : isSoon ? 'text-amber-300' : 'text-dark-200'
                          }`}>
                            Vence el {expDate.toLocaleDateString('es-AR', {
                              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                            })}
                          </p>
                          <p className={`text-xs ${
                            isUrgent ? 'text-red-500' : isSoon ? 'text-amber-500' : 'text-dark-500'
                          }`}>
                            {daysLeft === 1
                              ? '¡Vence mañana!'
                              : daysLeft <= 0
                              ? '¡Vence hoy!'
                              : `En ${daysLeft} días`}
                          </p>
                        </div>
                      </div>
                      <span className={`font-black text-lg ${
                        isUrgent ? 'text-red-400' : isSoon ? 'text-amber-400' : 'text-emerald-400'
                      }`}>
                        {formatCurrency(exp.amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Accumulated cashback chart — always show if client has at least 1 earned transaction */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-dark-100 flex items-center gap-2">
                <TrendingUp size={18} className="text-gold-500" /> Beneficios acumulados en el tiempo
              </h3>
              <span className="text-sm text-emerald-400 font-bold">
                Total histórico: {formatCurrency(client.totalCashbackEarned)}
              </span>
            </div>
            {cashbackChartData.length >= 2 ? (
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
                  <YAxis tick={{ fill: '#666', fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    contentStyle={{ background: '#1a1a1a', border: '1px solid #2d2d2d', borderRadius: 8 }}
                    formatter={(v: number) => [formatCurrency(v), 'Beneficio acumulado']}
                  />
                  <Area
                    type="stepAfter"
                    dataKey="beneficio"
                    stroke="#10b981"
                    fill="url(#cashGradient)"
                    strokeWidth={2}
                    dot={{ fill: '#10b981', r: 3 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-dark-500 gap-2">
                <TrendingUp size={32} className="opacity-20" />
                <p className="text-sm">Aún no hay beneficios acumulados en el historial.</p>
                <p className="text-xs">El gráfico aparecerá con su primer pedido con beneficio.</p>
              </div>
            )}
          </div>

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
