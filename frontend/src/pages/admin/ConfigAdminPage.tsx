import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Save, MessageSquare, Mail, AlertTriangle, Award, ShieldAlert, Trash2, Lock, X } from 'lucide-react';
import api from '../../utils/api';
import { GlobalConfig } from '../../types';
import toast from 'react-hot-toast';

type ResetTarget = 'orders' | 'clients' | 'products' | 'categories' | 'cashback' | 'cities';

const RESET_OPTIONS: { id: ResetTarget; label: string; desc: string }[] = [
  { id: 'orders',     label: 'Pedidos y movimientos de beneficios', desc: 'Borra todos los pedidos, sus ítems y las transacciones de beneficios. Reinicia el saldo y la categoría de cada cliente. No borra clientes ni productos.' },
  { id: 'clients',    label: 'Clientes',                            desc: 'Borra todos los clientes junto con sus pedidos y movimientos de beneficios.' },
  { id: 'products',   label: 'Productos',                           desc: 'Borra todos los productos (e imágenes). Implica borrar también los pedidos e ítems que los referencian.' },
  { id: 'categories', label: 'Categorías',                          desc: 'Borra todas las categorías. Implica borrar también los productos y pedidos asociados.' },
  { id: 'cashback',   label: 'Reglas y beneficios',                 desc: 'Borra reglas de cashback, beneficios por nivel y transacciones. Reinicia los saldos de los clientes.' },
  { id: 'cities',     label: 'Ciudades y fechas de visita',         desc: 'Borra todas las ciudades y sus fechas de visita. Desvincula a los clientes de su ciudad.' },
];

export default function ConfigAdminPage() {
  const qc = useQueryClient();

  // ── Reseteo de datos (zona de peligro) ──────────────────────────────────
  const [resetSel, setResetSel] = useState<Record<ResetTarget, boolean>>({
    orders: false, clients: false, products: false, categories: false, cashback: false, cities: false,
  });
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetPassword, setResetPassword] = useState('');

  const selectedTargets = (Object.keys(resetSel) as ResetTarget[]).filter((k) => resetSel[k]);

  const resetMutation = useMutation({
    mutationFn: () => api.post('/admin/reset', { password: resetPassword, targets: selectedTargets }),
    onSuccess: (res) => {
      const d = res.data.deleted || {};
      const parts = Object.entries(d).map(([k, v]) => `${v} ${k}`);
      toast.success(`Reseteo completado.${parts.length ? ' Eliminados: ' + parts.join(', ') + '.' : ''}`, { duration: 6000 });
      setShowResetModal(false);
      setResetPassword('');
      setResetSel({ orders: false, clients: false, products: false, categories: false, cashback: false, cities: false });
      // Refrescar todo lo que pudo cambiar
      qc.invalidateQueries();
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Error al resetear los datos.'),
  });
  const [form, setForm] = useState({
    lowStockThreshold: '10',
    adminWhatsappNumber: '',
    emailFrom: '',
    bronzeThreshold: '1000',
    silverThreshold: '5000',
    goldThreshold: '15000',
    tierPeriodType: 'MONTHLY',
    tierGracePeriodDays: '14',
    tierGraceRetainPercent: '20',
  });

  const { data: config } = useQuery<GlobalConfig>({
    queryKey: ['global-config'],
    queryFn: () => api.get('/config').then((r) => r.data),
  });

  useEffect(() => {
    if (config) {
      setForm({
        lowStockThreshold: String(config.lowStockThreshold),
        adminWhatsappNumber: config.adminWhatsappNumber || '',
        emailFrom: config.emailFrom || '',
        bronzeThreshold: String(config.bronzeThreshold || 1000),
        silverThreshold: String(config.silverThreshold || 5000),
        goldThreshold: String(config.goldThreshold || 15000),
        tierPeriodType: config.tierPeriodType || 'MONTHLY',
        tierGracePeriodDays: String(config.tierGracePeriodDays || 14),
        tierGraceRetainPercent: String(config.tierGraceRetainPercent || 20),
      });
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: () => api.put('/config', {
      lowStockThreshold: Number(form.lowStockThreshold),
      adminWhatsappNumber: form.adminWhatsappNumber,
      emailFrom: form.emailFrom,
      bronzeThreshold: Number(form.bronzeThreshold),
      silverThreshold: Number(form.silverThreshold),
      goldThreshold: Number(form.goldThreshold),
      tierPeriodType: form.tierPeriodType,
      tierGracePeriodDays: Number(form.tierGracePeriodDays),
      tierGraceRetainPercent: Number(form.tierGraceRetainPercent),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['global-config'] });
      qc.invalidateQueries({ queryKey: ['tiers'] });
      toast.success('Configuración actualizada exitosamente.');
    },
    onError: () => toast.error('Error al guardar la configuración.'),
  });

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="section-title">Configuración del sistema</h1>
        <p className="text-dark-400 text-sm">Parámetros generales de la plataforma</p>
      </div>

      {/* General */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card p-6 space-y-5">
        <h3 className="font-semibold text-dark-200 border-b border-dark-800 pb-3">General</h3>

        <div>
          <label className="label flex items-center gap-2">
            <MessageSquare size={16} className="text-gold-500" /> Número de WhatsApp del administrador
          </label>
          <input value={form.adminWhatsappNumber} onChange={(e) => setForm((f) => ({ ...f, adminWhatsappNumber: e.target.value }))} placeholder="whatsapp:+5491100000000" />
          <p className="text-xs text-dark-500 mt-1">Formato: whatsapp:+54XXXXXXXXXX — Recibe notificaciones de nuevos pedidos</p>
        </div>

        <div>
          <label className="label flex items-center gap-2">
            <Mail size={16} className="text-gold-500" /> Email de origen
          </label>
          <input value={form.emailFrom} onChange={(e) => setForm((f) => ({ ...f, emailFrom: e.target.value }))} placeholder='Varieté <noreply@variete.com>' />
          <p className="text-xs text-dark-500 mt-1">Nombre y dirección que verán los clientes al recibir emails</p>
        </div>

        <div>
          <label className="label flex items-center gap-2">
            <AlertTriangle size={16} className="text-gold-500" /> Umbral de stock bajo
          </label>
          <input type="number" value={form.lowStockThreshold} onChange={(e) => setForm((f) => ({ ...f, lowStockThreshold: e.target.value }))} min="1" placeholder="10" />
          <p className="text-xs text-dark-500 mt-1">Productos con stock igual o menor aparecerán como alerta en el dashboard</p>
        </div>
      </motion.div>

      {/* Tiers */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card p-6 space-y-5">
        <h3 className="font-semibold text-dark-200 border-b border-dark-800 pb-3 flex items-center gap-2">
          <Award size={18} className="text-gold-500" /> Categorías de clientes
        </h3>
        <p className="text-xs text-dark-400">Los clientes se clasifican según el beneficio acumulado histórico total.</p>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label flex items-center gap-1.5">
              <span className="text-amber-600 font-bold">🥉</span> Hasta Bronce ($)
            </label>
            <input type="number" value={form.bronzeThreshold}
              onChange={(e) => setForm((f) => ({ ...f, bronzeThreshold: e.target.value }))} min="1" />
            <p className="text-xs text-dark-500 mt-1">Acumulado menor a este valor</p>
          </div>
          <div>
            <label className="label flex items-center gap-1.5">
              <span className="text-gray-300 font-bold">🥈</span> Hasta Plata ($)
            </label>
            <input type="number" value={form.silverThreshold}
              onChange={(e) => setForm((f) => ({ ...f, silverThreshold: e.target.value }))} min="1" />
            <p className="text-xs text-dark-500 mt-1">Entre Bronce y este valor</p>
          </div>
          <div>
            <label className="label flex items-center gap-1.5">
              <span className="text-yellow-400 font-bold">🥇</span> Oro desde ($)
            </label>
            <input type="number" value={form.goldThreshold}
              onChange={(e) => setForm((f) => ({ ...f, goldThreshold: e.target.value }))} min="1" />
            <p className="text-xs text-dark-500 mt-1">Acumulado mayor a este valor</p>
          </div>
        </div>

        <div className="bg-dark-800 rounded-xl p-3 text-xs text-dark-400">
          <p>Ejemplo con valores actuales:</p>
          <p className="mt-1">🥉 Bronce: &lt; ${Number(form.bronzeThreshold).toLocaleString()} &nbsp;|&nbsp; 🥈 Plata: ${Number(form.bronzeThreshold).toLocaleString()} – ${Number(form.silverThreshold).toLocaleString()} &nbsp;|&nbsp; 🥇 Oro: &gt; ${Number(form.goldThreshold).toLocaleString()}</p>
        </div>
      </motion.div>

      {/* Tier period config */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card p-6 space-y-5">
        <h3 className="font-semibold text-dark-200 border-b border-dark-800 pb-3">Período de evaluación de categorías</h3>

        <div>
          <label className="label">Período de evaluación</label>
          <select value={form.tierPeriodType} onChange={(e) => setForm((f) => ({ ...f, tierPeriodType: e.target.value }))}>
            <option value="MONTHLY">Mensual</option>
            <option value="QUARTERLY">Trimestral</option>
          </select>
          <p className="text-xs text-dark-500 mt-1">
            {form.tierPeriodType === 'MONTHLY'
              ? 'Las categorías se evalúan mes a mes según el gasto del mes anterior.'
              : 'Las categorías se evalúan cada trimestre según el gasto del trimestre anterior.'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Período de gracia Oro (días)</label>
            <input type="number" value={form.tierGracePeriodDays}
              onChange={(e) => setForm((f) => ({ ...f, tierGracePeriodDays: e.target.value }))} min="1" max="30" />
            <p className="text-xs text-dark-500 mt-1">Días al inicio del nuevo período donde un cliente Oro puede retener su categoría con una compra</p>
          </div>
          <div>
            <label className="label">Compra mínima para retener Oro (%)</label>
            <input type="number" value={form.tierGraceRetainPercent}
              onChange={(e) => setForm((f) => ({ ...f, tierGraceRetainPercent: e.target.value }))} min="1" max="100" />
            <p className="text-xs text-dark-500 mt-1">% del gasto del período anterior que debe alcanzar para mantener Oro</p>
          </div>
        </div>

        <div className="bg-dark-800 rounded-xl p-4 text-xs text-dark-400 space-y-1.5 leading-relaxed">
          <p className="text-dark-300 font-medium">¿Cómo funciona?</p>
          <p>🥇 <strong>Oro:</strong> Al terminar el período, tiene {form.tierGracePeriodDays} días para hacer una compra ≥ {form.tierGraceRetainPercent}% de lo gastado el período anterior. Si lo hace → mantiene Oro ese período + el siguiente completo. Luego se recalcula.</p>
          <p>🥈 <strong>Plata / 🥉 Bronce:</strong> Se recalcula automáticamente cada período según el gasto del período anterior.</p>
        </div>
      </motion.div>

      <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="btn-primary w-full">
        <Save size={18} /> {saveMutation.isPending ? 'Guardando...' : 'Guardar configuración'}
      </button>

      {/* ── Zona de peligro: reseteo de datos ──────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="card p-6 space-y-4 border-red-700/40 bg-red-950/10">
        <div className="border-b border-red-900/40 pb-3">
          <h3 className="font-semibold text-red-300 flex items-center gap-2">
            <ShieldAlert size={18} className="text-red-400" /> Zona de peligro — Reseteo de datos
          </h3>
          <p className="text-xs text-dark-400 mt-1">
            Elimina permanentemente los datos seleccionados para empezar de cero. Esta acción no se puede deshacer y pedirá su contraseña.
          </p>
        </div>

        <div className="space-y-2">
          {RESET_OPTIONS.map((opt) => (
            <label key={opt.id}
              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                resetSel[opt.id] ? 'border-red-600/50 bg-red-950/30' : 'border-dark-700 hover:border-dark-600'
              }`}>
              <input
                type="checkbox"
                checked={resetSel[opt.id]}
                onChange={(e) => setResetSel((s) => ({ ...s, [opt.id]: e.target.checked }))}
                className="w-4 h-4 mt-0.5 accent-red-500 flex-shrink-0"
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-dark-100">{opt.label}</p>
                <p className="text-xs text-dark-500 leading-relaxed">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>

        <button
          onClick={() => setShowResetModal(true)}
          disabled={selectedTargets.length === 0}
          className="w-full flex items-center justify-center gap-2 bg-red-700 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-lg transition-colors active:scale-95"
        >
          <Trash2 size={18} /> Resetear datos seleccionados
          {selectedTargets.length > 0 && <span className="bg-red-900/60 rounded-full px-2 py-0.5 text-xs">{selectedTargets.length}</span>}
        </button>
      </motion.div>

      {/* ── Modal de confirmación ──────────────────────────────────────────── */}
      <AnimatePresence>
        {showResetModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/85 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-dark-900 rounded-2xl border border-red-700/50 w-full max-w-md"
            >
              <div className="flex items-center justify-between p-5 border-b border-dark-800">
                <h2 className="font-bold text-red-300 flex items-center gap-2">
                  <ShieldAlert size={18} className="text-red-400" /> Confirmar reseteo
                </h2>
                <button onClick={() => { setShowResetModal(false); setResetPassword(''); }}
                  className="p-2 hover:bg-dark-800 rounded-lg text-dark-400">
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <p className="text-sm text-dark-300">
                  Estás por eliminar permanentemente:
                </p>
                <ul className="space-y-1.5">
                  {selectedTargets.map((t) => {
                    const opt = RESET_OPTIONS.find((o) => o.id === t)!;
                    return (
                      <li key={t} className="flex items-center gap-2 text-sm text-red-300 bg-red-950/30 border border-red-800/40 rounded-lg px-3 py-2">
                        <Trash2 size={13} className="flex-shrink-0" /> {opt.label}
                      </li>
                    );
                  })}
                </ul>
                <p className="text-xs text-amber-400 bg-amber-950/20 border border-amber-700/30 rounded-lg p-2.5">
                  ⚠️ Esta acción es irreversible. Verificá bien antes de continuar.
                </p>

                <div>
                  <label className="label flex items-center gap-1.5">
                    <Lock size={13} className="text-red-400" /> Ingresá tu contraseña de administrador
                  </label>
                  <input
                    type="password"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && resetPassword) resetMutation.mutate(); }}
                    placeholder="Contraseña"
                    autoFocus
                  />
                </div>
              </div>

              <div className="p-5 border-t border-dark-800 flex gap-3">
                <button onClick={() => { setShowResetModal(false); setResetPassword(''); }} className="btn-secondary flex-1">
                  Cancelar
                </button>
                <button
                  onClick={() => resetMutation.mutate()}
                  disabled={!resetPassword || resetMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-700 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-lg transition-colors active:scale-95"
                >
                  <Trash2 size={16} /> {resetMutation.isPending ? 'Eliminando...' : 'Eliminar definitivamente'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
