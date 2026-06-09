import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import LoadingState from '../components/LoadingState'
import Logo from '../components/Logo'
import ThemeMenu from '../components/ThemeMenu'
import { useAuth } from '../context/AuthContext'

function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signInWithEmail } = useAuth()
  const navigate = useNavigate()

  const handleEmailSignIn = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { error } = await signInWithEmail(email, password)
      if (error) {
        setError(error.message)
      } else {
        navigate('/')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen bg-admin-canvas admin-login-pattern font-display flex items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <ThemeMenu />
      </div>

      <div className="w-full max-w-md bg-admin-panel border border-admin-border p-8 rounded-2xl shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <Logo className="h-20 w-20 object-contain" title="Who Am I? Admin" />
          <p className="mt-3 text-accent font-bold text-lg tracking-tight">WhoAmI Admin</p>
          <h1 className="mt-1 text-admin-muted text-sm font-medium">Content management</h1>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-950/50 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-200 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleEmailSignIn} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-admin-fg mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 bg-admin-muted-surface border border-admin-border rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/20 transition-colors text-admin-fg disabled:opacity-60"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-admin-fg mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 bg-admin-muted-surface border border-admin-border rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/20 transition-colors text-admin-fg disabled:opacity-60"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent text-white font-bold py-4 px-4 rounded-lg hover:bg-accent/90 shadow-lg shadow-accent/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? (
              <LoadingState label="Signing in" layout="inline" className="text-white w-full" />
            ) : (
              'Sign In'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

export default AdminLogin
