import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, Pencil, Trash2, X, Upload } from 'lucide-react';
import api from '../../utils/api';
import { Category } from '../../types';
import toast from 'react-hot-toast';

export default function CategoriesAdminPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: categories = [], isLoading } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then((r) => r.data),
  });

  const openCreate = () => { setEditing(null); setName(''); setFile(null); setPreview(''); setShowModal(true); };
  const openEdit = (c: Category) => { setEditing(c); setName(c.name); setFile(null); setPreview(c.imageUrl || ''); setShowModal(true); };

  const handleFile = (f: File | null) => {
    setFile(f);
    if (f) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(f);
    }
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('name', name);
      if (file) fd.append('image', file);
      if (editing) return api.put(`/categories/${editing.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      return api.post('/categories', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      setShowModal(false);
      toast.success(editing ? 'Categoría actualizada exitosamente.' : 'Categoría creada exitosamente.');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Error al guardar la categoría.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/categories/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); toast.success('Categoría eliminada exitosamente.'); },
    onError: () => toast.error('Error al eliminar la categoría.'),
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="section-title">Gestión de categorías</h1>
          <p className="text-dark-400 text-sm">{categories.length} categorías registradas</p>
        </div>
        <button onClick={openCreate} className="btn-primary"><Plus size={18} /> Nueva categoría</button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="card h-32 animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {categories.map((c) => (
            <motion.div key={c.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="card overflow-hidden">
              <div className="aspect-video bg-dark-800">
                {c.imageUrl ? <img src={c.imageUrl} alt={c.name} className="w-full h-full object-cover" /> : <div className="w-full h-full" />}
              </div>
              <div className="p-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-dark-100 text-sm">{c.name}</p>
                  <p className="text-xs text-dark-500">{c._count?.products || 0} productos</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(c)} className="p-1.5 hover:bg-dark-800 rounded-lg text-dark-400 hover:text-dark-200 transition-colors">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => { if (window.confirm(`¿Eliminar "${c.name}"?`)) deleteMutation.mutate(c.id); }}
                    className="p-1.5 hover:bg-dark-800 rounded-lg text-dark-400 hover:text-red-400 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/80 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="bg-dark-900 rounded-2xl border border-dark-700 w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b border-dark-800">
              <h2 className="font-bold text-dark-100">{editing ? 'Editar categoría' : 'Nueva categoría'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-dark-800 rounded-lg text-dark-400"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="label">Nombre <span className="text-gold-500">*</span></label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre de la categoría" />
              </div>
              <div>
                <label className="label">Imagen</label>
                {preview && <img src={preview} alt="" className="w-full aspect-video object-cover rounded-xl mb-2" />}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0] || null)} />
                <button type="button" onClick={() => fileRef.current?.click()} className="btn-secondary text-sm w-full">
                  <Upload size={16} /> {preview ? 'Cambiar imagen' : 'Seleccionar imagen'}
                </button>
              </div>
            </div>
            <div className="p-5 border-t border-dark-800 flex gap-3">
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={() => saveMutation.mutate()} disabled={!name || saveMutation.isPending} className="btn-primary flex-1">
                {saveMutation.isPending ? 'Guardando...' : editing ? 'Actualizar' : 'Crear'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
