import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ReactNode } from 'react'
import { AuthProvider } from './context/AuthContext'
import { GameProvider } from './context/GameContext'
import { AdminDatasetProvider } from './context/AdminDatasetContext'
import Home from './pages/Home'
import About from './pages/About'
import Lobby from './pages/Lobby'
import Game from './pages/Game'
import AdminLogin from './pages/AdminLogin'
import AdminDashboard from './pages/AdminDashboard'
import AdminDatasets from './pages/AdminDatasets'
import AdminEntities from './pages/AdminEntities'
import AdminEntityEditor from './pages/AdminEntityEditor'
import AdminPreview from './pages/AdminPreview'
import AdminBulkImport from './pages/AdminBulkImport'
import ProtectedRoute from './components/ProtectedRoute'
import ReconnectingIndicator from './components/ReconnectingIndicator'
import UpdatePrompt from './pwa/UpdatePrompt'

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
      <GameProvider>
        <UpdatePrompt />
        <BrowserRouter>
          <div className="flex min-h-screen flex-col">
            <ReconnectingIndicator />
            <div className="flex flex-1 flex-col">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/about" element={<About />} />
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
            </div>
          </div>
        </BrowserRouter>
      </GameProvider>
    </AuthProvider>
  )
}

export default App
