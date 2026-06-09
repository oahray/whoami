import { lazy, ReactNode, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { GameProvider } from './context/GameContext'
import { PreferencesProvider } from './context/PreferencesContext'
import { AdminDatasetProvider } from './context/AdminDatasetContext'
import Home from './pages/Home'
import About from './pages/About'
import PlaySetup from './pages/PlaySetup'
import PlayCards from './pages/PlayCards'
import Lobby from './pages/Lobby'
import Game from './pages/Game'
import ProtectedRoute from './components/ProtectedRoute'
import ReconnectingIndicator from './components/ReconnectingIndicator'
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
      <PreferencesProvider>
        <GameProvider>
          <UpdatePrompt />
          <BrowserRouter>
          <div className="flex min-h-screen flex-col">
            <ReconnectingIndicator />
            <div className="flex flex-1 flex-col">
              <Suspense fallback={<RouteFallback />}>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/play" element={<PlaySetup />} />
                  <Route path="/play/cards" element={<PlayCards />} />
                  <Route path="/lobby" element={<Lobby />} />
                  <Route path="/game" element={<Game />} />
                  <Route path="/admin/login" element={<AdminLogin />} />
                  <Route
                    path="/admin"
                    element={
                      <AdminRoute>
                        <AdminDashboard />
                      </AdminRoute>
                    }
                  />
                  <Route
                    path="/admin/datasets"
                    element={
                      <AdminRoute>
                        <AdminDatasets />
                      </AdminRoute>
                    }
                  />
                  <Route
                    path="/admin/datasets/:datasetId"
                    element={
                      <AdminRoute>
                        <AdminDashboard />
                      </AdminRoute>
                    }
                  />
                  <Route
                    path="/admin/entities/new"
                    element={
                      <AdminRoute>
                        <AdminEntityEditor />
                      </AdminRoute>
                    }
                  />
                  <Route
                    path="/admin/entities/:id/preview"
                    element={
                      <AdminRoute>
                        <AdminPreview />
                      </AdminRoute>
                    }
                  />
                  <Route
                    path="/admin/entities/:id"
                    element={
                      <AdminRoute>
                        <AdminEntityEditor />
                      </AdminRoute>
                    }
                  />
                  <Route
                    path="/admin/entities"
                    element={
                      <AdminRoute>
                        <AdminEntities />
                      </AdminRoute>
                    }
                  />
                  <Route
                    path="/admin/bulk-import"
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
        </GameProvider>
      </PreferencesProvider>
    </AuthProvider>
  )
}

export default App
