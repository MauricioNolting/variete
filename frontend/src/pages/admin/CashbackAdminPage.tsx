import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, Trash2, ToggleLeft, ToggleRight, X, Settings, CalendarRange, Timer } from 'lucide-react';
import api from '../../utils/api';
import { CashbackRule, CashbackRuleType, Category, Product, GlobalCashbackConfig } from '../../types';
import { formatCurrency, CASHBACK_TYPE_LABELS } from '../../utils/format';
import toast from 'react-hot-toast';

const RULE_TYPES: CashbackRuleType[] = ['GLOBAL', 'MIN_AMOUNT', 'DATE_RANGE', 'SPECIFIC_DATE', 'CATEGORY', 'PRODUCT'];

interface RuleForm {
  type: CashbackRuleType;
  percentage: string;
  minAmount: string;
  startDate: string;
  endDate: string;
  specificDates: string;
  categoryId: string;
  productId: string;
  expiryDays: string;
}

const emptyForm: RuleForm = {
  type: 'GLOBAL', percentage: '', minAmount: '', startDate: '', endDate: '',
  specificDates: '', categoryId: '', productId: '', expiryDays: '',
};

function formatShortDate(d: string | Date | null | undefined): string {
  if (!d) return '?';
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function CashbackAdminPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<RuleForm>(emptyForm);
  const [configOpen, setConfigOpen] = useState(false);

  const { data: rules = [] } = useQuery<CashbackRule[]>({
    queryKey: ['cashback-rules'],
    queryFn: () => api.get('/cashback/rules').then((r) => r.data),
  });

  const { data: config } = useQuery<GlobalCashbackConfig>({
    queryKey: ['cashback-config'],
    queryFn: () => api.get('/cashback/config').then((r) => r.data),
  });

  const { data: summary } = useQuery({
    queryKey: ['cashback-summary'],
    queryFn: () => api.get('/cashback/summary').then((r) => r.data),
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then((r) => r.data),
  });

  const { data: productsData } = useQuery({
    queryKey: ['products-admin'],
    queryFn: () => api.get('/products/admin/all').then((r) => r.data),
  });
  const products: Product[] = productsData || [];

  const createMutation = useMutation({
    mutationFn: () => api.post('/cashback/rules', {
      type: form.type,
      percentage: Number(form.percentage),
      minAmount: form.minAmount ? Number(form.minAmount) : undefined,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      specificDates: form.specificDates ? form.specificDates.split(',').map((d) => d.trim()) : undefined,
      categoryId: form.categoryId ? Number(form.categoryId) : undefined,
      productId: form.productId ? Number(form.productId) : undefined,
      expiryDays: form.expiryDays ? Number(form.expiryDays) : undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cashback-rules'] });
      setShowModal(false);
      toast.success('Regla de beneficios creada exitosamente.');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Error al crear la regla.'),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/cashback/rules/${id}/toggle`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cashback-rules'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/cashback/rules/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cashback-rules'] });
      toast.success('Regla eliminada exitosamente.');
    },
  });

  const [configForm, setConfigForm] = useState({
    stackRules: false, maxPercentage: '', maxAmount: '', balanceExpiryDays: '',
  });

  const configMutation = useMutation({
    mutationFn: () => api.put('/cashback/config', {
      stackRules: configForm.stackRules,
      maxPercentage: configForm.maxPercentage ? Number(configForm.maxPercentage) : null,
      maxAmount: configForm.maxAmount ? Number(configForm.maxAmount) : null,
      balanceExpiryDays: configForm.balanceExpiryDays ? Number(configForm.balanceExpiryDays) : null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cashback-config'] });
      toast.success('Configuración actualizada.');
      setConfigOpen(false);
    },
  });

  const openConfig = () => {
    setConfigForm({
      stackRules: config?.stackRules || false,
      maxPercentage: config?.maxPercentage ? String(config.maxPercentage) : '',
      maxAmount: (config as any)?.maxAmount ? String((config as any).maxAmount) : '',
      balanceExpiryDays: config?.balanceExpiryDays ? String(config.balanceExpiryDays) : '',
    });
    setConfigOpen(true);
  };

  // Human-readable description of a rule's type-specific condition
  const describeCondition = (rule: CashbackRule): string => {
    switch (rule.type) {
      case 'GLOBAL':        return 'Aplica a todas las compras';
      case 'MIN_AMOUNT':    return `Compras superiores a ${formatCurrency(rule.minAmount || 0)}`;
      case 'DATE_RANGE':    return `Del ${formatShortDate(rule.startDate)} al ${formatShortDate(rule.endDate)}`;
      case 'SPECIFIC_DATE': return `Días específicos: ${(rule.specificDates || []).join(', ')}`;
      case 'CATEGORY':      return `Categoría: ${rule.category?.name}`;
      case 'PRODUCT':       return `Producto: ${rule.product?.name}`;
      default:              return '';
    }
  };

  // Validity window label (for non-DATE_RANGE rules that have dates)
  const validityLabel = (rule: CashbackRule): string | null => {
    if (rule.type === 'DATE_RANGE') return null; // already shown in condition
    if (!rule.startDate && !rule.endDate) return null;
    if (rule.startDate && rule.endDate)
      return `Vigencia: ${formatShortDate(rule.startDate)} → ${formatShortDate(rule.endDate)}`;
    if (rule.startDate)
      return `Desde: ${formatShortDate(rule.startDate)}`;
    return `Hasta: ${formatShortDate(rule.endDate)}`;
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="section-title">Programa de beneficios</h1>
          <p className="text-dark-400 text-sm">Configuración de reglas de cashback</p>
        </div>
        <div className="flex gap-2">
          <button onClick={openConfig} className="btn-secondary text-sm">
            <Settings size={16} /> Configuración
          </button>
          <button onClick={() => { setForm(emptyForm); setShowModal(true); }} className="btn-primary text-sm">
            <Plus size={16} /> Nueva regla
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Saldo emitido total',  value: formatCurrency(summary?.totalEmitted || 0) },
          { label: 'Saldo utilizado total', value: formatCurrency(summary?.totalUsed || 0) },
          { label: 'Saldo pendiente',       value: formatCurrency(summary?.pendingBalance || 0) },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <p className="text-xs text-dark-500 uppercase tracking-wide">{s.label}</p>
            <p className="text-xl font-bold text-dark-50">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Current config pill */}
      {config && (
        <div className="card p-4 flex items-center gap-6 text-sm text-dark-400 flex-wrap">
          <span>
            Acumulación:{' '}
            <strong className={config.stackRules ? 'text-gold-400' : 'text-dark-300'}>
              {config.stackRules ? 'Activada' : 'Desactivada'}
            </strong>
          </span>
          {config.stackRules && config.maxPercentage && (
            <span>Tope máximo: <strong className="text-dark-200">{config.maxPercentage}%</strong></span>
          )}
          <span>
            Vencimiento del saldo:{' '}
            <strong className="text-dark-200">
              {config.balanceExpiryDays ? `${config.balanceExpiryDays} días` : 'Sin vencimiento'}
            </strong>
          </span>
        </div>
      )}

      {/* Rules list */}
      <div className="space-y-3">
        {rules.map((rule) => {
          const validity = validityLabel(rule);
          return (
            <motion.div
              key={rule.id}
              layout
              className={`card p-4 flex items-center justify-between ${!rule.isActive ? 'opacity-60' : ''}`}
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-14 h-14 bg-gold-600/20 rounded-xl flex flex-col items-center justify-center flex-shrink-0">
                  <span className="text-xl font-black text-gold-400">{rule.percentage}%</span>
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-dark-100">{CASHBACK_TYPE_LABELS[rule.type]}</p>
                  <p className="text-sm text-dark-400">{describeCondition(rule)}</p>
                  {validity && (
                    <p className="text-xs text-amber-500 flex items-center gap-1 mt-0.5">
                      <CalendarRange size={11} /> {validity}
                    </p>
                  )}
                  {rule.expiryDays && (
                    <p className="text-xs text-sky-400 flex items-center gap-1 mt-0.5">
                      <Timer size={11} /> Saldo vence a los {rule.expiryDays} días de la compra
                    </p>
                  )}
                  <span className={rule.isActive ? 'badge-green mt-1' : 'badge-red mt-1'}>
                    {rule.isActive ? 'Activa' : 'Inactiva'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => toggleMutation.mutate(rule.id)}
                  className="p-2 hover:bg-dark-800 rounded-lg text-dark-400 hover:text-dark-200 transition-colors"
                >
                  {rule.isActive
                    ? <ToggleRight size={20} className="text-emerald-400" />
                    : <ToggleLeft size={20} />}
                </button>
                <button
                  onClick={() => { if (window.confirm('¿Eliminar esta regla?')) deleteMutation.mutate(rule.id); }}
                  className="p-2 hover:bg-dark-800 rounded-lg text-dark-400 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ── Create rule modal ─────────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/80 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-dark-900 rounded-2xl border border-dark-700 w-full max-w-md max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between p-5 border-b border-dark-800">
              <h2 className="font-bold text-dark-100">Nueva regla de beneficios</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-dark-800 rounded-lg text-dark-400">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Type */}
              <div>
                <label className="label">Tipo de regla</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as CashbackRuleType }))}
                >
                  {RULE_TYPES.map((t) => <option key={t} value={t}>{CASHBACK_TYPE_LABELS[t]}</option>)}
                </select>
              </div>

              {/* Percentage */}
              <div>
                <label className="label">Porcentaje de beneficio (%)</label>
                <input
                  type="number"
                  value={form.percentage}
                  onChange={(e) => setForm((f) => ({ ...f, percentage: e.target.value }))}
                  placeholder="5"
                  min="0" max="100" step="0.1"
                />
              </div>

              {/* Type-specific fields */}
              {form.type === 'MIN_AMOUNT' && (
                <div>
                  <label className="label">Monto mínimo de compra</label>
                  <input
                    type="number"
                    value={form.minAmount}
                    onChange={(e) => setForm((f) => ({ ...f, minAmount: e.target.value }))}
                    placeholder="10000"
                  />
                </div>
              )}

              {form.type === 'DATE_RANGE' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Fecha inicio</label>
                    <input
                      type="date"
                      value={form.startDate}
                      onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label">Fecha fin</label>
                    <input
                      type="date"
                      value={form.endDate}
                      onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                    />
                  </div>
                </div>
              )}

              {form.type === 'SPECIFIC_DATE' && (
                <div>
                  <label className="label">Fechas específicas (separadas por coma)</label>
                  <input
                    value={form.specificDates}
                    onChange={(e) => setForm((f) => ({ ...f, specificDates: e.target.value }))}
                    placeholder="2024-07-20, 2024-07-21"
                  />
                </div>
              )}

              {form.type === 'CATEGORY' && (
                <div>
                  <label className="label">Categoría</label>
                  <select
                    value={form.categoryId}
                    onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                  >
                    <option value="">Seleccionar categoría</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}

              {form.type === 'PRODUCT' && (
                <div>
                  <label className="label">Producto</label>
                  <select
                    value={form.productId}
                    onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))}
                  >
                    <option value="">Seleccionar producto</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}

              {/* ── Validity window — for all non-DATE_RANGE types ─────────── */}
              {form.type !== 'DATE_RANGE' && (
                <div className="border border-dark-700 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <CalendarRange size={15} className="text-amber-400" />
                    <p className="text-sm font-medium text-dark-200">Vigencia de la regla <span className="text-dark-500 font-normal">(opcional)</span></p>
                  </div>
                  <p className="text-xs text-dark-500 -mt-1">
                    Si se especifica, la regla solo aplicará dentro de este período de fechas.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Válida desde</label>
                      <input
                        type="date"
                        value={form.startDate}
                        onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="label">Válida hasta</label>
                      <input
                        type="date"
                        value={form.endDate}
                        onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ── Expiry days for earned cashback ──────────────────────────── */}
              <div className="border border-dark-700 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Timer size={15} className="text-sky-400" />
                  <p className="text-sm font-medium text-dark-200">Vencimiento del saldo ganado <span className="text-dark-500 font-normal">(opcional)</span></p>
                </div>
                <p className="text-xs text-dark-500 -mt-1">
                  El beneficio que acumula el cliente en cada compra vencerá a los N días desde esa compra.
                  Si se deja vacío, se usa la configuración global del programa (o sin vencimiento si tampoco está configurada).
                </p>
                <div>
                  <label className="label">Días de vigencia del saldo</label>
                  <input
                    type="number"
                    value={form.expiryDays}
                    onChange={(e) => setForm((f) => ({ ...f, expiryDays: e.target.value }))}
                    placeholder="Ej: 30 (dejar vacío para usar configuración global)"
                    min="1"
                  />
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-dark-800 flex gap-3">
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
              <button
                onClick={() => createMutation.mutate()}
                disabled={!form.percentage || createMutation.isPending}
                className="btn-primary flex-1"
              >
                Crear regla
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Config modal ──────────────────────────────────────────────────────── */}
      {configOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/80 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-dark-900 rounded-2xl border border-dark-700 w-full max-w-sm"
          >
            <div className="flex items-center justify-between p-5 border-b border-dark-800">
              <h2 className="font-bold text-dark-100">Configuración del programa</h2>
              <button onClick={() => setConfigOpen(false)} className="p-2 hover:bg-dark-800 rounded-lg text-dark-400">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={configForm.stackRules}
                  onChange={(e) => setConfigForm((f) => ({ ...f, stackRules: e.target.checked }))}
                  className="w-4 h-4"
                />
                <div>
                  <p className="text-sm font-medium text-dark-200">Modo acumulación de reglas</p>
                  <p className="text-xs text-dark-500">Los porcentajes de múltiples reglas se suman</p>
                </div>
              </label>
              {configForm.stackRules && (
                <div>
                  <label className="label">Porcentaje máximo acumulable (%)</label>
                  <input
                    type="number"
                    value={configForm.maxPercentage}
                    onChange={(e) => setConfigForm((f) => ({ ...f, maxPercentage: e.target.value }))}
                    placeholder="Ej: 20 (sin límite si se deja vacío)"
                  />
                </div>
              )}
              <div>
                <label className="label">Monto máximo de beneficio por compra ($)</label>
                <input
                  type="number"
                  value={configForm.maxAmount}
                  onChange={(e) => setConfigForm((f) => ({ ...f, maxAmount: e.target.value }))}
                  placeholder="Ej: 2000 (sin límite si se deja vacío)"
                />
                <p className="text-xs text-dark-500 mt-1">El beneficio por pedido nunca superará este monto</p>
              </div>
              <div>
                <label className="label">Días de vigencia del saldo ganado</label>
                <input
                  type="number"
                  value={configForm.balanceExpiryDays}
                  onChange={(e) => setConfigForm((f) => ({ ...f, balanceExpiryDays: e.target.value }))}
                  placeholder="Sin vencimiento"
                  min="1"
                />
                <p className="text-xs text-dark-500 mt-1">
                  El saldo ganado en cada compra vencerá después de estos días. Dejar vacío para sin vencimiento.
                </p>
              </div>
            </div>
            <div className="p-5 border-t border-dark-800 flex gap-3">
              <button onClick={() => setConfigOpen(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={() => configMutation.mutate()} disabled={configMutation.isPending} className="btn-primary flex-1">
                Guardar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
