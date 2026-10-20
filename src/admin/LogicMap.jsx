import { useMemo, useState } from 'react'
import { plainLine } from '../lib/rich'
import { FIELD_TYPES, flattenFields } from '../lib/fields'
import { OPS } from '../lib/logic'
import Icon from '../Icon'

// Top-to-bottom layout: each "level" is a row, nodes in the same level sit side by side
const W = 176
const H = 58
const LEVEL_GAP = 64
const SIDE_GAP = 28
const PAD = 24
const PADX = 96 // room for edges that leave from the side

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
    nodes.push({ id: f.id, kind: 'field', field: f, title: plainLine(f.title) || 'Sem título', num: counted ? num : null })
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
  fields.forEach((f, i) => {
    const logic = schema.logic?.[f.id]
    const next = fields[i + 1]?.id || firstEnd
    const rules = (logic?.rules || []).filter((r) => norm(r.to))
    rules.forEach((r) => add(f.id, norm(r.to), 'rule', ruleText(r, byId, f.id)))
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

function layout(nodes, edges) {
  const order = Object.fromEntries(nodes.map((n, i) => [n.id, i]))
  const lvl = Object.fromEntries(nodes.map((n) => [n.id, 0]))
  // Longest path over forward edges (edges to later nodes), so branches get their own level
  for (const n of nodes) {
    for (const e of edges) {
      if (e.from === n.id && order[e.to] > order[e.from] && !e.to.startsWith('end:')) lvl[e.to] = Math.max(lvl[e.to], lvl[n.id] + 1)
    }
  }
  const fieldLvls = nodes.filter((n) => n.kind !== 'end').map((n) => lvl[n.id])
  const endLvl = (fieldLvls.length ? Math.max(...fieldLvls) : 0) + 1
  nodes.filter((n) => n.kind === 'end').forEach((n) => (lvl[n.id] = endLvl))

  const rows = {}
  nodes.forEach((n) => (rows[lvl[n.id]] ||= []).push(n))
  const maxPer = Math.max(...Object.values(rows).map((r) => r.length))
  const innerW = maxPer * W + (maxPer - 1) * SIDE_GAP
  const pos = {}
  for (const [l, list] of Object.entries(rows)) {
    const w = list.length * W + (list.length - 1) * SIDE_GAP
    const left = PADX + (innerW - w) / 2
    list.forEach((n, i) => (pos[n.id] = { x: left + i * (W + SIDE_GAP), y: PAD + Number(l) * (H + LEVEL_GAP), col: Number(l) }))
  }
  return { pos, width: PADX * 2 + innerW, height: PAD * 2 + (endLvl + 1) * H + endLvl * LEVEL_GAP }
}

function bez(p0, p1, p2, p3, t) {
  const u = 1 - t
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3
}

export default function LogicMap({ schema, selectedId, onSelect }) {
  const { nodes, edges } = useMemo(() => buildGraph(schema), [schema])
  const { pos, width, height } = useMemo(() => layout(nodes, edges), [nodes, edges])
  const [zoom, setZoom] = useState(1)
  let backCount = 0
  const rightX = width - 8

  const paths = edges.map((e, i) => {
    const a = pos[e.from]
    const b = pos[e.to]
    if (!a || !b) return null
    let d
    let mid
    if (b.col === a.col + 1) {
      const sx = a.x + W / 2
      const sy = a.y + H
      const tx = b.x + W / 2
      const ty = b.y
      const dy = Math.max(28, (ty - sy) / 2)
      d = `M${sx},${sy} C${sx},${sy + dy} ${tx},${ty - dy} ${tx},${ty}`
      // Label near the target end, so branches leaving one node don't overlap
      mid = { x: bez(sx, sx, tx, tx, 0.7), y: bez(sy, sy + dy, ty - dy, ty, 0.7) }
    } else if (b.col > a.col) {
      // Skips one or more levels: leave from the side so it doesn't run behind the nodes in between
      const dir = b.x + W / 2 >= a.x + W / 2 ? 1 : -1
      const sx = dir > 0 ? a.x + W : a.x
      const sy = a.y + H / 2
      const tx = b.x + W / 2 + dir * (W / 2 - 14)
      const ty = b.y
      const out = sx + dir * 70
      d = `M${sx},${sy} C${out},${sy} ${tx},${ty - 70} ${tx},${ty}`
      mid = { x: bez(sx, out, tx, tx, 0.5), y: bez(sy, sy, ty - 70, ty, 0.5) }
    } else {
      // Jump back up (or sideways): route along the right edge
      backCount += 1
      const sx = a.x + W
      const sy = a.y + H / 2
      const tx = b.x + W
      const ty = b.y + H / 2
      const out = rightX + backCount * 16
      d = `M${sx},${sy} C${out},${sy} ${out},${ty} ${tx},${ty}`
      mid = { x: bez(sx, out, out, tx, 0.5), y: bez(sy, sy, ty, ty, 0.5) }
    }
    const active = selectedId && (e.from === selectedId || e.to === selectedId)
    return { ...e, d, mid, key: `${e.from}->${e.to}-${i}`, active }
  })
  const svgH = height
  const svgW = width + (backCount ? 16 + backCount * 16 : 0)

  return (
    <div className="ad-map">
      <div className="ad-map-bar">
        <span className="ad-map-legend">
          <i className="is-rule" /> regra
          <i className="is-else" /> nos outros casos
          <i className="is-next" /> próxima pergunta
        </span>
        <span className="ad-map-zoom">
          <button className="ad-icon-btn" aria-label="Diminuir" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))}>
            <Icon name="down" size={16} />
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button className="ad-icon-btn" aria-label="Aumentar" onClick={() => setZoom((z) => Math.min(1.5, +(z + 0.1).toFixed(2)))}>
            <Icon name="up" size={16} />
          </button>
        </span>
      </div>
      <div className="ad-map-scroll">
        <div className="ad-map-canvas" style={{ width: svgW * zoom, height: svgH * zoom }}>
          <div style={{ width: svgW, height: svgH, transform: `scale(${zoom})`, transformOrigin: '0 0', position: 'relative' }}>
            <svg width={svgW} height={svgH} className="ad-map-svg" aria-hidden="true">
              <defs>
                {['rule', 'else', 'next', 'always', 'active'].map((k) => (
                  <marker key={k} id={`arr-${k}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                    <path d="M0,0 L10,5 L0,10 z" className={`ad-map-arrow is-${k}`} />
                  </marker>
                ))}
              </defs>
              {paths.filter(Boolean).map((p) => (
                <path key={p.key} d={p.d} className={`ad-map-edge is-${p.kind} ${p.active ? 'is-active' : ''}`} markerEnd={`url(#arr-${p.active ? 'active' : p.kind})`} />
              ))}
            </svg>
            {paths
              .filter((p) => p && p.labels.length)
              .map((p) => (
                <span key={`l-${p.key}`} className={`ad-map-label is-${p.kind} ${p.active ? 'is-active' : ''}`} style={{ left: p.mid.x, top: p.mid.y }} title={p.labels.join(' | ')}>
                  {p.labels.join(' | ')}
                </span>
              ))}
            {nodes.map((n) => {
              const p = pos[n.id]
              const d = n.field ? FIELD_TYPES[n.field.type] : null
              const clickable = n.kind === 'field'
              return (
                <button
                  key={n.id}
                  type="button"
                  className={`ad-map-node is-${n.kind} ${n.id === selectedId ? 'is-on' : ''} ${n.reachable ? '' : 'is-orphan'}`}
                  style={{ left: p.x, top: p.y, width: W, height: H }}
                  onClick={() => clickable && onSelect(n.id)}
                  disabled={!clickable}
                  title={n.title}
                >
                  <span className="ad-item-chip" style={{ background: d?.color }}>
                    <Icon name={n.kind === 'welcome' ? 'welcome' : n.kind === 'end' ? 'end' : d?.glyph} size={12} stroke={2} />
                    {(n.num || n.letter) && <b>{n.num || n.letter}</b>}
                  </span>
                  <span className="ad-map-title">{n.title}</span>
                  {!n.reachable && <span className="ad-map-orphan">ninguém chega aqui</span>}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
