import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { plainLine } from '../lib/rich'
import { useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { flattenFields, answerableFields } from '../lib/fields'
import { nextTarget, step } from '../lib/logic'
import { validateField, autoAdvances } from '../lib/answers'
import { domainError } from '../lib/validation'
import { FormFrame, FieldScreen, WelcomeScreen, EndingScreen } from './Screens'
import Icon from '../Icon'
import './runner.css'

const ERRORS = {
  duplicate: 'Esta resposta já foi usada por outra pessoa. Confira o que você digitou.',
  invalid_cpf: 'CPF inválido. Confira os números.',
  form_unavailable: 'Este formulário não está recebendo respostas agora.',
  email_domain: 'Este e-mail não é aceito neste formulário.',
}

const CLOSED_TEXT = {
  date: 'O prazo para responder este formulário terminou.',
  limit: 'Este formulário atingiu o número máximo de respostas.',
  manual: 'Este formulário não está mais recebendo respostas.',
}

/** Turn ?pre_<fieldId>=value into typed answers. */
export function parsePrefill(params, fields) {
  const byId = Object.fromEntries(flattenFields(fields).map((f) => [f.id, f]))
  const out = {}
  for (const [k, raw] of params.entries()) {
    if (!k.startsWith('pre_')) continue
    const f = byId[k.slice(4)]
    if (!f || raw === '') continue
    const findOpt = (v) => f.props?.options?.find((o) => o.id === v || o.label.toLowerCase() === v.toLowerCase())?.id
    switch (f.type) {
      case 'multiple_choice':
      case 'dropdown':
      case 'picture_choice':
        if (f.type !== 'dropdown' && f.props?.multiple) out[f.id] = raw.split(',').map(findOpt).filter(Boolean)
        else if (findOpt(raw)) out[f.id] = findOpt(raw)
        break
      case 'checkbox':
        out[f.id] = raw.split(',').map(findOpt).filter(Boolean)
        break
      case 'yes_no':
      case 'legal':
        if (raw === 'true' || raw === 'false') out[f.id] = raw === 'true'
        break
      case 'nps':
      case 'opinion_scale':
      case 'rating':
        if (!Number.isNaN(Number(raw))) out[f.id] = Number(raw)
        break
      case 'short_text':
        if (f.props?.selector?.enabled) break
        out[f.id] = raw
        break
      case 'long_text':
      case 'email':
      case 'phone':
      case 'website':
      case 'number':
      case 'date':
        out[f.id] = raw
        break
      default:
        break
    }
  }
  return out
}

export default function PublicForm() {
  const { slug } = useParams()
  const [params] = useSearchParams()
  const [state, setState] = useState({ status: 'loading' })

  useEffect(() => {
    let alive = true
    supabase.rpc('get_public_form', { p_slug: slug }).then(({ data, error }) => {
      if (!alive) return
      if (error) setState({ status: 'error' })
      else if (!data) setState({ status: 'missing' })
      else {
        setState({ status: 'ready', form: data })
        document.title = data.title
        if (!data.closed) supabase.rpc('track_view', { p_slug: slug }).then(() => {})
      }
    })
    return () => {
      alive = false
    }
  }, [slug])

  if (state.status === 'loading') return <div className="fr fr-plain"><div className="fr-spinner" aria-label="Carregando" /></div>
  if (state.status !== 'ready')
    return (
      <div className="fr fr-plain">
        <div className="fr-q">
          <h1 className="fr-welcome-title">{state.status === 'missing' ? 'Formulário não encontrado' : 'Não foi possível carregar'}</h1>
          <p className="fr-q-desc">
            {state.status === 'missing'
              ? 'Confira se o link está completo. Se recebeu o link de alguém, peça para enviar de novo.'
              : 'Verifique sua conexão e recarregue a página.'}
          </p>
        </div>
      </div>
    )

  const { form } = state
  if (form.closed)
    return (
      <FormFrame theme={form.schema.theme}>
        <div className="fr-stage">
          <div className="fr-q">
            <h1 className="fr-welcome-title">{form.title}</h1>
            <p className="fr-q-desc">{form.closed_message?.trim() || CLOSED_TEXT[form.closed_reason] || CLOSED_TEXT.manual}</p>
          </div>
        </div>
      </FormFrame>
    )
  const prefill = parsePrefill(params, form.schema.fields || [])
  return <Runner schema={form.schema} slug={form.slug} count={form.submission_count} prefill={prefill} closedMessage={form.closed_message} formTitle={form.title} />
}

/** The interactive form. With `preview`, nothing is sent. */
export function Runner({ schema, slug, count = 0, preview = false, onExit, prefill, closedMessage, formTitle }) {
  const fields = schema.fields || []
  const fieldsById = useMemo(() => Object.fromEntries(flattenFields(fields).map((f) => [f.id, f])), [fields])
  const total = useMemo(() => answerableFields(fields).length, [fields])
  const welcomeOn = schema.welcome?.enabled !== false

  const hasPrefill = prefill && Object.keys(prefill).length > 0
  const [screen, setScreen] = useState(
    welcomeOn && !hasPrefill ? { type: 'welcome' } : fields[0] ? { type: 'field', id: fields[0].id } : { type: 'end', id: null },
  )
  const [history, setHistory] = useState([])
  const [queue, setQueue] = useState(null) // pages still to visit from a multi-answer question
  const [answers, setAnswers] = useState(() => ({ ...(prefill || {}) }))
  const [errors, setErrors] = useState({})
  const [dir, setDir] = useState('down')
  const [busy, setBusy] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [receipt, setReceipt] = useState(null)
  const startedAt = useRef(hasPrefill ? new Date().toISOString() : null)
  const partial = useRef(null) // { id, token }
  const advanceTimer = useRef(null)

  const current = screen.type === 'field' ? fields.find((f) => f.id === screen.id) : null
  const number = current ? fields.filter((f) => f.type !== 'statement' && f.type !== 'partial_submit').findIndex((f) => f.id === current.id) + 1 : null

  const setAnswer = useCallback((id, v) => {
    if (!startedAt.current) startedAt.current = new Date().toISOString()
    setAnswers((a) => ({ ...a, [id]: v }))
    setErrors((e) => (e[id] ? { ...e, [id]: null } : e))
  }, [])

  const answeredCount = useMemo(
    () => answerableFields(fields).filter((f) => {
      const v = answers[f.id]
      return v != null && v !== '' && !(Array.isArray(v) && !v.length)
    }).length,
    [answers, fields],
  )

  const send = async (isPartial) => {
    if (preview) return { ok: true, receipt: { protocol: 'PREV-IA00', submittedAt: new Date().toISOString() } }
    const clean = Object.fromEntries(Object.entries(answers).filter(([, v]) => v != null && v !== ''))
    const { data, error } = await supabase.rpc('submit_response', {
      p_slug: slug,
      p_answers: clean,
      p_started_at: startedAt.current,
      p_partial: isPartial,
      p_response_id: partial.current?.id ?? null,
      p_token: partial.current?.token ?? null,
    })
    if (error) {
      const code = Object.keys(ERRORS).find((k) => error.message?.includes(k))
      const message = code === 'form_unavailable' && closedMessage?.trim() ? closedMessage.trim() : ERRORS[code]
      return { ok: false, code, fieldId: error.details || null, message: message || 'Não foi possível enviar. Verifique sua conexão e tente de novo.' }
    }
    if (isPartial) partial.current = data
    return { ok: true, receipt: { protocol: data?.protocol, submittedAt: data?.submitted_at } }
  }

  const go = (target, from, nextQueue = null) => {
    setDir('down')
    if (from) setHistory((h) => [...h, { screen: from, queue }])
    setQueue(nextQueue)
    setScreen(target)
  }

  const finish = async (endingId) => {
    setBusy(true)
    setSubmitError('')
    const res = await send(false)
    setBusy(false)
    if (!res.ok) {
      if (res.fieldId && fieldsById[res.fieldId]) {
        const f = fieldsById[res.fieldId]
        const owner = f._group || res.fieldId
        let message = res.message
        if (res.code === 'email_domain') message = domainError(f.props) || res.message
        if (res.code === 'duplicate') {
          const a = answers[res.fieldId]
          const opt = a && typeof a === 'object' ? f.props?.selector?.options?.find((o) => o.id === a.option) : null
          message = opt
            ? `Este ${opt.label} já foi usado para responder este formulário.`
            : `Já recebemos uma resposta com este valor em “${plainLine(f.title)}”.`
        }
        setErrors((e) => ({ ...e, [res.fieldId]: message }))
        setDir('up')
        // Rewind history to that page so the path (and pending pages) stays consistent
        const idx = history.findIndex((h) => h.screen.type === 'field' && h.screen.id === owner)
        if (idx >= 0) {
          setQueue(history[idx].queue)
          setHistory((h) => h.slice(0, idx))
        }
        setScreen({ type: 'field', id: owner })
      } else setSubmitError(res.message)
      return
    }
    const ending = (schema.endings || []).find((e) => e.id === endingId) || schema.endings?.[0]
    setReceipt(res.receipt || null)
    setHistory([])
    go({ type: 'end', id: ending?.id ?? null })
    if (ending?.redirectUrl && !preview) setTimeout(() => window.location.assign(ending.redirectUrl), 1800)
  }

  const next = async () => {
    clearTimeout(advanceTimer.current)
    if (busy) return
    if (screen.type === 'welcome') {
      if (!startedAt.current) startedAt.current = new Date().toISOString()
      if (fields[0]) go({ type: 'field', id: fields[0].id })
      else finish(null)
      return
    }
    if (!current) return

    // Validate this screen
    const toCheck = current.type === 'group' ? current.children || [] : [current]
    const errs = {}
    for (const f of toCheck) {
      const e = validateField(f, answers[f.id])
      if (e) errs[f.id] = e
    }
    if (Object.keys(errs).length) {
      setErrors((x) => ({ ...x, ...errs }))
      return
    }

    const { target, queue: nextQueue } = step(schema, current.id, answers, fieldsById, queue)
    if (target.type === 'end') return finish(target.id)

    // Partial submit points save silently and move on
    const nf = fields.find((f) => f.id === target.id)
    if (nf?.type === 'partial_submit') {
      setBusy(true)
      await send(true)
      setBusy(false)
      const { target: after, queue: afterQueue } = step(schema, nf.id, answers, fieldsById, nextQueue)
      setHistory((h) => [...h, { screen, queue }])
      if (after.type === 'end') return finish(after.id)
      return go({ type: 'field', id: after.id }, null, afterQueue)
    }
    go(target, screen, nextQueue)
  }

  const back = () => {
    if (!history.length) return
    setDir('up')
    const prev = history[history.length - 1]
    setScreen(prev.screen)
    setQueue(prev.queue)
    setHistory((h) => h.slice(0, -1))
  }

  const autoAdvance = () => {
    clearTimeout(advanceTimer.current)
    advanceTimer.current = setTimeout(() => nextRef.current(), 450)
  }
  const nextRef = useRef(next)
  nextRef.current = next

  // Global Enter on screens without a focused text input
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Enter' || e.defaultPrevented) return
      if (e.target.closest?.('input,textarea,a,button')) return
      if (screen.type === 'end') return
      e.preventDefault()
      nextRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [screen])

  const progress = total ? Math.round((answeredCount / total) * 100) : 0
  const showProgress = schema.settings?.showProgress !== false && screen.type === 'field'
  const showNav = schema.settings?.showNav !== false && screen.type === 'field'
  const key = screen.type === 'field' ? screen.id : screen.type + (screen.id || '')
  const ending = screen.type === 'end' ? (schema.endings || []).find((e) => e.id === screen.id) || schema.endings?.[0] : null

  return (
    <FormFrame theme={schema.theme} className={preview ? 'fr-preview' : ''}>
      {showProgress && (
        <div className="fr-progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso">
          <span style={{ width: `${progress}%` }} />
        </div>
      )}
      {preview && onExit && (
        <button type="button" className="fr-exit" onClick={onExit}>
          <Icon name="close" size={16} /> Fechar prévia
        </button>
      )}
      <div className="fr-stage">
        <div key={key} className={`fr-slide fr-slide-${dir}`}>
          {screen.type === 'welcome' && <WelcomeScreen welcome={schema.welcome} fields={fields} count={count} onStart={next} />}
          {screen.type === 'field' && current && (
            <FieldScreen
              field={current}
              number={number}
              answers={answers}
              setAnswer={setAnswer}
              errors={errors}
              onNext={next}
              onAutoAdvance={autoAdvances(current) ? autoAdvance : undefined}
              fieldsById={fieldsById}
              letters={schema.settings?.letters !== false}
              busy={busy}
              isLast={step(schema, current.id, answers, fieldsById, queue).target.type === 'end'}
            />
          )}
          {screen.type === 'end' && <EndingScreen ending={ending} answers={answers} fieldsById={fieldsById} receipt={receipt} schema={schema} formTitle={formTitle} preview={preview} />}
          {submitError && (
            <div className="fr-error fr-error-submit" role="alert">
              <span aria-hidden="true">!</span>
              {submitError}
            </div>
          )}
        </div>
      </div>
      {showNav && (
        <div className="fr-nav">
          <button type="button" aria-label="Pergunta anterior" onClick={back} disabled={!history.length}>
            <Icon name="up" size={20} stroke={2.2} />
          </button>
          <button type="button" aria-label="Próxima pergunta" onClick={next}>
            <Icon name="down" size={20} stroke={2.2} />
          </button>
        </div>
      )}
      {preview && <div className="fr-preview-tag">Prévia: respostas não são enviadas</div>}
    </FormFrame>
  )
}
