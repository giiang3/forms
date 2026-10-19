import { useEffect, useRef, useState } from 'react'
import Icon from '../Icon'
import { uid } from '../lib/fields'

export function Toggle({ checked, onChange, label, hint, disabled }) {
  return (
    <label className={`ad-toggle ${disabled ? 'is-disabled' : ''}`}>
      <span className="ad-toggle-text">
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <input type="checkbox" checked={!!checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="ad-toggle-track" aria-hidden="true" />
    </label>
  )
}

export function Row({ label, children, hint }) {
  return (
    <label className="ad-row">
      <span className="ad-row-label">{label}</span>
      {children}
      {hint && <small className="ad-row-hint">{hint}</small>}
    </label>
  )
}

export function TextInput({ value, onChange, ...rest }) {
  return <input className="ad-input" value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...rest} />
}

export function TextArea({ value, onChange, rows = 3, ...rest }) {
  return <textarea className="ad-input ad-textarea" rows={rows} value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...rest} />
}

export function Select({ value, onChange, options, ...rest }) {
  return (
    <select className="ad-input ad-select" value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...rest}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function Section({ title, children, defaultOpen = true, aside }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className={`ad-sec ${open ? 'is-open' : ''}`}>
      <button type="button" className="ad-sec-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span>{title}</span>
        {aside}
        <Icon name={open ? 'up' : 'down'} size={16} />
      </button>
      {open && <div className="ad-sec-body">{children}</div>}
    </section>
  )
}

/** Editable list of { id, label, ...extra } with bulk paste. */
export function OptionsEditor({ options, onChange, extra, addLabel = 'Adicionar opção', placeholderPrefix = 'Opção' }) {
  const [bulk, setBulk] = useState(false)
  const [text, setText] = useState('')
  const list = options || []
  const update = (i, patch) => onChange(list.map((o, j) => (j === i ? { ...o, ...patch } : o)))
  const move = (i, d) => {
    const j = i + d
    if (j < 0 || j >= list.length) return
    const a = [...list]
    ;[a[i], a[j]] = [a[j], a[i]]
    onChange(a)
  }
  if (bulk)
    return (
      <div className="ad-opts">
        <TextArea rows={8} value={text} onChange={setText} placeholder="Uma opção por linha" autoFocus />
        <div className="ad-opts-bulk">
          <button type="button" className="ad-btn ad-btn-sm" onClick={() => setBulk(false)}>
            Cancelar
          </button>
          <button
            type="button"
            className="ad-btn ad-btn-sm ad-btn-primary"
            onClick={() => {
              const labels = text.split('\n').map((s) => s.trim()).filter(Boolean)
              onChange(labels.map((label) => list.find((o) => o.label === label) || { id: uid('o'), label }))
              setBulk(false)
            }}
          >
            Aplicar
          </button>
        </div>
      </div>
    )
  return (
    <div className="ad-opts">
      {list.map((o, i) => (
        <div key={o.id} className="ad-opt">
          <div className="ad-opt-main">
            <input className="ad-input" value={o.label} placeholder={`${placeholderPrefix} ${i + 1}`} onChange={(e) => update(i, { label: e.target.value })} />
            <div className="ad-opt-tools">
              <button type="button" aria-label="Subir" onClick={() => move(i, -1)} disabled={i === 0}>
                <Icon name="up" size={14} />
              </button>
              <button type="button" aria-label="Descer" onClick={() => move(i, 1)} disabled={i === list.length - 1}>
                <Icon name="down" size={14} />
              </button>
              <button type="button" aria-label="Remover" onClick={() => onChange(list.filter((_, j) => j !== i))}>
                <Icon name="trash" size={14} />
              </button>
            </div>
          </div>
          {extra && extra(o, (patch) => update(i, patch))}
        </div>
      ))}
      <div className="ad-opts-actions">
        <button type="button" className="ad-btn ad-btn-sm" onClick={() => onChange([...list, { id: uid('o'), label: '' }])}>
          <Icon name="plus" size={14} /> {addLabel}
        </button>
        <button
          type="button"
          className="ad-btn ad-btn-sm ad-btn-quiet"
          onClick={() => {
            setText(list.map((o) => o.label).join('\n'))
            setBulk(true)
          }}
        >
          Colar lista
        </button>
      </div>
    </div>
  )
}

/** Textarea that grows with its content, styled by the caller. */
export function AutoText({ value, onChange, className, placeholder, onKeyDown }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])
  return (
    <textarea
      ref={ref}
      rows={1}
      className={className}
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
    />
  )
}

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="ad-modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`ad-modal ${wide ? 'is-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="ad-modal-head">
          <h2>{title}</h2>
          <button type="button" className="ad-icon-btn" onClick={onClose} aria-label="Fechar">
            <Icon name="close" size={18} />
          </button>
        </header>
        <div className="ad-modal-body">{children}</div>
      </div>
    </div>
  )
}

export function TypeChip({ type, color, glyph, children }) {
  return (
    <span className="ad-chip" style={{ background: color }} data-type={type}>
      <Icon name={glyph} size={14} stroke={2} />
      {children}
    </span>
  )
}

export function useToast() {
  const [msg, setMsg] = useState(null)
  const timer = useRef(null)
  const show = (text, tone = 'ok') => {
    clearTimeout(timer.current)
    setMsg({ text, tone })
    timer.current = setTimeout(() => setMsg(null), 2600)
  }
  const node = msg ? (
    <div className={`ad-toast is-${msg.tone}`} role="status">
      {msg.text}
    </div>
  ) : null
  return [node, show]
}
