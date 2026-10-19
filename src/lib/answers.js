import { checkValidation, isValidEmail, isValidPhone, isValidUrl, emailDomainOk, domainError } from './validation'

const blank = (v) => v == null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && v.length === 0)

/** Returns an error message for one field, or null. */
export function validateField(field, value) {
  const p = field.props || {}
  const req = field.required

  switch (field.type) {
    case 'statement':
    case 'group':
    case 'partial_submit':
      return null

    case 'short_text': {
      const sel = p.selector?.enabled && p.selector.options?.length
      if (sel) {
        const v = value && typeof value === 'object' ? value : null
        if (!v || blank(v.value)) return req ? 'Preencha este campo.' : null
        const opt = p.selector.options.find((o) => o.id === v.option) || p.selector.options[0]
        return checkValidation(opt.validation, v.value, opt.regex)
      }
      if (blank(value)) return req ? 'Preencha este campo.' : null
      if (p.maxLength && String(value).length > Number(p.maxLength)) return `Use no máximo ${p.maxLength} caracteres.`
      return checkValidation(p.validation, value, p.regex)
    }
    case 'long_text':
      if (blank(value)) return req ? 'Preencha este campo.' : null
      if (p.maxLength && String(value).length > Number(p.maxLength)) return `Use no máximo ${p.maxLength} caracteres.`
      return null
    case 'email':
      if (blank(value)) return req ? 'Preencha este campo.' : null
      if (!isValidEmail(value)) return 'Digite um e-mail válido, como nome@exemplo.com.'
      return emailDomainOk(value, p.allowedDomains, p.allowSubdomains) ? null : domainError(p)
    case 'phone':
      if (blank(value)) return req ? 'Preencha este campo.' : null
      return isValidPhone(value) ? null : 'Digite o telefone com DDD.'
    case 'website':
      if (blank(value)) return req ? 'Preencha este campo.' : null
      return isValidUrl(value) ? null : 'Digite um endereço de site válido.'
    case 'number': {
      if (blank(value)) return req ? 'Preencha este campo.' : null
      const n = Number(String(value).replace(',', '.'))
      if (Number.isNaN(n)) return 'Digite um número.'
      if (p.min !== '' && p.min != null && n < Number(p.min)) return `O número precisa ser ${p.min} ou maior.`
      if (p.max !== '' && p.max != null && n > Number(p.max)) return `O número precisa ser ${p.max} ou menor.`
      return null
    }
    case 'date': {
      if (blank(value)) return req ? 'Preencha a data.' : null
      const [y, m, d] = String(value).split('-').map(Number)
      const dt = new Date(y, (m || 0) - 1, d || 0)
      const ok = y > 1000 && dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
      return ok ? null : 'Data inválida. Use dia, mês e ano.'
    }
    case 'contact_info':
    case 'address': {
      const subs = Object.entries(p.subfields || {}).filter(([, s]) => s.enabled)
      const v = value && typeof value === 'object' ? value : {}
      const anyFilled = subs.some(([k]) => !blank(v[k]))
      if (!anyFilled && !req) return null
      for (const [k, s] of subs) {
        if ((s.required || (req && !anyFilled)) && blank(v[k])) return `Preencha ${s.label.toLowerCase()}.`
        if (k === 'email' && !blank(v[k]) && !isValidEmail(v[k])) return 'Digite um e-mail válido.'
        if (k === 'email' && !blank(v[k]) && !emailDomainOk(v[k], p.allowedDomains, p.allowSubdomains)) return domainError(p)
        if (k === 'phone' && !blank(v[k]) && !isValidPhone(v[k])) return 'Digite o telefone com DDD.'
      }
      return null
    }
    case 'checkbox':
    case 'multiple_choice':
    case 'picture_choice': {
      const multiple = field.type === 'checkbox' || p.multiple
      const list = multiple ? [].concat(value || []) : value != null ? [value] : []
      if (!list.length) return req ? 'Escolha uma opção.' : null
      if (multiple && p.minSelect && list.length < Number(p.minSelect)) return `Escolha pelo menos ${p.minSelect}.`
      return null
    }
    case 'dropdown':
      return value == null && req ? 'Escolha uma opção da lista.' : null
    case 'yes_no':
      return value == null && req ? 'Escolha uma opção.' : null
    case 'legal':
      if (value == null && req) return 'Escolha uma opção.'
      return null
    case 'nps':
    case 'opinion_scale':
    case 'rating':
      return value == null && req ? 'Escolha um valor.' : null
    case 'ranking':
      return !Array.isArray(value) && req ? 'Ordene os itens ou confirme a ordem atual.' : null
    case 'matrix': {
      const rows = p.rows || []
      const v = value && typeof value === 'object' ? value : {}
      const answered = rows.filter((r) => !blank(v[r.id]))
      if (req && answered.length < rows.length) return 'Responda todas as linhas.'
      return null
    }
    case 'signature':
      return blank(value) && req ? 'Assine para continuar.' : null
    default:
      return blank(value) && req ? 'Preencha este campo.' : null
  }
}

/** Whether a choice-like field should advance on its own after picking. */
export function autoAdvances(field) {
  if (['yes_no', 'legal', 'nps', 'opinion_scale', 'rating', 'dropdown'].includes(field.type)) return true
  if (field.type === 'multiple_choice' || field.type === 'picture_choice') return !field.props?.multiple
  return false
}
