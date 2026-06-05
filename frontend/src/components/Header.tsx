import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, LogOut, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { useCartStore } from '../store/cart';
import { useAuthStore } from '../store/auth';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function Header() {
  const { getTotalItems, toggleCart, isOpen } = useCartStore();
  const { role, client, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const totalItems = getTotalItems();

  const handleLogout = async () => {
    if (!window.confirm('¿Confirma que desea cerrar sesión?')) return;
    await api.post('/auth/logout').catch(() => {});
    clearAuth();
    navigate('/login');
    toast.success('Sesión cerrada exitosamente.');
  };

  return (
    <header className="sticky top-0 z-50 bg-dark-950/95 backdrop-blur-sm border-b border-dark-800">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-2xl font-extrabold tracking-widest text-gold-500 uppercase">Varieté</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          <Link to="/" className="text-dark-300 hover:text-dark-100 text-sm font-medium transition-colors">Inicio</Link>
          <Link to="/catalogo" className="text-dark-300 hover:text-dark-100 text-sm font-medium transition-colors">Catálogo</Link>
          {role === 'client' && (
            <Link to="/perfil" className="text-dark-300 hover:text-dark-100 text-sm font-medium transition-colors">Mi cuenta</Link>
          )}
        </nav>

        <div className="flex items-center gap-3">
          {role === 'client' && (
            <>
              <span className="hidden md:block text-sm text-dark-400 max-w-[160px] truncate">
                {client?.localName}
              </span>
              <button
                onClick={toggleCart}
                className="relative p-2.5 text-dark-300 hover:text-gold-500 hover:bg-dark-800 rounded-lg transition-all"
              >
                <ShoppingCart size={22} />
                {totalItems > 0 && (
                  <motion.span
                    key={totalItems}
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-0.5 -right-0.5 bg-gold-600 text-dark-950 text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center"
                  >
                    {totalItems > 9 ? '9+' : totalItems}
                  </motion.span>
                )}
              </button>
              <button onClick={handleLogout} className="p-2.5 text-dark-400 hover:text-dark-200 hover:bg-dark-800 rounded-lg transition-all">
                <LogOut size={18} />
              </button>
            </>
          )}

          {role === 'admin' && (
            <div className="flex items-center gap-3">
              <Link to="/admin" className="text-sm font-medium text-gold-500 hover:text-gold-400 transition-colors">
                Panel Admin
              </Link>
              <button onClick={handleLogout} className="p-2.5 text-dark-400 hover:text-dark-200 hover:bg-dark-800 rounded-lg transition-all">
                <LogOut size={18} />
              </button>
            </div>
          )}

          {!role && (
            <div className="flex items-center gap-2">
              <Link to="/login" className="btn-ghost text-sm px-4 py-2">Iniciar sesión</Link>
              <Link to="/registro" className="btn-primary text-sm px-4 py-2">Registrarse</Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
