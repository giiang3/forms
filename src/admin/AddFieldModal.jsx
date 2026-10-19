import { useState } from 'react'
import { CATEGORIES, FIELD_TYPES } from '../lib/fields'
import Icon from '../Icon'
import { Modal } from './ui'

export default function AddFieldModal({ onClose, onPick, groupName }) {
  const [q, setQ] = useState('')
  const [intoGroup, setIntoGroup] = useState(!!groupName)
  const norm = (s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  const entries = Object.entries(FIELD_TYPES).filter(([type, d]) => {
    if (intoGroup && ['group', 'partial_submit'].includes(type)) return false
    return !q || norm(d.label).includes(norm(q))
  })
  return (
    <Modal title="Adicionar pergunta" onClose={onClose} wide>
      <div className="ad-add-top">
        <input className="ad-input" placeholder="Buscar tipo de pergunta" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        {groupName && (
          <label className="ad-check">
            <input type="checkbox" checked={intoGroup} onChange={(e) => setIntoGroup(e.target.checked)} />
            Adicionar dentro de “{groupName}”
          </label>
        )}
      </div>
      <div className="ad-add-grid">
        {CATEGORIES.map((cat) => {
          const items = entries.filter(([, d]) => d.category === cat.id)
          if (!items.length) return null
          return (
            <div key={cat.id} className="ad-add-col">
              <h3>{cat.label}</h3>
              {items.map(([type, d]) => (
                <button key={type} type="button" className="ad-add-item" onClick={() => onPick(type, intoGroup)}>
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
