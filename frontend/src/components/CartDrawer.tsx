import { motion } from 'framer-motion';
import { X, Minus, Plus, Trash2, ShoppingBag, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCartStore } from '../store/cart';
import { useAuthStore } from '../store/auth';
import { formatCurrency } from '../utils/format';

export default function CartDrawer() {
  const { items, removeItem, updateQuantity, closeCart, getSubtotal } = useCartStore();
  const { client } = useAuthStore();
  const subtotal = getSubtotal();

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={closeCart}
        className="fixed inset-0 z-50 bg-dark-950/80 backdrop-blur-sm"
      />

      {/* Drawer */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm bg-dark-900 border-l border-dark-700 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-800">
          <h2 className="text-lg font-bold text-dark-50 flex items-center gap-2">
            <ShoppingBag size={20} className="text-gold-500" />
            Pedido actual
          </h2>
          <button onClick={closeCart} className="p-2 hover:bg-dark-800 rounded-lg text-dark-400 hover:text-dark-200 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-dark-500">
              <ShoppingBag size={48} className="opacity-30" />
              <p className="text-sm text-center">Su pedido está vacío.<br />Explore el catálogo para comenzar.</p>
              <Link to="/catalogo" onClick={closeCart} className="btn-primary text-sm">
                Ver catálogo
              </Link>
            </div>
          ) : (
            items.map((item) => {
              const mainImg = item.product.images[item.product.mainImageIndex];
              return (
                <motion.div
                  key={item.product.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex gap-3 bg-dark-800 rounded-xl p-3"
                >
                  {mainImg && (
                    <img src={mainImg.url} alt={item.product.name}
                      className="w-16 h-16 object-cover rounded-lg flex-shrink-0" loading="lazy" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-dark-100 truncate">{item.product.name}</p>
                    <p className="text-xs text-dark-400">{formatCurrency(item.product.price)} c/u</p>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                          className="w-7 h-7 rounded-lg bg-dark-700 hover:bg-dark-600 flex items-center justify-center transition-colors"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="text-sm font-semibold w-6 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                          disabled={item.quantity >= item.product.stock}
                          className="w-7 h-7 rounded-lg bg-dark-700 hover:bg-dark-600 flex items-center justify-center transition-colors disabled:opacity-40"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gold-400">{formatCurrency(item.product.price * item.quantity)}</span>
                        <button
                          onClick={() => removeItem(item.product.id)}
                          className="p-1 text-dark-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-dark-800 p-4 space-y-3">
            {client?.cashbackBalance !== undefined && client.cashbackBalance > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-emerald-400">Saldo de beneficios disponible:</span>
                <span className="font-semibold text-emerald-400">{formatCurrency(client.cashbackBalance)}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-dark-300 text-sm">Subtotal:</span>
              <span className="text-lg font-bold text-dark-50">{formatCurrency(subtotal)}</span>
            </div>
            <Link
              to="/checkout"
              onClick={closeCart}
              className="btn-primary w-full"
            >
              Confirmar pedido <ArrowRight size={18} />
            </Link>
          </div>
        )}
      </motion.div>
    </>
  );
}
