import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, Pencil, Trash2, X, Upload, Image, FolderPlus, Check, Loader2, Filter, ArrowUpAZ, Clock } from 'lucide-react';
import api from '../../utils/api';
import { Product, Category } from '../../types';
import { formatCurrency } from '../../utils/format';
import toast from 'react-hot-toast';

interface ProductForm {
  name: string;
  description: string;
  categoryId: string;
  stock: string;
  price: string;
  isActive: boolean;
}

const emptyForm: ProductForm = { name: '', description: '', categoryId: '', stock: '', price: '', isActive: true };

export default function ProductsAdminPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [mainIdx, setMainIdx] = useState(0);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Inline category creation
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [creatingCat, setCreatingCat] = useState(false);

  // Filter & sort
  const [filterCategoryId, setFilterCategoryId] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'createdAt'>('createdAt');

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ['admin-products'],
    queryFn: () => api.get('/products/admin/all').then((r) => r.data),
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then((r) => r.data),
  });

  const sortedCategories = [...categories].sort((a, b) =>
    a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
  );

  // Derived list: filter by category, then sort
  const visibleProducts = [...products]
    .filter((p) => !filterCategoryId || String(p.categoryId) === filterCategoryId)
    .sort((a, b) =>
      sortBy === 'name'
        ? a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
        : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

  const handleCreateCategory = async () => {
    const name = newCatName.trim();
    if (!name) return;
    setCreatingCat(true);
    try {
      const res = await api.post('/categories', { name });
      await qc.invalidateQueries({ queryKey: ['categories'] });
      setForm((f) => ({ ...f, categoryId: String(res.data.id) }));
      setNewCatName('');
      setShowNewCat(false);
    } catch {
      // error silently — category creation failure
    } finally {
      setCreatingCat(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setNewFiles([]);
    setPreviews([]);
    setMainIdx(0);
    setShowModal(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description || '',
      categoryId: String(p.categoryId),
      stock: String(p.stock),
      price: String(p.price),
      isActive: p.isActive,
    });
    setNewFiles([]);
    setPreviews([]);
    setMainIdx(p.mainImageIndex);
    setShowModal(true);
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files);
    setNewFiles((f) => [...f, ...arr]);
    arr.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => setPreviews((p) => [...p, e.target?.result as string]);
      reader.readAsDataURL(file);
    });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      setUploading(true);
      const fd = new FormData();
      fd.append('name', form.name);
      fd.append('description', form.description);
      fd.append('categoryId', form.categoryId);
      fd.append('stock', form.stock);
      fd.append('price', form.price);
      fd.append('mainImageIndex', String(mainIdx));
      fd.append('isActive', String(form.isActive));
      newFiles.forEach((f) => fd.append('images', f));

      if (editing) {
        return api.put(`/products/${editing.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      return api.post('/products', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-products'] });
      setShowModal(false);
      setUploading(false);
      toast.success(editing ? 'Producto actualizado exitosamente.' : 'Producto creado exitosamente.');
    },
    onError: (err: any) => {
      setUploading(false);
      toast.error(err.response?.data?.error || 'Error al guardar el producto.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/products/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-products'] });
      toast.success('Producto eliminado exitosamente.');
    },
    onError: () => toast.error('Error al eliminar el producto.'),
  });

  const stockMutation = useMutation({
    mutationFn: ({ id, stock }: { id: number; stock: number }) => api.patch(`/products/${id}/stock`, { stock }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-products'] }),
  });

  const handleDelete = (p: Product) => {
    if (!window.confirm(`¿Confirma que desea eliminar "${p.name}"? Esta acción no se puede deshacer.`)) return;
    deleteMutation.mutate(p.id);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="section-title">Gestión de productos</h1>
          <p className="text-dark-400 text-sm">
            {visibleProducts.length !== products.length
              ? `${visibleProducts.length} de ${products.length} productos`
              : `${products.length} productos registrados`}
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus size={18} /> Nuevo producto
        </button>
      </div>

      {/* Filter & sort bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter size={15} className="text-dark-500 flex-shrink-0" />

        {/* Category filter */}
        <select
          value={filterCategoryId}
          onChange={(e) => setFilterCategoryId(e.target.value)}
          className="text-sm py-2 px-3 bg-dark-800 border-dark-700 rounded-xl text-dark-300 min-w-[160px]"
        >
          <option value="">Todas las categorías</option>
          {sortedCategories.map((c) => (
            <option key={c.id} value={String(c.id)}>{c.name}</option>
          ))}
        </select>

        {/* Sort */}
        <div className="flex gap-1 bg-dark-800 rounded-xl p-1">
          <button
            onClick={() => setSortBy('createdAt')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              sortBy === 'createdAt' ? 'bg-dark-600 text-dark-100' : 'text-dark-400 hover:text-dark-200'
            }`}
          >
            <Clock size={13} /> Más recientes
          </button>
          <button
            onClick={() => setSortBy('name')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              sortBy === 'name' ? 'bg-dark-600 text-dark-100' : 'text-dark-400 hover:text-dark-200'
            }`}
          >
            <ArrowUpAZ size={13} /> A → Z
          </button>
        </div>

        {/* Clear filter chip */}
        {filterCategoryId && (
          <button
            onClick={() => setFilterCategoryId('')}
            className="flex items-center gap-1 text-xs text-gold-400 hover:text-gold-300 transition-colors"
          >
            <X size={12} /> Limpiar filtro
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="card h-48 animate-pulse" />)}
        </div>
      ) : visibleProducts.length === 0 ? (
        <div className="card p-8 text-center text-dark-500">
          {filterCategoryId
            ? 'No hay productos en esta categoría.'
            : 'No hay productos registrados aún.'}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-800 text-dark-500 text-xs uppercase tracking-wide">
                <th className="text-left p-4">Producto</th>
                <th className="text-left p-4 hidden md:table-cell">Categoría</th>
                <th className="text-right p-4">Precio</th>
                <th className="text-right p-4">Stock</th>
                <th className="text-center p-4">Estado</th>
                <th className="text-right p-4">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visibleProducts.map((p) => {
                const img = p.images[p.mainImageIndex];
                return (
                  <tr key={p.id} className="border-b border-dark-800/50 hover:bg-dark-800/30 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-dark-800 flex-shrink-0">
                          {img ? <img src={img.url} alt={p.name} className="w-full h-full object-cover" /> : <Image size={18} className="m-auto text-dark-600" />}
                        </div>
                        <span className="font-medium text-dark-100 truncate max-w-[140px]">{p.name}</span>
                      </div>
                    </td>
                    <td className="p-4 hidden md:table-cell text-dark-400">{p.category?.name}</td>
                    <td className="p-4 text-right font-semibold text-dark-100">{formatCurrency(p.price)}</td>
                    <td className="p-4">
                      <div className="flex justify-end">
                        <div className="stepper">
                          <button
                            type="button"
                            onClick={() => stockMutation.mutate({ id: p.id, stock: Math.max(0, p.stock - 1) })}
                            disabled={p.stock <= 0}
                            className="stepper-btn hover:text-red-400 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-dark-400"
                          >
                            <Minus size={13} />
                          </button>
                          <input
                            type="number"
                            value={p.stock}
                            onChange={(e) => stockMutation.mutate({ id: p.id, stock: Math.max(0, Number(e.target.value)) })}
                            min={0}
                          />
                          <button
                            type="button"
                            onClick={() => stockMutation.mutate({ id: p.id, stock: p.stock + 1 })}
                            className="stepper-btn hover:text-emerald-400"
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <span className={p.isActive ? 'badge-green' : 'badge-red'}>
                        {p.isActive ? 'Activo' : p.stock === 0 ? 'Sin stock' : 'Pausado'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(p)} className="p-2 hover:bg-dark-700 rounded-lg text-dark-400 hover:text-dark-200 transition-colors">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => handleDelete(p)} className="p-2 hover:bg-dark-700 rounded-lg text-dark-400 hover:text-red-400 transition-colors">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/80 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-dark-900 rounded-2xl border border-dark-700 w-full max-w-lg max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between p-5 border-b border-dark-800">
              <h2 className="font-bold text-dark-100">{editing ? 'Editar producto' : 'Nuevo producto'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-dark-800 rounded-lg text-dark-400">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="label">Nombre <span className="text-gold-500">*</span></label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nombre del producto" />
              </div>
              <div>
                <label className="label">Descripción</label>
                <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} className="resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Categoría <span className="text-gold-500">*</span></label>
                  <div className="flex gap-1.5">
                    <select
                      value={form.categoryId}
                      onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                      className="flex-1 min-w-0"
                    >
                      <option value="">Seleccionar</option>
                      {sortedCategories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      title="Nueva categoría"
                      onClick={() => { setShowNewCat((v) => !v); setNewCatName(''); }}
                      className="flex-shrink-0 p-2 rounded-lg bg-dark-800 hover:bg-dark-700 text-dark-400 hover:text-gold-400 border border-dark-700 transition-colors"
                    >
                      <FolderPlus size={16} />
                    </button>
                  </div>

                  {/* Inline new category form */}
                  <AnimatePresence>
                    {showNewCat && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-2 flex gap-1.5">
                          <input
                            autoFocus
                            value={newCatName}
                            onChange={(e) => setNewCatName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreateCategory(); } if (e.key === 'Escape') setShowNewCat(false); }}
                            placeholder="Nombre de nueva categoría"
                            className="flex-1 text-sm py-1.5 px-3"
                          />
                          <button
                            type="button"
                            onClick={handleCreateCategory}
                            disabled={creatingCat || !newCatName.trim()}
                            className="flex-shrink-0 p-2 rounded-lg bg-emerald-700/40 hover:bg-emerald-700/60 text-emerald-400 border border-emerald-700/40 transition-colors disabled:opacity-40"
                          >
                            {creatingCat ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowNewCat(false)}
                            className="flex-shrink-0 p-2 rounded-lg bg-dark-800 hover:bg-dark-700 text-dark-400 border border-dark-700 transition-colors"
                          >
                            <X size={15} />
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <div>
                  <label className="label">Precio <span className="text-gold-500">*</span></label>
                  <input type="number" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} placeholder="0.00" step="0.01" />
                </div>
              </div>
              <div>
                <label className="label">Stock <span className="text-gold-500">*</span></label>
                <input type="number" value={form.stock} onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))} placeholder="0" min="0" />
              </div>

              {/* Image upload */}
              <div>
                <label className="label">Imágenes</label>
                {/* Existing images */}
                {editing && editing.images.length > 0 && (
                  <div className="flex gap-2 mb-3 flex-wrap">
                    {editing.images.map((img, i) => (
                      <div key={i} onClick={() => setMainIdx(i)}
                        className={`w-16 h-16 rounded-lg overflow-hidden cursor-pointer border-2 transition-colors ${mainIdx === i ? 'border-gold-500' : 'border-dark-700'}`}>
                        <img src={img.url} alt="" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}
                {/* New previews */}
                {previews.length > 0 && (
                  <div className="flex gap-2 mb-3 flex-wrap">
                    {previews.map((p, i) => (
                      <div key={i} className="w-16 h-16 rounded-lg overflow-hidden border-2 border-dark-700 relative">
                        <img src={p} alt="" className="w-full h-full object-cover" />
                        <button
                          onClick={() => { setNewFiles((f) => f.filter((_, j) => j !== i)); setPreviews((p) => p.filter((_, j) => j !== i)); }}
                          className="absolute top-0 right-0 bg-dark-950/80 p-0.5 rounded-bl text-red-400"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="btn-secondary text-sm w-full">
                  <Upload size={16} /> Seleccionar imágenes
                </button>
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="isActive" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} className="w-4 h-4" />
                <label htmlFor="isActive" className="text-sm text-dark-300 cursor-pointer">Producto activo</label>
              </div>
            </div>

            <div className="p-5 border-t border-dark-800 flex gap-3">
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={() => saveMutation.mutate()} disabled={uploading || saveMutation.isPending} className="btn-primary flex-1">
                {uploading ? 'Subiendo imágenes...' : editing ? 'Actualizar' : 'Crear producto'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
