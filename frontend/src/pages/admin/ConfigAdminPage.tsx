import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Save, MessageSquare, Mail, AlertTriangle, Award } from 'lucide-react';
import api from '../../utils/api';
import { GlobalConfig } from '../../types';
import toast from 'react-hot-toast';

export default function ConfigAdminPage() {
  const qc = useQueryClient();
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
    </div>
  );
}
