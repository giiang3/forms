import { uid } from './fields'

// schema.logic = {
//   [fieldId]: { rules: [{ id, join: 'and'|'or', conditions: [{ id, field, op, value }], to }], otherwise: '' }
// }
// A target is a top-level field id, or `end:<endingId>`.

export const OPS = {
  is: 'é igual a',
  is_not: 'é diferente de',
  contains: 'contém',
  not_contains: 'não contém',
  starts: 'começa com',
  ends: 'termina com',
  gt: 'é maior que',
  gte: 'é maior ou igual a',
  lt: 'é menor que',
  lte: 'é menor ou igual a',
  answered: 'foi respondida',
  not_answered: 'não foi respondida',
}

const CHOICE = ['multiple_choice', 'dropdown', 'picture_choice', 'checkbox']
const NUMERIC = ['number', 'nps', 'opinion_scale', 'rating']
const BOOL = ['yes_no', 'legal']

export function opsFor(field) {
  if (!field) return ['answered', 'not_answered']
  if (CHOICE.includes(field.type)) return ['is', 'is_not', 'answered', 'not_answered']
  if (BOOL.includes(field.type)) return ['is', 'answered', 'not_answered']
  if (NUMERIC.includes(field.type)) return ['is', 'is_not', 'gt', 'gte', 'lt', 'lte', 'answered', 'not_answered']
  if (field.type === 'date') return ['is', 'gt', 'lt', 'answered', 'not_answered']
  if (field.type === 'short_text' && field.props?.selector?.enabled)
    return ['is', 'is_not', 'contains', 'not_contains', 'answered', 'not_answered']
  if (['short_text', 'long_text', 'email', 'website', 'phone'].includes(field.type))
    return ['is', 'is_not', 'contains', 'not_contains', 'starts', 'ends', 'answered', 'not_answered']
  return ['answered', 'not_answered']
}

const isEmpty = (a) =>
  a == null || a === '' || (Array.isArray(a) && a.length === 0) ||
  (typeof a === 'object' && !Array.isArray(a) && 'value' in a && !String(a.value || '').trim())

export function evalCondition(c, answers, fieldsById) {
  const field = fieldsById[c.field]
  const a = answers[c.field]
  if (c.op === 'answered') return !isEmpty(a)
  if (c.op === 'not_answered') return isEmpty(a)
  if (isEmpty(a)) return c.op === 'is_not' || c.op === 'not_contains'

  if (field && CHOICE.includes(field.type)) {
    const list = [].concat(a)
    const has = list.includes(c.value)
    return c.op === 'is' ? has : !has
  }
  if (field && BOOL.includes(field.type)) return String(a) === String(c.value)

  // Inline selector: "is" compares the chosen option; text ops compare the typed value
  if (typeof a === 'object' && a && 'option' in a) {
    if (c.op === 'is') return a.option === c.value
    if (c.op === 'is_not') return a.option !== c.value
    const s = String(a.value || '').toLowerCase()
    const v = String(c.value || '').toLowerCase()
    return c.op === 'contains' ? s.includes(v) : !s.includes(v)
  }

  if (field && (NUMERIC.includes(field.type) || field.type === 'date')) {
    const x = field.type === 'date' ? String(a) : Number(a)
    const y = field.type === 'date' ? String(c.value) : Number(c.value)
    switch (c.op) {
      case 'is': return x === y
      case 'is_not': return x !== y
      case 'gt': return x > y
      case 'gte': return x >= y
      case 'lt': return x < y
      case 'lte': return x <= y
      default: return false
    }
  }

  const s = String(a).toLowerCase().trim()
  const v = String(c.value ?? '').toLowerCase().trim()
  switch (c.op) {
    case 'is': return s === v
    case 'is_not': return s !== v
    case 'contains': return s.includes(v)
    case 'not_contains': return !s.includes(v)
    case 'starts': return s.startsWith(v)
    case 'ends': return s.endsWith(v)
    default: return false
  }
}

export function evalRule(rule, answers, fieldsById) {
  const conds = rule.conditions || []
  if (!conds.length) return true
  return rule.join === 'or'
    ? conds.some((c) => evalCondition(c, answers, fieldsById))
    : conds.every((c) => evalCondition(c, answers, fieldsById))
}

/**
 * Decide where to go after `fieldId`.
 * Returns { type: 'field', id } | { type: 'end', id|null }
 */
export function nextTarget(schema, fieldId, answers, fieldsById) {
  const screens = schema.fields || []
  const logic = schema.logic?.[fieldId]
  let target = null
  if (logic) {
    for (const rule of logic.rules || []) {
      if (rule.to && evalRule(rule, answers, fieldsById)) {
        target = rule.to
        break
      }
    }
    if (!target && logic.otherwise) target = logic.otherwise
  }
  if (target) {
    if (target.startsWith('end:')) return { type: 'end', id: target.slice(4) }
    if (screens.some((f) => f.id === target)) return { type: 'field', id: target }
  }
  const idx = screens.findIndex((f) => f.id === fieldId)
  const next = screens[idx + 1]
  return next ? { type: 'field', id: next.id } : { type: 'end', id: null }
}

export const newRule = () => ({
  id: uid('r'),
  join: 'and',
  conditions: [{ id: uid('c'), field: '', op: 'is', value: '' }],
  to: '',
})

/* ------------------------------------------------------------------
   Questions with several answers (checkboxes, multiple choice with "várias respostas"):
   every rule that matches is followed, one page after the other, in rule order.
   After the last one the form goes to "nos outros casos" (or past all those pages).
------------------------------------------------------------------- */

export function isMultiSelect(f) {
  return !!f && (f.type === 'checkbox' || (['multiple_choice', 'picture_choice'].includes(f.type) && !!f.props?.multiple))
}

function toTarget(schema, t) {
  if (!t) return null
  if (t.startsWith('end:')) return { type: 'end', id: t.slice(4) }
  return (schema.fields || []).some((f) => f.id === t) ? { type: 'field', id: t } : null
}

/** Where a multi-answer question continues after its pages. */
export function fanOutAfter(schema, fieldId) {
  const logic = schema.logic?.[fieldId]
  if (logic?.otherwise && toTarget(schema, logic.otherwise)) return logic.otherwise
  const fields = schema.fields || []
  const idx = (logic?.rules || []).map((r) => fields.findIndex((f) => f.id === r.to)).filter((i) => i >= 0)
  const from = idx.length ? Math.max(...idx) : fields.findIndex((f) => f.id === fieldId)
  if (fields[from + 1]) return fields[from + 1].id
  return schema.endings?.[0] ? `end:${schema.endings[0].id}` : null
}

/**
 * Next screen plus the pages still waiting from a multi-answer question.
 * queue: null | { items: [targetId...], after: targetId|null }
 */
export function step(schema, fieldId, answers, fieldsById, queue) {
  const field = (schema.fields || []).find((f) => f.id === fieldId)
  const logic = schema.logic?.[fieldId]
  const end = { type: 'end', id: null }

  if (isMultiSelect(field) && logic) {
    const targets = [...new Set((logic.rules || []).filter((r) => r.to && evalRule(r, answers, fieldsById)).map((r) => r.to))].filter(
      (t) => t !== fieldId && toTarget(schema, t),
    )
    if (targets.length) {
      return { target: toTarget(schema, targets[0]), queue: { items: targets.slice(1), after: fanOutAfter(schema, fieldId) } }
    }
  }

  if (queue) {
    // A page's own explicit rule wins over the queue
    const own = (logic?.rules || []).find((r) => r.to && evalRule(r, answers, fieldsById) && toTarget(schema, r.to))
    if (own) return { target: toTarget(schema, own.to), queue: null }
    if (logic?.otherwise && toTarget(schema, logic.otherwise)) return { target: toTarget(schema, logic.otherwise), queue: null }
    if (queue.items.length) return { target: toTarget(schema, queue.items[0]), queue: { ...queue, items: queue.items.slice(1) } }
    return { target: toTarget(schema, queue.after) || end, queue: null }
  }

  return { target: nextTarget(schema, fieldId, answers, fieldsById), queue: null }
}
