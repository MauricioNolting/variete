import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Plus, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Product } from '../types';
import { useCartStore } from '../store/cart';
import { formatCurrency } from '../utils/format';
import toast from 'react-hot-toast';

interface ProductCardProps {
  product: Product;
  cashbackPercentage?: number;
}

export default function ProductCard({ product, cashbackPercentage = 0 }: ProductCardProps) {
  const { addItem, openCart } = useCartStore();
  const [adding, setAdding] = useState(false);
  const mainImg = product.images[product.mainImageIndex];
  const cashbackAmount = (product.price * cashbackPercentage) / 100;

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!product.isActive || product.stock === 0) return;
    setAdding(true);
    addItem(product, 1);
    toast.success('Producto agregado al pedido', { icon: '✓' });
    setTimeout(() => {
      setAdding(false);
      openCart();
    }, 600);
  };

  return (
    <Link to={`/producto/${product.id}`}>
      <motion.div
        whileHover={{ y: -4 }}
        className="card-hover overflow-hidden h-full flex flex-col"
      >
        {/* Image */}
        <div className="relative aspect-square overflow-hidden bg-dark-800">
          {mainImg ? (
            <img
              src={mainImg.url}
              alt={product.name}
              className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ShoppingCart size={40} className="text-dark-700" />
            </div>
          )}
          {!product.isActive && (
            <div className="absolute inset-0 bg-dark-950/70 flex items-center justify-center">
              <span className="badge-red text-xs px-3 py-1">Sin disponibilidad</span>
            </div>
          )}
          {product.stock > 0 && product.stock <= 5 && (
            <div className="absolute top-2 right-2 badge-red text-xs">
              Últimas {product.stock} unidades
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-4 flex flex-col gap-2 flex-1">
          <div>
            <p className="text-xs text-dark-500 uppercase tracking-wide mb-1">{product.category?.name}</p>
            <h3 className="font-semibold text-dark-100 leading-tight line-clamp-2">{product.name}</h3>
          </div>

          <div className="flex items-end justify-between mt-auto pt-2">
            <div>
              <p className="text-xl font-bold text-dark-50">{formatCurrency(product.price)}</p>
              {cashbackAmount > 0 && (
                <p className="text-xs text-emerald-400 mt-0.5">
                  Esta compra genera {formatCurrency(cashbackAmount)} de beneficio
                </p>
              )}
            </div>

            <AnimatePresence mode="wait">
              {product.isActive && product.stock > 0 ? (
                <motion.button
                  key="add"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: adding ? [1, 1.3, 1] : 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  onClick={handleAdd}
                  className="w-10 h-10 bg-gold-600 hover:bg-gold-500 text-dark-950 rounded-xl flex items-center justify-center transition-colors"
                >
                  {adding ? <ShoppingCart size={18} /> : <Plus size={18} />}
                </motion.button>
              ) : (
                <motion.div
                  key="unavailable"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-1 text-dark-500"
                >
                  <AlertCircle size={14} />
                  <span className="text-xs">No disponible</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
