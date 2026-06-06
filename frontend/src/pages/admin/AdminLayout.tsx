import { Link, useLocation, Outlet } from 'react-router-dom';
import { LayoutDashboard, Package, Grid, MapPin, Gift, Settings, Users, ShoppingBag, LogOut, TrendingUp } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import toast from 'react-hot-toast';

const navItems = [
  { path: '/admin', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { path: '/admin/pedidos', icon: ShoppingBag, label: 'Pedidos' },
  { path: '/admin/facturacion', icon: TrendingUp, label: 'Facturación' },
  { path: '/admin/productos', icon: Package, label: 'Productos' },
  { path: '/admin/categorias', icon: Grid, label: 'Categorías' },
  { path: '/admin/ciudades', icon: MapPin, label: 'Ciudades' },
  { path: '/admin/cashback', icon: Gift, label: 'Beneficios' },
  { path: '/admin/clientes', icon: Users, label: 'Clientes' },
  { path: '/admin/configuracion', icon: Settings, label: 'Configuración' },
];

export default function AdminLayout() {
  const location = useLocation();
  const { clearAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    if (!window.confirm('¿Confirma que desea cerrar sesión?')) return;
    await api.post('/auth/logout').catch(() => {});
    clearAuth();
    navigate('/admin/login');
    toast.success('Sesión cerrada exitosamente.');
  };

  const isActive = (path: string, exact?: boolean) => {
    if (exact) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 z-40 w-56 bg-dark-900 border-r border-dark-800 flex flex-col hidden md:flex">
        <div className="p-5 border-b border-dark-800">
          <span className="text-xl font-extrabold tracking-widest text-gold-500 uppercase">Varieté</span>
          <p className="text-xs text-dark-500 mt-0.5">Panel de administración</p>
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ path, icon: Icon, label, exact }) => (
            <Link
              key={path}
              to={path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive(path, exact)
                  ? 'bg-gold-600/20 text-gold-400 border border-gold-600/30'
                  : 'text-dark-400 hover:text-dark-100 hover:bg-dark-800'
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-dark-800">
          <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-dark-400 hover:text-dark-200 hover:bg-dark-800 w-full transition-all">
            <LogOut size={18} /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="fixed top-0 left-0 right-0 z-40 md:hidden bg-dark-900 border-b border-dark-800 px-4 h-14 flex items-center justify-between">
        <span className="text-lg font-extrabold tracking-widest text-gold-500 uppercase">Varieté Admin</span>
        <button onClick={handleLogout} className="p-2 text-dark-400">
          <LogOut size={18} />
        </button>
      </div>

      {/* Mobile nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-dark-900/95 backdrop-blur-sm border-t border-dark-800 overflow-x-auto">
        <div className="flex items-center gap-0 px-1 py-1 min-w-max">
          {navItems.map(({ path, icon: Icon, label, exact }) => (
            <Link key={path} to={path}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-[10px] font-medium flex-shrink-0 transition-colors ${
                isActive(path, exact) ? 'text-gold-500' : 'text-dark-500 hover:text-dark-300'
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 md:ml-56 pt-14 md:pt-0 pb-16 md:pb-0 min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}
