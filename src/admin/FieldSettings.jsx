import { FIELD_TYPES, NON_ANSWER_TYPES, answerableFields } from '../lib/fields'
import { plainLine } from '../lib/rich'
import { VALIDATIONS } from '../lib/validation'
import { googleCalendarUrl } from '../lib/calendar'
import Icon from '../Icon'
import { Toggle, Row, TextInput, TextArea, Select, Section, OptionsEditor } from './ui'

const typeOptions = Object.entries(FIELD_TYPES)
  .filter(([t]) => t !== 'partial_submit')
  .map(([value, d]) => ({ value, label: d.label }))

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i)

function RecallPicker({ fields, currentId, onPick }) {
  const list = answerableFields(fields)
  const idx = list.findIndex((f) => f.id === currentId)
  const before = (idx < 0 ? list : list.slice(0, idx)).filter((f) => f.id !== currentId)
  if (!before.length) return null
  return (
    <Row label="Inserir resposta anterior" hint="Mostra no texto o que a pessoa respondeu antes.">
      <select className="ad-input ad-select" value="" onChange={(e) => e.target.value && onPick(`{{${e.target.value}}}`)}>
        <option value="">Escolha uma pergunta…</option>
        {before.map((f) => (
          <option key={f.id} value={f.id}>
            {plainLine(f.title) || 'Sem título'}
          </option>
        ))}
      </select>
    </Row>
  )
}

export function FieldSettings({ schema, field, parent, onPatch, onProps, onChangeType, onDuplicate, onRemove, onMoveToGroup }) {
  const p = field.props || {}
  const groups = schema.fields.filter((f) => f.type === 'group')
  const canGroup = field.type !== 'group' && field.type !== 'partial_submit'

  if (field.type === 'partial_submit')
    return (
      <div className="ad-right-body">
        <p className="ad-note">
          Quando a pessoa passar por este ponto, as respostas dadas até aqui ficam salvas, mesmo que ela não termine o formulário. A pessoa não vê nada nesta etapa.
        </p>
        <div className="ad-danger-zone">
          <button className="ad-btn ad-btn-sm" onClick={onRemove}>
            <Icon name="trash" size={14} /> Remover
          </button>
        </div>
      </div>
    )

  return (
    <div className="ad-right-body">
      <Section title="Pergunta">
        <Row label="Tipo">
          <Select value={field.type} onChange={onChangeType} options={typeOptions} />
        </Row>
        {!NON_ANSWER_TYPES.has(field.type) && <Toggle label="Obrigatória" checked={field.required} onChange={(v) => onPatch({ required: v })} />}
        <RecallPicker fields={schema.fields} currentId={field.id} onPick={(tok) => onPatch({ title: `${field.title || ''} ${tok}`.trim() })} />
      </Section>

      <TypeSettings field={field} p={p} onProps={onProps} />

      <Section title="Imagem" defaultOpen={!!field.image}>
        <Row label="Endereço da imagem (URL)" hint="Cole o link de uma imagem pública.">
          <TextInput value={field.image} onChange={(v) => onPatch({ image: v })} placeholder="https://…" />
        </Row>
      </Section>

      {canGroup && groups.length > 0 && (
        <Section title="Organização" defaultOpen={!!parent}>
          <Row label="Grupo de perguntas">
            <Select
              value={parent?.id || ''}
              onChange={(v) => onMoveToGroup(v || null)}
              options={[{ value: '', label: 'Fora de grupo' }, ...groups.map((g) => ({ value: g.id, label: plainLine(g.title) || 'Grupo sem título' }))]}
            />
          </Row>
        </Section>
      )}

      <div className="ad-danger-zone">
        <button className="ad-btn ad-btn-sm" onClick={onDuplicate}>
          <Icon name="copy" size={14} /> Duplicar
        </button>
        <button className="ad-btn ad-btn-sm ad-btn-danger-quiet" onClick={onRemove}>
          <Icon name="trash" size={14} /> Excluir
        </button>
      </div>
    </div>
  )
}

function UniqueToggle({ p, onProps }) {
  return (
    <Toggle
      label="Não aceitar resposta repetida"
      hint="Bloqueia o envio se o mesmo valor já foi enviado neste formulário."
      checked={p.unique}
      onChange={(v) => onProps({ unique: v })}
    />
  )
}

function DomainSettings({ p, onProps }) {
  const list = p.allowedDomains || []
  const active = list.some((d) => String(d).trim())
  return (
    <Section title="Domínios aceitos" defaultOpen={active}>
      <Row label="Aceitar só e-mails destes domínios" hint="Um por linha, sem o @. Deixe vazio para aceitar qualquer e-mail.">
        <TextArea rows={3} value={list.join('\n')} onChange={(v) => onProps({ allowedDomains: v.split('\n') })} placeholder="saude.mg.gov.br" />
      </Row>
      <Toggle label="Aceitar subdomínios" hint="Ex.: com saude.mg.gov.br, aceita também nome@ses.saude.mg.gov.br." checked={p.allowSubdomains} onChange={(v) => onProps({ allowSubdomains: v })} />
      <Row label="Mensagem de erro" hint="Opcional. Sem mensagem, aparece “Use um e-mail @domínio”.">
        <TextInput value={p.domainError} onChange={(v) => onProps({ domainError: v })} placeholder="Use seu e-mail institucional." />
      </Row>
    </Section>
  )
}

function TypeSettings({ field, p, onProps }) {
  switch (field.type) {
    case 'short_text': {
      const sel = p.selector || { enabled: false, options: [] }
      return (
        <>
          <Section title="Resposta">
            <Row label="Texto de exemplo">
              <TextInput value={p.placeholder} onChange={(v) => onProps({ placeholder: v })} />
            </Row>
            <Row label="Limite de caracteres">
              <TextInput type="number" min="1" value={p.maxLength} onChange={(v) => onProps({ maxLength: v })} placeholder="Sem limite" />
            </Row>
            {!sel.enabled && (
              <>
                <Row label="Validação">
                  <Select value={p.validation || 'none'} onChange={(v) => onProps({ validation: v })} options={VALIDATIONS.map((v) => ({ value: v.id, label: v.label }))} />
                </Row>
                {p.validation === 'regex' && (
                  <Row label="Expressão regular">
                    <TextInput value={p.regex} onChange={(v) => onProps({ regex: v })} placeholder="^\\d{4}$" />
                  </Row>
                )}
              </>
            )}
            <UniqueToggle p={p} onProps={onProps} />
          </Section>
          <Section title="Seletor ao lado do campo" defaultOpen={sel.enabled}>
            <Toggle
              label="Mostrar seletor"
              hint="Uma lista curta à esquerda do campo, como CPF ou RG. Cada opção tem a própria validação."
              checked={sel.enabled}
              onChange={(v) =>
                onProps({
                  selector: {
                    ...sel,
                    enabled: v,
                    options: sel.options?.length
                      ? sel.options
                      : [
                          { id: 'cpf', label: 'CPF', validation: 'cpf', placeholder: '000.000.000-00' },
                          { id: 'rg', label: 'RG', validation: 'none', placeholder: 'Número do RG' },
                        ],
                  },
                })
              }
            />
            {sel.enabled && (
              <OptionsEditor
                options={sel.options}
                onChange={(options) => onProps({ selector: { ...sel, options } })}
                extra={(o, set) => (
                  <div className="ad-opt-extra">
                    <Select value={o.validation || 'none'} onChange={(v) => set({ validation: v })} options={VALIDATIONS.filter((v) => v.id !== 'regex').map((v) => ({ value: v.id, label: v.label }))} />
                    <input className="ad-input" value={o.placeholder || ''} placeholder="Texto de exemplo" onChange={(e) => set({ placeholder: e.target.value })} />
                  </div>
                )}
              />
            )}
          </Section>
        </>
      )
    }
    case 'long_text':
      return (
        <Section title="Resposta">
          <Row label="Texto de exemplo">
            <TextInput value={p.placeholder} onChange={(v) => onProps({ placeholder: v })} />
          </Row>
          <Row label="Limite de caracteres">
            <TextInput type="number" min="1" value={p.maxLength} onChange={(v) => onProps({ maxLength: v })} placeholder="Sem limite" />
          </Row>
        </Section>
      )
    case 'email':
    case 'phone':
    case 'website':
      return (
        <>
          <Section title="Resposta">
            <Row label="Texto de exemplo">
              <TextInput value={p.placeholder} onChange={(v) => onProps({ placeholder: v })} />
            </Row>
            {field.type !== 'website' && <UniqueToggle p={p} onProps={onProps} />}
          </Section>
          {field.type === 'email' && <DomainSettings p={p} onProps={onProps} />}
        </>
      )
    case 'number':
      return (
        <Section title="Resposta">
          <Row label="Texto de exemplo">
            <TextInput value={p.placeholder} onChange={(v) => onProps({ placeholder: v })} />
          </Row>
          <div className="ad-two">
            <Row label="Mínimo">
              <TextInput type="number" value={p.min} onChange={(v) => onProps({ min: v })} />
            </Row>
            <Row label="Máximo">
              <TextInput type="number" value={p.max} onChange={(v) => onProps({ max: v })} />
            </Row>
          </div>
          <UniqueToggle p={p} onProps={onProps} />
        </Section>
      )
    case 'contact_info':
    case 'address':
      return (
        <>
        <Section title="Campos">
          <div className="ad-subs">
            {Object.entries(p.subfields || {}).map(([k, s]) => (
              <div key={k} className={`ad-sub ${s.enabled ? '' : 'is-off'}`}>
                <input type="checkbox" aria-label={`Mostrar ${s.label}`} checked={s.enabled} onChange={(e) => onProps({ subfields: { ...p.subfields, [k]: { ...s, enabled: e.target.checked } } })} />
                <input className="ad-input" value={s.label} onChange={(e) => onProps({ subfields: { ...p.subfields, [k]: { ...s, label: e.target.value } } })} />
                <label className="ad-check ad-check-sm">
                  <input type="checkbox" checked={s.required} disabled={!s.enabled} onChange={(e) => onProps({ subfields: { ...p.subfields, [k]: { ...s, required: e.target.checked } } })} />
                  Obrig.
                </label>
              </div>
            ))}
          </div>
        </Section>
        {field.type === 'contact_info' && p.subfields?.email?.enabled && <DomainSettings p={p} onProps={onProps} />}
        </>
      )
    case 'multiple_choice':
    case 'checkbox':
      return (
        <Section title="Opções">
          <OptionsEditor options={p.options} onChange={(options) => onProps({ options })} />
          {field.type === 'multiple_choice' && <Toggle label="Permitir várias respostas" checked={p.multiple} onChange={(v) => onProps({ multiple: v })} />}
          {(field.type === 'checkbox' || p.multiple) && (
            <div className="ad-two">
              <Row label="Mínimo">
                <TextInput type="number" min="0" value={p.minSelect} onChange={(v) => onProps({ minSelect: v })} />
              </Row>
              <Row label="Máximo">
                <TextInput type="number" min="0" value={p.maxSelect} onChange={(v) => onProps({ maxSelect: v })} />
              </Row>
            </div>
          )}
          <Toggle label="Opção “Outro”" checked={p.other} onChange={(v) => onProps({ other: v })} />
          <Toggle label="Ordem aleatória" checked={p.randomize} onChange={(v) => onProps({ randomize: v })} />
        </Section>
      )
    case 'dropdown':
      return (
        <Section title="Opções">
          <OptionsEditor options={p.options} onChange={(options) => onProps({ options })} />
          <Row label="Texto de exemplo">
            <TextInput value={p.placeholder} onChange={(v) => onProps({ placeholder: v })} />
          </Row>
          <Toggle label="Ordem alfabética" checked={p.alphabetical} onChange={(v) => onProps({ alphabetical: v })} />
        </Section>
      )
    case 'picture_choice':
      return (
        <Section title="Opções">
          <OptionsEditor
            options={p.options}
            onChange={(options) => onProps({ options })}
            extra={(o, set) => <input className="ad-input" value={o.image || ''} placeholder="URL da imagem" onChange={(e) => set({ image: e.target.value })} />}
          />
          <Toggle label="Permitir várias respostas" checked={p.multiple} onChange={(v) => onProps({ multiple: v })} />
          <Toggle label="Mostrar nomes" checked={p.showLabels ?? true} onChange={(v) => onProps({ showLabels: v })} />
        </Section>
      )
    case 'legal':
      return (
        <Section title="Botões">
          <p className="ad-note">O texto do termo vai na descrição da pergunta.</p>
          <Row label="Aceitar">
            <TextInput value={p.acceptLabel} onChange={(v) => onProps({ acceptLabel: v })} />
          </Row>
          <Row label="Recusar">
            <TextInput value={p.rejectLabel} onChange={(v) => onProps({ rejectLabel: v })} />
          </Row>
        </Section>
      )
    case 'nps':
      return (
        <Section title="Legendas">
          <Row label="Esquerda (0)">
            <TextInput value={p.leftLabel} onChange={(v) => onProps({ leftLabel: v })} />
          </Row>
          <Row label="Direita (10)">
            <TextInput value={p.rightLabel} onChange={(v) => onProps({ rightLabel: v })} />
          </Row>
        </Section>
      )
    case 'opinion_scale':
      return (
        <Section title="Escala">
          <div className="ad-two">
            <Row label="Começa em">
              <Select value={String(p.start ?? 1)} onChange={(v) => onProps({ start: Number(v) })} options={[{ value: '0', label: '0' }, { value: '1', label: '1' }]} />
            </Row>
            <Row label="Quantidade">
              <Select value={String(p.steps || 5)} onChange={(v) => onProps({ steps: Number(v) })} options={range(3, 11).map((n) => ({ value: String(n), label: String(n) }))} />
            </Row>
          </div>
          <Row label="Legenda à esquerda">
            <TextInput value={p.leftLabel} onChange={(v) => onProps({ leftLabel: v })} />
          </Row>
          <Row label="Legenda no meio">
            <TextInput value={p.centerLabel} onChange={(v) => onProps({ centerLabel: v })} />
          </Row>
          <Row label="Legenda à direita">
            <TextInput value={p.rightLabel} onChange={(v) => onProps({ rightLabel: v })} />
          </Row>
        </Section>
      )
    case 'rating':
      return (
        <Section title="Nota">
          <div className="ad-two">
            <Row label="Quantidade">
              <Select value={String(p.steps || 5)} onChange={(v) => onProps({ steps: Number(v) })} options={range(3, 10).map((n) => ({ value: String(n), label: String(n) }))} />
            </Row>
            <Row label="Formato">
              <Select value={p.shape || 'star'} onChange={(v) => onProps({ shape: v })} options={[{ value: 'star', label: 'Estrela' }, { value: 'heart', label: 'Coração' }, { value: 'circle', label: 'Círculo' }]} />
            </Row>
          </div>
        </Section>
      )
    case 'ranking':
      return (
        <Section title="Itens">
          <OptionsEditor options={p.options} onChange={(options) => onProps({ options })} addLabel="Adicionar item" placeholderPrefix="Item" />
        </Section>
      )
    case 'matrix':
      return (
        <>
          <Section title="Linhas">
            <OptionsEditor options={p.rows} onChange={(rows) => onProps({ rows })} addLabel="Adicionar linha" placeholderPrefix="Linha" />
          </Section>
          <Section title="Colunas">
            <OptionsEditor options={p.columns} onChange={(columns) => onProps({ columns })} addLabel="Adicionar coluna" placeholderPrefix="Coluna" />
            <Toggle label="Várias respostas por linha" checked={p.multiple} onChange={(v) => onProps({ multiple: v })} />
          </Section>
        </>
      )
    case 'statement':
    case 'group':
      return (
        <Section title="Botão">
          <Row label="Texto do botão">
            <TextInput value={p.buttonText} onChange={(v) => onProps({ buttonText: v })} />
          </Row>
          {field.type === 'group' && <p className="ad-note">As perguntas deste grupo aparecem juntas na mesma tela. Use “Adicionar pergunta” com o grupo selecionado.</p>}
        </Section>
      )
    default:
      return null
  }
}

export function WelcomeSettings({ welcome, onChange }) {
  return (
    <div className="ad-right-body">
      <Section title="Tela de boas-vindas">
        <Toggle label="Mostrar tela de boas-vindas" checked={welcome.enabled !== false} onChange={(v) => onChange({ enabled: v })} />
        <Row label="Texto do botão">
          <TextInput value={welcome.buttonText} onChange={(v) => onChange({ buttonText: v })} maxLength={30} />
        </Row>
        <Toggle label="Tempo para responder" hint="Estimado pela quantidade e tipo de perguntas." checked={welcome.showTime} onChange={(v) => onChange({ showTime: v })} />
        <Toggle label="Número de respostas" hint="Mostra quantas pessoas já responderam." checked={welcome.showCount} onChange={(v) => onChange({ showCount: v })} />
      </Section>
      <Section title="Imagem" defaultOpen={!!welcome.image}>
        <Row label="Endereço da imagem (URL)">
          <TextInput value={welcome.image} onChange={(v) => onChange({ image: v })} placeholder="https://…" />
        </Row>
      </Section>
    </div>
  )
}

export function EndingSettings({ ending, schema, onChange, onRemove, canRemove }) {
  const cal = ending.calendar || {}
  const setCal = (patch) => onChange({ calendar: { ...cal, ...patch } })
  const preview = cal.enabled ? googleCalendarUrl(cal) : null
  const fields = answerableFields(schema.fields)
  return (
    <div className="ad-right-body">
      <Section title="Comprovante" defaultOpen>
        <Toggle
          label="Botão “Baixar comprovante”"
          hint="Mostra o protocolo do envio e gera um PDF com data, hora e respostas. Documentos aparecem parcialmente ocultos."
          checked={ending.receipt?.enabled !== false}
          onChange={(v) => onChange({ receipt: { ...(ending.receipt || {}), enabled: v } })}
        />
      </Section>
      <Section title="Botão Google Agenda" defaultOpen>
        <Toggle label="Mostrar botão" hint="A pessoa adiciona o evento à própria agenda com um clique." checked={cal.enabled} onChange={(v) => setCal({ enabled: v, title: cal.title || '' })} />
        {cal.enabled && (
          <>
            <Row label="Título do evento">
              <TextInput value={cal.title} onChange={(v) => setCal({ title: v })} placeholder="Confraternização de fim de ano" />
            </Row>
            <Row label="Data">
              <TextInput type="date" value={cal.date} onChange={(v) => setCal({ date: v })} />
            </Row>
            <Toggle label="Dia inteiro" checked={cal.allDay} onChange={(v) => setCal({ allDay: v })} />
            {!cal.allDay && (
              <div className="ad-two">
                <Row label="Início">
                  <TextInput type="time" value={cal.start} onChange={(v) => setCal({ start: v })} />
                </Row>
                <Row label="Fim">
                  <TextInput type="time" value={cal.end} onChange={(v) => setCal({ end: v })} />
                </Row>
              </div>
            )}
            <Row label="Local">
              <TextInput value={cal.location} onChange={(v) => setCal({ location: v })} placeholder="Endereço ou link da reunião" />
            </Row>
            <Row label="Descrição" hint="Use {{id}} para incluir uma resposta, como o nome da pessoa.">
              <TextArea value={cal.details} onChange={(v) => setCal({ details: v })} rows={3} />
            </Row>
            {fields.length > 0 && (
              <Row label="Incluir resposta na descrição">
                <select className="ad-input ad-select" value="" onChange={(e) => e.target.value && setCal({ details: `${cal.details || ''}{{${e.target.value}}}` })}>
                  <option value="">Escolha uma pergunta…</option>
                  {fields.map((f) => (
                    <option key={f.id} value={f.id}>
                      {plainLine(f.title) || 'Sem título'}
                    </option>
                  ))}
                </select>
              </Row>
            )}
            {preview ? (
              <a className="ad-btn ad-btn-sm" href={preview} target="_blank" rel="noopener noreferrer">
                <Icon name="calendar" size={14} /> Testar link
              </a>
            ) : (
              <p className="ad-note">Escolha a data para o botão aparecer.</p>
            )}
          </>
        )}
      </Section>
      <Section title="Outro botão" defaultOpen={!!ending.buttonText}>
        <Row label="Texto do botão">
          <TextInput value={ending.buttonText} onChange={(v) => onChange({ buttonText: v })} placeholder="Ex.: Ver programação" />
        </Row>
        <Row label="Link do botão">
          <TextInput value={ending.buttonUrl} onChange={(v) => onChange({ buttonUrl: v })} placeholder="https://…" />
        </Row>
      </Section>
      <Section title="Redirecionar" defaultOpen={!!ending.redirectUrl}>
        <Row label="Enviar para outro site" hint="Depois de 2 segundos nesta tela, a pessoa vai para este endereço.">
          <TextInput value={ending.redirectUrl} onChange={(v) => onChange({ redirectUrl: v })} placeholder="https://…" />
        </Row>
      </Section>
      {canRemove && (
        <div className="ad-danger-zone">
          <button className="ad-btn ad-btn-sm ad-btn-danger-quiet" onClick={onRemove}>
            <Icon name="trash" size={14} /> Excluir tela final
          </button>
        </div>
      )}
    </div>
  )
}
