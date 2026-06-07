import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';
import api from '../utils/api';
import { useAuthStore } from '../store/auth';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      toast.error('Complete todos los campos requeridos.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/auth/client/login', form);
      setAuth('client', res.data.client, null, res.data.token);
      toast.success('Sesión iniciada exitosamente.');
      navigate('/');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold tracking-widest text-gold-500 uppercase mb-2">Varieté</h1>
          <h2 className="text-xl font-bold text-dark-100">Iniciar sesión</h2>
          <p className="text-dark-400 text-sm mt-1">Ingrese con el correo y contraseña de su cuenta</p>
        </div>

        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Correo electrónico</label>
              <input
                type="email"
                placeholder="correo@ejemplo.com"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="label">Contraseña</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  placeholder="Su contraseña"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  required
                  className="pr-10"
                />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-200">
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? 'Verificando...' : 'Iniciar sesión'}
            </button>
          </form>

          <div className="mt-4 text-center text-sm text-dark-400">
            ¿No tiene cuenta?{' '}
            <Link to="/registro" className="text-gold-500 hover:text-gold-400 font-medium">
              Registre su establecimiento
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
