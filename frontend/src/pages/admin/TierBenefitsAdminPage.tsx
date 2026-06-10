import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, Pencil, Trash2, Star, Timer } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';

interface TierBenefit {
  id: number;
  tier: 'BRONZE' | 'SILVER' | 'GOLD';
  title: string;
  percentage?: number;
  description?: string;
  expiryDays?: number;
  isActive: boolean;
}

const TIER_OPTIONS = [
  { value: 'BRONZE', label: '🥉 Bronce', color: 'text-amber-600' },
  { value: 'SILVER', label: '🥈 Plata', color: 'text-gray-300' },
  { value: 'GOLD',   label: '🥇 Oro',   color: 'text-yellow-400' },
];

const emptyForm = { tier: 'BRONZE', title: '', percentage: '', description: '', expiryDays: '' };

export default function TierBenefitsAdminPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<typeof emptyForm>({ ...emptyForm });

  const { data: benefits = [], isLoading } = useQuery<TierBenefit[]>({
    queryKey: ['tier-benefits-admin'],
    queryFn: () => api.get('/cashback/tier-benefits/admin').then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/cashback/tier-benefits', {
      tier: form.tier,
      title: form.title,
      percentage: form.percentage ? Number(form.percentage) : undefined,
      description: form.description || undefined,
      expiryDays: form.expiryDays ? Number(form.expiryDays) : undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tier-benefits-admin'] });
      setForm({ ...emptyForm });
      setShowForm(false);
      toast.success('Beneficio creado exitosamente.');
    },
    onError: () => toast.error('Error al crear el beneficio.'),
  });

  const updateMutation = useMutation({
    mutationFn: (id: number) => api.put(`/cashback/tier-benefits/${id}`, {
      tier: form.tier,
      title: form.title,
      percentage: form.percentage ? Number(form.percentage) : null,
      description: form.description || null,
      expiryDays: form.expiryDays ? Number(form.expiryDays) : null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tier-benefits-admin'] });
      setEditingId(null);
      setForm({ ...emptyForm });
      toast.success('Beneficio actualizado.');
    },
    onError: () => toast.error('Error al actualizar el beneficio.'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      api.put(`/cashback/tier-benefits/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tier-benefits-admin'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/cashback/tier-benefits/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tier-benefits-admin'] });
      toast.success('Beneficio eliminado.');
    },
    onError: () => toast.error('Error al eliminar el beneficio.'),
  });

  const handleEdit = (b: TierBenefit) => {
    setEditingId(b.id);
    setForm({ tier: b.tier, title: b.title, percentage: b.percentage?.toString() || '', description: b.description || '', expiryDays: b.expiryDays?.toString() || '' });
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (!form.title) { toast.error('El título es requerido.'); return; }
    if (editingId) {
      updateMutation.mutate(editingId);
    } else {
      createMutation.mutate();
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyForm });
  };

  const groupedByTier = {
    GOLD:   benefits.filter((b) => b.tier === 'GOLD'),
    SILVER: benefits.filter((b) => b.tier === 'SILVER'),
    BRONZE: benefits.filter((b) => b.tier === 'BRONZE'),
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="section-title flex items-center gap-2">
            <Star size={22} className="text-gold-500" /> Beneficios por categoría
          </h1>
          <p className="text-dark-400 text-sm mt-1">
            Defina los beneficios exclusivos de cada categoría. Los clientes Bronce ven todos, Plata ve Plata+Oro, Oro solo ve Oro.
          </p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Nuevo
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="card p-5 space-y-4 border-gold-600/30">
          <h3 className="font-semibold text-dark-100">{editingId ? 'Editar beneficio' : 'Nuevo beneficio'}</h3>

          <div>
            <label className="label">Categoría</label>
            <select value={form.tier} onChange={(e) => setForm((f) => ({ ...f, tier: e.target.value }))}>
              {TIER_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Título del beneficio</label>
            <input type="text" placeholder="Ej: Descuento exclusivo en productos seleccionados"
              value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </div>

          <div>
            <label className="label">Porcentaje (opcional)</label>
            <input type="number" placeholder="Ej: 5" min="0" max="100" step="0.5"
              value={form.percentage} onChange={(e) => setForm((f) => ({ ...f, percentage: e.target.value }))} />
            <p className="text-xs text-dark-500 mt-1">Si aplica. Se mostrará como "beneficio del X%"</p>
          </div>

          <div>
            <label className="label">Descripción adicional (opcional)</label>
            <textarea rows={2} placeholder="Detalles adicionales del beneficio..."
              value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="resize-none" />
          </div>

          <div>
            <label className="label flex items-center gap-1.5">
              <Timer size={13} className="text-sky-400" /> Vencimiento del saldo ganado (opcional)
            </label>
            <input type="number" placeholder="Ej: 30 (días)" min="1"
              value={form.expiryDays} onChange={(e) => setForm((f) => ({ ...f, expiryDays: e.target.value }))} />
            <p className="text-xs text-dark-500 mt-1">
              El beneficio que el cliente acumule por esta categoría vencerá a los N días desde la compra. Vacío = sin vencimiento propio (usa la configuración global).
            </p>
          </div>

          <div className="flex gap-3">
            <button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}
              className="btn-primary flex-1">
              {createMutation.isPending || updateMutation.isPending ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear beneficio'}
            </button>
            <button onClick={handleCancel} className="btn-secondary">Cancelar</button>
          </div>
        </motion.div>
      )}

      {/* List grouped by tier */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="card h-20 animate-pulse" />)}
        </div>
      ) : benefits.length === 0 ? (
        <div className="card p-12 text-center text-dark-500">
          <Star size={40} className="mx-auto mb-3 opacity-20" />
          <p>No hay beneficios configurados aún.</p>
          <p className="text-xs mt-1">Cree el primero con el botón "Nuevo".</p>
        </div>
      ) : (
        <div className="space-y-6">
          {(['GOLD', 'SILVER', 'BRONZE'] as const).map((tierKey) => {
            const tierBenefits = groupedByTier[tierKey];
            if (tierBenefits.length === 0) return null;
            const tierMeta = TIER_OPTIONS.find((t) => t.value === tierKey)!;
            return (
              <div key={tierKey}>
                <h3 className={`text-sm font-bold uppercase tracking-wide mb-3 ${tierMeta.color}`}>{tierMeta.label}</h3>
                <div className="space-y-2">
                  {tierBenefits.map((b) => (
                    <div key={b.id} className={`card p-4 flex items-start justify-between gap-4 ${!b.isActive ? 'opacity-50' : ''}`}>
                      <div className="min-w-0">
                        <p className="font-medium text-dark-100 text-sm">
                          {b.title}
                          {b.percentage && (
                            <span className={`ml-2 font-bold ${tierMeta.color}`}>{b.percentage}%</span>
                          )}
                        </p>
                        {b.description && <p className="text-xs text-dark-400 mt-0.5">{b.description}</p>}
                        {b.expiryDays && (
                          <p className="text-xs text-sky-400 flex items-center gap-1 mt-1">
                            <Timer size={11} /> Saldo vence a los {b.expiryDays} días de la compra
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => toggleMutation.mutate({ id: b.id, isActive: !b.isActive })}
                          className={`text-xs px-2 py-1 rounded-lg transition-colors ${b.isActive ? 'bg-emerald-900/40 text-emerald-400' : 'bg-dark-800 text-dark-500'}`}
                        >
                          {b.isActive ? 'Activo' : 'Inactivo'}
                        </button>
                        <button onClick={() => handleEdit(b)} className="p-1.5 text-dark-400 hover:text-gold-400 transition-colors">
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => { if (window.confirm('¿Eliminar este beneficio?')) deleteMutation.mutate(b.id); }}
                          className="p-1.5 text-dark-400 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
