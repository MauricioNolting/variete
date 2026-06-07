import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight, Gift } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useCartStore } from '../store/cart';
import { useAuthStore } from '../store/auth';
import { formatCurrency } from '../utils/format';
import api from '../utils/api';

export default function CartPage() {
  const { items, removeItem, updateQuantity, getSubtotal, useCashback, cashbackToUse, setCashbackUsage } = useCartStore();
  const { client } = useAuthStore();
  const subtotal = getSubtotal();

  // Use stored balance as the primary source — it stays positive even when
  // no CashbackTransaction records exist (manually-set balances, old data, etc.)
  const cashbackBalance: number = client?.cashbackBalance ?? 0;
  const maxApplicable = Math.min(cashbackBalance, subtotal);

  // cashbackInput is the text-field value only — the store holds the real amount
  const [cashbackInput, setCashbackInput] = useState(
    cashbackToUse > 0 ? String(cashbackToUse) : ''
  );

  // Applied cashback is always read from store (source of truth)
  const appliedCashback = useCashback ? cashbackToUse : 0;
  const total = subtotal - appliedCashback;

  // Toggle cashback on/off
  const handleToggle = (checked: boolean) => {
    if (checked) {
      // Default to max if input is empty
      const raw = Number(cashbackInput);
      const amount = raw > 0 ? Math.min(raw, maxApplicable) : maxApplicable;
      if (!cashbackInput) setCashbackInput(String(maxApplicable));
      setCashbackUsage(true, amount);
    } else {
      setCashbackUsage(false, 0);
    }
  };

  // Custom amount typed by user
  const handleAmountChange = (value: string) => {
    setCashbackInput(value);
    const clamped = Math.min(Math.max(Number(value) || 0, 0), maxApplicable);
    setCashbackUsage(true, clamped);
  };

  const { data: cashbackCalc } = useQuery({
    queryKey: ['cashback-cart', total],
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
    enabled: items.length > 0 && !!client,
  });

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      <h1 className="section-title">Mi pedido</h1>

      {items.length === 0 ? (
        <div className="card p-12 text-center space-y-4">
          <ShoppingBag size={48} className="mx-auto text-dark-700" />
          <p className="text-dark-400">Su pedido está vacío.</p>
          <Link to="/catalogo" className="btn-primary inline-flex">Ver catálogo</Link>
        </div>
      ) : (
        <>
          {/* Items */}
          <div className="space-y-3">
            <AnimatePresence>
              {items.map((item) => {
                const img = item.product.images[item.product.mainImageIndex];
                const cashbackPerUnit = cashbackCalc
                  ? (item.product.price * cashbackCalc.percentage) / 100
                  : 0;
                return (
                  <motion.div
                    key={item.product.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="card p-4 flex gap-4"
                  >
                    {img && (
                      <Link to={`/producto/${item.product.id}`}>
                        <img
                          src={img.url}
                          alt={item.product.name}
                          className="w-20 h-20 object-cover rounded-xl flex-shrink-0"
                          loading="lazy"
                        />
                      </Link>
                    )}
                    <div className="flex-1 min-w-0">
                      <Link to={`/producto/${item.product.id}`}>
                        <p className="font-semibold text-dark-100 hover:text-gold-400 transition-colors">
                          {item.product.name}
                        </p>
                      </Link>
                      <p className="text-sm text-dark-400">{formatCurrency(item.product.price)} c/u</p>
                      {cashbackPerUnit > 0 && (
                        <p className="text-xs text-emerald-400 mt-0.5">
                          Beneficio por unidad: {formatCurrency(cashbackPerUnit)}
                        </p>
                      )}
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-2 bg-dark-800 rounded-xl p-1">
                          <button
                            onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                            className="w-8 h-8 rounded-lg hover:bg-dark-700 flex items-center justify-center transition-colors"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="text-sm font-bold w-8 text-center">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                            disabled={item.quantity >= item.product.stock}
                            className="w-8 h-8 rounded-lg hover:bg-dark-700 flex items-center justify-center transition-colors disabled:opacity-40"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-gold-400">
                            {formatCurrency(item.product.price * item.quantity)}
                          </span>
                          <button
                            onClick={() => removeItem(item.product.id)}
                            className="p-1.5 text-dark-500 hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Summary */}
          <div className="card p-5 space-y-4">
            {/* Subtotal */}
            <div className="flex justify-between items-center">
              <span className="text-dark-400">Subtotal:</span>
              <span className="font-semibold text-dark-100">{formatCurrency(subtotal)}</span>
            </div>

            {/* Cashback balance widget — only for logged-in clients with balance */}
            {client && cashbackBalance > 0 && (
              <div className="bg-emerald-950/30 border border-emerald-700/30 rounded-xl p-4 space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <span className="text-emerald-400 text-sm font-medium flex items-center gap-2">
                    <Gift size={15} /> Saldo de beneficios disponible
                  </span>
                  <span className="font-bold text-emerald-400">{formatCurrency(cashbackBalance)}</span>
                </div>

                {/* Toggle */}
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={useCashback}
                    onChange={(e) => handleToggle(e.target.checked)}
                    className="w-4 h-4 rounded border-dark-600 accent-emerald-500 cursor-pointer"
                  />
                  <span className="text-sm text-dark-300">
                    Utilizar saldo de beneficios en este pedido
                  </span>
                </label>

                {/* Amount selector */}
                {useCashback && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={cashbackInput}
                        onChange={(e) => handleAmountChange(e.target.value)}
                        placeholder={`Máximo ${formatCurrency(maxApplicable)}`}
                        max={maxApplicable}
                        min={0}
                        step={0.01}
                        className="text-sm py-2 flex-1"
                      />
                      <button
                        onClick={() => {
                          setCashbackInput(String(maxApplicable));
                          setCashbackUsage(true, maxApplicable);
                        }}
                        className="text-xs text-emerald-400 hover:text-emerald-300 whitespace-nowrap transition-colors px-2"
                      >
                        Usar todo
                      </button>
                    </div>
                    <p className="text-xs text-emerald-500">
                      Se descontarán{' '}
                      <span className="font-bold">{formatCurrency(appliedCashback)}</span>{' '}
                      del total
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Discount line */}
            {appliedCashback > 0 && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-emerald-400">Descuento saldo de beneficios:</span>
                <span className="font-semibold text-emerald-400">
                  -{formatCurrency(appliedCashback)}
                </span>
              </div>
            )}

            {/* Total */}
            <div className="flex justify-between items-center border-t border-dark-800 pt-3">
              <span className="font-bold text-dark-100 text-lg">Total a pagar:</span>
              <span className="font-black text-2xl text-gold-400">{formatCurrency(total)}</span>
            </div>

            {/* Cashback to earn on this purchase */}
            {cashbackCalc?.amount > 0 && (
              <div className="bg-dark-800/60 rounded-xl px-4 py-3 space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-emerald-300 text-sm font-medium flex items-center gap-1.5">
                    <Gift size={14} /> Beneficio a ganar en esta compra
                  </span>
                  <span className="text-emerald-400 font-black">
                    {cashbackCalc.percentage}% — {formatCurrency(cashbackCalc.amount)}
                  </span>
                </div>
                {cashbackCalc.ruleDescription && (
                  <p className="text-xs text-emerald-700">{cashbackCalc.ruleDescription}</p>
                )}
              </div>
            )}

            <Link to="/checkout" className="btn-primary w-full text-base py-4 justify-center">
              Continuar con el pedido <ArrowRight size={18} />
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
