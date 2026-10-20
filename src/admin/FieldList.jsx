import { useRef, useState } from 'react'
import { DndContext, DragOverlay, MouseSensor, TouchSensor, pointerWithin, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import { FIELD_TYPES, screenLabel } from '../lib/fields'
import { plainLine } from '../lib/rich'
import Icon from '../Icon'

function numbering(fields) {
  const map = {}
  let n = 0
  for (const f of fields) {
    if (f.type === 'statement' || f.type === 'partial_submit') continue
    n += 1
    map[f.id] = String(n)
    if (f.type === 'group') (f.children || []).forEach((c, i) => (map[c.id] = `${n}${String.fromCharCode(97 + i)}`))
  }
  return map
}

const CANT_GROUP = new Set(['group', 'partial_submit'])

function Chip({ field, num }) {
  const d = FIELD_TYPES[field.type]
  return (
    <span className="ad-item-chip" style={{ background: d?.color }}>
      <Icon name={d?.glyph} size={13} stroke={2} />
      {num && <b>{num}</b>}
    </span>
  )
}

function Item({ field, num, selected, onSelect, hasLogic, child, drop, dragging }) {
  const drag = useDraggable({ id: field.id })
  const dropZone = useDroppable({ id: field.id })
  const label = field.type === 'group' ? screenLabel(field) : plainLine(field.title)
  const zone = drop?.id === field.id ? drop.zone : null
  return (
    <div
      ref={(n) => {
        drag.setNodeRef(n)
        dropZone.setNodeRef(n)
      }}
      className={`ad-item ${child ? 'is-child' : ''} ${field.type === 'group' ? 'is-page' : ''} ${selected ? 'is-on' : ''} ${dragging ? 'is-ghost' : ''} ${zone ? `is-drop-${zone}` : ''}`}
    >
      <button type="button" className="ad-item-btn" onClick={onSelect} {...drag.attributes} {...drag.listeners}>
        <Chip field={field} num={num} />
        <span className={`ad-item-title ${field.type === 'group' && !plainLine(field.title) ? 'is-auto' : ''}`}>{label || <i>Sem título</i>}</span>
        {hasLogic && (
          <span className="ad-item-logic" title="Tem lógica">
            <Icon name="logic" size={14} />
          </span>
        )}
      </button>
      {zone === 'merge' && <span className="ad-drop-hint">Juntar na mesma página</span>}
    </div>
  )
}

export default function FieldList({ schema, selected, onSelect, onAdd, onAddToPage, onAddEnding, onMove }) {
  const nums = numbering(schema.fields)
  // Touch needs a short press before dragging, so the list still scrolls
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 5 } }), useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }))
  const [activeId, setActiveId] = useState(null)
  const [drop, setDrop] = useState(null)
  const startY = useRef(0)

  const isSel = (kind, id) => selected?.kind === kind && selected?.id === id
  const logicIds = new Set(Object.entries(schema.logic || {}).filter(([, v]) => v.rules?.some((r) => r.to) || v.otherwise).map(([k]) => k))
  const all = []
  for (const f of schema.fields) {
    all.push(f)
    if (f.type === 'group') all.push(...(f.children || []))
  }
  const byId = Object.fromEntries(all.map((f) => [f.id, f]))
  const parentOf = (id) => schema.fields.find((g) => g.type === 'group' && g.children?.some((c) => c.id === id))

  // Where "add to this page" shows: under the selected page (or the page of the selected question)
  const selField = selected?.kind === 'field' ? byId[selected.id] : null
  const selPage = selField ? parentOf(selField.id) || selField : null
  const canAddHere = selPage && selPage.type !== 'partial_submit'

  const zoneFor = (over, y, dragField) => {
    const r = over.rect
    const rel = (y - r.top) / r.height
    const target = byId[over.id]
    const canMerge = dragField && !CANT_GROUP.has(dragField.type) && target && target.type !== 'partial_submit' && parentOf(over.id)?.id !== dragField.id
    if (canMerge && rel > 0.28 && rel < 0.72) return 'merge'
    return rel < 0.5 ? 'before' : 'after'
  }

  const onDragMove = ({ active, over, delta }) => {
    if (!over || over.id === active.id) return setDrop(null)
    const y = startY.current + delta.y
    setDrop({ id: over.id, zone: zoneFor(over, y, byId[active.id]) })
  }

  const renderItem = (f, child) => (
    <Item
      key={f.id}
      field={f}
      num={nums[f.id]}
      child={child}
      selected={isSel('field', f.id)}
      onSelect={() => onSelect({ kind: 'field', id: f.id })}
      hasLogic={!child && logicIds.has(f.id)}
      drop={drop}
      dragging={activeId === f.id}
    />
  )

  const addHereBtn = (page) =>
    canAddHere &&
    selPage.id === page.id && (
      <button type="button" className="ad-add-here" onClick={() => onAddToPage(selField.id)}>
        <Icon name="plus" size={14} /> Adicionar nesta página
      </button>
    )

  return (
    <aside className="ad-left">
      <div className="ad-left-scroll">
        <h3 className="ad-left-h">Páginas</h3>
        <div className={`ad-item ${isSel('welcome') ? 'is-on' : ''} ${schema.welcome?.enabled === false ? 'is-off' : ''}`}>
          <button type="button" className="ad-item-btn" onClick={() => onSelect({ kind: 'welcome' })}>
            <span className="ad-item-chip is-neutral">
              <Icon name="welcome" size={13} stroke={2} />
            </span>
            <span className="ad-item-title">{plainLine(schema.welcome?.title) || 'Boas-vindas'}</span>
          </button>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={({ active, activatorEvent }) => {
            setActiveId(active.id)
            startY.current = activatorEvent?.touches?.[0]?.clientY ?? activatorEvent?.clientY ?? 0
          }}
          onDragMove={onDragMove}
          onDragCancel={() => {
            setActiveId(null)
            setDrop(null)
          }}
          onDragEnd={({ active }) => {
            const d = drop
            setActiveId(null)
            setDrop(null)
            if (d && d.id !== active.id) onMove(active.id, d.id, d.zone)
          }}
        >
          {schema.fields.map((f) => (
            <div key={f.id} className={`ad-item-group ${f.type === 'group' ? 'is-page' : ''}`}>
              {renderItem(f, false)}
              {f.type === 'group' && (f.children || []).map((c) => renderItem(c, true))}
              {addHereBtn(f)}
            </div>
          ))}
          <DragOverlay dropAnimation={null}>
            {activeId && byId[activeId] ? (
              <div className="ad-item ad-item-overlay">
                <span className="ad-item-btn">
                  <Chip field={byId[activeId]} num={nums[activeId]} />
                  <span className="ad-item-title">{screenLabel(byId[activeId]) || 'Sem título'}</span>
                </span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        <p className="ad-left-tip">Arraste uma pergunta sobre outra para juntar as duas na mesma página.</p>

        <button type="button" className="ad-add-btn" onClick={onAdd}>
          <Icon name="plus" size={16} /> Nova página
        </button>

        <h3 className="ad-left-h ad-left-h-row">
          Telas finais
          <button type="button" className="ad-icon-btn" aria-label="Adicionar tela final" onClick={onAddEnding}>
            <Icon name="plus" size={16} />
          </button>
        </h3>
        {(schema.endings || []).map((e, i) => (
          <div key={e.id} className={`ad-item ${isSel('ending', e.id) ? 'is-on' : ''}`}>
            <button type="button" className="ad-item-btn" onClick={() => onSelect({ kind: 'ending', id: e.id })}>
              <span className="ad-item-chip is-neutral">
                <Icon name="end" size={13} stroke={2} />
                <b>{String.fromCharCode(65 + i)}</b>
              </span>
              <span className="ad-item-title">{plainLine(e.title) || 'Tela final'}</span>
              {e.calendar?.enabled && (
                <span className="ad-item-logic" title="Botão Google Agenda">
                  <Icon name="calendar" size={14} />
                </span>
              )}
            </button>
          </div>
        ))}
      </div>
    </aside>
  )
}
