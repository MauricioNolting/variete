import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Search, Filter, X } from 'lucide-react';
import api from '../utils/api';
import { Category, Product } from '../types';
import ProductCard from '../components/ProductCard';

export default function CatalogPage() {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = (value: string) => {
    setSearch(value);
    if (searchTimer) clearTimeout(searchTimer);
    setSearchTimer(setTimeout(() => setDebouncedSearch(value), 400));
  };

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then((r) => r.data),
  });

  const { data: productsData, isLoading } = useQuery({
    queryKey: ['products', selectedCategory, debouncedSearch],
    queryFn: () =>
      api.get('/products', {
        params: {
          category: selectedCategory || undefined,
          search: debouncedSearch || undefined,
          limit: 100,
        },
      }).then((r) => r.data),
  });

  const { data: cashbackData } = useQuery({
    queryKey: ['cashback-config'],
    queryFn: () => api.get('/cashback/config').then((r) => r.data),
  });

  const products: Product[] = productsData?.products || [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="section-title mb-1">Catálogo de productos</h1>
        <p className="text-dark-400 text-sm">{productsData?.total || 0} productos disponibles</p>
      </div>

      {/* Search & filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
          <input
            type="text"
            placeholder="Buscar productos..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10"
          />
          {search && (
            <button onClick={() => { setSearch(''); setDebouncedSearch(''); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 hover:text-dark-300">
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Category filters */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
            !selectedCategory ? 'bg-gold-600 text-dark-950' : 'bg-dark-800 text-dark-300 hover:text-dark-100'
          }`}
        >
          Todos
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
              selectedCategory === cat.id ? 'bg-gold-600 text-dark-950' : 'bg-dark-800 text-dark-300 hover:text-dark-100'
            }`}
          >
            {cat.name} {cat._count && <span className="opacity-60">({cat._count.products})</span>}
          </button>
        ))}
      </div>

      {/* Products grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="card animate-pulse aspect-[3/4]" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-dark-500">
          <Filter size={48} className="opacity-30" />
          <p className="text-center">No se encontraron productos que coincidan con su búsqueda.</p>
          <button onClick={() => { setSearch(''); setDebouncedSearch(''); setSelectedCategory(null); }} className="btn-secondary text-sm">
            Limpiar filtros
          </button>
        </div>
      ) : (
        <motion.div
          layout
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
        >
          {products.map((product, i) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <ProductCard product={product} cashbackPercentage={cashbackData?.percentage || 0} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
