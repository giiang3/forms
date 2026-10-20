import { useState } from 'react'
import { CATEGORIES, FIELD_TYPES } from '../lib/fields'
import Icon from '../Icon'
import { Modal } from './ui'

export default function AddFieldModal({ onClose, onPick, toPage }) {
  const [q, setQ] = useState('')
  const norm = (s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  const entries = Object.entries(FIELD_TYPES).filter(([type, d]) => {
    // Pages with several questions are made by "add to this page" or by dragging
    if (type === 'group') return false
    if (toPage && type === 'partial_submit') return false
    return !q || norm(d.label).includes(norm(q))
  })
  return (
    <Modal title={toPage ? 'Adicionar nesta página' : 'Nova página'} onClose={onClose} wide>
      <div className="ad-add-top">
        <input className="ad-input" placeholder="Buscar tipo de pergunta" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      </div>
      <div className="ad-add-grid">
        {CATEGORIES.map((cat) => {
          const items = entries.filter(([, d]) => d.category === cat.id)
          if (!items.length) return null
          return (
            <div key={cat.id} className="ad-add-col">
              <h3>{cat.label}</h3>
              {items.map(([type, d]) => (
                <button key={type} type="button" className="ad-add-item" onClick={() => onPick(type)}>
                  <span className="ad-add-ico" style={{ background: d.color }}>
                    <Icon name={d.glyph} size={16} stroke={2} />
                  </span>
                  {d.label}
                </button>
              ))}
            </div>
          )
        })}
      </div>
    </Modal>
  )
}
