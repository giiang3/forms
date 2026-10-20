import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core'
import { plainLine } from '../lib/rich'
import { SortableContext, verticalListSortingStrategy, useSortable, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { FIELD_TYPES } from '../lib/fields'
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

function Item({ field, num, selected, onSelect, hasLogic, child, sortable }) {
  const d = FIELD_TYPES[field.type]
  const s = useSortable({ id: field.id, disabled: !sortable })
  const style = sortable ? { transform: CSS.Transform.toString(s.transform), transition: s.transition } : undefined
  return (
    <div ref={sortable ? s.setNodeRef : undefined} style={style} className={`ad-item ${child ? 'is-child' : ''} ${selected ? 'is-on' : ''} ${s.isDragging ? 'is-drag' : ''}`}>
      <button type="button" className="ad-item-btn" onClick={onSelect} {...(sortable ? s.attributes : {})} {...(sortable ? s.listeners : {})}>
        <span className="ad-item-chip" style={{ background: d?.color }}>
          <Icon name={d?.glyph} size={13} stroke={2} />
          {num && <b>{num}</b>}
        </span>
        <span className="ad-item-title">{plainLine(field.title) || <i>Sem título</i>}</span>
        {hasLogic && (
          <span className="ad-item-logic" title="Tem lógica">
            <Icon name="logic" size={14} />
          </span>
        )}
      </button>
    </div>
  )
}

export default function FieldList({ schema, selected, onSelect, onAdd, onAddEnding, onReorder }) {
  const nums = numbering(schema.fields)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const isSel = (kind, id) => selected?.kind === kind && selected?.id === id
  const logicIds = new Set(Object.entries(schema.logic || {}).filter(([, v]) => v.rules?.some((r) => r.to) || v.otherwise).map(([k]) => k))

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
          collisionDetection={closestCenter}
          onDragEnd={({ active, over }) => {
            if (!over || active.id === over.id) return
            const from = schema.fields.findIndex((f) => f.id === active.id)
            const to = schema.fields.findIndex((f) => f.id === over.id)
            if (from >= 0 && to >= 0) onReorder(from, to)
          }}
        >
          <SortableContext items={schema.fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
            {schema.fields.map((f) => (
              <div key={f.id} className="ad-item-group">
                <Item field={f} num={nums[f.id]} selected={isSel('field', f.id)} onSelect={() => onSelect({ kind: 'field', id: f.id })} hasLogic={logicIds.has(f.id)} sortable />
                {f.type === 'group' &&
                  (f.children || []).map((c) => (
                    <Item key={c.id} field={c} num={nums[c.id]} child selected={isSel('field', c.id)} onSelect={() => onSelect({ kind: 'field', id: c.id })} />
                  ))}
              </div>
            ))}
          </SortableContext>
        </DndContext>

        <button type="button" className="ad-add-btn" onClick={onAdd}>
          <Icon name="plus" size={16} /> Adicionar pergunta
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
