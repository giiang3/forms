import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { newSchema } from '../lib/fields'
import Icon from '../Icon'
import { Modal, useToast } from './ui'

export function randomSlug(n = 5) {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
  return Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => chars[b % chars.length]).join('')
}

export async function createForm(title, schema) {
  for (let i = 0; i < 5; i++) {
    const { data, error } = await supabase
      .from('forms')
      .insert({ slug: randomSlug(), title, draft: schema, schema })
      .select('id')
      .single()
    if (!error) return data.id
    if (!String(error.message).includes('duplicate')) throw error
  }
  throw new Error('Não foi possível gerar um link único.')
}

const fmtDate = (s) =>
  s ? new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

export default function FormsList({ session }) {
  const [forms, setForms] = useState(null)
  const [counts, setCounts] = useState({})
  const [confirm, setConfirm] = useState(null)
  const [pwOpen, setPwOpen] = useState(false)
  const [toast, showToast] = useToast()
  const nav = useNavigate()

  const load = async () => {
    const [{ data, error }, { data: c }] = await Promise.all([
      supabase.from('forms').select('id, slug, title, published, closed, updated_at, created_at').order('updated_at', { ascending: false }),
      supabase.rpc('admin_form_counts'),
    ])
    if (error) showToast('Não foi possível carregar os formulários.', 'err')
    setForms(data || [])
    setCounts(Object.fromEntries((c || []).map((r) => [r.form_id, r])))
  }
  useEffect(() => {
    load()
  }, []) // eslint-disable-line

  const create = async () => {
    try {
      const id = await createForm('Formulário sem título', newSchema())
      nav(`/admin/forms/${id}`)
    } catch (e) {
      showToast(e.message, 'err')
    }
  }

  const duplicate = async (f) => {
    const { data } = await supabase.from('forms').select('draft').eq('id', f.id).single()
    try {
      await createForm(`${f.title} (cópia)`, data.draft)
      showToast('Formulário duplicado.')
      load()
    } catch (e) {
      showToast(e.message, 'err')
    }
  }

  const remove = async (f) => {
    const { error } = await supabase.from('forms').delete().eq('id', f.id)
    setConfirm(null)
    if (error) showToast('Não foi possível excluir.', 'err')
    else {
      showToast('Formulário excluído.')
      load()
    }
  }

  return (
    <div className="ad-page">
      <header className="ad-top">
        <div className="ad-brand">
          <div className="ad-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          Formulários
        </div>
        <div className="ad-top-right">
          <span className="ad-muted ad-hide-sm">{session.user.email}</span>
          <button className="ad-btn ad-btn-quiet" onClick={() => setPwOpen(true)}>
            Trocar senha
          </button>
          <button className="ad-btn ad-btn-quiet" onClick={() => supabase.auth.signOut()}>
            <Icon name="logout" size={16} /> Sair
          </button>
        </div>
      </header>

      <main className="ad-list-main">
        <div className="ad-list-head">
          <h1>Seus formulários</h1>
          <button className="ad-btn ad-btn-primary" onClick={create}>
            <Icon name="plus" size={16} /> Novo formulário
          </button>
        </div>

        {forms === null ? (
          <div className="ad-spinner" />
        ) : forms.length === 0 ? (
          <div className="ad-empty">
            <p>Nenhum formulário ainda.</p>
            <button className="ad-btn ad-btn-primary" onClick={create}>
              Criar o primeiro formulário
            </button>
          </div>
        ) : (
          <div className="ad-table-wrap">
            <table className="ad-table">
              <thead>
                <tr>
                  <th>Formulário</th>
                  <th>Situação</th>
                  <th className="num">Respostas</th>
                  <th className="ad-hide-sm">Atualizado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {forms.map((f) => {
                  const c = counts[f.id]
                  const status = !f.published ? ['Rascunho', 'draft'] : f.closed ? ['Encerrado', 'closed'] : ['No ar', 'live']
                  return (
                    <tr key={f.id}>
                      <td>
                        <Link className="ad-form-link" to={`/admin/forms/${f.id}`}>
                          {f.title}
                        </Link>
                        <small className="ad-muted ad-slug">/{f.slug}</small>
                      </td>
                      <td>
                        <span className={`ad-status is-${status[1]}`}>{status[0]}</span>
                      </td>
                      <td className="num">
                        <Link to={`/admin/forms/${f.id}/results`}>{c?.completed ?? 0}</Link>
                      </td>
                      <td className="ad-hide-sm ad-muted">{fmtDate(f.updated_at)}</td>
                      <td className="ad-row-actions">
                        <Link className="ad-btn ad-btn-sm" to={`/admin/forms/${f.id}/results`}>
                          <Icon name="chart" size={14} /> Resultados
                        </Link>
                        <button className="ad-icon-btn" aria-label="Duplicar" title="Duplicar" onClick={() => duplicate(f)}>
                          <Icon name="copy" size={16} />
                        </button>
                        <button className="ad-icon-btn" aria-label="Excluir" title="Excluir" onClick={() => setConfirm(f)}>
                          <Icon name="trash" size={16} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {confirm && (
        <Modal title="Excluir formulário" onClose={() => setConfirm(null)}>
          <p>
            Excluir <b>{confirm.title}</b> apaga também todas as {counts[confirm.id]?.completed ?? 0} respostas. Não dá para desfazer.
          </p>
          <div className="ad-modal-actions">
            <button className="ad-btn" onClick={() => setConfirm(null)}>
              Cancelar
            </button>
            <button className="ad-btn ad-btn-danger" onClick={() => remove(confirm)}>
              Excluir formulário
            </button>
          </div>
        </Modal>
      )}
      {pwOpen && <PasswordModal onClose={() => setPwOpen(false)} onDone={() => showToast('Senha alterada.')} />}
      {toast}
    </div>
  )
}

function PasswordModal({ onClose, onDone }) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [err, setErr] = useState('')
  const save = async (e) => {
    e.preventDefault()
    if (pw.length < 8) return setErr('Use pelo menos 8 caracteres.')
    if (pw !== pw2) return setErr('As senhas não são iguais.')
    const { error } = await supabase.auth.updateUser({ password: pw })
    if (error) return setErr(error.message)
    onDone()
    onClose()
  }
  return (
    <Modal title="Trocar senha" onClose={onClose}>
      <form onSubmit={save} className="ad-stack">
        <label className="ad-row">
          <span className="ad-row-label">Nova senha</span>
          <input className="ad-input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
        </label>
        <label className="ad-row">
          <span className="ad-row-label">Repita a nova senha</span>
          <input className="ad-input" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        </label>
        {err && <p className="ad-error">{err}</p>}
        <div className="ad-modal-actions">
          <button type="button" className="ad-btn" onClick={onClose}>
            Cancelar
          </button>
          <button className="ad-btn ad-btn-primary">Salvar senha</button>
        </div>
      </form>
    </Modal>
  )
}
