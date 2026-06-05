import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ShoppingCart, Plus, Minus, ArrowLeft, AlertCircle } from 'lucide-react';
import api from '../utils/api';
import { Product } from '../types';
import { useCartStore } from '../store/cart';
import { formatCurrency } from '../utils/format';
import toast from 'react-hot-toast';

export default function ProductDetailPage() {
  const { id } = useParams();
  const [qty, setQty] = useState(1);
  const [selectedImg, setSelectedImg] = useState(0);
  const { addItem, openCart } = useCartStore();

  const { data: product, isLoading } = useQuery<Product>({
    queryKey: ['product', id],
    queryFn: () => api.get(`/products/${id}`).then((r) => r.data),
  });

  const { data: cashbackData } = useQuery({
    queryKey: ['cashback-calculate', product?.id, qty],
    queryFn: () =>
      api.post('/cashback/calculate', {
        items: [{ productId: product!.id, categoryId: product!.categoryId, quantity: qty, unitPrice: product!.price }],
        orderTotal: product!.price * qty,
      }).then((r) => r.data),
    enabled: !!product,
  });

  if (isLoading) return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="grid md:grid-cols-2 gap-8">
        <div className="card animate-pulse aspect-square" />
        <div className="space-y-4">
          <div className="h-8 bg-dark-800 rounded-lg animate-pulse" />
          <div className="h-6 bg-dark-800 rounded-lg w-1/2 animate-pulse" />
          <div className="h-24 bg-dark-800 rounded-lg animate-pulse" />
        </div>
      </div>
    </div>
  );

  if (!product) return (
    <div className="max-w-5xl mx-auto px-4 py-8 text-center text-dark-400">Producto no encontrado.</div>
  );

  const handleAdd = () => {
    if (!product.isActive || product.stock === 0) return;
    if (qty > product.stock) {
      toast.error(`El stock disponible es insuficiente para la cantidad solicitada.`);
      return;
    }
    addItem(product, qty);
    toast.success('Producto agregado al pedido');
    openCart();
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <Link to="/catalogo" className="flex items-center gap-2 text-dark-400 hover:text-dark-200 text-sm mb-6 transition-colors w-fit">
        <ArrowLeft size={16} /> Volver al catálogo
      </Link>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Gallery */}
        <div className="space-y-3">
          <motion.div
            key={selectedImg}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="aspect-square rounded-2xl overflow-hidden bg-dark-800 border border-dark-700"
          >
            {product.images[selectedImg] ? (
              <img src={product.images[selectedImg].url} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-dark-600">
                <ShoppingCart size={48} />
              </div>
            )}
          </motion.div>
          {product.images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {product.images.map((img, i) => (
                <button key={i} onClick={() => setSelectedImg(i)}
                  className={`w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-colors ${selectedImg === i ? 'border-gold-500' : 'border-dark-700'}`}>
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="space-y-5">
          <div>
            <p className="text-sm text-dark-500 uppercase tracking-widest mb-1">{product.category?.name}</p>
            <h1 className="text-3xl font-extrabold text-dark-50">{product.name}</h1>
          </div>

          <div className="text-4xl font-black text-dark-50">{formatCurrency(product.price)}</div>

          {cashbackData?.amount > 0 && (
            <div className="card p-4 border-emerald-600/30 bg-emerald-950/20">
              <p className="text-emerald-400 font-medium">
                Esta compra genera {formatCurrency(cashbackData.amount)} de beneficio
              </p>
              <p className="text-emerald-600 text-xs mt-0.5">{cashbackData.ruleDescription}</p>
            </div>
          )}

          {product.description && (
            <p className="text-dark-300 leading-relaxed">{product.description}</p>
          )}

          <div className="flex items-center gap-2">
            {product.isActive && product.stock > 0 ? (
              <span className="badge-green">Disponible — {product.stock} en stock</span>
            ) : (
              <span className="badge-red flex items-center gap-1"><AlertCircle size={12} /> Sin disponibilidad</span>
            )}
          </div>

          {product.isActive && product.stock > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <label className="label">Cantidad:</label>
                <div className="flex items-center gap-2 bg-dark-800 rounded-xl p-1">
                  <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-9 h-9 rounded-lg hover:bg-dark-700 flex items-center justify-center transition-colors">
                    <Minus size={16} />
                  </button>
                  <span className="w-10 text-center font-bold text-dark-100">{qty}</span>
                  <button onClick={() => setQty((q) => Math.min(product.stock, q + 1))} className="w-9 h-9 rounded-lg hover:bg-dark-700 flex items-center justify-center transition-colors">
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              <div className="text-sm text-dark-400">
                Subtotal: <span className="text-lg font-bold text-dark-100">{formatCurrency(product.price * qty)}</span>
              </div>

              <button onClick={handleAdd} className="btn-primary w-full text-base py-4">
                <ShoppingCart size={20} /> Agregar al pedido
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
