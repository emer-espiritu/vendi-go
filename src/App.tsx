import { Navigate, Route, Routes } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { landingPath } from '@/lib/permissions'
import { isSupabaseConfigured } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { AppLayout } from '@/components/layout/app-layout'
import CashClosingsPage from '@/pages/cash-closings'
import CustomersPage from '@/pages/customers'
import DashboardPage from '@/pages/dashboard'
import ExpensesPage from '@/pages/expenses'
import InventoryPage from '@/pages/inventory'
import LoginPage from '@/pages/login'
import PosPage from '@/pages/pos'
import ProductsPage from '@/pages/products'
import PurchasesPage from '@/pages/purchases'
import ReceiptsPage from '@/pages/receipts'
import ReportsPage from '@/pages/reports'
import ReturnsPage from '@/pages/returns'
import RolesPage from '@/pages/roles'
import ProfilePage from '@/pages/profile'
import SuppliersPage from '@/pages/suppliers'

function HomeRedirect() {
  const { user } = useAuth()
  return <Navigate to={user ? landingPath(user.role) : '/login'} replace />
}

function Splash({ message }: { message: string }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-background px-6">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <Loader2 className="size-6 animate-spin text-brand-600 dark:text-brand-300" />
        <p className="text-sm font-medium text-muted">{message}</p>
      </div>
    </div>
  )
}

export default function App() {
  const { loading } = useAuth()

  if (!isSupabaseConfigured) {
    return (
      <Splash message="Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY en .env. Revisa el README." />
    )
  }

  if (loading) return <Splash message="Restaurando tu sesión…" />

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/pos" element={<PosPage />} />
        <Route path="/productos" element={<ProductsPage />} />
        <Route path="/inventario" element={<InventoryPage />} />
        <Route path="/comprobantes" element={<ReceiptsPage />} />
        <Route path="/clientes" element={<CustomersPage />} />
        <Route path="/proveedores" element={<SuppliersPage />} />
        <Route path="/compras" element={<PurchasesPage />} />
        <Route path="/gastos" element={<ExpensesPage />} />
        <Route path="/devoluciones" element={<ReturnsPage />} />
        <Route path="/cierres" element={<CashClosingsPage />} />
        <Route path="/reportes" element={<ReportsPage />} />
        <Route path="/roles" element={<RolesPage />} />
        <Route path="/perfil" element={<ProfilePage />} />
      </Route>

      <Route path="/" element={<HomeRedirect />} />
      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  )
}
