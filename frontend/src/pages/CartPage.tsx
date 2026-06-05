import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight, Gift } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useCartStore } from '../store/cart';
import { useAuthStore } from '../store/auth';
import { formatCurrency } from '../utils/format';
import api from '../utils/api';

export default function CartPage() {
  const { items, removeItem, updateQuantity, getSubtotal } = useCartStore();
  const { client } = useAuthStore();
  const subtotal = getSubtotal();

  const { data: cashbackCalc } = useQuery({
    queryKey: ['cashback-cart', subtotal],
    queryFn: () =>
      api.post('/cashback/calculate', {
        items: items.map((i) => ({
          productId: i.product.id,
          categoryId: i.product.categoryId,
          quantity: i.quantity,
          unitPrice: i.product.price,
        })),
        orderTotal: subtotal,
      }).then((r) => r.data),
    enabled: items.length > 0,
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
                const cashbackPerUnit = cashbackCalc ? (item.product.price * cashbackCalc.percentage) / 100 : 0;
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
                        <img src={img.url} alt={item.product.name}
                          className="w-20 h-20 object-cover rounded-xl flex-shrink-0" loading="lazy" />
                      </Link>
                    )}
                    <div className="flex-1 min-w-0">
                      <Link to={`/producto/${item.product.id}`}>
                        <p className="font-semibold text-dark-100 hover:text-gold-400 transition-colors">{item.product.name}</p>
                      </Link>
                      <p className="text-sm text-dark-400">{formatCurrency(item.product.price)} c/u</p>
                      {cashbackPerUnit > 0 && (
                        <p className="text-xs text-emerald-400 mt-0.5">
                          Beneficio por unidad: {formatCurrency(cashbackPerUnit)}
                        </p>
                      )}
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-2 bg-dark-800 rounded-xl p-1">
                          <button onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                            className="w-8 h-8 rounded-lg hover:bg-dark-700 flex items-center justify-center transition-colors">
                            <Minus size={14} />
                          </button>
                          <span className="text-sm font-bold w-8 text-center">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                            disabled={item.quantity >= item.product.stock}
                            className="w-8 h-8 rounded-lg hover:bg-dark-700 flex items-center justify-center transition-colors disabled:opacity-40">
                            <Plus size={14} />
                          </button>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-gold-400">{formatCurrency(item.product.price * item.quantity)}</span>
                          <button onClick={() => removeItem(item.product.id)}
                            className="p-1.5 text-dark-500 hover:text-red-400 transition-colors">
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
          <div className="card p-5 space-y-3">
            {client?.cashbackBalance !== undefined && client.cashbackBalance > 0 && (
              <div className="flex items-center justify-between text-sm pb-3 border-b border-dark-800">
                <span className="text-emerald-400 flex items-center gap-2">
                  <Gift size={16} /> Saldo de beneficios disponible:
                </span>
                <span className="font-semibold text-emerald-400">{formatCurrency(client.cashbackBalance)}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-dark-300">Subtotal del pedido:</span>
              <span className="text-xl font-bold text-dark-50">{formatCurrency(subtotal)}</span>
            </div>
            {cashbackCalc?.amount > 0 && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-emerald-400">Beneficio que generará esta compra:</span>
                <span className="font-semibold text-emerald-400">{formatCurrency(cashbackCalc.amount)}</span>
              </div>
            )}
            <Link to="/checkout" className="btn-primary w-full text-base py-4">
              Confirmar pedido <ArrowRight size={18} />
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
