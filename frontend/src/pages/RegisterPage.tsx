import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import api from '../utils/api';
import { useAuthStore } from '../store/auth';
import { City } from '../types';
import toast from 'react-hot-toast';

const COUNTRY_PREFIXES = [
  { code: '+54', label: 'Argentina (+54)' },
  { code: '+598', label: 'Uruguay (+598)' },
  { code: '+56', label: 'Chile (+56)' },
  { code: '+55', label: 'Brasil (+55)' },
  { code: '+591', label: 'Bolivia (+591)' },
  { code: '+595', label: 'Paraguay (+595)' },
];

export default function RegisterPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [form, setForm] = useState({
    localName: '',
    address: '',
    cityId: '',
    prefix: '+54',
    phoneNumber: '',
    email: '',
  });
  const [loading, setLoading] = useState(false);

  const { data: cities = [] } = useQuery<City[]>({
    queryKey: ['cities-public'],
    queryFn: () => api.get('/cities').then((r) => r.data),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.localName || !form.address || !form.cityId || !form.phoneNumber) {
      toast.error('Complete todos los campos obligatorios.');
      return;
    }
    const phone = `${form.prefix}${form.phoneNumber.replace(/\s/g, '')}`;
    setLoading(true);
    try {
      const res = await api.post('/auth/client/register', {
        localName: form.localName,
        address: form.address,
        cityId: form.cityId,
        phone,
        email: form.email || undefined,
      });
      setAuth('client', res.data.client, null, res.data.token);
      toast.success('Registro completado exitosamente.');
      navigate('/');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al registrarse.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold tracking-widest text-gold-500 uppercase mb-2">Varieté</h1>
          <h2 className="text-xl font-bold text-dark-100">Registro de establecimiento</h2>
          <p className="text-dark-400 text-sm mt-1">Complete los datos de su establecimiento para comenzar</p>
        </div>

        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Nombre del establecimiento <span className="text-gold-500">*</span></label>
              <input type="text" placeholder="Nombre exacto de su comercio" value={form.localName}
                onChange={(e) => setForm((f) => ({ ...f, localName: e.target.value }))} required />
            </div>

            <div>
              <label className="label">Domicilio del establecimiento <span className="text-gold-500">*</span></label>
              <input type="text" placeholder="Calle, número, localidad" value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} required />
            </div>

            <div>
              <label className="label">Ciudad <span className="text-gold-500">*</span></label>
              <select value={form.cityId} onChange={(e) => setForm((f) => ({ ...f, cityId: e.target.value }))} required>
                <option value="">Seleccione una ciudad</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Número de teléfono <span className="text-gold-500">*</span></label>
              <div className="flex gap-2">
                <select value={form.prefix} onChange={(e) => setForm((f) => ({ ...f, prefix: e.target.value }))}
                  className="w-44 flex-shrink-0">
                  {COUNTRY_PREFIXES.map((p) => (
                    <option key={p.code} value={p.code}>{p.label}</option>
                  ))}
                </select>
                <input type="tel" placeholder="9 11 0000-0000" value={form.phoneNumber}
                  onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))} required />
              </div>
            </div>

            <div>
              <label className="label">Correo electrónico <span className="text-dark-500">(opcional)</span></label>
              <input type="email" placeholder="correo@ejemplo.com" value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              <p className="text-xs text-dark-500 mt-1">Permite recibir confirmaciones de pedidos por email</p>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? 'Registrando...' : 'Completar registro'}
            </button>
          </form>

          <div className="mt-4 text-center text-sm text-dark-400">
            ¿Ya tiene cuenta?{' '}
            <Link to="/login" className="text-gold-500 hover:text-gold-400 font-medium">
              Iniciar sesión
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
