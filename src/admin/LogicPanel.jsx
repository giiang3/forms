import { flattenFields, NON_ANSWER_TYPES, uid } from '../lib/fields'
import { OPS, opsFor, newRule } from '../lib/logic'
import Icon from '../Icon'

const CHOICE = ['multiple_choice', 'dropdown', 'picture_choice', 'checkbox']

function ValueInput({ field, op, value, onChange }) {
  if (!field || op === 'answered' || op === 'not_answered') return null
  if (CHOICE.includes(field.type))
    return (
      <select className="ad-input ad-select" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Escolha…</option>
        {(field.props?.options || []).map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    )
  if (field.type === 'yes_no' || field.type === 'legal')
    return (
      <select className="ad-input ad-select" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Escolha…</option>
        <option value="true">{field.type === 'legal' ? field.props?.acceptLabel || 'Aceito' : 'Sim'}</option>
        <option value="false">{field.type === 'legal' ? field.props?.rejectLabel || 'Não aceito' : 'Não'}</option>
      </select>
    )
  if (field.type === 'short_text' && field.props?.selector?.enabled && (op === 'is' || op === 'is_not'))
    return (
      <select className="ad-input ad-select" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Escolha…</option>
        {(field.props.selector.options || []).map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    )
  if (field.type === 'date') return <input className="ad-input" type="date" value={value} onChange={(e) => onChange(e.target.value)} />
  if (['number', 'nps', 'opinion_scale', 'rating'].includes(field.type))
    return <input className="ad-input" type="number" value={value} onChange={(e) => onChange(e.target.value)} />
  return <input className="ad-input" value={value} placeholder="Valor" onChange={(e) => onChange(e.target.value)} />
}

function TargetSelect({ schema, selfId, value, onChange, emptyLabel }) {
  return (
    <select className="ad-input ad-select" value={value || ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">{emptyLabel}</option>
      <optgroup label="Perguntas">
        {schema.fields
          .filter((f) => f.id !== selfId)
          .map((f) => (
            <option key={f.id} value={f.id}>
              {f.title || 'Sem título'}
            </option>
          ))}
      </optgroup>
      <optgroup label="Telas finais">
        {(schema.endings || []).map((e, i) => (
          <option key={e.id} value={`end:${e.id}`}>
            {String.fromCharCode(65 + i)}. {e.title || 'Tela final'}
          </option>
        ))}
      </optgroup>
    </select>
  )
}

export default function LogicPanel({ schema, screenId, onChange, onSelect }) {
  const screen = schema.fields.find((f) => f.id === screenId)
  const logic = schema.logic?.[screenId] || { rules: [], otherwise: '' }
  const all = flattenFields(schema.fields)
  const idx = all.findIndex((f) => f.id === screenId)
  const end = screen?.type === 'group' ? idx + (screen.children?.length || 0) : idx
  const condFields = all.slice(0, end + 1).filter((f) => !NON_ANSWER_TYPES.has(f.type))
  const byId = Object.fromEntries(all.map((f) => [f.id, f]))

  const set = (next) => onChange({ ...(schema.logic || {}), [screenId]: next })
  const setRule = (i, patch) => set({ ...logic, rules: logic.rules.map((r, j) => (j === i ? { ...r, ...patch } : r)) })
  const setCond = (i, k, patch) =>
    setRule(i, { conditions: logic.rules[i].conditions.map((c, j) => (j === k ? { ...c, ...patch } : c)) })

  const withLogic = schema.fields.filter((f) => {
    const l = schema.logic?.[f.id]
    return l && (l.rules?.some((r) => r.to) || l.otherwise)
  })

  if (!screen)
    return (
      <div className="ad-logic">
        <p className="ad-note">Escolha uma pergunta na lista à esquerda para criar regras de lógica.</p>
      </div>
    )

  return (
    <div className="ad-logic">
      <div className="ad-logic-head">
        <h2>Lógica de “{screen.title || 'Sem título'}”</h2>
        <p className="ad-muted">Depois desta tela, a pessoa vai para o destino da primeira regra que for verdadeira.</p>
      </div>

      {condFields.length === 0 ? (
        <p className="ad-note">Ainda não há perguntas com resposta até esta tela. Você pode definir só o destino padrão.</p>
      ) : (
        logic.rules.map((r, i) => (
          <div key={r.id} className="ad-rule">
            <div className="ad-rule-top">
              <b>Regra {i + 1}</b>
              <button className="ad-icon-btn" aria-label="Excluir regra" onClick={() => set({ ...logic, rules: logic.rules.filter((_, j) => j !== i) })}>
                <Icon name="trash" size={16} />
              </button>
            </div>
            {r.conditions.map((c, k) => {
              const f = byId[c.field]
              const ops = opsFor(f)
              return (
                <div key={c.id} className="ad-cond">
                  <span className="ad-cond-word">
                    {k === 0 ? (
                      'Se'
                    ) : (
                      <select className="ad-input ad-select ad-join" value={r.join} onChange={(e) => setRule(i, { join: e.target.value })}>
                        <option value="and">e</option>
                        <option value="or">ou</option>
                      </select>
                    )}
                  </span>
                  <select className="ad-input ad-select" value={c.field} onChange={(e) => setCond(i, k, { field: e.target.value, op: opsFor(byId[e.target.value])[0], value: '' })}>
                    <option value="">Escolha a pergunta…</option>
                    {condFields.map((cf) => (
                      <option key={cf.id} value={cf.id}>
                        {cf.title || 'Sem título'}
                      </option>
                    ))}
                  </select>
                  <select className="ad-input ad-select" value={c.op} onChange={(e) => setCond(i, k, { op: e.target.value })} disabled={!f}>
                    {ops.map((o) => (
                      <option key={o} value={o}>
                        {OPS[o]}
                      </option>
                    ))}
                  </select>
                  <ValueInput field={f} op={c.op} value={c.value} onChange={(v) => setCond(i, k, { value: v })} />
                  {r.conditions.length > 1 && (
                    <button className="ad-icon-btn" aria-label="Remover condição" onClick={() => setRule(i, { conditions: r.conditions.filter((_, j) => j !== k) })}>
                      <Icon name="close" size={14} />
                    </button>
                  )}
                </div>
              )
            })}
            <button className="ad-btn ad-btn-sm ad-btn-quiet" onClick={() => setRule(i, { conditions: [...r.conditions, { id: uid('c'), field: '', op: 'is', value: '' }] })}>
              <Icon name="plus" size={14} /> Condição
            </button>
            <div className="ad-cond ad-cond-to">
              <span className="ad-cond-word">ir para</span>
              <TargetSelect schema={schema} selfId={screenId} value={r.to} onChange={(v) => setRule(i, { to: v })} emptyLabel="Escolha o destino…" />
            </div>
          </div>
        ))
      )}

      {condFields.length > 0 && (
        <button className="ad-btn" onClick={() => set({ ...logic, rules: [...logic.rules, newRule()] })}>
          <Icon name="plus" size={16} /> Adicionar regra
        </button>
      )}

      <div className="ad-rule ad-rule-default">
        <div className="ad-cond ad-cond-to">
          <span className="ad-cond-word">{logic.rules.length ? 'Nos outros casos, ir para' : 'Sempre ir para'}</span>
          <TargetSelect schema={schema} selfId={screenId} value={logic.otherwise} onChange={(v) => set({ ...logic, otherwise: v })} emptyLabel="Próxima pergunta (padrão)" />
        </div>
      </div>

      {withLogic.length > 0 && (
        <div className="ad-logic-index">
          <h3>Perguntas com lógica</h3>
          {withLogic.map((f) => (
            <button key={f.id} className={`ad-chip-btn ${f.id === screenId ? 'is-on' : ''}`} onClick={() => onSelect(f.id)}>
              <Icon name="logic" size={14} /> {f.title || 'Sem título'}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
