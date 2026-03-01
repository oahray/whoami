import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { GameProvider } from './context/GameContext'
import Home from './pages/Home'
import Lobby from './pages/Lobby'
import Game from './pages/Game'
import AdminLogin from './pages/AdminLogin'
import AdminDashboard from './pages/AdminDashboard'
import AdminEntityEditor from './pages/AdminEntityEditor'
import AdminPreview from './pages/AdminPreview'
import ProtectedRoute from './components/ProtectedRoute'
import ReconnectingIndicator from './components/ReconnectingIndicator'

function App() {
  return (
    <AuthProvider>
      <GameProvider>
        <ReconnectingIndicator />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/lobby" element={<Lobby />} />
            <Route path="/game" element={<Game />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/entities/:id"
              element={
                <ProtectedRoute>
                  <AdminEntityEditor />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/entities/:id/preview"
              element={
                <ProtectedRoute>
                  <AdminPreview />
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </GameProvider>
    </AuthProvider>
  )
}

export default App
