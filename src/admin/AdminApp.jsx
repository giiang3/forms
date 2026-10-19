import { useEffect, useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Login from './Login'
import FormsList from './FormsList'
import Editor from './Editor'
import Results from './Results'
import './admin.css'

export default function AdminApp() {
  const [session, setSession] = useState(undefined)
  const [isAdmin, setIsAdmin] = useState(null)

  useEffect(() => {
    document.title = 'Formulários'
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) {
      setIsAdmin(null)
      return
    }
    supabase
      .from('admins')
      .select('user_id')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data))
  }, [session])

  if (session === undefined || (session && isAdmin === null))
    return (
      <div className="ad ad-center">
        <div className="ad-spinner" aria-label="Carregando" />
      </div>
    )
  if (!session) return <Login />
  if (!isAdmin)
    return (
      <div className="ad ad-center">
        <div className="ad-card ad-login">
          <h1>Sem acesso</h1>
          <p className="ad-muted">A conta {session.user.email} não tem permissão de administrador.</p>
          <button className="ad-btn" onClick={() => supabase.auth.signOut()}>
            Sair
          </button>
        </div>
      </div>
    )

  return (
    <div className="ad">
      <Routes>
        <Route index element={<FormsList session={session} />} />
        <Route path="forms/:id" element={<Editor />} />
        <Route path="forms/:id/results" element={<Results />} />
      </Routes>
    </div>
  )
}
