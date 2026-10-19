export const onlyDigits = (v) => String(v ?? '').replace(/\D/g, '')

export function isValidCPF(value) {
  const d = onlyDigits(value)
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false
  const calc = (len) => {
    let s = 0
    for (let i = 0; i < len; i++) s += Number(d[i]) * (len + 1 - i)
    const r = (s * 10) % 11
    return r === 10 ? 0 : r
  }
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10])
}

export function isValidCNPJ(value) {
  const d = onlyDigits(value)
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false
  const calc = (len) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    let s = 0
    for (let i = 0; i < len; i++) s += Number(d[i]) * weights[i]
    const r = s % 11
    return r < 2 ? 0 : 11 - r
  }
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13])
}

export const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v ?? '').trim())

/** domains: list like ["saude.mg.gov.br"]. Empty list accepts any domain. */
export function emailDomainOk(email, domains, allowSubdomains) {
  const list = (domains || []).map((d) => String(d).trim().toLowerCase().replace(/^@/, '')).filter(Boolean)
  if (!list.length) return true
  const e = String(email ?? '').trim().toLowerCase()
  return list.some((d) => e.endsWith(`@${d}`) || (allowSubdomains && e.endsWith(`.${d}`)))
}

export function domainError(props) {
  if (props?.domainError?.trim()) return props.domainError.trim()
  const list = (props?.allowedDomains || []).map((d) => `@${String(d).trim().replace(/^@/, '')}`).filter((d) => d.length > 1)
  if (!list.length) return null
  return list.length === 1 ? `Use um e-mail ${list[0]}.` : `Use um e-mail destes domínios: ${list.join(', ')}.`
}

export const isValidUrl = (v) => {
  const s = String(v ?? '').trim()
  if (!s) return false
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`)
    return u.hostname.includes('.')
  } catch {
    return false
  }
}

export const isValidPhone = (v) => {
  const d = onlyDigits(v)
  return d.length >= 10 && d.length <= 13
}

// Input masks ----------------------------------------------------------
export function maskCPF(v) {
  const d = onlyDigits(v).slice(0, 11)
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4')
}

export function maskCNPJ(v) {
  const d = onlyDigits(v).slice(0, 14)
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

export function maskPhoneBR(v) {
  const d = onlyDigits(v).slice(0, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

export const VALIDATIONS = [
  { id: 'none', label: 'Sem validação' },
  { id: 'cpf', label: 'CPF' },
  { id: 'cnpj', label: 'CNPJ' },
  { id: 'email', label: 'E-mail' },
  { id: 'digits', label: 'Somente números' },
  { id: 'regex', label: 'Expressão regular' },
]

export function applyMask(validation, value) {
  if (validation === 'cpf') return maskCPF(value)
  if (validation === 'cnpj') return maskCNPJ(value)
  if (validation === 'digits') return onlyDigits(value)
  return value
}

/** Returns an error message, or null when the value passes. */
export function checkValidation(validation, value, regex) {
  const v = String(value ?? '').trim()
  if (!v) return null
  switch (validation) {
    case 'cpf':
      return isValidCPF(v) ? null : 'CPF inválido. Confira os números.'
    case 'cnpj':
      return isValidCNPJ(v) ? null : 'CNPJ inválido. Confira os números.'
    case 'email':
      return isValidEmail(v) ? null : 'Digite um e-mail válido, como nome@exemplo.com.'
    case 'digits':
      return /^\d+$/.test(v) ? null : 'Use somente números.'
    case 'regex':
      try {
        return new RegExp(regex || '.*').test(v) ? null : 'O formato da resposta não é aceito.'
      } catch {
        return null
      }
    default:
      return null
  }
}
