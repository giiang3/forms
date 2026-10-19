import { useEffect, useMemo, useRef, useState } from 'react'
import { DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Icon from '../Icon'
import { applyMask, maskPhoneBR } from '../lib/validation'

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function shuffle(list) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/* ---------------------------------------------------------------- text */

export function TextLine({ value, onChange, placeholder, type = 'text', autoFocus, onEnter, inputMode, maxLength, ariaLabel }) {
  const ref = useRef(null)
  useEffect(() => {
    if (autoFocus) setTimeout(() => ref.current?.focus({ preventScroll: true }), 350)
  }, [autoFocus])
  return (
    <input
      ref={ref}
      className="fr-line"
      type={type}
      value={value ?? ''}
      placeholder={placeholder}
      inputMode={inputMode}
      maxLength={maxLength || undefined}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          onEnter?.()
        }
      }}
    />
  )
}

function InlineSelector({ options, value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const current = options.find((o) => o.id === value) || options[0]
  useEffect(() => {
    if (!open) return
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false)
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])
  return (
    <div className="fr-sel" ref={ref}>
      <button
        type="button"
        className="fr-sel-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            const i = options.findIndex((o) => o.id === current?.id)
            const n = options[(i + (e.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length]
            onChange(n.id)
          }
        }}
      >
        <span>{current?.label || 'Tipo'}</span>
        <Icon name="down" size={18} />
      </button>
      {open && (
        <ul className="fr-sel-menu" role="listbox">
          {options.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                role="option"
                aria-selected={o.id === current?.id}
                className={o.id === current?.id ? 'is-on' : ''}
                onClick={() => {
                  onChange(o.id)
                  setOpen(false)
                }}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function ShortText({ field, value, onChange, onEnter, autoFocus }) {
  const p = field.props || {}
  const sel = p.selector?.enabled && p.selector.options?.length ? p.selector : null
  if (sel) {
    const v = value && typeof value === 'object' ? value : { option: sel.options[0].id, value: '' }
    const opt = sel.options.find((o) => o.id === v.option) || sel.options[0]
    return (
      <div className="fr-sel-row">
        <InlineSelector
          options={sel.options}
          value={opt.id}
          onChange={(id) => {
            const nextOpt = sel.options.find((o) => o.id === id)
            onChange({ option: id, value: applyMask(nextOpt?.validation, v.value) })
          }}
        />
        <TextLine
          value={v.value}
          placeholder={opt.placeholder || p.placeholder}
          inputMode={['cpf', 'cnpj', 'digits'].includes(opt.validation) ? 'numeric' : undefined}
          onChange={(t) => onChange({ option: opt.id, value: applyMask(opt.validation, t) })}
          onEnter={onEnter}
          autoFocus={autoFocus}
          ariaLabel={field.title}
        />
      </div>
    )
  }
  return (
    <TextLine
      value={value}
      placeholder={p.placeholder}
      maxLength={p.maxLength}
      inputMode={['cpf', 'cnpj', 'digits'].includes(p.validation) ? 'numeric' : undefined}
      onChange={(t) => onChange(applyMask(p.validation, t))}
      onEnter={onEnter}
      autoFocus={autoFocus}
      ariaLabel={field.title}
    />
  )
}

export function LongText({ field, value, onChange, onEnter, autoFocus }) {
  const ref = useRef(null)
  useEffect(() => {
    if (autoFocus) setTimeout(() => ref.current?.focus({ preventScroll: true }), 350)
  }, [autoFocus])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])
  return (
    <>
      <textarea
        ref={ref}
        rows={1}
        className="fr-line fr-area"
        value={value ?? ''}
        placeholder={field.props?.placeholder}
        maxLength={field.props?.maxLength || undefined}
        aria-label={field.title}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            onEnter?.()
          }
        }}
      />
      <p className="fr-hint">Shift + Enter para quebrar a linha</p>
    </>
  )
}

export function PhoneInput({ field, value, onChange, onEnter, autoFocus }) {
  return (
    <TextLine
      type="tel"
      inputMode="tel"
      value={value}
      placeholder={field.props?.placeholder}
      onChange={(t) => onChange(maskPhoneBR(t))}
      onEnter={onEnter}
      autoFocus={autoFocus}
      ariaLabel={field.title}
    />
  )
}

export function NumberInput({ field, value, onChange, onEnter, autoFocus }) {
  return (
    <TextLine
      inputMode="decimal"
      value={value}
      placeholder={field.props?.placeholder}
      onChange={(t) => onChange(t.replace(/[^\d.,-]/g, ''))}
      onEnter={onEnter}
      autoFocus={autoFocus}
      ariaLabel={field.title}
    />
  )
}

export function DateInput({ value, onChange, onEnter, autoFocus }) {
  const [y, m, d] = (value || '--').split('-')
  const refs = [useRef(null), useRef(null), useRef(null)]
  const set = (dd, mm, yy) => {
    const all = `${yy || ''}-${mm || ''}-${dd || ''}`
    onChange(all === '--' ? '' : all)
  }
  useEffect(() => {
    if (autoFocus) setTimeout(() => refs[0].current?.focus({ preventScroll: true }), 350)
  }, [autoFocus]) // eslint-disable-line
  const part = (i, val, max, ph, onSet) => (
    <label className="fr-date-part">
      <span>{ph}</span>
      <input
        ref={refs[i]}
        className="fr-line"
        inputMode="numeric"
        value={val || ''}
        placeholder={ph === 'Ano' ? 'AAAA' : ph === 'Mês' ? 'MM' : 'DD'}
        maxLength={max}
        onChange={(e) => {
          const t = e.target.value.replace(/\D/g, '').slice(0, max)
          onSet(t)
          if (t.length === max && i < 2) refs[i + 1].current?.focus()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            onEnter?.()
          }
          if (e.key === 'Backspace' && !e.target.value && i > 0) refs[i - 1].current?.focus()
        }}
      />
    </label>
  )
  return (
    <div className="fr-date">
      {part(0, d, 2, 'Dia', (t) => set(t, m, y))}
      <span className="fr-date-sep">/</span>
      {part(1, m, 2, 'Mês', (t) => set(d, t, y))}
      <span className="fr-date-sep">/</span>
      {part(2, y, 4, 'Ano', (t) => set(d, m, t))}
    </div>
  )
}

export function SubfieldsInput({ field, value, onChange, onEnter, autoFocus, kind }) {
  const subs = Object.entries(field.props?.subfields || {}).filter(([, s]) => s.enabled)
  const v = value && typeof value === 'object' ? value : {}
  return (
    <div className="fr-subs">
      {subs.map(([key, s], i) => (
        <label key={key} className="fr-sub">
          <span>
            {s.label}
            {s.required ? ' *' : ''}
          </span>
          <TextLine
            type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'}
            value={v[key]}
            onChange={(t) => onChange({ ...v, [key]: key === 'phone' ? maskPhoneBR(t) : t })}
            onEnter={() => (i === subs.length - 1 ? onEnter?.() : null)}
            autoFocus={autoFocus && i === 0}
            ariaLabel={s.label}
            placeholder={key === 'email' ? 'nome@exemplo.com' : key === 'phone' ? '(31) 99999-9999' : kind === 'address' && key === 'zip' ? '00000-000' : ''}
          />
        </label>
      ))}
    </div>
  )
}

/* -------------------------------------------------------------- choice */

export function ChoiceInput({ field, value, onChange, onAutoAdvance, letters = true, active }) {
  const p = field.props || {}
  const multiple = field.type === 'checkbox' || !!p.multiple
  const options = useMemo(() => (p.randomize ? shuffle(p.options || []) : p.options || []), [p.options, p.randomize])
  const selected = multiple ? [].concat(value || []) : value
  const otherValue = (multiple ? selected : [selected]).find((x) => typeof x === 'string' && x.startsWith('other:'))
  const [otherOpen, setOtherOpen] = useState(!!otherValue)
  const otherRef = useRef(null)

  const toggle = (id) => {
    if (multiple) {
      const has = selected.includes(id)
      const max = Number(p.maxSelect) || 0
      if (!has && max && selected.length >= max) return
      onChange(has ? selected.filter((x) => x !== id) : [...selected, id])
    } else {
      onChange(selected === id ? null : id)
      if (selected !== id) onAutoAdvance?.()
    }
  }

  const items = [...options]
  const allKeys = items.map((_, i) => LETTERS[i])
  const otherKey = LETTERS[items.length]

  useEffect(() => {
    if (!active || !letters) return
    const onKey = (e) => {
      if (e.target.closest?.('input,textarea')) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key.toUpperCase()
      const i = allKeys.indexOf(k)
      if (i >= 0) toggle(items[i].id)
      else if (p.other && k === otherKey) setOtherOpen(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  useEffect(() => {
    if (otherOpen) setTimeout(() => otherRef.current?.focus(), 30)
  }, [otherOpen])

  const setOther = (text) => {
    const cleaned = (multiple ? selected : []).filter((x) => !(typeof x === 'string' && x.startsWith('other:')))
    const val = text ? `other:${text}` : null
    if (multiple) onChange(val ? [...cleaned, val] : cleaned)
    else onChange(val)
  }

  return (
    <div className="fr-choices" role={multiple ? 'group' : 'radiogroup'}>
      {multiple && <p className="fr-hint">Escolha quantas quiser{p.maxSelect ? ` (até ${p.maxSelect})` : ''}</p>}
      {items.map((o, i) => {
        const on = multiple ? selected.includes(o.id) : selected === o.id
        return (
          <button
            key={o.id}
            type="button"
            role={multiple ? 'checkbox' : 'radio'}
            aria-checked={on}
            className={`fr-choice ${on ? 'is-on' : ''}`}
            onClick={() => toggle(o.id)}
          >
            {letters && <kbd>{LETTERS[i]}</kbd>}
            <span className="fr-choice-label">{o.label}</span>
            {on && <Icon name="ok" size={18} stroke={2.4} className="fr-choice-check" />}
          </button>
        )
      })}
      {p.other &&
        (otherOpen ? (
          <div className={`fr-choice fr-choice-other ${otherValue ? 'is-on' : ''}`}>
            {letters && <kbd>{otherKey}</kbd>}
            <input
              ref={otherRef}
              value={otherValue ? otherValue.slice(6) : ''}
              placeholder="Escreva aqui"
              onChange={(e) => setOther(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (!multiple) onAutoAdvance?.()
                }
              }}
            />
          </div>
        ) : (
          <button type="button" className="fr-choice" onClick={() => setOtherOpen(true)}>
            {letters && <kbd>{otherKey}</kbd>}
            <span className="fr-choice-label">Outro</span>
          </button>
        ))}
    </div>
  )
}

export function DropdownInput({ field, value, onChange, onAutoAdvance, autoFocus }) {
  const p = field.props || {}
  const options = useMemo(() => {
    const list = [...(p.options || [])]
    return p.alphabetical ? list.sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')) : list
  }, [p.options, p.alphabetical])
  const current = options.find((o) => o.id === value)
  const [query, setQuery] = useState(current?.label || '')
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const ref = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    setQuery(current?.label || '')
  }, [current?.label])
  useEffect(() => {
    if (autoFocus) setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 350)
  }, [autoFocus])
  useEffect(() => {
    if (!open) return
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false)
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  const norm = (s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  const filtered = query && query !== current?.label ? options.filter((o) => norm(o.label).includes(norm(query))) : options

  const pick = (o) => {
    onChange(o.id)
    setQuery(o.label)
    setOpen(false)
    onAutoAdvance?.()
  }

  return (
    <div className="fr-dd" ref={ref}>
      <div className="fr-dd-field">
        <input
          ref={inputRef}
          className="fr-line"
          value={query}
          placeholder={p.placeholder || 'Digite ou selecione uma opção'}
          aria-label={field.title}
          aria-expanded={open}
          role="combobox"
          onClick={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            setHi(0)
            if (value) onChange(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setOpen(true)
              setHi((h) => Math.min(h + 1, filtered.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setHi((h) => Math.max(h - 1, 0))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              if (open && filtered[hi]) pick(filtered[hi])
              else if (value) onAutoAdvance?.()
            } else if (e.key === 'Escape') setOpen(false)
          }}
        />
        <button type="button" className="fr-dd-toggle" aria-label="Abrir lista" onClick={() => setOpen((o) => !o)}>
          <Icon name={open ? 'up' : 'down'} size={22} />
        </button>
      </div>
      {open && (
        <ul className="fr-dd-menu" role="listbox">
          {filtered.length === 0 && <li className="fr-dd-empty">Nenhuma opção encontrada</li>}
          {filtered.map((o, i) => (
            <li key={o.id}>
              <button
                type="button"
                role="option"
                aria-selected={o.id === value}
                className={`${o.id === value ? 'is-on' : ''} ${i === hi ? 'is-hi' : ''}`}
                onMouseEnter={() => setHi(i)}
                onClick={() => pick(o)}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function PictureChoice({ field, value, onChange, onAutoAdvance, letters = true }) {
  const p = field.props || {}
  const multiple = !!p.multiple
  const selected = multiple ? [].concat(value || []) : value
  const toggle = (id) => {
    if (multiple) onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
    else {
      onChange(selected === id ? null : id)
      if (selected !== id) onAutoAdvance?.()
    }
  }
  return (
    <div className="fr-pics">
      {(p.options || []).map((o, i) => {
        const on = multiple ? selected.includes(o.id) : selected === o.id
        return (
          <button key={o.id} type="button" className={`fr-pic ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={() => toggle(o.id)}>
            <span className="fr-pic-img">
              {o.image ? <img src={o.image} alt="" loading="lazy" /> : <Icon name="image" size={40} stroke={1.2} />}
            </span>
            {(p.showLabels ?? true) && (
              <span className="fr-pic-label">
                {letters && <kbd>{LETTERS[i]}</kbd>}
                {o.label}
              </span>
            )}
            {on && <Icon name="ok" size={18} stroke={2.4} className="fr-pic-check" />}
          </button>
        )
      })}
    </div>
  )
}

export function BoolInput({ field, value, onChange, onAutoAdvance, active }) {
  const legal = field.type === 'legal'
  const yes = legal ? field.props?.acceptLabel || 'Aceito' : 'Sim'
  const no = legal ? field.props?.rejectLabel || 'Não aceito' : 'Não'
  const pick = (v) => {
    onChange(v)
    onAutoAdvance?.()
  }
  useEffect(() => {
    if (!active) return
    const onKey = (e) => {
      if (e.target.closest?.('input,textarea')) return
      const k = e.key.toUpperCase()
      if (k === 'S' || k === 'Y' || k === 'A') pick(true)
      if (k === 'N') pick(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  return (
    <div className="fr-choices fr-choices-bool" role="radiogroup">
      {[
        [true, legal ? 'A' : 'S', yes],
        [false, 'N', no],
      ].map(([v, k, label]) => (
        <button key={String(v)} type="button" role="radio" aria-checked={value === v} className={`fr-choice ${value === v ? 'is-on' : ''}`} onClick={() => pick(v)}>
          <kbd>{k}</kbd>
          <span className="fr-choice-label">{label}</span>
          {value === v && <Icon name="ok" size={18} stroke={2.4} className="fr-choice-check" />}
        </button>
      ))}
    </div>
  )
}

/* -------------------------------------------------------------- scales */

export function ScaleInput({ field, value, onChange, onAutoAdvance }) {
  const p = field.props || {}
  const isNps = field.type === 'nps'
  const start = isNps ? 0 : Number(p.start ?? 1)
  const steps = isNps ? 11 : Number(p.steps || 5)
  const nums = Array.from({ length: steps }, (_, i) => start + i)
  return (
    <div className="fr-scale">
      <div className="fr-scale-row" style={{ gridTemplateColumns: `repeat(${steps}, 1fr)` }} role="radiogroup">
        {nums.map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            className={`fr-scale-btn ${value === n ? 'is-on' : ''}`}
            onClick={() => {
              onChange(n)
              onAutoAdvance?.()
            }}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="fr-scale-labels">
        <span>{p.leftLabel}</span>
        <span>{p.centerLabel}</span>
        <span>{p.rightLabel}</span>
      </div>
    </div>
  )
}

const SHAPES = {
  star: 'star',
  heart: 'heart',
  circle: 'circle',
}
function Shape({ shape, filled }) {
  const common = { fill: filled ? 'currentColor' : 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinejoin: 'round' }
  if (shape === 'heart')
    return (
      <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true">
        <path {...common} d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z" />
      </svg>
    )
  if (shape === 'circle')
    return (
      <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true">
        <circle {...common} cx="12" cy="12" r="8" />
      </svg>
    )
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true">
      <path {...common} d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8Z" />
    </svg>
  )
}

export function RatingInput({ field, value, onChange, onAutoAdvance }) {
  const steps = Number(field.props?.steps || 5)
  const shape = SHAPES[field.props?.shape] || 'star'
  const [hover, setHover] = useState(0)
  const shown = hover || value || 0
  return (
    <div className="fr-rating" role="radiogroup" onMouseLeave={() => setHover(0)}>
      {Array.from({ length: steps }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-label={`${n} de ${steps}`}
          aria-checked={value === n}
          className={`fr-rating-btn ${n <= shown ? 'is-on' : ''}`}
          onMouseEnter={() => setHover(n)}
          onClick={() => {
            onChange(n)
            onAutoAdvance?.()
          }}
        >
          <Shape shape={shape} filled={n <= shown} />
          <span>{n}</span>
        </button>
      ))}
    </div>
  )
}

function SortItem({ id, index, label, onMove, total }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`fr-rank-item ${isDragging ? 'is-drag' : ''}`}
    >
      <span className="fr-rank-handle" {...attributes} {...listeners} aria-label={`Arrastar ${label}`}>
        <Icon name="drag" size={18} />
      </span>
      <kbd>{index + 1}</kbd>
      <span className="fr-choice-label">{label}</span>
      <span className="fr-rank-arrows">
        <button type="button" aria-label="Subir" disabled={index === 0} onClick={() => onMove(index, index - 1)}>
          <Icon name="up" size={16} />
        </button>
        <button type="button" aria-label="Descer" disabled={index === total - 1} onClick={() => onMove(index, index + 1)}>
          <Icon name="down" size={16} />
        </button>
      </span>
    </li>
  )
}

export function RankingInput({ field, value, onChange }) {
  const options = field.props?.options || []
  const order = Array.isArray(value) && value.length === options.length ? value : options.map((o) => o.id)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const move = (from, to) => onChange(arrayMove(order, from, to))
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={({ active, over }) => {
        if (over && active.id !== over.id) move(order.indexOf(active.id), order.indexOf(over.id))
      }}
    >
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        <ol className="fr-rank">
          {order.map((id, i) => (
            <SortItem key={id} id={id} index={i} total={order.length} onMove={move} label={options.find((o) => o.id === id)?.label || id} />
          ))}
        </ol>
      </SortableContext>
      {!Array.isArray(value) && (
        <button type="button" className="fr-link" onClick={() => onChange(order)}>
          A ordem atual está certa
        </button>
      )}
    </DndContext>
  )
}

export function MatrixInput({ field, value, onChange }) {
  const { rows = [], columns = [], multiple } = field.props || {}
  const v = value && typeof value === 'object' ? value : {}
  const set = (r, c) => {
    if (multiple) {
      const cur = [].concat(v[r] || [])
      onChange({ ...v, [r]: cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c] })
    } else onChange({ ...v, [r]: c })
  }
  return (
    <div className="fr-matrix-wrap">
      <table className="fr-matrix">
        <thead>
          <tr>
            <th />
            {columns.map((c) => (
              <th key={c.id} scope="col">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <th scope="row">{r.label}</th>
              {columns.map((c) => {
                const on = multiple ? [].concat(v[r.id] || []).includes(c.id) : v[r.id] === c.id
                return (
                  <td key={c.id}>
                    <button
                      type="button"
                      className={`fr-matrix-cell ${multiple ? 'is-square' : ''} ${on ? 'is-on' : ''}`}
                      aria-label={`${r.label}: ${c.label}`}
                      aria-pressed={on}
                      onClick={() => set(r.id, c.id)}
                    />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function SignatureInput({ value, onChange }) {
  const canvas = useRef(null)
  const drawing = useRef(false)
  const last = useRef(null)
  const dirty = useRef(false)

  useEffect(() => {
    const c = canvas.current
    const ratio = window.devicePixelRatio || 1
    const rect = c.getBoundingClientRect()
    c.width = rect.width * ratio
    c.height = rect.height * ratio
    const ctx = c.getContext('2d')
    ctx.scale(ratio, ratio)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 2.4
    ctx.strokeStyle = getComputedStyle(c).color
    if (value) {
      const img = new Image()
      img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height)
      img.src = value
    }
  }, []) // eslint-disable-line

  const pos = (e) => {
    const r = canvas.current.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const down = (e) => {
    drawing.current = true
    last.current = pos(e)
    canvas.current.setPointerCapture(e.pointerId)
  }
  const move = (e) => {
    if (!drawing.current) return
    const ctx = canvas.current.getContext('2d')
    const p = pos(e)
    ctx.beginPath()
    ctx.moveTo(last.current.x, last.current.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    last.current = p
    dirty.current = true
  }
  const up = () => {
    if (!drawing.current) return
    drawing.current = false
    if (dirty.current) onChange(canvas.current.toDataURL('image/png'))
  }
  const clear = () => {
    const c = canvas.current
    c.getContext('2d').clearRect(0, 0, c.width, c.height)
    dirty.current = false
    onChange(null)
  }
  return (
    <div className="fr-sign">
      <canvas
        ref={canvas}
        className="fr-sign-pad"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        aria-label="Área para assinar"
      />
      <div className="fr-sign-bar">
        <span>Assine com o dedo ou o mouse</span>
        <button type="button" className="fr-link" onClick={clear}>
          Limpar
        </button>
      </div>
    </div>
  )
}
