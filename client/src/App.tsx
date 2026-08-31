import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { GameProvider } from './context/GameContext'
import { PreferencesProvider } from './context/PreferencesContext'
import Home from './pages/Home'
import About from './pages/About'
import Privacy from './pages/Privacy'
import PlaySetup from './pages/PlaySetup'
import PlayCards from './pages/PlayCards'
import SoloSetup from './pages/SoloSetup'
import SoloGame from './pages/SoloGame'
import Lobby from './pages/Lobby'
import Game from './pages/Game'
import AdminLegacyRedirect from './components/AdminLegacyRedirect'
import ReconnectingIndicator from './components/ReconnectingIndicator'
import UpdatePrompt from './pwa/UpdatePrompt'
import NotFound from './pages/NotFound'

function App() {
  return (
    <PreferencesProvider>
      <GameProvider>
        <UpdatePrompt />
        <BrowserRouter>
          <div className="flex min-h-screen flex-col">
            <ReconnectingIndicator />
            <div className="flex flex-1 flex-col">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/about" element={<About />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/play" element={<PlaySetup />} />
                <Route path="/play/cards" element={<PlayCards />} />
                <Route path="/solo" element={<SoloSetup />} />
                <Route path="/solo/play" element={<SoloGame />} />
                <Route path="/lobby" element={<Lobby />} />
                <Route path="/game" element={<Game />} />
                <Route path="/admin/*" element={<AdminLegacyRedirect />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </div>
          </div>
        </BrowserRouter>
      </GameProvider>
    </PreferencesProvider>
  )
}

export default App
