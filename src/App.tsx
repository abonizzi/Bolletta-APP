import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ToastProvider } from '@/hooks/useToast'
import { ThemeProvider } from '@/hooks/useTheme'
import { LayoutModeProvider } from '@/hooks/useLayoutMode'
import { AuthProvider, useAuth } from '@/hooks/useAuth'
import { DataProvider } from '@/hooks/useData'
import { ProtectedRoute } from '@/components/ProtectedRoute'

import { Login } from '@/pages/Login'
import { Register } from '@/pages/Register'
import { ForgotPassword } from '@/pages/ForgotPassword'
import { ResetPassword } from '@/pages/ResetPassword'
import { Dashboard } from '@/pages/Dashboard'
import { Bills } from '@/pages/Bills'
import { BillDetails } from '@/pages/BillDetails'
import { Statistics } from '@/pages/Statistics'
import { Ebitts } from '@/pages/Ebitts'
import { Categories } from '@/pages/Categories'
import { Settings } from '@/pages/Settings'

function PublicOnly({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  return (
    <ToastProvider>
      <ThemeProvider>
        <LayoutModeProvider>
        <AuthProvider>
          <DataProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
                <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
                <Route path="/forgot-password" element={<PublicOnly><ForgotPassword /></PublicOnly>} />
                <Route path="/reset-password" element={<ResetPassword />} />

                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/bills" element={<ProtectedRoute><Bills /></ProtectedRoute>} />
                <Route path="/bills/new" element={<ProtectedRoute><Bills openForm /></ProtectedRoute>} />
                <Route path="/bills/:id" element={<ProtectedRoute><BillDetails /></ProtectedRoute>} />
                <Route path="/statistics" element={<ProtectedRoute><Statistics /></ProtectedRoute>} />
                <Route path="/ebitts" element={<ProtectedRoute><Ebitts /></ProtectedRoute>} />
                <Route path="/categories" element={<ProtectedRoute><Categories /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </BrowserRouter>
          </DataProvider>
        </AuthProvider>
        </LayoutModeProvider>
      </ThemeProvider>
    </ToastProvider>
  )
}
