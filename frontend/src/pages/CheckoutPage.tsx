import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, Clock, CheckCircle, Gift } from 'lucide-react';
import api from '../utils/api';
import { useCartStore } from '../store/cart';
import { useAuthStore } from '../store/auth';
import { CityVisitDate } from '../types';
import { formatCurrency, formatDateLong, TIME_RANGE_OPTIONS } from '../utils/format';
import toast from 'react-hot-toast';
import CashbackCelebration from '../components/CashbackCelebration';

export default function CheckoutPage() {
  const { items, getSubtotal, clearCart, useCashback, cashbackToUse, setCashbackUsage } = useCartStore();
  const { client, updateClient } = useAuthStore();
  const [selectedDate, setSelectedDate] = useState('');
  const [timeRange, setTimeRange] = useState('');
  const [notes, setNotes] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [celebrationAmount, setCelebrationAmount] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);

  const subtotal = getSubtotal();
  const cashbackBalance = client?.cashbackBalance ?? 0;
  const maxApplicable = Math.min(cashbackBalance, subtotal);
  const appliedCashback = useCashback ? cashbackToUse : 0;
  const total = subtotal - appliedCashback;

  const { data: visitDates = [] } = useQuery<CityVisitDate[]>({
    queryKey: ['visit-dates', client?.cityId],
    queryFn: () => api.get(`/cities/${client?.cityId}/dates`).then((r) => r.data),
    enabled: !!client?.cityId,
  });

  const { data: cashbackCalc } = useQuery({
    queryKey: ['cashback-order', total],
    queryFn: () =>
      api.post('/cashback/calculate', {
        items: items.map((i) => ({
          productId: i.product.id,
          categoryId: i.product.categoryId,
          quantity: i.quantity,
          unitPrice: i.product.price,
        })),
        orderTotal: total,
      }).then((r) => r.data),
    enabled: items.length > 0,
  });

  const mutation = useMutation({
    mutationFn: (data: object) => api.post('/orders', data),
    onSuccess: (res) => {
      setConfirmed(true);
      clearCart();
      if (client) {
        updateClient({ ...client, cashbackBalance: res.data.newCashbackBalance });
      }
      if (res.data.order.cashbackEarned > 0) {
        setCelebrationAmount(res.data.order.cashbackEarned);
        setShowCelebration(true);
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Error al procesar el pedido.');
    },
  });

  const noDatesAvailable = visitDates.length === 0;

  const handleSubmit = () => {
    if (!noDatesAvailable && !selectedDate) { toast.error('Seleccione la fecha de entrega de su preferencia.'); return; }
    if (!timeRange) { toast.error('Indique el rango horario disponible para la recepción del pedido.'); return; }
    if (items.length === 0) { toast.error('El pedido está vacío.'); return; }

    // If no dates configured for the city, use a 30-day placeholder and mark in notes
    const deliveryDate = noDatesAvailable
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      : selectedDate;

    const finalNotes = noDatesAvailable
      ? `[📅 Fecha a coordinar con el cliente] ${notes || ''}`.trim()
      : (notes || undefined);

    mutation.mutate({
      items: items.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
      deliveryDate,
      preferredTimeRange: timeRange,
      notes: finalNotes,
      cashbackToUse: useCashback ? cashbackToUse : 0,
    });
  };

  if (confirmed) return (
    <>
      {showCelebration && celebrationAmount > 0 && (
        <CashbackCelebration amount={celebrationAmount} onClose={() => setShowCelebration(false)} />
      )}
    <div className="max-w-lg mx-auto px-4 py-16 text-center">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 12 }}>
        <div className="w-20 h-20 bg-emerald-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle size={40} className="text-emerald-400" />
        </div>
        <h2 className="text-2xl font-bold text-dark-50 mb-2">Su pedido ha sido registrado exitosamente</h2>
        <p className="text-dark-400 mb-6">Recibirá una confirmación por email. El pago se realiza al momento de recibir el pedido.</p>
        {cashbackCalc?.amount > 0 && (
          <div className="card p-4 mb-6 border-emerald-600/30">
            <p className="text-emerald-400 font-semibold">
              Beneficio acumulado: {cashbackCalc.percentage}% — {formatCurrency(cashbackCalc.amount)}
            </p>
            {cashbackCalc.ruleDescription && (
              <p className="text-xs text-emerald-600 mt-0.5">{cashbackCalc.ruleDescription}</p>
            )}
            <p className="text-sm text-emerald-600 mt-1">Nuevo saldo disponible: {formatCurrency(client?.cashbackBalance || 0)}</p>
          </div>
        )}
        <div className="flex gap-3 justify-center">
          <Link to="/perfil" className="btn-secondary">Ver mis pedidos</Link>
          <Link to="/catalogo" className="btn-primary">Nuevo pedido</Link>
        </div>
      </motion.div>
    </div>
    </>
  );

  if (items.length === 0) return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center">
      <p className="text-dark-400 mb-4">Su pedido está vacío.</p>
      <Link to="/catalogo" className="btn-primary">Ver catálogo</Link>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <Link to="/carrito" className="flex items-center gap-2 text-dark-400 hover:text-dark-200 text-sm mb-6 transition-colors w-fit">
        <ArrowLeft size={16} /> Volver al pedido
      </Link>

      <h1 className="section-title mb-6">Confirmar pedido</h1>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Delivery date */}
          <div className="card p-5">
            <h3 className="font-semibold text-dark-100 flex items-center gap-2 mb-4">
              <Calendar size={18} className="text-gold-500" /> Fecha de entrega
            </h3>
            {noDatesAvailable ? (
              <div className="bg-amber-950/20 border border-amber-600/30 rounded-xl p-4 text-sm text-amber-300">
                <p className="font-medium mb-1">Sin fechas programadas para su ciudad aún</p>
                <p className="text-amber-400/70 text-xs leading-relaxed">
                  Puede confirmar su pedido igualmente. Una vez procesado, nos pondremos en contacto para coordinar y confirmarle la fecha exacta de entrega.
                </p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {visitDates.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setSelectedDate(d.date)}
                    className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all capitalize ${
                      selectedDate === d.date
                        ? 'bg-gold-600 text-dark-950'
                        : 'bg-dark-800 text-dark-300 hover:text-dark-100 border border-dark-700'
                    }`}
                  >
                    {formatDateLong(d.date)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Time range */}
          <div className="card p-5">
            <h3 className="font-semibold text-dark-100 flex items-center gap-2 mb-4">
              <Clock size={18} className="text-gold-500" /> Rango horario
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {TIME_RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setTimeRange(opt.value)}
                  className={`px-4 py-3 rounded-xl text-sm font-medium transition-all text-left ${
                    timeRange === opt.value
                      ? 'bg-gold-600 text-dark-950'
                      : 'bg-dark-800 text-dark-300 hover:text-dark-100 border border-dark-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="card p-5">
            <h3 className="font-semibold text-dark-100 mb-3">Observaciones</h3>
            <textarea
              placeholder="Instrucciones especiales, referencias de entrega (opcional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
        </div>

        {/* Right column — order summary */}
        <div className="space-y-4">
          <div className="card p-5 space-y-3">
            <h3 className="font-semibold text-dark-100 mb-2">Resumen del pedido</h3>

            {items.map((item) => (
              <div key={item.product.id} className="flex justify-between text-sm">
                <span className="text-dark-300 truncate flex-1 mr-2">
                  {item.product.name} <span className="text-dark-500">x{item.quantity}</span>
                </span>
                <span className="font-medium text-dark-100 flex-shrink-0">{formatCurrency(item.product.price * item.quantity)}</span>
              </div>
            ))}

            <div className="border-t border-dark-800 pt-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-dark-400">Subtotal:</span>
                <span className="text-dark-100">{formatCurrency(subtotal)}</span>
              </div>

              {/* Cashback toggle */}
              {cashbackBalance > 0 && (
                <div className="bg-emerald-950/30 border border-emerald-700/30 rounded-xl p-3 space-y-1.5">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={useCashback}
                      onChange={(e) => {
                        if (e.target.checked) {
                          // Use amount already set from cart, or default to max
                          const amount = cashbackToUse > 0 ? Math.min(cashbackToUse, maxApplicable) : maxApplicable;
                          setCashbackUsage(true, amount);
                        } else {
                          setCashbackUsage(false, 0);
                        }
                      }}
                      className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
                    />
                    <span className="text-sm text-emerald-300 font-medium flex items-center gap-1.5">
                      <Gift size={13} /> Usar saldo de beneficios
                    </span>
                    <span className="text-emerald-400 text-xs ml-auto">
                      disponible: {formatCurrency(cashbackBalance)}
                    </span>
                  </label>
                  {useCashback && appliedCashback > 0 && (
                    <div className="flex justify-between text-sm pl-6">
                      <span className="text-emerald-500">Descuento:</span>
                      <span className="text-emerald-400 font-semibold">-{formatCurrency(appliedCashback)}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-between font-bold text-lg border-t border-dark-800 pt-2">
                <span className="text-dark-100">Total a pagar:</span>
                <span className="text-gold-400">{formatCurrency(total)}</span>
              </div>

              {cashbackCalc?.amount > 0 && (
                <div className="bg-emerald-950/30 border border-emerald-700/30 rounded-xl p-3 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-300 text-sm font-semibold flex items-center gap-1.5">
                      <Gift size={14} /> Beneficio a ganar
                    </span>
                    <span className="text-emerald-400 font-black text-base">
                      {cashbackCalc.percentage}% — {formatCurrency(cashbackCalc.amount)}
                    </span>
                  </div>
                  {cashbackCalc.ruleDescription && (
                    <p className="text-xs text-emerald-600 leading-tight">
                      {cashbackCalc.ruleDescription}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="card p-4 text-xs text-dark-400 border-gold-600/20 bg-amber-950/10">
            <p className="font-medium text-gold-500 mb-1">Pago contra entrega</p>
            El pago se realiza al momento de recibir su pedido. El pedido debe realizarse con al menos 24 hs. de anticipación a la fecha de entrega.
          </div>

          <button
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className="btn-primary w-full text-base py-4"
          >
            {mutation.isPending ? 'Procesando...' : 'Confirmar pedido'}
          </button>
        </div>
      </div>
    </div>
  );
}
