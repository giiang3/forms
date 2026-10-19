import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase, publicFormUrl } from '../lib/supabase'
import { answerableFields, formatAnswer, FIELD_TYPES, labelFor } from '../lib/fields'
import Icon from '../Icon'
import { Modal, useToast } from './ui'

const PAGE = 1000

async function fetchAll(formId) {
  const out = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('responses')
      .select('id, protocol, answers, status, started_at, submitted_at, duration_ms')
      .eq('form_id', formId)
      .order('submitted_at', { ascending: false })
      .range(from, from + PAGE - 1)
    if (error) throw error
    out.push(...data)
    if (data.length < PAGE) return out
  }
}

export function fmtDuration(ms) {
  if (ms == null) return '—'
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}min ${String(s % 60).padStart(2, '0')}s`
  return `${Math.floor(m / 60)}h ${m % 60}min`
}
const fmtDateTime = (s) => (s ? new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—')
const median = (arr) => {
  if (!arr.length) return null
  const a = [...arr].sort((x, y) => x - y)
  const m = Math.floor(a.length / 2)
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2
}
const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0)

/* ------------------------------------------------------------ summary */

function Bars({ rows, total }) {
  const max = Math.max(1, ...rows.map((r) => r.count))
  return (
    <ul className="ad-bars">
      {rows.map((r) => (
        <li key={r.key} title={`${r.label}: ${r.count} (${pct(r.count, total)}%)`}>
          <span className="ad-bars-label">{r.label}</span>
          <span className="ad-bars-track">
            <span className="ad-bars-fill" style={{ width: `${(r.count / max) * 100}%` }} />
          </span>
          <span className="ad-bars-num">
            {r.count} <small>{pct(r.count, total)}%</small>
          </span>
        </li>
      ))}
    </ul>
  )
}

function FieldSummary({ field, rows }) {
  const values = rows.map((r) => r.answers?.[field.id]).filter((v) => v != null && v !== '' && !(Array.isArray(v) && !v.length))
  const n = values.length
  const d = FIELD_TYPES[field.type]
  let body

  if (['multiple_choice', 'checkbox', 'dropdown', 'picture_choice'].includes(field.type)) {
    const counts = new Map((field.props?.options || []).map((o) => [o.id, 0]))
    let other = 0
    for (const v of values)
      for (const x of [].concat(v)) {
        if (typeof x === 'string' && x.startsWith('other:')) other++
        else counts.set(x, (counts.get(x) || 0) + 1)
      }
    const list = [...counts].map(([k, count]) => ({ key: k, label: labelFor(field, k), count }))
    if (other) list.push({ key: 'other', label: 'Outro', count: other })
    body = <Bars rows={list} total={n} />
  } else if (field.type === 'yes_no' || field.type === 'legal') {
    const yes = values.filter((v) => v === true).length
    body = (
      <Bars
        total={n}
        rows={[
          { key: 'y', label: field.type === 'legal' ? field.props?.acceptLabel || 'Aceito' : 'Sim', count: yes },
          { key: 'n', label: field.type === 'legal' ? field.props?.rejectLabel || 'Não aceito' : 'Não', count: n - yes },
        ]}
      />
    )
  } else if (['nps', 'opinion_scale', 'rating'].includes(field.type)) {
    const nums = values.map(Number)
    const start = field.type === 'nps' ? 0 : field.type === 'rating' ? 1 : Number(field.props?.start ?? 1)
    const steps = field.type === 'nps' ? 11 : Number(field.props?.steps || 5)
    const avg = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null
    let extra = null
    if (field.type === 'nps' && nums.length) {
      const pro = nums.filter((x) => x >= 9).length
      const det = nums.filter((x) => x <= 6).length
      extra = (
        <p className="ad-sum-kpi">
          NPS <b>{Math.round(((pro - det) / nums.length) * 100)}</b>
          <small>
            {pro} promotores, {nums.length - pro - det} neutros, {det} detratores
          </small>
        </p>
      )
    }
    body = (
      <>
        <p className="ad-sum-kpi">
          Média <b>{avg == null ? '—' : avg.toFixed(1).replace('.', ',')}</b>
        </p>
        {extra}
        <Bars total={n} rows={Array.from({ length: steps }, (_, i) => start + i).map((v) => ({ key: v, label: String(v), count: nums.filter((x) => x === v).length }))} />
      </>
    )
  } else if (field.type === 'number') {
    const nums = values.map((v) => Number(String(v).replace(',', '.'))).filter((x) => !Number.isNaN(x))
    const avg = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null
    body = (
      <div className="ad-sum-stats">
        <span>Média <b>{avg == null ? '—' : avg.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</b></span>
        <span>Mínimo <b>{nums.length ? Math.min(...nums).toLocaleString('pt-BR') : '—'}</b></span>
        <span>Máximo <b>{nums.length ? Math.max(...nums).toLocaleString('pt-BR') : '—'}</b></span>
        <span>Soma <b>{nums.reduce((a, b) => a + b, 0).toLocaleString('pt-BR')}</b></span>
      </div>
    )
  } else if (field.type === 'ranking') {
    const opts = field.props?.options || []
    const avgPos = opts
      .map((o) => {
        const pos = values.map((v) => v.indexOf(o.id)).filter((i) => i >= 0)
        return { o, avg: pos.length ? pos.reduce((a, b) => a + b, 0) / pos.length + 1 : null }
      })
      .sort((a, b) => (a.avg ?? 99) - (b.avg ?? 99))
    body = (
      <ol className="ad-sum-rank">
        {avgPos.map(({ o, avg }) => (
          <li key={o.id}>
            <span>{o.label}</span>
            <small>posição média {avg == null ? '—' : avg.toFixed(1).replace('.', ',')}</small>
          </li>
        ))}
      </ol>
    )
  } else if (field.type === 'matrix') {
    const { rows: mrows = [], columns = [] } = field.props || {}
    body = (
      <div className="ad-table-wrap">
        <table className="ad-table ad-table-compact">
          <thead>
            <tr>
              <th />
              {columns.map((c) => (
                <th key={c.id} className="num">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mrows.map((r) => (
              <tr key={r.id}>
                <th>{r.label}</th>
                {columns.map((c) => (
                  <td key={c.id} className="num">
                    {values.filter((v) => [].concat(v?.[r.id] || []).includes(c.id)).length}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  } else if (field.type === 'short_text' && field.props?.selector?.enabled) {
    const opts = field.props.selector.options || []
    body = (
      <>
        <Bars total={n} rows={opts.map((o) => ({ key: o.id, label: o.label, count: values.filter((v) => v?.option === o.id).length }))} />
        <Latest values={values} field={field} />
      </>
    )
  } else if (field.type === 'signature') {
    body = <p className="ad-muted">{n} assinaturas. Veja cada uma na aba Respostas.</p>
  } else {
    body = <Latest values={values} field={field} />
  }

  return (
    <article className="ad-card ad-sum">
      <header className="ad-sum-head">
        <span className="ad-item-chip" style={{ background: d?.color }}>
          <Icon name={d?.glyph} size={13} stroke={2} />
        </span>
        <h3>{field.title || 'Sem título'}</h3>
        <span className="ad-muted ad-sum-n">
          {n} de {rows.length} {rows.length === 1 ? 'respondeu' : 'responderam'}
        </span>
      </header>
      {n === 0 ? <p className="ad-muted">Ainda sem respostas.</p> : body}
    </article>
  )
}

function Latest({ values, field }) {
  const [all, setAll] = useState(false)
  const list = all ? values : values.slice(0, 6)
  return (
    <>
      <ul className="ad-latest">
        {list.map((v, i) => (
          <li key={i}>{formatAnswer(v, field)}</li>
        ))}
      </ul>
      {values.length > 6 && (
        <button className="ad-btn ad-btn-sm ad-btn-quiet" onClick={() => setAll((a) => !a)}>
          {all ? 'Mostrar menos' : `Mostrar todas (${values.length})`}
        </button>
      )}
    </>
  )
}

function PerDay({ rows }) {
  const days = useMemo(() => {
    const map = new Map()
    for (const r of rows) {
      const k = new Date(r.submitted_at).toLocaleDateString('sv-SE')
      map.set(k, (map.get(k) || 0) + 1)
    }
    const keys = [...map.keys()].sort()
    if (!keys.length) return []
    const out = []
    const d = new Date(`${keys[0]}T12:00:00`)
    const last = new Date(`${keys[keys.length - 1]}T12:00:00`)
    while (d <= last && out.length < 120) {
      const k = d.toLocaleDateString('sv-SE')
      out.push({ k, n: map.get(k) || 0 })
      d.setDate(d.getDate() + 1)
    }
    return out.slice(-60)
  }, [rows])
  if (days.length < 2) return null
  const max = Math.max(...days.map((x) => x.n))
  return (
    <article className="ad-card ad-perday">
      <h3>Respostas por dia</h3>
      <div className="ad-cols" role="img" aria-label="Respostas por dia">
        {days.map((x) => (
          <span key={x.k} className="ad-col" title={`${new Date(`${x.k}T12:00:00`).toLocaleDateString('pt-BR')}: ${x.n}`}>
            <span style={{ height: `${max ? (x.n / max) * 100 : 0}%` }} />
          </span>
        ))}
      </div>
      <div className="ad-cols-axis ad-muted">
        <span>{new Date(`${days[0].k}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>
        <span>máx. {max}/dia</span>
        <span>{new Date(`${days[days.length - 1].k}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>
      </div>
    </article>
  )
}

/* ------------------------------------------------------------ page */

function csvCell(v) {
  const s = String(v ?? '')
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export default function Results() {
  const { id } = useParams()
  const [form, setForm] = useState(null)
  const [rows, setRows] = useState(null)
  const [views, setViews] = useState(0)
  const [tab, setTab] = useState('summary')
  const [status, setStatus] = useState('completed')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(null)
  const [del, setDel] = useState(null)
  const [err, setErr] = useState('')
  const [toast, showToast] = useToast()

  const load = async () => {
    try {
      const [{ data: f, error }, all, { data: c }] = await Promise.all([
        supabase.from('forms').select('id, slug, title, schema, draft, published, closed').eq('id', id).single(),
        fetchAll(id),
        supabase.rpc('admin_form_counts'),
      ])
      if (error) throw error
      setForm(f)
      setRows(all)
      setViews(c?.find((x) => x.form_id === id)?.views || 0)
      document.title = `${f.title} · Resultados`
    } catch {
      setErr('Não foi possível carregar os resultados.')
    }
  }
  useEffect(() => {
    load()
  }, [id]) // eslint-disable-line

  const schema = form ? (form.schema?.fields ? form.schema : form.draft) : null
  const fields = useMemo(() => (schema ? answerableFields(schema.fields) : []), [schema])
  const completed = useMemo(() => (rows || []).filter((r) => r.status === 'completed'), [rows])
  const partials = useMemo(() => (rows || []).filter((r) => r.status === 'partial'), [rows])
  const medianMs = median(completed.map((r) => r.duration_ms).filter((x) => x != null))

  const listRows = useMemo(() => {
    const base = status === 'all' ? rows || [] : status === 'partial' ? partials : completed
    if (!q.trim()) return base
    const s = q.toLowerCase()
    return base.filter(
      (r) => (r.protocol || '').toLowerCase().includes(s.replace(/\s/g, '')) || fields.some((f) => formatAnswer(r.answers?.[f.id], f).toLowerCase().includes(s)),
    )
  }, [rows, completed, partials, status, q, fields])

  const fileBase = () =>
    (form.title || 'respostas').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\- ]+/g, '').trim().slice(0, 80) || 'respostas'

  // One column per answer; selector fields and contact/address fields are split
  const exportColumns = () => {
    const cols = [
      {
        header: 'Enviada em',
        width: 18,
        // Excel has no time zone: shift so the cell shows the viewer's local time
        get: (r) => {
          const d = new Date(r.submitted_at)
          return { value: new Date(d.getTime() - d.getTimezoneOffset() * 60000), format: 'dd/mm/yyyy hh:mm' }
        },
      },
      { header: 'Protocolo', width: 12, get: (r) => r.protocol || null },
      { header: 'Situação', width: 11, get: (r) => (r.status === 'completed' ? 'Completa' : 'Parcial') },
      { header: 'Tempo (segundos)', width: 10, get: (r) => (r.duration_ms == null ? null : Math.round(r.duration_ms / 1000)) },
    ]
    for (const f of fields) {
      const title = f.title || f.id
      if (f.type === 'short_text' && f.props?.selector?.enabled) {
        const opts = f.props.selector.options || []
        cols.push({ header: `${title} (tipo)`, width: 10, get: (r) => opts.find((o) => o.id === r.answers?.[f.id]?.option)?.label ?? null })
        cols.push({ header: title, width: 22, get: (r) => r.answers?.[f.id]?.value ?? null })
      } else if (f.type === 'contact_info' || f.type === 'address') {
        for (const [k, sub] of Object.entries(f.props?.subfields || {}).filter(([, x]) => x.enabled))
          cols.push({ header: `${title}: ${sub.label}`, width: 20, get: (r) => r.answers?.[f.id]?.[k] ?? null })
      } else if (['nps', 'opinion_scale', 'rating'].includes(f.type)) {
        cols.push({ header: title, width: 10, get: (r) => (r.answers?.[f.id] == null ? null : Number(r.answers[f.id])) })
      } else if (f.type === 'number') {
        cols.push({ header: title, width: 12, get: (r) => {
          const n = Number(String(r.answers?.[f.id] ?? '').replace(',', '.'))
          return r.answers?.[f.id] == null || Number.isNaN(n) ? null : n
        } })
      } else if (f.type === 'signature') {
        cols.push({ header: title, width: 14, get: (r) => (r.answers?.[f.id] ? 'assinada (ver no painel)' : null) })
      } else {
        cols.push({ header: title, width: 24, get: (r) => formatAnswer(r.answers?.[f.id], f) || null })
      }
    }
    return cols
  }

  const exportXlsx = async () => {
    try {
      const { default: writeExcelFile } = await import('write-excel-file/browser')
      const cols = exportColumns()
      const data = [
        cols.map((c) => ({ value: c.header, fontWeight: 'bold' })),
        ...listRows.map((r) => cols.map((c) => c.get(r))),
      ]
      await writeExcelFile(data, { columns: cols.map((c) => ({ width: c.width })), stickyRowsCount: 1 }).toFile(`${fileBase()}.xlsx`)
    } catch (e) {
      console.error(e)
      showToast('Não foi possível gerar o Excel. Tente o CSV.', 'err')
    }
  }

  const exportCsv = () => {
    const cols = exportColumns()
    const cell = (v) => (v && typeof v === 'object' && v.value instanceof Date ? fmtDateTime(v.value.toISOString()) : v)
    const lines = [cols.map((c) => csvCell(c.header)).join(';')]
    for (const r of listRows) lines.push(cols.map((c) => csvCell(cell(c.get(r)))).join(';'))
    const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${fileBase()}.csv`
    a.click()
  }

  const remove = async (r) => {
    const { error } = await supabase.from('responses').delete().eq('id', r.id)
    setDel(null)
    setOpen(null)
    if (error) showToast('Não foi possível excluir.', 'err')
    else {
      setRows((rs) => rs.filter((x) => x.id !== r.id))
      showToast('Resposta excluída. Os valores únicos dela foram liberados.')
    }
  }

  if (err)
    return (
      <div className="ad ad-center">
        <div className="ad-card ad-login">
          <h1>{err}</h1>
          <Link className="ad-btn" to="/admin">
            Voltar
          </Link>
        </div>
      </div>
    )
  if (!form || !rows)
    return (
      <div className="ad ad-center">
        <div className="ad-spinner" />
      </div>
    )

  return (
    <div className="ad-page">
      <header className="ad-top">
        <div className="ad-top-left">
          <Link className="ad-icon-btn" to="/admin" aria-label="Voltar para a lista">
            <Icon name="back" size={20} />
          </Link>
          <h1 className="ad-top-title">{form.title}</h1>
        </div>
        <div className="ad-top-right">
          <a className="ad-btn ad-btn-quiet ad-hide-sm" href={publicFormUrl(form.slug)} target="_blank" rel="noopener noreferrer">
            <Icon name="globe" size={16} /> Abrir formulário
          </a>
          <Link className="ad-btn" to={`/admin/forms/${id}`}>
            Editar
          </Link>
        </div>
      </header>

      <main className="ad-results">
        <section className="ad-stats" aria-label="Números do formulário">
          <div className="ad-stat">
            <b>{views}</b>
            <span>Visualizações</span>
          </div>
          <div className="ad-stat is-main">
            <b>{completed.length}</b>
            <span>Respostas completas</span>
          </div>
          <div className="ad-stat">
            <b>{views ? `${pct(completed.length, views)}%` : '—'}</b>
            <span>Taxa de conclusão</span>
          </div>
          <div className="ad-stat">
            <b>{fmtDuration(medianMs)}</b>
            <span>Tempo típico de preenchimento</span>
          </div>
          {partials.length > 0 && (
            <div className="ad-stat">
              <b>{partials.length}</b>
              <span>Parciais</span>
            </div>
          )}
        </section>

        <div className="ad-tabs-sm ad-results-tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'summary'} className={tab === 'summary' ? 'is-on' : ''} onClick={() => setTab('summary')}>
            Resumo
          </button>
          <button role="tab" aria-selected={tab === 'list'} className={tab === 'list' ? 'is-on' : ''} onClick={() => setTab('list')}>
            Respostas
          </button>
          <button className="ad-btn ad-btn-sm ad-btn-quiet" onClick={load}>
            Atualizar
          </button>
        </div>

        {tab === 'summary' && (
          <div className="ad-sum-grid">
            <PerDay rows={completed} />
            {completed.length === 0 && (
              <div className="ad-empty">
                <p>Nenhuma resposta completa ainda.</p>
                <Link className="ad-btn" to={`/admin/forms/${id}`}>
                  Compartilhar o formulário
                </Link>
              </div>
            )}
            {completed.length > 0 && fields.map((f) => <FieldSummary key={f.id} field={f} rows={completed} />)}
          </div>
        )}

        {tab === 'list' && (
          <>
            <div className="ad-list-tools">
              <input className="ad-input" placeholder="Buscar nas respostas ou protocolo" value={q} onChange={(e) => setQ(e.target.value)} />
              <select className="ad-input ad-select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filtrar">
                <option value="completed">Completas ({completed.length})</option>
                <option value="partial">Parciais ({partials.length})</option>
                <option value="all">Todas ({rows.length})</option>
              </select>
              <button className="ad-btn ad-btn-primary" onClick={exportXlsx} disabled={!listRows.length}>
                <Icon name="download" size={16} /> Exportar Excel
              </button>
              <button className="ad-btn ad-btn-quiet" onClick={exportCsv} disabled={!listRows.length}>
                CSV
              </button>
            </div>
            {listRows.length === 0 ? (
              <div className="ad-empty">
                <p>Nenhuma resposta encontrada.</p>
              </div>
            ) : (
              <div className="ad-table-wrap ad-resp-wrap">
                <table className="ad-table ad-resp">
                  <thead>
                    <tr>
                      <th>Enviada em</th>
                      <th>Protocolo</th>
                      <th>Tempo</th>
                      {fields.map((f) => (
                        <th key={f.id}>{f.title || 'Sem título'}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {listRows.map((r) => (
                      <tr key={r.id} onClick={() => setOpen(r)} className="is-click">
                        <td className="nowrap">
                          {fmtDateTime(r.submitted_at)}
                          {r.status === 'partial' && <span className="ad-status is-draft">Parcial</span>}
                        </td>
                        <td className="nowrap ad-mono">{r.protocol}</td>
                        <td className="nowrap ad-muted">{fmtDuration(r.duration_ms)}</td>
                        {fields.map((f) => (
                          <td key={f.id}>{f.type === 'signature' && r.answers?.[f.id] ? <img className="ad-sig-thumb" src={r.answers[f.id]} alt="Assinatura" /> : formatAnswer(r.answers?.[f.id], f)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>

      {open && (
        <Modal title="Resposta" onClose={() => setOpen(null)}>
          <p className="ad-muted">
            Protocolo <b className="ad-mono">{open.protocol}</b>, enviada em {fmtDateTime(open.submitted_at)}, em {fmtDuration(open.duration_ms)} ({open.status === 'completed' ? 'completa' : 'parcial'})
          </p>
          <dl className="ad-detail">
            {fields.map((f) => (
              <div key={f.id}>
                <dt>{f.title || 'Sem título'}</dt>
                <dd>{f.type === 'signature' && open.answers?.[f.id] ? <img className="ad-sig" src={open.answers[f.id]} alt="Assinatura" /> : formatAnswer(open.answers?.[f.id], f) || <span className="ad-muted">Sem resposta</span>}</dd>
              </div>
            ))}
          </dl>
          <div className="ad-modal-actions">
            <button className="ad-btn ad-btn-danger-quiet" onClick={() => setDel(open)}>
              <Icon name="trash" size={14} /> Excluir resposta
            </button>
          </div>
        </Modal>
      )}
      {del && (
        <Modal title="Excluir resposta" onClose={() => setDel(null)}>
          <p>A resposta some dos resultados e quem enviou poderá responder de novo com o mesmo CPF ou e-mail. Não dá para desfazer.</p>
          <div className="ad-modal-actions">
            <button className="ad-btn" onClick={() => setDel(null)}>
              Cancelar
            </button>
            <button className="ad-btn ad-btn-danger" onClick={() => remove(del)}>
              Excluir
            </button>
          </div>
        </Modal>
      )}
      {toast}
    </div>
  )
}
