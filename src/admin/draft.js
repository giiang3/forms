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
  const next = { ...schema, fields, logic: cleanLogic(schema.logic, ids) }
  return parent ? dissolve(next, parent.id) : next
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
    return { ...fresh, id: f.id, title: f.title, description: f.description, image: f.image, required: f.required, half: f.half }
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

/* ------------------------------------------------------------------
   Pages with several questions (groups) built by "add to this page" and drag & drop.
   Logic lives on pages (top-level items). A question that becomes part of a page
   loses its own rules; rules elsewhere that pointed to it now point to the page.
------------------------------------------------------------------- */

const CANT_GROUP = new Set(['group', 'partial_submit'])

export function hasLogic(schema, id) {
  const l = schema.logic?.[id]
  return !!l && (!!l.otherwise || (l.rules || []).some((r) => r.to || r.conditions?.some((c) => c.field)))
}

function retarget(logic, fromId, toId) {
  const out = {}
  for (const [k, v] of Object.entries(logic || {})) {
    out[k] = {
      ...v,
      otherwise: v.otherwise === fromId ? toId : v.otherwise,
      rules: (v.rules || []).map((r) => (r.to === fromId ? { ...r, to: toId } : r)),
    }
  }
  return out
}

function newPage(children) {
  return { id: uid('f'), type: 'group', title: '', description: '', required: false, image: '', props: { buttonText: 'Continuar' }, children }
}

const isUntitled = (g) => !String(g.title || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()

/** An untitled page left with one question turns back into that question; an empty one disappears. */
function dissolve(schema, groupId) {
  const g = schema.fields.find((f) => f.id === groupId)
  if (!g || g.type !== 'group' || !isUntitled(g) || (g.children || []).length > 1) return schema
  let logic = { ...(schema.logic || {}) }
  const groupLogic = logic[g.id]
  delete logic[g.id]
  if (g.children?.length === 1) {
    const child = g.children[0]
    if (groupLogic) logic[child.id] = groupLogic
    logic = retarget(logic, g.id, child.id)
    return { ...schema, fields: schema.fields.map((f) => (f.id === g.id ? child : f)), logic }
  }
  logic = retarget(logic, g.id, '')
  return { ...schema, fields: schema.fields.filter((f) => f.id !== g.id), logic }
}

/** Questions (labels) whose rules would be deleted by a move. */
function lostFrom(schema, ids) {
  return ids.filter((id) => hasLogic(schema, id)).map((id) => findField(schema, id).field)
}

/**
 * Plan a drag & drop. mode: 'before' | 'after' | 'merge'.
 * Returns { schema, lost: [fields whose rules are deleted] } or null if not allowed.
 */
export function planMove(schema, dragId, targetId, mode) {
  if (!dragId || !targetId || dragId === targetId) return null
  const D = findField(schema, dragId)
  const T = findField(schema, targetId)
  if (!D.field || !T.field) return null
  if (D.field.type === 'group' && T.parent?.id === D.field.id) return null
  const dragGroupable = !CANT_GROUP.has(D.field.type)
  const wasTop = !D.parent

  // 1. Take the dragged item out
  let fields = D.parent
    ? schema.fields.map((f) => (f.id === D.parent.id ? { ...f, children: f.children.filter((c) => c.id !== dragId) } : f))
    : schema.fields.filter((f) => f.id !== dragId)
  let logic = { ...(schema.logic || {}) }
  const lostIds = []
  const item = D.field

  const insertTop = (refId, after) => {
    const i = fields.findIndex((f) => f.id === refId)
    fields.splice(after ? i + 1 : i, 0, item)
  }
  const insertChild = (groupId, refId, after) => {
    fields = fields.map((g) => {
      if (g.id !== groupId) return g
      const kids = [...(g.children || [])]
      const i = refId ? kids.findIndex((c) => c.id === refId) : kids.length - 1
      kids.splice(refId ? (after ? i + 1 : i) : kids.length, 0, item)
      return { ...g, children: kids }
    })
  }
  const becameChildOf = (pageId) => {
    if (!wasTop) return
    if (hasLogic(schema, dragId)) lostIds.push(dragId)
    delete logic[dragId]
    logic = retarget(logic, dragId, pageId)
  }

  // 2. Put it back
  if (mode === 'before' || mode === 'after') {
    if (T.parent) {
      if (dragGroupable) {
        insertChild(T.parent.id, targetId, mode === 'after')
        becameChildOf(T.parent.id)
      } else insertTop(T.parent.id, mode === 'after')
    } else {
      insertTop(targetId, mode === 'after')
      if (!wasTop) {
        // Leaving a page: it becomes its own page again
      }
    }
  } else if (mode === 'merge') {
    if (!dragGroupable || T.field.type === 'partial_submit') return null
    if (T.field.type === 'group') {
      insertChild(T.field.id, null, true)
      becameChildOf(T.field.id)
    } else if (T.parent) {
      insertChild(T.parent.id, targetId, true)
      becameChildOf(T.parent.id)
    } else {
      // Two loose questions become one page
      const page = newPage([T.field, item])
      fields = fields.map((f) => (f.id === T.field.id ? page : f))
      if (hasLogic(schema, T.field.id)) lostIds.push(T.field.id)
      delete logic[T.field.id]
      logic = retarget(logic, T.field.id, page.id)
      becameChildOf(page.id)
    }
  } else return null

  let next = { ...schema, fields, logic }
  if (D.parent) next = dissolve(next, D.parent.id)
  return { schema: next, lost: lostFrom(schema, [...new Set(lostIds)]) }
}

/** "Add to this page" next to anchorId. Returns { schema, id, lost }. */
export function planAddToPage(schema, type, anchorId) {
  const A = findField(schema, anchorId)
  if (!A.field || CANT_GROUP.has(type)) return null
  const nf = newField(type)
  let fields
  let logic = { ...(schema.logic || {}) }
  let lost = []
  if (A.field.type === 'group') {
    fields = schema.fields.map((g) => (g.id === A.field.id ? { ...g, children: [...(g.children || []), nf] } : g))
  } else if (A.parent) {
    fields = schema.fields.map((g) => {
      if (g.id !== A.parent.id) return g
      const kids = [...g.children]
      kids.splice(kids.findIndex((c) => c.id === anchorId) + 1, 0, nf)
      return { ...g, children: kids }
    })
  } else {
    if (A.field.type === 'partial_submit') return null
    const page = newPage([A.field, nf])
    fields = schema.fields.map((f) => (f.id === anchorId ? page : f))
    lost = lostFrom(schema, [anchorId])
    delete logic[anchorId]
    logic = retarget(logic, anchorId, page.id)
  }
  return { schema: { ...schema, fields, logic }, id: nf.id, lost }
}
