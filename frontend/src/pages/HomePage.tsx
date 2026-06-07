import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Calendar, Gift, Lock, Star, Zap } from 'lucide-react';
import api from '../utils/api';
import { useAuthStore } from '../store/auth';
import { CashbackRule, City } from '../types';
import { formatCurrency, formatDateLong, daysUntil, CASHBACK_TYPE_LABELS } from '../utils/format';

interface TierData {
  tier: 'BRONZE' | 'SILVER' | 'GOLD';
  label: string;
  emoji: string;
  color: string;
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

export default function HomePage() {
  const { client } = useAuthStore();

  const { data: rules = [] } = useQuery<CashbackRule[]>({
    queryKey: ['cashback-rules-active'],
    queryFn: () => api.get('/cashback/rules/active').then((r) => r.data),
  });

  const { data: cities = [] } = useQuery<City[]>({
    queryKey: ['cities-public'],
    queryFn: () => api.get('/cities').then((r) => r.data),
    enabled: !!client,
  });

  const { data: tierData } = useQuery<TierData>({
    queryKey: ['my-tier'],
    queryFn: () => api.get('/clients/me/tier').then((r) => r.data),
    enabled: !!client,
  });

  const { data: tierBenefits = [] } = useQuery<TierBenefit[]>({
    queryKey: ['tier-benefits', tierData?.tier],
    queryFn: () => api.get(`/cashback/tier-benefits?tier=${tierData?.tier}`).then((r) => r.data),
    enabled: !!tierData?.tier,
  });

  const clientCity = cities.find((c) => c.id === client?.cityId);
  const nextDate = clientCity?.visitDates?.[0];
  const daysLeft = nextDate ? daysUntil(nextDate.date) : null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-10">
      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-dark-900 via-dark-900 to-amber-950/30 border border-dark-800 p-8 md:p-12"
      >
        <div className="relative z-10 max-w-xl">
          <p className="text-gold-500 text-sm font-semibold tracking-widest uppercase mb-3">Bienvenido a Varieté</p>
          <h1 className="text-4xl md:text-5xl font-extrabold text-dark-50 leading-tight mb-4">
            {client ? (
              <>
                Bienvenido,<br />
                <span className="text-gold-400">{client.localName}</span>
              </>
            ) : (
              <>
                Distribución B2B<br />
                <span className="text-gold-400">de calidad superior</span>
              </>
            )}
          </h1>
          <p className="text-dark-400 mb-6 leading-relaxed">
            {client
              ? 'Explore el catálogo completo y realice sus pedidos con entregas programadas y beneficios exclusivos.'
              : 'Registre su establecimiento para acceder al catálogo completo, realizar pedidos y acumular beneficios.'}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/catalogo" className="btn-primary">
              Ver catálogo <ArrowRight size={18} />
            </Link>
            {!client && (
              <Link to="/registro" className="btn-secondary">
                Registrarse
              </Link>
            )}
          </div>
        </div>
        <div className="absolute right-0 bottom-0 opacity-10 text-[200px] font-black tracking-tighter text-gold-500 leading-none select-none pointer-events-none">
          V
        </div>
      </motion.section>

      {/* Next delivery widget */}
      {client && (
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {nextDate ? (
            <div className="card p-5 flex items-center gap-4 border-gold-600/30 bg-gradient-to-r from-dark-900 to-amber-950/10">
              <div className="w-12 h-12 bg-gold-600/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Calendar size={24} className="text-gold-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-dark-500 uppercase tracking-wide">Próxima fecha de entrega programada</p>
                <p className="font-semibold text-dark-100 capitalize">{formatDateLong(nextDate.date)}</p>
                <p className="text-sm text-gold-400">{daysLeft === 0 ? 'Es hoy' : daysLeft === 1 ? 'Mañana' : `En ${daysLeft} días`}</p>
              </div>
              <Link to="/checkout" className="btn-primary text-sm hidden md:flex">
                Hacer pedido
              </Link>
            </div>
          ) : (
            <div className="card p-5 flex items-center gap-4">
              <Calendar size={24} className="text-dark-500" />
              <p className="text-dark-400 text-sm">
                No hay fechas de entrega programadas para su ciudad. Contáctenos para más información.
              </p>
            </div>
          )}
        </motion.section>
      )}

      {/* Cashback balance widget */}
      {client && client.cashbackBalance > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="card p-5 border-emerald-600/30 bg-gradient-to-r from-dark-900 to-emerald-950/10"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-600/20 rounded-xl flex items-center justify-center">
                <Gift size={24} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-dark-500 uppercase tracking-wide">Saldo de beneficios disponible</p>
                <p className="text-2xl font-bold text-emerald-400">{formatCurrency(client.cashbackBalance)}</p>
              </div>
            </div>
            <Link to="/perfil" className="btn-secondary text-sm hidden md:flex">
              Ver historial
            </Link>
          </div>
        </motion.section>
      )}

      {/* Tier benefits for authenticated clients */}
      {client && tierData && tierBenefits.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title flex items-center gap-2">
              <Star size={22} className="text-gold-500" />
              Beneficios de tu categoría
              <span className="text-lg ml-1">{tierData.emoji}</span>
              <span className={`text-base font-semibold ${tierData.color}`}>{tierData.label}</span>
            </h2>
            <Link to="/perfil" className="text-xs text-dark-500 hover:text-gold-400 transition-colors">
              Ver todo →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {tierBenefits.map((b) => {
              const meta = TIER_META[b.tier];
              const isOwn = b.tier === tierData.tier;
              const isHigher =
                (b.tier === 'GOLD'   && tierData.tier !== 'GOLD') ||
                (b.tier === 'SILVER' && tierData.tier === 'BRONZE');
              return (
                <motion.div
                  key={b.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`card p-4 flex items-start gap-3 ${
                    isOwn
                      ? 'border-gold-600/30 bg-gradient-to-br from-dark-900 to-amber-950/10'
                      : 'opacity-60'
                  }`}
                >
                  <span className="text-xl flex-shrink-0 mt-0.5">{meta.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${isHigher ? 'text-dark-400' : 'text-dark-100'}`}>
                      {isHigher && <Lock size={11} className="inline mr-1 mb-0.5 text-dark-500" />}
                      {b.title}
                      {b.percentage ? (
                        <span className={`ml-1.5 font-black text-base ${meta.color}`}>
                          {b.percentage}%
                        </span>
                      ) : null}
                    </p>
                    {b.description && (
                      <p className="text-xs text-dark-500 mt-0.5 leading-tight">{b.description}</p>
                    )}
                    {isHigher && (
                      <p className="text-xs text-dark-600 mt-1 italic">
                        Suba a {meta.label} para acceder
                      </p>
                    )}
                    {isOwn && (
                      <p className={`text-xs mt-1 font-medium ${meta.color}`}>
                        Por ser categoría {meta.label}
                      </p>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.section>
      )}

      {/* Active cashback rules */}
      {rules.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title flex items-center gap-2">
              <Zap size={22} className="text-gold-500" /> Beneficios activos
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rules.map((rule) => (
              <motion.div
                key={rule.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="card p-5 border-gold-600/20 bg-gradient-to-br from-dark-900 to-amber-950/10"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-gold-600/20 rounded-lg flex items-center justify-center">
                    <Star size={18} className="text-gold-500" />
                  </div>
                  <div>
                    <p className="text-xs text-dark-500 uppercase tracking-wide">{CASHBACK_TYPE_LABELS[rule.type]}</p>
                    <p className="text-2xl font-black text-gold-400">{rule.percentage}%</p>
                  </div>
                </div>
                {rule.type === 'GLOBAL' && <p className="text-sm text-dark-300">Todas sus compras generan un {rule.percentage}% de beneficio</p>}
                {rule.type === 'MIN_AMOUNT' && <p className="text-sm text-dark-300">Compras superiores a {formatCurrency(rule.minAmount || 0)} generan un {rule.percentage}% de beneficio</p>}
                {rule.type === 'DATE_RANGE' && <p className="text-sm text-dark-300">Promoción por período activa — {rule.percentage}% de beneficio</p>}
                {rule.type === 'SPECIFIC_DATE' && <p className="text-sm text-dark-300">Día especial — {rule.percentage}% de beneficio</p>}
                {rule.type === 'CATEGORY' && <p className="text-sm text-dark-300">Productos de la categoría <span className="text-gold-400">{rule.category?.name}</span> — {rule.percentage}% de beneficio</p>}
                {rule.type === 'PRODUCT' && <p className="text-sm text-dark-300">Producto <span className="text-gold-400">{rule.product?.name}</span> — {rule.percentage}% de beneficio</p>}
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* CTA for non-authenticated */}
      {!client && (
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card p-8 text-center"
        >
          <h2 className="text-2xl font-bold text-dark-50 mb-2">¿Tiene un establecimiento comercial?</h2>
          <p className="text-dark-400 mb-6 max-w-md mx-auto">
            Regístrese para acceder al catálogo completo, realizar pedidos y comenzar a acumular beneficios exclusivos.
          </p>
          <div className="flex justify-center gap-3">
            <Link to="/registro" className="btn-primary">Registrar establecimiento</Link>
            <Link to="/login" className="btn-secondary">Iniciar sesión</Link>
          </div>
        </motion.section>
      )}
    </div>
  );
}
