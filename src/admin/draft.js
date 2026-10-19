// Pure helpers that return a new draft schema.
import { newField, newEnding, uid } from '../lib/fields'

const clone = (x) => JSON.parse(JSON.stringify(x))

export function mapField(schema, id, fn) {
  return {
    ...schema,
    fields: schema.fields.map((f) => {
      if (f.id === id) return fn(f)
      if (f.type === 'group' && f.children?.some((c) => c.id === id))
        return { ...f, children: f.children.map((c) => (c.id === id ? fn(c) : c)) }
      return f
    }),
  }
}

export function updateField(schema, id, patch) {
  return mapField(schema, id, (f) => ({ ...f, ...patch, props: patch.props ? { ...f.props, ...patch.props } : f.props }))
}

export function findField(schema, id) {
  for (const f of schema.fields) {
    if (f.id === id) return { field: f, parent: null }
    if (f.type === 'group') {
      const c = f.children?.find((x) => x.id === id)
      if (c) return { field: c, parent: f }
    }
  }
  return { field: null, parent: null }
}

function cleanLogic(logic, removedIds) {
  const gone = new Set(removedIds)
  const out = {}
  for (const [k, v] of Object.entries(logic || {})) {
    if (gone.has(k)) continue
    out[k] = {
      ...v,
      otherwise: gone.has(v.otherwise) ? '' : v.otherwise,
      rules: (v.rules || [])
        .map((r) => ({ ...r, to: gone.has(r.to) ? '' : r.to, conditions: r.conditions.filter((c) => !gone.has(c.field)) }))
        .filter((r) => r.conditions.length || r.to),
    }
  }
  return out
}

export function removeField(schema, id) {
  const { field, parent } = findField(schema, id)
  if (!field) return schema
  const ids = [id, ...(field.children || []).map((c) => c.id)]
  const fields = parent
    ? schema.fields.map((f) => (f.id === parent.id ? { ...f, children: f.children.filter((c) => c.id !== id) } : f))
    : schema.fields.filter((f) => f.id !== id)
  return { ...schema, fields, logic: cleanLogic(schema.logic, ids) }
}

export function duplicateField(schema, id) {
  const { field, parent } = findField(schema, id)
  if (!field) return { schema, id: null }
  const copy = clone(field)
  copy.id = uid('f')
  copy.title = field.title ? `${field.title} (cópia)` : ''
  if (copy.children) copy.children = copy.children.map((c) => ({ ...c, id: uid('f') }))
  const insertAfter = (list) => {
    const i = list.findIndex((f) => f.id === id)
    return [...list.slice(0, i + 1), copy, ...list.slice(i + 1)]
  }
  const fields = parent
    ? schema.fields.map((f) => (f.id === parent.id ? { ...f, children: insertAfter(f.children) } : f))
    : insertAfter(schema.fields)
  return { schema: { ...schema, fields }, id: copy.id }
}

/** Add a field after `afterId` (top level), or at the end of a group. */
export function addField(schema, type, { afterId, groupId } = {}) {
  const f = newField(type)
  if (groupId) {
    return {
      schema: { ...schema, fields: schema.fields.map((g) => (g.id === groupId ? { ...g, children: [...(g.children || []), f] } : g)) },
      id: f.id,
    }
  }
  const list = [...schema.fields]
  let i = afterId ? list.findIndex((x) => x.id === afterId) : -1
  if (i < 0 && afterId) {
    // afterId may be a group child: insert after its group
    i = list.findIndex((x) => x.children?.some((c) => c.id === afterId))
  }
  if (i < 0) list.push(f)
  else list.splice(i + 1, 0, f)
  return { schema: { ...schema, fields: list }, id: f.id }
}

export function moveTop(schema, from, to) {
  const list = [...schema.fields]
  const [x] = list.splice(from, 1)
  list.splice(to, 0, x)
  return { ...schema, fields: list }
}

export function moveChild(schema, groupId, from, to) {
  return {
    ...schema,
    fields: schema.fields.map((g) => {
      if (g.id !== groupId) return g
      const list = [...g.children]
      const [x] = list.splice(from, 1)
      list.splice(to, 0, x)
      return { ...g, children: list }
    }),
  }
}

/** Move a field into a group (groupId) or out to the top level (groupId = null). */
export function moveToGroup(schema, id, groupId) {
  const { field, parent } = findField(schema, id)
  if (!field || field.type === 'group' || field.type === 'partial_submit') return schema
  if ((parent?.id || null) === groupId) return schema
  let fields = parent
    ? schema.fields.map((f) => (f.id === parent.id ? { ...f, children: f.children.filter((c) => c.id !== id) } : f))
    : schema.fields.filter((f) => f.id !== id)
  if (groupId) fields = fields.map((g) => (g.id === groupId ? { ...g, children: [...(g.children || []), field] } : g))
  else {
    const i = fields.findIndex((f) => f.id === parent.id)
    fields.splice(i + 1, 0, field)
  }
  // Logic lives on top-level screens only
  const logic = { ...(schema.logic || {}) }
  if (groupId) delete logic[id]
  return { ...schema, fields, logic }
}

export function changeType(schema, id, type) {
  return mapField(schema, id, (f) => {
    const fresh = newField(type)
    return { ...fresh, id: f.id, title: f.title, description: f.description, image: f.image, required: f.required }
  })
}

export function addEnding(schema) {
  const e = newEnding()
  return { schema: { ...schema, endings: [...(schema.endings || []), e] }, id: e.id }
}

export function updateEnding(schema, id, patch) {
  return { ...schema, endings: schema.endings.map((e) => (e.id === id ? { ...e, ...patch } : e)) }
}

export function removeEnding(schema, id) {
  const target = `end:${id}`
  const logic = Object.fromEntries(
    Object.entries(schema.logic || {}).map(([k, v]) => [
      k,
      { ...v, otherwise: v.otherwise === target ? '' : v.otherwise, rules: (v.rules || []).map((r) => (r.to === target ? { ...r, to: '' } : r)) },
    ]),
  )
  return { ...schema, endings: schema.endings.filter((e) => e.id !== id), logic }
}
