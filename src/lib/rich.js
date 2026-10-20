// Rich text for titles and descriptions.
// Stored as a small HTML subset: <b>, <i>, <u>, <a href>, <br>. Older plain-text values still work.

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escAttr = (s) => esc(s).replace(/"/g, '&quot;')

// Elements whose content must never show up as text
const DROP = new Set(['script', 'style', 'template', 'noscript', 'iframe', 'object', 'embed', 'svg', 'math', 'head', 'title', 'textarea', 'select'])

const RICH_RE =/<\/?(b|i|u|a|br)\b|&(amp|lt|gt|quot|#39|nbsp);/i

export const isRich = (s) => RICH_RE.test(String(s ?? ''))

export function safeHref(href) {
  const h = String(href ?? '').trim()
  if (/^(https?:|mailto:|tel:)/i.test(h)) return h
  if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(h)) return `https://${h}`
  return null
}

/** Keep only the allowed tags. Runs in the browser (DOMParser). */
export function sanitizeRich(html) {
  if (!html) return ''
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
  const out = []
  const endsWithBr = () => out.length > 0 && out[out.length - 1] === '<br>'
  const TAGS = { b: 'b', strong: 'b', i: 'i', em: 'i', u: 'u' }

  const walk = (node) => {
    for (const n of node.childNodes) {
      if (n.nodeType === 3) {
        out.push(esc(n.nodeValue.replace(/ /g, ' ')))
        continue
      }
      if (n.nodeType !== 1) continue
      const tag = n.tagName.toLowerCase()
      if (DROP.has(tag)) continue
      if (tag === 'br') {
        out.push('<br>')
        continue
      }
      if (tag === 'div' || tag === 'p') {
        if (out.length && !endsWithBr()) out.push('<br>')
        walk(n)
        continue
      }
      if (TAGS[tag]) {
        out.push(`<${TAGS[tag]}>`)
        walk(n)
        out.push(`</${TAGS[tag]}>`)
        continue
      }
      if (tag === 'a') {
        const href = safeHref(n.getAttribute('href'))
        if (href) {
          out.push(`<a href="${escAttr(href)}" target="_blank" rel="noopener noreferrer">`)
          walk(n)
          out.push('</a>')
        } else walk(n)
        continue
      }
      // Some browsers format with <span style="...">
      const st = (n.getAttribute('style') || '').toLowerCase()
      const wrap = []
      if (/font-weight:\s*(bold|[6-9]00)/.test(st)) wrap.push('b')
      if (/font-style:\s*italic/.test(st)) wrap.push('i')
      if (/text-decoration[^;]*underline/.test(st)) wrap.push('u')
      wrap.forEach((t) => out.push(`<${t}>`))
      walk(n)
      wrap.reverse().forEach((t) => out.push(`</${t}>`))
    }
  }
  walk(doc.body.firstChild)

  let s = out.join('')
  for (let k = 0; k < 3; k++) s = s.replace(/<(b|i|u)><\/\1>/g, '').replace(/<\/(b|i|u)><\1>/g, '')
  s = s.replace(/(<br>)+$/, '')
  return plainText(s).trim() ? s : ''
}

/** HTML ready to render for a stored title/description. */
export function richHtml(s) {
  if (!s) return ''
  return isRich(s) ? sanitizeRich(s) : esc(s).replace(/\n/g, '<br>')
}

/** Plain text for lists, selects, spreadsheets and PDFs. */
export function plainText(s) {
  if (!s) return ''
  const str = String(s)
  if (!isRich(str)) return str
  return str
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

/** Single-line plain text (for one-line labels). */
export const plainLine = (s) => plainText(s).replace(/\s*\n\s*/g, ' ').trim()

export const escapeHtml = esc
