import { useEffect, useMemo, useRef, useState } from 'react'
import { plainLine } from '../lib/rich'
import { FIELD_TYPES, flattenFields, screenLabel } from '../lib/fields'
import { OPS, isMultiSelect, fanOutAfter } from '../lib/logic'
import Icon from '../Icon'

// Left-to-right layout: each column is a step; pages that are alternatives stack in the same column
const W = 196
const COL_GAP = 90
const ROW_GAP = 26
const PAD = 40
const OPT_MAX = 3

function valueLabel(field, op, value) {
  if (op === 'answered' || op === 'not_answered') return ''
  if (!field) return String(value ?? '')
  if (field.props?.options) return field.props.options.find((o) => o.id === value)?.label ?? String(value ?? '')
  if (field.type === 'short_text' && field.props?.selector?.enabled && (op === 'is' || op === 'is_not'))
    return field.props.selector.options.find((o) => o.id === value)?.label ?? String(value ?? '')
  if (field.type === 'yes_no') return value === 'true' ? 'Sim' : value === 'false' ? 'Não' : ''
  if (field.type === 'legal') return value === 'true' ? field.props?.acceptLabel || 'Aceito' : field.props?.rejectLabel || 'Não aceito'
  return String(value ?? '')
}

function ruleText(rule, byId, fromId) {
  return (rule.conditions || [])
    .filter((c) => c.field)
    .map((c) => {
      const f = byId[c.field]
      const v = valueLabel(f, c.op, c.value)
      const own = c.field === fromId
      return `${own ? '' : `${plainLine(f?.title) || '?'}: `}${OPS[c.op] || c.op}${v ? ` “${v}”` : ''}`
    })
    .join(rule.join === 'or' ? ' ou ' : ' e ')
}

export function buildGraph(schema) {
  const fields = schema.fields || []
  const endings = schema.endings || []
  const byId = Object.fromEntries(flattenFields(fields).map((f) => [f.id, f]))
  const firstEnd = endings[0] ? `end:${endings[0].id}` : null
  const nodes = []
  const welcomeOn = schema.welcome?.enabled !== false
  if (welcomeOn) nodes.push({ id: 'welcome', kind: 'welcome', title: plainLine(schema.welcome?.title) || 'Boas-vindas' })
  let num = 0
  for (const f of fields) {
    const counted = f.type !== 'statement' && f.type !== 'partial_submit'
    if (counted) num += 1
    nodes.push({ id: f.id, kind: 'field', field: f, title: f.type === 'group' ? plainLine(f.title) || 'Página' : plainLine(f.title) || 'Sem título', num: counted ? num : null })
  }
  endings.forEach((e, i) => nodes.push({ id: `end:${e.id}`, kind: 'end', title: plainLine(e.title) || 'Tela final', letter: String.fromCharCode(65 + i) }))
  const valid = new Set(nodes.map((n) => n.id))
  const norm = (t) => (t && valid.has(t) ? t : null)

  const edges = []
  const add = (from, to, kind, label) => {
    if (!to) return
    const ex = edges.find((e) => e.from === from && e.to === to)
    if (ex) {
      if (label) ex.labels.push(label)
      if (kind === 'rule') ex.kind = 'rule'
      return
    }
    edges.push({ from, to, kind, labels: label ? [label] : [] })
  }

  if (welcomeOn) add('welcome', fields[0]?.id || firstEnd, 'next')

  // Pages reached from a multi-answer question: the person goes through each marked option in turn
  const fanOf = {}
  fields.forEach((f) => {
    if (!isMultiSelect(f)) return
    const rules = (schema.logic?.[f.id]?.rules || []).filter((r) => norm(r.to) && !r.to.startsWith('end:'))
    const targets = [...new Set(rules.map((r) => r.to))]
    const after = norm(fanOutAfter(schema, f.id))
    targets.forEach((t, i) => {
      if (!fanOf[t]) fanOf[t] = { later: targets.slice(i + 1).map((x) => ({ to: x, rule: rules.find((r) => r.to === x) })), after, question: f }
    })
  })

  fields.forEach((f, i) => {
    const logic = schema.logic?.[f.id]
    const next = fields[i + 1]?.id || firstEnd
    const rules = (logic?.rules || []).filter((r) => norm(r.to))
    rules.forEach((r) => add(f.id, norm(r.to), 'rule', ruleText(r, byId, f.id)))
    const fan = fanOf[f.id]
    if (fan && !rules.length && !norm(logic?.otherwise)) {
      // The person goes through the other marked options first (explained in the rules panel)
      add(f.id, fan.after, 'next', 'depois das opções marcadas')
      return
    }
    const other = norm(logic?.otherwise)
    if (rules.length) add(f.id, other || next, 'else', 'nos outros casos')
    else add(f.id, other || next, other ? 'always' : 'next', other ? 'sempre' : '')
  })

  // Reachability from the start
  const start = welcomeOn ? 'welcome' : fields[0]?.id || firstEnd
  const seen = new Set()
  const stack = [start]
  while (stack.length) {
    const n = stack.pop()
    if (!n || seen.has(n)) continue
    seen.add(n)
    edges.filter((e) => e.from === n).forEach((e) => stack.push(e.to))
  }
  nodes.forEach((n) => (n.reachable = seen.has(n.id)))
  return { nodes, edges, byId }
}


/** Options shown under a node's title, like "- CAF". */
function nodeOptions(n) {
  const f = n.field
  if (!f) return []
  const list = (f.props?.options || []).map((o) => plainLine(o.label))
  if (f.type === 'yes_no') return ['Sim', 'Não']
  if (f.type === 'group') return (f.children || []).map((c) => plainLine(c.title)).filter(Boolean)
  return list
}

function nodeHeight(n) {
  const opts = nodeOptions(n)
  const lines = Math.min(opts.length, OPT_MAX) + (opts.length > OPT_MAX ? 1 : 0)
  const titleLines = String(n.title || '').length > 24 ? 2 : 1
  return 50 + titleLines * 17 + (lines ? 6 + lines * 15 : 0)
}

function layout(nodes, edges) {
  const order = Object.fromEntries(nodes.map((n, i) => [n.id, i]))
  const col = Object.fromEntries(nodes.map((n) => [n.id, 0]))
  for (const n of nodes) {
    for (const e of edges) {
      if (e.from === n.id && order[e.to] > order[e.from] && !e.to.startsWith('end:')) col[e.to] = Math.max(col[e.to], col[n.id] + 1)
    }
  }
  const fieldCols = nodes.filter((n) => n.kind !== 'end').map((n) => col[n.id])
  const endCol = (fieldCols.length ? Math.max(...fieldCols) : 0) + 1
  nodes.filter((n) => n.kind === 'end').forEach((n) => (col[n.id] = endCol))

  const columns = {}
  nodes.forEach((n) => (columns[col[n.id]] ||= []).push(n))
  const colH = (list) => list.reduce((h, n) => h + nodeHeight(n), 0) + (list.length - 1) * ROW_GAP
  const maxH = Math.max(...Object.values(columns).map(colH))
  const pos = {}
  for (const [c, list] of Object.entries(columns)) {
    let y = PAD + (maxH - colH(list)) / 2
    for (const n of list) {
      const h = nodeHeight(n)
      pos[n.id] = { x: PAD + Number(c) * (W + COL_GAP), y, h, col: Number(c) }
      y += h + ROW_GAP
    }
  }
  return { pos, width: PAD * 2 + (endCol + 1) * W + endCol * COL_GAP, height: PAD * 2 + maxH }
}

function bez(p0, p1, p2, p3, t) {
  const u = 1 - t
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3
}

export default function LogicMap({ schema, selectedId, onSelect }) {
  const { nodes, edges } = useMemo(() => buildGraph(schema), [schema])
  const { pos, width, height } = useMemo(() => layout(nodes, edges), [nodes, edges])
  const [zoom, setZoom] = useState(1)
  const scroller = useRef(null)
  const fitted = useRef(false)

  // Fit the flow on screen, but never so small that text can't be read
  const fit = (minZoom = 0.7) => {
    const el = scroller.current
    if (!el) return
    const z = Math.max(minZoom, Math.min(1, (el.clientWidth - 16) / width, (el.clientHeight - 16) / height))
    setZoom(+z.toFixed(2))
    return z
  }
  const centerOn = (id, z, smooth) => {
    const el = scroller.current
    const p = pos[id]
    if (!el || !p) return
    el.scrollTo({ left: (p.x + W / 2) * z - el.clientWidth / 2, top: (p.y + p.h / 2) * z - el.clientHeight / 2, behavior: smooth ? 'smooth' : 'auto' })
  }
  useEffect(() => {
    if (fitted.current || !width) return
    fitted.current = true
    const z = fit()
    // Start where the flow branches (or on the selected page)
    const focus = selectedId || [...logicIds][0]
    if (focus) requestAnimationFrame(() => centerOn(focus, z))
  }, [width]) // eslint-disable-line
  useEffect(() => {
    if (!fitted.current || !selectedId) return
    const el = scroller.current
    const p = pos[selectedId]
    if (!el || !p) return
    const x = (p.x + W / 2) * zoom
    const y = (p.y + p.h / 2) * zoom
    const inView = x > el.scrollLeft + 40 && x < el.scrollLeft + el.clientWidth - 40 && y > el.scrollTop + 40 && y < el.scrollTop + el.clientHeight - 40
    if (!inView) centerOn(selectedId, zoom, true)
  }, [selectedId]) // eslint-disable-line
  const pan = useRef(null)
  const logicIds = new Set(edges.filter((e) => e.kind === 'rule' || e.kind === 'always').map((e) => e.from))

  let back = 0
  const paths = edges
    .map((e, i) => {
      const a = pos[e.from]
      const b = pos[e.to]
      if (!a || !b) return null
      let d
      let mid
      if (b.col > a.col) {
        const sx = a.x + W + (logicIds.has(e.from) ? 18 : 0)
        const sy = a.y + a.h / 2
        const tx = b.x
        const ty = b.y + b.h / 2
        const dx = Math.max(50, (tx - sx) * 0.5)
        d = `M${sx},${sy} C${sx + dx},${sy} ${tx - dx},${ty} ${tx},${ty}`
        mid = { x: bez(sx, sx + dx, tx - dx, tx, 0.55), y: bez(sy, sy, ty, ty, 0.55) }
      } else {
        // Going back: route under the diagram
        back += 1
        const sx = a.x + W / 2
        const sy = a.y + a.h
        const tx = b.x + W / 2
        const ty = b.y + b.h
        const low = height - PAD / 2 + back * 16
        d = `M${sx},${sy} C${sx},${low} ${tx},${low} ${tx},${ty}`
        mid = { x: bez(sx, sx, tx, tx, 0.5), y: bez(sy, low, low, ty, 0.5) }
      }
      const active = selectedId && (e.from === selectedId || e.to === selectedId)
      return { ...e, d, mid, key: `${e.from}->${e.to}-${i}`, active }
    })
    .filter(Boolean)
  const svgH = height + (back ? back * 16 + 8 : 0)

  // Drag the background to move around
  const onPointerDown = (e) => {
    if (e.target.closest('button')) return
    pan.current = { x: e.clientX, y: e.clientY, l: scroller.current.scrollLeft, t: scroller.current.scrollTop }
    scroller.current.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e) => {
    if (!pan.current) return
    scroller.current.scrollLeft = pan.current.l - (e.clientX - pan.current.x)
    scroller.current.scrollTop = pan.current.t - (e.clientY - pan.current.y)
  }
  const onPointerUp = () => (pan.current = null)

  return (
    <div className="ad-map">
      <div className="ad-map-bar">
        <span className="ad-map-legend">
          <i className="is-rule" /> regra
          <i className="is-else" /> nos outros casos
          <i className="is-next" /> próxima página
        </span>
        <span className="ad-map-zoom">
          <button className="ad-btn ad-btn-sm ad-btn-quiet" onClick={() => fit(0.3)}>
            Ver tudo
          </button>
          <button className="ad-icon-btn" aria-label="Diminuir" onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.1).toFixed(2)))}>
            <Icon name="down" size={16} />
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button className="ad-icon-btn" aria-label="Aumentar" onClick={() => setZoom((z) => Math.min(1.5, +(z + 0.1).toFixed(2)))}>
            <Icon name="up" size={16} />
          </button>
        </span>
      </div>
      <div className="ad-map-scroll" ref={scroller} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        <div className="ad-map-canvas" style={{ width: width * zoom, height: svgH * zoom }}>
          <div style={{ width, height: svgH, transform: `scale(${zoom})`, transformOrigin: '0 0', position: 'relative' }}>
            <svg width={width} height={svgH} className="ad-map-svg" aria-hidden="true">
              <defs>
                {['rule', 'else', 'next', 'always', 'active'].map((k) => (
                  <marker key={k} id={`arr-${k}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M0,0 L10,5 L0,10 z" className={`ad-map-arrow is-${k}`} />
                  </marker>
                ))}
              </defs>
              {paths.map((p) => (
                <path key={p.key} d={p.d} className={`ad-map-edge is-${p.kind} ${p.active ? 'is-active' : ''}`} markerEnd={`url(#arr-${p.active ? 'active' : p.kind})`} />
              ))}
            </svg>
            {/* Conditions are shown for the selected page only, to keep the map readable */}
            {paths
              .filter((p) => p.active && p.labels.length && p.from === selectedId)
              .map((p) => (
                <span key={`l-${p.key}`} className={`ad-map-label is-${p.kind}`} style={{ left: p.mid.x, top: p.mid.y }} title={p.labels.join(' | ')}>
                  {p.labels.join(' | ')}
                </span>
              ))}
            {nodes.map((n) => {
              const p = pos[n.id]
              const d = n.field ? FIELD_TYPES[n.field.type] : null
              const clickable = n.kind === 'field'
              const opts = nodeOptions(n)
              return (
                <div key={n.id} className="ad-map-node-wrap" style={{ left: p.x, top: p.y, width: W, height: p.h }}>
                  <button
                    type="button"
                    className={`ad-map-node is-${n.kind} ${n.id === selectedId ? 'is-on' : ''} ${n.reachable ? '' : 'is-orphan'}`}
                    onClick={() => clickable && onSelect(n.id)}
                    disabled={!clickable}
                    title={n.title}
                  >
                    <span className="ad-map-head">
                      <span className="ad-item-chip" style={{ background: d?.color }}>
                        <Icon name={n.kind === 'welcome' ? 'welcome' : n.kind === 'end' ? 'end' : d?.glyph} size={12} stroke={2} />
                        {(n.num || n.letter) && <b>{n.num || n.letter}</b>}
                      </span>
                    </span>
                    <span className="ad-map-title">{n.title}</span>
                    {opts.length > 0 && (
                      <span className="ad-map-opts">
                        {opts.slice(0, OPT_MAX).map((o, i) => (
                          <span key={i}>- {o}</span>
                        ))}
                        {opts.length > OPT_MAX && <span>- …</span>}
                      </span>
                    )}
                  </button>
                  {logicIds.has(n.id) && (
                    <button type="button" className="ad-map-branch" aria-label={`Regras de ${n.title}`} title="Tem regras de lógica" onClick={() => onSelect(n.id)}>
                      <Icon name="logic" size={15} stroke={2} />
                    </button>
                  )}
                  {!n.reachable && <span className="ad-map-orphan">ninguém chega aqui</span>}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
