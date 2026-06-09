import { lazy, ReactNode, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { AdminDatasetProvider } from './context/AdminDatasetContext'
import ProtectedRoute from './components/ProtectedRoute'
import RouteFallback from './components/RouteFallback'
import UpdatePrompt from './pwa/UpdatePrompt'

const AdminLogin = lazy(() => import('./pages/AdminLogin'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const AdminDatasets = lazy(() => import('./pages/AdminDatasets'))
const AdminEntities = lazy(() => import('./pages/AdminEntities'))
const AdminEntityEditor = lazy(() => import('./pages/AdminEntityEditor'))
const AdminPreview = lazy(() => import('./pages/AdminPreview'))
const AdminBulkImport = lazy(() => import('./pages/AdminBulkImport'))

function AdminRoute({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <AdminDatasetProvider>{children}</AdminDatasetProvider>
    </ProtectedRoute>
  )
}

function App() {
  return (
    <AuthProvider>
      <UpdatePrompt />
      <BrowserRouter>
        <div className="flex min-h-screen flex-col">
          <div className="flex flex-1 flex-col">
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/login" element={<AdminLogin />} />
                <Route
                  path="/"
                  element={
                    <AdminRoute>
                      <AdminDashboard />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/datasets"
                  element={
                    <AdminRoute>
                      <AdminDatasets />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/datasets/:datasetId"
                  element={
                    <AdminRoute>
                      <AdminDashboard />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/entities/new"
                  element={
                    <AdminRoute>
                      <AdminEntityEditor />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/entities/:id/preview"
                  element={
                    <AdminRoute>
                      <AdminPreview />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/entities/:id"
                  element={
                    <AdminRoute>
                      <AdminEntityEditor />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/entities"
                  element={
                    <AdminRoute>
                      <AdminEntities />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/bulk-import"
                  element={
                    <AdminRoute>
                      <AdminBulkImport />
                    </AdminRoute>
                  }
                />
              </Routes>
            </Suspense>
          </div>
        </div>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
