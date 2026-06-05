import { Link, useLocation, Outlet } from 'react-router-dom';
import { ShoppingCart, Home, BookOpen, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCartStore } from '../store/cart';
import CartDrawer from './CartDrawer';
import Header from './Header';

export default function Layout() {
  const location = useLocation();
  const { getTotalItems, toggleCart, isOpen } = useCartStore();
  const totalItems = getTotalItems();

  const navItems = [
    { path: '/', icon: Home, label: 'Inicio' },
    { path: '/catalogo', icon: BookOpen, label: 'Catálogo' },
    { path: '/carrito', icon: ShoppingCart, label: 'Pedido', badge: totalItems },
    { path: '/perfil', icon: User, label: 'Mi cuenta' },
  ];

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col">
      <Header />
      <main className="flex-1 pb-20 md:pb-0"><Outlet /></main>

      {/* Mobile tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-dark-900/95 backdrop-blur-sm border-t border-dark-800">
        <div className="flex items-center justify-around px-2 py-2">
          {navItems.map(({ path, icon: Icon, label, badge }) => {
            const active = location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
            return (
              <Link
                key={path}
                to={path === '/carrito' ? '#' : path}
                onClick={path === '/carrito' ? (e) => { e.preventDefault(); toggleCart(); } : undefined}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg relative min-w-[48px] ${
                  active ? 'text-gold-500' : 'text-dark-400 hover:text-dark-200'
                }`}
              >
                <div className="relative">
                  <Icon size={22} />
                  {badge !== undefined && badge > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1.5 -right-1.5 bg-gold-600 text-dark-950 text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center"
                    >
                      {badge > 9 ? '9+' : badge}
                    </motion.span>
                  )}
                </div>
                <span className="text-[10px] font-medium">{label}</span>
                {active && (
                  <motion.div
                    layoutId="tab-indicator"
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-gold-500 rounded-full"
                  />
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      <AnimatePresence>{isOpen && <CartDrawer />}</AnimatePresence>
    </div>
  );
}
