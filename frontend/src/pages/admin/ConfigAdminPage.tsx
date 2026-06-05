import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Save, MessageSquare, Mail, AlertTriangle } from 'lucide-react';
import api from '../../utils/api';
import { GlobalConfig } from '../../types';
import toast from 'react-hot-toast';

export default function ConfigAdminPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ lowStockThreshold: '10', adminWhatsappNumber: '', emailFrom: '' });

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
      });
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: () => api.put('/config', {
      lowStockThreshold: Number(form.lowStockThreshold),
      adminWhatsappNumber: form.adminWhatsappNumber,
      emailFrom: form.emailFrom,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['global-config'] }); toast.success('Configuración actualizada exitosamente.'); },
    onError: () => toast.error('Error al guardar la configuración.'),
  });

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="section-title">Configuración del sistema</h1>
        <p className="text-dark-400 text-sm">Parámetros generales de la plataforma</p>
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card p-6 space-y-5">
        {/* WhatsApp */}
        <div>
          <label className="label flex items-center gap-2">
            <MessageSquare size={16} className="text-gold-500" /> Número de WhatsApp del administrador
          </label>
          <input
            value={form.adminWhatsappNumber}
            onChange={(e) => setForm((f) => ({ ...f, adminWhatsappNumber: e.target.value }))}
            placeholder="whatsapp:+5491100000000"
          />
          <p className="text-xs text-dark-500 mt-1">Formato: whatsapp:+54XXXXXXXXXX — Recibe notificaciones de nuevos pedidos</p>
        </div>

        {/* Email */}
        <div>
          <label className="label flex items-center gap-2">
            <Mail size={16} className="text-gold-500" /> Email de origen
          </label>
          <input
            value={form.emailFrom}
            onChange={(e) => setForm((f) => ({ ...f, emailFrom: e.target.value }))}
            placeholder='Varieté <noreply@variete.com>'
          />
          <p className="text-xs text-dark-500 mt-1">Nombre y dirección que verán los clientes al recibir emails</p>
        </div>

        {/* Low stock threshold */}
        <div>
          <label className="label flex items-center gap-2">
            <AlertTriangle size={16} className="text-gold-500" /> Umbral de stock bajo
          </label>
          <input
            type="number"
            value={form.lowStockThreshold}
            onChange={(e) => setForm((f) => ({ ...f, lowStockThreshold: e.target.value }))}
            min="1"
            placeholder="10"
          />
          <p className="text-xs text-dark-500 mt-1">Productos con stock igual o menor a este valor aparecerán como "stock bajo" en el dashboard</p>
        </div>

        <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="btn-primary w-full">
          <Save size={18} /> {saveMutation.isPending ? 'Guardando...' : 'Guardar configuración'}
        </button>
      </motion.div>
    </div>
  );
}
