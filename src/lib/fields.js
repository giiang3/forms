// Field registry: one entry per field type the editor can add.

export const uid = (prefix = '') =>
  prefix + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3)

const opt = (label) => ({ id: uid('o'), label })

export const CATEGORIES = [
  { id: 'contact', label: 'Contato' },
  { id: 'choice', label: 'Escolha' },
  { id: 'rating', label: 'Avaliação e ranking' },
  { id: 'text', label: 'Texto' },
  { id: 'other', label: 'Outros' },
]

// color = chip background in the editor (hue groups by category)
export const FIELD_TYPES = {
  contact_info: {
    label: 'Dados de contato', category: 'contact', color: '#F5C9D6', glyph: 'contact',
    defaults: () => ({
      title: 'Seus dados de contato',
      props: {
        subfields: {
          first_name: { enabled: true, required: true, label: 'Nome' },
          last_name: { enabled: true, required: true, label: 'Sobrenome' },
          phone: { enabled: true, required: false, label: 'Telefone' },
          email: { enabled: true, required: true, label: 'E-mail' },
          company: { enabled: false, required: false, label: 'Empresa / órgão' },
        },
      },
    }),
  },
  email: {
    label: 'E-mail', category: 'contact', color: '#F5C9D6', glyph: 'mail',
    defaults: () => ({ title: 'Qual é o seu e-mail?', props: { placeholder: 'nome@exemplo.com', unique: false } }),
  },
  phone: {
    label: 'Telefone', category: 'contact', color: '#F5C9D6', glyph: 'phone',
    defaults: () => ({ title: 'Qual é o seu telefone?', props: { placeholder: '(31) 99999-9999', unique: false } }),
  },
  address: {
    label: 'Endereço', category: 'contact', color: '#F5C9D6', glyph: 'pin',
    defaults: () => ({
      title: 'Qual é o seu endereço?',
      props: {
        subfields: {
          line1: { enabled: true, required: true, label: 'Endereço' },
          line2: { enabled: true, required: false, label: 'Complemento' },
          city: { enabled: true, required: true, label: 'Cidade' },
          state: { enabled: true, required: true, label: 'Estado' },
          zip: { enabled: true, required: false, label: 'CEP' },
          country: { enabled: false, required: false, label: 'País' },
        },
      },
    }),
  },
  website: {
    label: 'Site', category: 'contact', color: '#F5C9D6', glyph: 'link',
    defaults: () => ({ title: 'Qual é o endereço do site?', props: { placeholder: 'https://' } }),
  },

  multiple_choice: {
    label: 'Múltipla escolha', category: 'choice', color: '#C9D3F5', glyph: 'list',
    defaults: () => ({
      title: 'Escolha uma opção',
      props: { options: [opt('Opção A'), opt('Opção B')], multiple: false, other: false, randomize: false },
    }),
  },
  dropdown: {
    label: 'Lista suspensa', category: 'choice', color: '#C9D3F5', glyph: 'chevron',
    defaults: () => ({
      title: 'Selecione uma opção',
      props: { options: [opt('Opção 1'), opt('Opção 2'), opt('Opção 3')], alphabetical: false, placeholder: 'Digite ou selecione uma opção' },
    }),
  },
  picture_choice: {
    label: 'Escolha por imagem', category: 'choice', color: '#C9D3F5', glyph: 'image',
    defaults: () => ({
      title: 'Qual destas você prefere?',
      props: { options: [{ ...opt('Opção A'), image: '' }, { ...opt('Opção B'), image: '' }], multiple: false, showLabels: true },
    }),
  },
  yes_no: {
    label: 'Sim/Não', category: 'choice', color: '#C9D3F5', glyph: 'yesno',
    defaults: () => ({ title: 'Você vai comparecer?', props: {} }),
  },
  legal: {
    label: 'Termo de aceite', category: 'choice', color: '#C9D3F5', glyph: 'legal',
    defaults: () => ({
      title: 'Você aceita os termos?',
      description: 'Escreva aqui o texto do termo.',
      props: { acceptLabel: 'Aceito', rejectLabel: 'Não aceito' },
    }),
  },
  checkbox: {
    label: 'Caixas de seleção', category: 'choice', color: '#C9D3F5', glyph: 'check',
    defaults: () => ({
      title: 'Marque todas que se aplicam',
      props: { options: [opt('Opção A'), opt('Opção B'), opt('Opção C')], multiple: true, other: false, randomize: false, minSelect: '', maxSelect: '' },
    }),
  },

  nps: {
    label: 'Net Promoter Score', category: 'rating', color: '#C7E8D5', glyph: 'gauge',
    defaults: () => ({
      title: 'De 0 a 10, quanto você recomendaria este evento a um colega?',
      props: { leftLabel: 'Nada provável', rightLabel: 'Muito provável' },
    }),
  },
  opinion_scale: {
    label: 'Escala de opinião', category: 'rating', color: '#C7E8D5', glyph: 'scale',
    defaults: () => ({
      title: 'Como você avalia a organização?',
      props: { start: 1, steps: 5, leftLabel: 'Ruim', centerLabel: '', rightLabel: 'Excelente' },
    }),
  },
  rating: {
    label: 'Nota', category: 'rating', color: '#C7E8D5', glyph: 'star',
    defaults: () => ({ title: 'Dê uma nota', props: { steps: 5, shape: 'star' } }),
  },
  ranking: {
    label: 'Ranking', category: 'rating', color: '#C7E8D5', glyph: 'rank',
    defaults: () => ({
      title: 'Ordene do mais ao menos importante',
      props: { options: [opt('Item 1'), opt('Item 2'), opt('Item 3')] },
    }),
  },
  matrix: {
    label: 'Matriz', category: 'rating', color: '#C7E8D5', glyph: 'grid',
    defaults: () => ({
      title: 'Avalie cada item',
      props: {
        rows: [opt('Conteúdo'), opt('Palestrantes'), opt('Local')],
        columns: [opt('Ruim'), opt('Regular'), opt('Bom'), opt('Ótimo')],
        multiple: false,
      },
    }),
  },

  short_text: {
    label: 'Texto curto', category: 'text', color: '#F3E2B8', glyph: 'short',
    defaults: () => ({
      title: 'Sua pergunta aqui',
      props: {
        placeholder: 'Escreva aqui...',
        maxLength: '',
        validation: 'none',
        regex: '',
        unique: false,
        selector: { enabled: false, options: [] },
      },
    }),
  },
  long_text: {
    label: 'Texto longo', category: 'text', color: '#F3E2B8', glyph: 'long',
    defaults: () => ({ title: 'Conte para a gente', props: { placeholder: 'Escreva aqui...', maxLength: '' } }),
  },

  number: {
    label: 'Número', category: 'other', color: '#E2D3F2', glyph: 'hash',
    defaults: () => ({ title: 'Quantos?', props: { placeholder: 'Digite um número', min: '', max: '', unique: false } }),
  },
  date: {
    label: 'Data', category: 'other', color: '#E2D3F2', glyph: 'calendar',
    defaults: () => ({ title: 'Qual a data?', props: {} }),
  },
  signature: {
    label: 'Assinatura', category: 'other', color: '#E2D3F2', glyph: 'pen',
    defaults: () => ({ title: 'Assine abaixo', props: {} }),
  },
  statement: {
    label: 'Texto informativo', category: 'other', color: '#E2D3F2', glyph: 'quote',
    defaults: () => ({ title: 'Uma informação importante', props: { buttonText: 'Continuar' } }),
  },
  group: {
    label: 'Grupo de perguntas', category: 'other', color: '#E2D3F2', glyph: 'group',
    defaults: () => ({ title: 'Grupo de perguntas', props: { buttonText: 'Continuar' }, children: [] }),
  },
  partial_submit: {
    label: 'Ponto de envio parcial', category: 'other', color: '#E2D3F2', glyph: 'flag',
    defaults: () => ({ title: 'Ponto de envio parcial', props: {} }),
  },
}

// Types that collect no answer
export const NON_ANSWER_TYPES = new Set(['statement', 'group', 'partial_submit'])
// Types allowed inside a question group
export const GROUPABLE = new Set(
  Object.keys(FIELD_TYPES).filter((t) => !['group', 'partial_submit'].includes(t)),
)

export function newField(type) {
  const def = FIELD_TYPES[type].defaults()
  return {
    id: uid('f'),
    type,
    title: def.title,
    description: def.description || '',
    required: type === 'legal',
    image: '',
    props: def.props,
    ...(def.children ? { children: def.children } : {}),
  }
}

export function newEnding() {
  return {
    id: uid('e'),
    title: 'Obrigado!',
    description: 'Sua resposta foi registrada.',
    buttonText: '',
    buttonUrl: '',
    redirectUrl: '',
    calendar: { enabled: false, title: '', date: '', start: '09:00', end: '10:00', allDay: false, location: '', details: '' },
  }
}

export function newSchema() {
  return {
    welcome: {
      enabled: true,
      title: 'Olá!',
      description: '',
      buttonText: 'Começar',
      showTime: true,
      showCount: false,
      image: '',
    },
    fields: [newField('short_text')],
    endings: [newEnding()],
    logic: {},
    theme: null,
    settings: { showProgress: true, showNav: true, letters: true },
  }
}

/** Flatten top-level fields + group children, keeping a reference to the group. */
export function flattenFields(fields = []) {
  const out = []
  for (const f of fields) {
    if (f.type === 'group') {
      out.push(f)
      for (const c of f.children || []) out.push({ ...c, _group: f.id })
    } else out.push(f)
  }
  return out
}

export function answerableFields(fields = []) {
  return flattenFields(fields).filter((f) => !NON_ANSWER_TYPES.has(f.type))
}

// Rough reading + answering time per field type, in seconds
const SECONDS = {
  short_text: 12, long_text: 40, email: 10, phone: 10, website: 10, number: 8, date: 8,
  contact_info: 30, address: 35, multiple_choice: 6, checkbox: 8, dropdown: 6, picture_choice: 6,
  yes_no: 4, legal: 10, nps: 5, opinion_scale: 5, rating: 4, ranking: 15, signature: 12,
  statement: 6, partial_submit: 0,
}
export function estimateMinutes(fields = []) {
  let s = 0
  for (const f of flattenFields(fields)) {
    if (f.type === 'group') continue
    if (f.type === 'matrix') s += 5 * (f.props?.rows?.length || 1)
    else s += SECONDS[f.type] ?? 8
  }
  return Math.max(1, Math.round(s / 60))
}

/** Replace {{id}} with the answer to that field (for recall in titles). */
export function recall(text, answers, fieldsById) {
  if (!text) return text
  return text.replace(/\{\{([\w-]+)\}\}/g, (_, id) => {
    const a = answers?.[id]
    if (a == null) return '___'
    return formatAnswer(a, fieldsById?.[id])
  })
}

export function formatAnswer(a, field) {
  if (a == null || a === '') return ''
  if (Array.isArray(a)) {
    if (field?.type === 'ranking') return a.map((id, i) => `${i + 1}. ${labelFor(field, id)}`).join(', ')
    return a.map((x) => labelFor(field, x)).join(', ')
  }
  if (typeof a === 'object') {
    if ('value' in a && 'option' in a) {
      const o = field?.props?.selector?.options?.find((x) => x.id === a.option)
      return `${o?.label || a.option}: ${a.value}`
    }
    if (field?.type === 'matrix') {
      return Object.entries(a)
        .map(([r, c]) => `${labelFor({ props: { options: field.props.rows } }, r)}: ${[].concat(c).map((x) => labelFor({ props: { options: field.props.columns } }, x)).join('/')}`)
        .join('; ')
    }
    if (field?.type === 'signature') return '[assinatura]'
    return Object.values(a).filter(Boolean).join(', ')
  }
  if (typeof a === 'boolean') {
    if (field?.type === 'legal') return a ? field.props?.acceptLabel || 'Aceito' : field.props?.rejectLabel || 'Não aceito'
    return a ? 'Sim' : 'Não'
  }
  if (field && ['multiple_choice', 'dropdown', 'picture_choice', 'checkbox'].includes(field.type)) return labelFor(field, a)
  return String(a)
}

export function labelFor(field, idOrText) {
  if (typeof idOrText === 'string' && idOrText.startsWith('other:')) return idOrText.slice(6)
  const o = field?.props?.options?.find((x) => x.id === idOrText)
  return o ? o.label : String(idOrText)
}
