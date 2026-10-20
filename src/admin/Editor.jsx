import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { plainLine } from '../lib/rich'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { newSchema } from '../lib/fields'
import Icon from '../Icon'
import FieldList from './FieldList'
import Canvas from './Canvas'
import AddFieldModal from './AddFieldModal'
import LogicPanel from './LogicPanel'
import LogicMap from './LogicMap'
import DesignPanel from './DesignPanel'
import SharePanel from './SharePanel'
import { FieldSettings, WelcomeSettings, EndingSettings } from './FieldSettings'
import { Runner } from '../public/FormRunner'
import { useToast, Modal } from './ui'
import { screenLabel } from '../lib/fields'
import * as D from './draft'

const TABS = [
  ['content', 'Conteúdo', 'list'],
  ['logic', 'Lógica', 'logic'],
  ['design', 'Design', 'palette'],
  ['share', 'Compartilhar', 'share'],
]

function normalize(schema) {
  const base = newSchema()
  if (!schema || !schema.fields) return base
  return { ...base, ...schema, welcome: { ...base.welcome, ...schema.welcome }, settings: { ...base.settings, ...schema.settings }, logic: schema.logic || {} }
}

export default function Editor() {
  const { id } = useParams()
  const [form, setForm] = useState(null)
  const [draft, setDraft] = useState(null)
  const [published, setPublished] = useState(null)
  const [title, setTitle] = useState('')
  const [selected, setSelected] = useState({ kind: 'welcome' })
  const [tab, setTab] = useState('content')
  const [adding, setAdding] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [preview, setPreview] = useState(false)
  const [device, setDevice] = useState('desktop')
  const [save, setSave] = useState('saved')
  const [loadErr, setLoadErr] = useState('')
  const [toast, showToast] = useToast()
  const timer = useRef(null)
  const loaded = useRef(false)

  useEffect(() => {
    supabase
      .from('forms')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) return setLoadErr('Formulário não encontrado.')
        setForm(data)
        setTitle(data.title)
        const d = normalize(data.draft)
        setDraft(d)
        setPublished(data.schema)
        setSelected(d.welcome?.enabled !== false ? { kind: 'welcome' } : d.fields[0] ? { kind: 'field', id: d.fields[0].id } : { kind: 'welcome' })
        document.title = `${data.title} · Editor`
        setTimeout(() => (loaded.current = true), 0)
      })
  }, [id])

  // Autosave draft + title
  useEffect(() => {
    if (!loaded.current || !draft) return
    setSave('saving')
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      const { error } = await supabase.from('forms').update({ draft, title: title.trim() || 'Formulário sem título' }).eq('id', id)
      setSave(error ? 'error' : 'saved')
    }, 700)
    return () => clearTimeout(timer.current)
  }, [draft, title, id])

  const dirty = useMemo(() => draft && JSON.stringify(draft) !== JSON.stringify(published), [draft, published])
  const mutate = useCallback((fn) => setDraft((d) => fn(d)), [])

  const publish = async () => {
    clearTimeout(timer.current)
    const { error } = await supabase
      .from('forms')
      .update({ draft, schema: draft, title: title.trim() || 'Formulário sem título', published: true, published_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return showToast('Não foi possível publicar.', 'err')
    setPublished(draft)
    setForm((f) => ({ ...f, published: true }))
    setSave('saved')
    showToast(form.published ? 'Alterações publicadas.' : 'Formulário publicado.')
  }

  if (loadErr)
    return (
      <div className="ad ad-center">
        <div className="ad-card ad-login">
          <h1>{loadErr}</h1>
          <Link className="ad-btn" to="/admin">
            Voltar para a lista
          </Link>
        </div>
      </div>
    )
  if (!draft)
    return (
      <div className="ad ad-center">
        <div className="ad-spinner" />
      </div>
    )

  const { field, parent } = selected.kind === 'field' ? D.findField(draft, selected.id) : { field: null, parent: null }
  const ending = selected.kind === 'ending' ? draft.endings.find((e) => e.id === selected.id) : null
  const logicScreen = parent ? parent.id : field?.id

  // Apply a planned change; if it deletes logic rules, ask first
  const applyPlan = (plan, selectId) => {
    if (!plan) return
    const go = () => {
      setDraft(plan.schema)
      if (selectId) setSelected({ kind: 'field', id: selectId })
      setConfirm(null)
    }
    if (plan.lost?.length) setConfirm({ lost: plan.lost, go })
    else go()
  }

  const onAddPick = (type) => {
    if (adding?.anchor) {
      const plan = D.planAddToPage(draft, type, adding.anchor)
      setAdding(false)
      if (plan) applyPlan(plan, plan.id)
      return
    }
    const res = D.addField(draft, type, { afterId: selected.kind === 'field' ? selected.id : undefined })
    setDraft(res.schema)
    setSelected({ kind: 'field', id: res.id })
    setAdding(false)
  }

  let right = null
  if (tab === 'design') right = <DesignPanel schema={draft} onTheme={(theme) => mutate((d) => ({ ...d, theme }))} onSettings={(s) => mutate((d) => ({ ...d, settings: { ...d.settings, ...s } }))} toast={showToast} />
  else if (selected.kind === 'welcome') right = <WelcomeSettings welcome={draft.welcome} onChange={(p) => mutate((d) => ({ ...d, welcome: { ...d.welcome, ...p } }))} />
  else if (ending)
    right = (
      <EndingSettings
        ending={ending}
        schema={draft}
        canRemove={draft.endings.length > 1}
        onChange={(p) => mutate((d) => D.updateEnding(d, ending.id, p))}
        onRemove={() => {
          mutate((d) => D.removeEnding(d, ending.id))
          setSelected({ kind: 'ending', id: draft.endings.find((e) => e.id !== ending.id)?.id })
        }}
      />
    )
  else if (field)
    right = (
      <FieldSettings
        schema={draft}
        field={field}
        parent={parent}
        onPatch={(p) => mutate((d) => D.updateField(d, field.id, p))}
        onProps={(p) => mutate((d) => D.updateField(d, field.id, { props: p }))}
        onChangeType={(t) => mutate((d) => D.changeType(d, field.id, t))}
        onDuplicate={() => {
          const r = D.duplicateField(draft, field.id)
          setDraft(r.schema)
          if (r.id) setSelected({ kind: 'field', id: r.id })
        }}
        onRemove={() => {
          const list = draft.fields
          const i = list.findIndex((f) => f.id === (parent?.id || field.id))
          mutate((d) => D.removeField(d, field.id))
          const fallback = parent ? parent.id : list[i + 1]?.id || list[i - 1]?.id
          setSelected(fallback ? { kind: 'field', id: fallback } : { kind: 'welcome' })
        }}
        onMoveToGroup={(gid) => applyPlan(gid ? D.planMove(draft, field.id, gid, 'merge') : D.planMove(draft, field.id, parent?.id, 'after'), field.id)}
      />
    )

  const showCanvas = tab === 'content' || tab === 'design'

  return (
    <div className="ad-editor">
      <header className="ad-top ad-top-editor">
        <div className="ad-top-left">
          <Link className="ad-icon-btn" to="/admin" aria-label="Voltar para a lista">
            <Icon name="back" size={20} />
          </Link>
          <input className="ad-title-input" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Nome do formulário" />
          <span className={`ad-save is-${save}`}>{save === 'saving' ? 'Salvando…' : save === 'error' ? 'Erro ao salvar' : 'Salvo'}</span>
        </div>
        <nav className="ad-tabs" role="tablist">
          {TABS.map(([k, label, icon]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'is-on' : ''} onClick={() => setTab(k)}>
              <Icon name={icon} size={16} />
              <span>{label}</span>
            </button>
          ))}
          <Link className="ad-tab-link" to={`/admin/forms/${id}/results`}>
            <Icon name="chart" size={16} />
            <span>Resultados</span>
          </Link>
        </nav>
        <div className="ad-top-right">
          <button className="ad-btn ad-btn-quiet" onClick={() => setPreview(true)}>
            <Icon name="eye" size={16} /> <span className="ad-hide-sm">Prévia</span>
          </button>
          <button className="ad-btn ad-btn-primary" onClick={publish} disabled={form.published && !dirty}>
            {!form.published ? 'Publicar' : dirty ? 'Publicar alterações' : 'Publicado'}
          </button>
        </div>
      </header>

      <div className={`ad-work is-${tab}`}>
        {tab !== 'share' && (
          <FieldList
            schema={draft}
            selected={selected}
            onSelect={(s) => setSelected(s)}
            onAdd={() => setAdding({})}
            onAddToPage={(anchor) => setAdding({ anchor })}
            onMove={(dragId, targetId, zone) => applyPlan(D.planMove(draft, dragId, targetId, zone), dragId)}
            onAddEnding={() => {
              const r = D.addEnding(draft)
              setDraft(r.schema)
              setSelected({ kind: 'ending', id: r.id })
            }}
          />
        )}

        {showCanvas && (
          <main className="ad-center-col">
            <div className="ad-canvas-bar">
              <div className="ad-seg" role="group" aria-label="Tamanho da prévia">
                <button className={device === 'desktop' ? 'is-on' : ''} onClick={() => setDevice('desktop')}>
                  Computador
                </button>
                <button className={device === 'mobile' ? 'is-on' : ''} onClick={() => setDevice('mobile')}>
                  Celular
                </button>
              </div>
              {field && parent && (
                <button className="ad-btn ad-btn-sm ad-btn-quiet" onClick={() => setSelected({ kind: 'field', id: parent.id })}>
                  Ver página inteira
                </button>
              )}
            </div>
            <Canvas
              schema={draft}
              selected={selected}
              field={field}
              parent={parent}
              ending={ending}
              device={device}
              onPatch={(p) => mutate((d) => D.updateField(d, field.id, p))}
              onWelcome={(p) => mutate((d) => ({ ...d, welcome: { ...d.welcome, ...p } }))}
              onEnding={(p) => mutate((d) => D.updateEnding(d, ending.id, p))}
            />
          </main>
        )}

        {tab === 'logic' && (
          <>
            <main className="ad-center-col">
              <LogicMap schema={draft} selectedId={logicScreen} onSelect={(fid) => setSelected({ kind: 'field', id: fid })} />
            </main>
            <aside className="ad-right ad-right-logic">
              <div className="ad-right-body">
                <LogicPanel
                  schema={draft}
                  screenId={logicScreen}
                  onChange={(logic) => mutate((d) => ({ ...d, logic }))}
                  onSelect={(fid) => setSelected({ kind: 'field', id: fid })}
                />
              </div>
            </aside>
          </>
        )}

        {tab === 'share' && (
          <main className="ad-center-col ad-center-scroll">
            <SharePanel form={form} schema={published?.fields ? published : draft} onForm={(p) => setForm((f) => ({ ...f, ...p }))} onPublish={publish} dirty={dirty} toast={showToast} />
          </main>
        )}

        {showCanvas && <aside className="ad-right">{right}</aside>}
      </div>

      {adding && <AddFieldModal onClose={() => setAdding(false)} onPick={onAddPick} toPage={!!adding.anchor} />}
      {confirm && (
        <Modal title="Juntar na mesma página" onClose={() => setConfirm(null)}>
          <p>
            {confirm.lost.length === 1 ? 'Esta pergunta tem regras de lógica:' : 'Estas perguntas têm regras de lógica:'}{' '}
            <b>{confirm.lost.map((f) => screenLabel(f) || 'Sem título').join(', ')}</b>.
          </p>
          <p>A lógica fica na página. Ao juntar, essas regras serão apagadas e você cria as regras da nova página na aba Lógica. Regras de outras perguntas que levavam até aqui passam a levar para a nova página.</p>
          <div className="ad-modal-actions">
            <button className="ad-btn" onClick={() => setConfirm(null)}>
              Cancelar
            </button>
            <button className="ad-btn ad-btn-danger" onClick={confirm.go}>
              Juntar e apagar as regras
            </button>
          </div>
        </Modal>
      )}
      {preview && (
        <div className="ad-preview">
          <Runner schema={draft} preview onExit={() => setPreview(false)} />
        </div>
      )}
      {toast}
    </div>
  )
}
