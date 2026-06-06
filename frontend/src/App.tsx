import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from './store/auth';
import api from './utils/api';

// Client pages
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import CatalogPage from './pages/CatalogPage';
import ProductDetailPage from './pages/ProductDetailPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import ProfilePage from './pages/ProfilePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

// Admin pages
import AdminLoginPage from './pages/admin/AdminLoginPage';
import AdminLayout from './pages/admin/AdminLayout';
import DashboardPage from './pages/admin/DashboardPage';
import OrdersAdminPage from './pages/admin/OrdersAdminPage';
import ProductsAdminPage from './pages/admin/ProductsAdminPage';
import CategoriesAdminPage from './pages/admin/CategoriesAdminPage';
import CitiesAdminPage from './pages/admin/CitiesAdminPage';
import CashbackAdminPage from './pages/admin/CashbackAdminPage';
import ClientsAdminPage from './pages/admin/ClientsAdminPage';
import ConfigAdminPage from './pages/admin/ConfigAdminPage';
import BillingAdminPage from './pages/admin/BillingAdminPage';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { role } = useAuthStore();
  const location = useLocation();
  if (!role) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { role } = useAuthStore();
  if (role !== 'admin') return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
}

function RequireGuest({ children }: { children: React.ReactNode }) {
  const { role } = useAuthStore();
  if (role === 'admin') return <Navigate to="/admin" replace />;
  if (role === 'client') return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  const { setAuth, clearAuth, role } = useAuthStore();
  const navigate = useNavigate();

  // Verify session on mount
  useEffect(() => {
    const verify = async () => {
      try {
        const res = await api.get('/auth/me');
        if (res.data.role === 'admin') {
          setAuth('admin', null, res.data.id);
        } else {
          setAuth('client', res.data.client, null);
        }
      } catch {
        clearAuth();
      }
    };
    verify();
  }, []);

  return (
    <Routes>
      {/* Admin routes */}
      <Route path="/admin/login" element={<RequireGuest><AdminLoginPage /></RequireGuest>} />
      <Route path="/admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
        <Route index element={<DashboardPage />} />
        <Route path="pedidos" element={<OrdersAdminPage />} />
        <Route path="productos" element={<ProductsAdminPage />} />
        <Route path="categorias" element={<CategoriesAdminPage />} />
        <Route path="ciudades" element={<CitiesAdminPage />} />
        <Route path="cashback" element={<CashbackAdminPage />} />
        <Route path="clientes" element={<ClientsAdminPage />} />
        <Route path="facturacion" element={<BillingAdminPage />} />
        <Route path="configuracion" element={<ConfigAdminPage />} />
      </Route>

      {/* Client routes */}
      <Route path="/login" element={<RequireGuest><LoginPage /></RequireGuest>} />
      <Route path="/registro" element={<RequireGuest><RegisterPage /></RequireGuest>} />

      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="catalogo" element={<CatalogPage />} />
        <Route path="producto/:id" element={<ProductDetailPage />} />
        <Route path="carrito" element={<RequireAuth><CartPage /></RequireAuth>} />
        <Route path="checkout" element={<RequireAuth><CheckoutPage /></RequireAuth>} />
        <Route path="perfil" element={<RequireAuth><ProfilePage /></RequireAuth>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
