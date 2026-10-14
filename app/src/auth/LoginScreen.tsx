import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import { testerEmail } from './testerLogin'

type Mode = 'link' | 'tester'

const inputClass =
  'mb-3 w-full rounded-standard border border-white/10 bg-app-bg px-3 py-2 text-sm outline-none focus:border-accent-teal'

export function LoginScreen() {
  const [mode, setMode] = useState<Mode>('link')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const switchMode = (next: Mode) => {
    setMode(next)
    setError(null)
  }

  const handleLinkSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setSending(true)
    setError(null)
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    })
    setSending(false)
    if (otpError) setError(otpError.message)
    else setSent(true)
  }

  // On success AuthProvider's onAuthStateChange picks up the session and swaps this screen out.
  const handleTesterSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) return
    setSending(true)
    setError(null)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: testerEmail(username),
      password,
    })
    setSending(false)
    if (signInError) {
      setError(signInError.status === 400 ? 'Wrong username or password.' : signInError.message)
    }
  }

  return (
    <div className="flex h-full items-center justify-center bg-app-bg">
      <div className="w-[420px] max-w-[90vw] rounded-lg border border-white/10 bg-panel p-6">
        <h1 className="mb-4 text-lg font-bold text-text">{mode === 'tester' ? 'Tester sign in' : 'Sign in'}</h1>
        {mode === 'tester' ? (
          <form onSubmit={handleTesterSubmit}>
            <input
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
              className={inputClass}
            />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              className={inputClass}
            />
            {error && <p className="mb-3 text-xs text-alert-red">{error}</p>}
            <button
              type="submit"
              disabled={sending}
              className="w-full rounded-standard bg-accent-teal py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {sending ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        ) : sent ? (
          <p className="text-sm text-muted">
            Check <span className="text-text">{email}</span> for a sign-in link.
          </p>
        ) : (
          <form onSubmit={handleLinkSubmit}>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={inputClass}
            />
            {error && <p className="mb-3 text-xs text-alert-red">{error}</p>}
            <button
              type="submit"
              disabled={sending}
              className="w-full rounded-standard bg-accent-teal py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {sending ? 'Sending…' : 'Send sign-in link'}
            </button>
          </form>
        )}
        {!sent && (
          <button
            type="button"
            onClick={() => switchMode(mode === 'tester' ? 'link' : 'tester')}
            className="mt-3 w-full text-center text-xs text-muted hover:text-text"
          >
            {mode === 'tester' ? 'Back to email sign-in' : 'Tester login'}
          </button>
        )}
      </div>
    </div>
  )
}
