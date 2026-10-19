import { answerableFields, formatAnswer } from './fields'

/** Hide all digits except the last four, keeping punctuation: 529.982.247-25 -> ***.***.*47-25 */
export function maskDocument(value) {
  const s = String(value ?? '')
  const total = (s.match(/[0-9A-Za-z]/g) || []).length
  let seen = 0
  return s.replace(/[0-9A-Za-z]/g, (ch) => {
    seen += 1
    return seen > total - 4 ? ch : '*'
  })
}

function answerText(field, value) {
  const p = field.props || {}
  if (field.type === 'signature') return 'Assinatura registrada'
  if (field.type === 'short_text' && p.selector?.enabled && value && typeof value === 'object') {
    const opt = p.selector.options?.find((o) => o.id === value.option)
    return `${opt?.label || ''}: ${maskDocument(value.value)}`.replace(/^: /, '')
  }
  if (field.type === 'short_text' && ['cpf', 'cnpj'].includes(p.validation)) return maskDocument(value)
  return formatAnswer(value, field)
}

/** Question/answer pairs for what the person actually answered, in form order. */
export function receiptItems(schema, answers) {
  return answerableFields(schema.fields || [])
    .filter((f) => {
      const v = answers[f.id]
      return v != null && v !== '' && !(Array.isArray(v) && !v.length)
    })
    .map((f) => ({ q: f.title || 'Pergunta', a: answerText(f, answers[f.id]) }))
}

export async function downloadReceipt({ title, protocol, submittedAt, items, url }) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const L = 20
  const R = 190
  const width = R - L
  let y = 24

  const ensure = (h) => {
    if (y + h > 280) {
      doc.addPage()
      y = 22
    }
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(100, 104, 120)
  doc.text('Comprovante de envio', L, y)
  y += 8

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.setTextColor(23, 26, 38)
  const titleLines = doc.splitTextToSize(title || 'Formulário', width)
  doc.text(titleLines, L, y)
  y += titleLines.length * 7 + 4

  // Protocol box
  const when = new Date(submittedAt || Date.now())
  const whenText = when.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
  doc.setDrawColor(217, 220, 229)
  doc.setFillColor(246, 247, 250)
  doc.roundedRect(L, y, width, 26, 2, 2, 'FD')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(100, 104, 120)
  doc.text('Protocolo', L + 6, y + 8)
  doc.text('Enviado em', L + 96, y + 8)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(23, 26, 38)
  doc.text(protocol || '—', L + 6, y + 18)
  doc.setFontSize(12)
  doc.text(whenText, L + 96, y + 18)
  y += 36

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Respostas', L, y)
  y += 4
  doc.setDrawColor(231, 233, 239)
  doc.line(L, y, R, y)
  y += 7

  for (const it of items) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    const qLines = doc.splitTextToSize(it.q, width)
    doc.setFontSize(11)
    const aLines = doc.splitTextToSize(String(it.a ?? ''), width)
    ensure(qLines.length * 4.2 + aLines.length * 5.4 + 6)
    doc.setFontSize(9)
    doc.setTextColor(100, 104, 120)
    doc.text(qLines, L, y)
    y += qLines.length * 4.2 + 1
    doc.setFontSize(11)
    doc.setTextColor(23, 26, 38)
    doc.text(aLines, L, y)
    y += aLines.length * 5.4 + 5
  }

  ensure(16)
  y = Math.max(y + 4, 270)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(130, 134, 150)
  const foot = doc.splitTextToSize(
    `Guarde este comprovante. O protocolo identifica seu envio para a organização do formulário.${url ? ` Formulário: ${url}` : ''}`,
    width,
  )
  doc.text(foot, L, y)

  doc.save(`comprovante-${protocol || 'envio'}.pdf`)
}
