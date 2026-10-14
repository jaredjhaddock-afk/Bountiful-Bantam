import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import { TESTER_EMAIL, normalizeAccessCode } from './testerLogin'

type Mode = 'tester' | 'email'

const inputClass =
  'mb-3 w-full rounded-standard border border-white/10 bg-app-bg px-3 py-2 text-sm outline-none focus:border-accent-teal'

export function LoginScreen() {
  const [mode, setMode] = useState<Mode>('tester')
  const [code, setCode] = useState('')
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const switchMode = (next: Mode) => {
    setMode(next)
    setError(null)
  }

  // On success AuthProvider's onAuthStateChange picks up the session and swaps this screen out.
  const handleCodeSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const accessCode = normalizeAccessCode(code)
    if (!accessCode) return
    setBusy(true)
    setError(null)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: TESTER_EMAIL,
      password: accessCode,
    })
    setBusy(false)
    if (signInError) {
      setError(signInError.status === 400 ? "That access code isn't right." : signInError.message)
    }
  }

  const handleLinkSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setBusy(true)
    setError(null)
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    })
    setBusy(false)
    if (otpError) setError(otpError.message)
    else setSent(true)
  }

  return (
    <div className="flex h-full items-center justify-center bg-app-bg">
      <div className="w-[420px] max-w-[90vw] rounded-lg border border-white/10 bg-panel p-6">
        {mode === 'tester' ? (
          <>
            <h1 className="mb-2 text-lg font-bold text-text">Tester access</h1>
            <p className="mb-4 text-sm text-muted">Enter the tester code you were given.</p>
            <form onSubmit={handleCodeSubmit}>
              <input
                type="password"
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Tester code"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="current-password"
                className={inputClass}
              />
              {error && <p className="mb-3 text-xs text-alert-red">{error}</p>}
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-standard bg-accent-teal py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {busy ? 'Checking…' : 'Enter'}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="mb-4 text-lg font-bold text-text">Coach sign in</h1>
            {sent ? (
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
                  disabled={busy}
                  className="w-full rounded-standard bg-accent-teal py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  {busy ? 'Sending…' : 'Send sign-in link'}
                </button>
              </form>
            )}
          </>
        )}
        {!sent && (
          <button
            type="button"
            onClick={() => switchMode(mode === 'tester' ? 'email' : 'tester')}
            className="mt-3 w-full text-center text-xs text-muted hover:text-text"
          >
            {mode === 'tester' ? 'Coach sign-in (email link)' : 'Back to tester access'}
          </button>
        )}
      </div>
    </div>
  )
}
