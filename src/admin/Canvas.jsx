import { useState } from 'react'
import { FormFrame, FieldInput } from '../public/Screens'
import { estimateMinutes, flattenFields } from '../lib/fields'
import { RichEditor, RichToolbar } from './RichEditor'
import { richHtml, plainLine } from '../lib/rich'
import Icon from '../Icon'

function numberFor(schema, id) {
  let n = 0
  for (const f of schema.fields) {
    if (f.type === 'statement' || f.type === 'partial_submit') {
      if (f.id === id) return null
      continue
    }
    n += 1
    if (f.id === id) return String(n)
    if (f.type === 'group') {
      const i = (f.children || []).findIndex((c) => c.id === id)
      if (i >= 0) return `${n}${String.fromCharCode(97 + i)}`
    }
  }
  return null
}

/** Shows {{id}} tokens as the question they refer to. */
function RecallNote({ text, schema }) {
  const ids = [...String(text || '').matchAll(/\{\{([\w-]+)\}\}/g)].map((m) => m[1])
  if (!ids.length) return null
  const byId = Object.fromEntries(flattenFields(schema.fields).map((f) => [f.id, f]))
  return (
    <p className="ad-recall-note">
      {ids.map((id) => (
        <span key={id}>
          <code>{`{{${id}}}`}</code> = resposta de “{plainLine(byId[id]?.title) || 'pergunta removida'}”
        </span>
      ))}
    </p>
  )
}

function EditableHead({ number, title, description, required, onTitle, onDescription, big, schema }) {
  return (
    <>
      <div className="fr-q-head">
        {number && (
          <span className="fr-q-num">
            {number}
            <span aria-hidden="true">→</span>
          </span>
        )}
        <div className="ad-edit-title-wrap">
          <RichEditor className={`ad-edit ${big ? 'fr-welcome-title' : 'fr-q-title'}`} value={title} onChange={onTitle} placeholder="Escreva a pergunta" />
          {required && <span className="ad-req" title="Obrigatória">obrigatória</span>}
        </div>
      </div>
      <RichEditor className="ad-edit fr-q-desc ad-edit-desc" value={description} onChange={onDescription} placeholder="Descrição (opcional)" />
      <RecallNote text={`${title || ''} ${description || ''}`} schema={schema} />
    </>
  )
}

function FieldPreview({ field, isGroupChild, onPatch, schema }) {
  const [values, setValues] = useState({})
  const set = (id, v) => setValues((s) => ({ ...s, [id]: v }))
  const isGroup = field.type === 'group'
  const isStatement = field.type === 'statement'

  if (field.type === 'partial_submit')
    return (
      <div className="fr-q">
        <div className="ad-partial">
          <Icon name="flag" size={28} />
          <h2 className="fr-q-title">Ponto de envio parcial</h2>
          <p className="fr-q-desc">As respostas até aqui são salvas. A pessoa não vê esta etapa.</p>
        </div>
      </div>
    )

  return (
    <div className="fr-q">
      {isGroupChild && <p className="ad-in-group">Dentro do grupo “{plainLine(isGroupChild.title) || 'sem título'}”</p>}
      <EditableHead
        schema={schema}
        number={isStatement ? null : numberFor(schema, field.id)}
        title={field.title}
        description={field.description}
        required={field.required && !isGroup}
        onTitle={(v) => onPatch({ title: v })}
        onDescription={(v) => onPatch({ description: v })}
      />
      {field.image && <img className="fr-q-img" src={field.image} alt="" />}
      {isGroup ? (
        <div className="fr-group">
          {(field.children || []).length === 0 && <p className="fr-hint">Este grupo está vazio. Adicione perguntas a ele.</p>}
          {(field.children || []).map((c, i) => (
            <div key={c.id} className="fr-group-item">
              <div className="fr-q-head is-small">
                <span className="fr-q-num">
                  {numberFor(schema, c.id)}
                  <span aria-hidden="true">→</span>
                </span>
                <h2 className="fr-q-title">
                  {c.title ? <span className="fr-rich" dangerouslySetInnerHTML={{ __html: richHtml(c.title) }} /> : <span className="fr-muted">Sem título</span>}
                  {c.required && ' *'}
                </h2>
              </div>
              <FieldInput field={c} value={values[c.id]} onChange={(v) => set(c.id, v)} letters={false} active={false} />
            </div>
          ))}
        </div>
      ) : (
        !isStatement && (
          <div className="fr-q-input">
            <FieldInput key={field.type + JSON.stringify(field.props?.selector?.options?.map((o) => o.id))} field={field} value={values[field.id]} onChange={(v) => set(field.id, v)} letters={schema.settings?.letters !== false} active={false} />
          </div>
        )
      )}
      <div className="fr-actions">
        <span className="fr-btn" aria-hidden="true">
          {isStatement || isGroup ? field.props?.buttonText || 'Continuar' : 'OK'}
          {!(isStatement || isGroup) && <Icon name="ok" size={16} stroke={2.6} />}
        </span>
      </div>
    </div>
  )
}

export default function Canvas({ schema, selected, field, parent, ending, onPatch, onWelcome, onEnding, device }) {
  let body = null
  if (selected?.kind === 'welcome') {
    const w = schema.welcome || {}
    const mins = estimateMinutes(schema.fields)
    body = (
      <div className={`fr-q fr-welcome ${w.enabled === false ? 'ad-dim' : ''}`}>
        {w.enabled === false && <p className="ad-in-group">Tela de boas-vindas desligada</p>}
        {w.image && <img className="fr-q-img fr-welcome-img" src={w.image} alt="" />}
        <RichEditor className="ad-edit fr-welcome-title" value={w.title} onChange={(v) => onWelcome({ title: v })} placeholder="Título da boas-vindas" />
        <RichEditor className="ad-edit fr-q-desc ad-edit-desc" value={w.description} onChange={(v) => onWelcome({ description: v })} placeholder="Descrição (opcional)" />
        <div className="fr-actions">
          <span className="fr-btn fr-btn-lg">{w.buttonText || 'Começar'}</span>
        </div>
        {(w.showTime || w.showCount) && (
          <p className="fr-meta">
            {w.showTime && <span>Leva {mins} {mins === 1 ? 'minuto' : 'minutos'}</span>}
            {w.showCount && <span>N pessoas já responderam</span>}
          </p>
        )}
      </div>
    )
  } else if (selected?.kind === 'ending' && ending) {
    body = (
      <div className="fr-q fr-ending">
        <RichEditor className="ad-edit fr-welcome-title" value={ending.title} onChange={(v) => onEnding({ title: v })} placeholder="Título da tela final" />
        <RichEditor className="ad-edit fr-q-desc ad-edit-desc" value={ending.description} onChange={(v) => onEnding({ description: v })} placeholder="Descrição (opcional)" />
        <RecallNote text={`${ending.title || ''} ${ending.description || ''}`} schema={schema} />
        {ending.receipt?.enabled !== false && (
          <p className="fr-protocol">
            Protocolo <b>XXXX-XXXX</b>
          </p>
        )}
        {(ending.calendar?.enabled || ending.buttonText || ending.receipt?.enabled !== false) && (
          <div className="fr-actions fr-actions-end">
            {ending.receipt?.enabled !== false && (
              <span className="fr-btn">
                <Icon name="download" size={16} /> Baixar comprovante
              </span>
            )}
            {ending.calendar?.enabled && (
              <span className={`fr-btn ${ending.receipt?.enabled !== false ? 'fr-btn-ghost' : ''}`}>
                <Icon name="calendar" size={16} /> Adicionar ao Google Agenda
              </span>
            )}
            {ending.buttonText && <span className="fr-btn fr-btn-ghost">{ending.buttonText}</span>}
          </div>
        )}
      </div>
    )
  } else if (field) {
    body = <FieldPreview key={field.id} field={field} isGroupChild={parent} onPatch={onPatch} schema={schema} />
  }

  return (
    <div className={`ad-canvas ${device === 'mobile' ? 'is-mobile' : ''}`}>
      <RichToolbar />
      <FormFrame theme={schema.theme} className="ad-frame">
        <div className="fr-stage ad-stage">
          <div className="fr-slide">{body}</div>
        </div>
      </FormFrame>
    </div>
  )
}
