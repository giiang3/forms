import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) setError(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : error.message)
  }

  return (
    <div className="ad ad-center">
      <form className="ad-card ad-login" onSubmit={submit}>
        <div className="ad-mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <h1>Entrar</h1>
        <p className="ad-muted">Área de administração dos formulários.</p>
        <label className="ad-row">
          <span className="ad-row-label">E-mail</span>
          <input className="ad-input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </label>
        <label className="ad-row">
          <span className="ad-row-label">Senha</span>
          <input className="ad-input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p className="ad-error">{error}</p>}
        <button className="ad-btn ad-btn-primary ad-btn-block" disabled={busy}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
