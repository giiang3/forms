import { useMemo, useState } from 'react'
import { plainLine } from '../lib/rich'
import { resolveTheme } from '../lib/themes'
import Icon from '../Icon'

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Choices for the first question, as [label, prefill value]. Null when the type can't be answered by a link. */
function firstChoices(field) {
  if (!field) return null
  const p = field.props || {}
  switch (field.type) {
    case 'multiple_choice':
    case 'picture_choice':
      return p.multiple ? null : (p.options || []).map((o) => [o.label, o.id])
    case 'dropdown':
      return (p.options || []).length <= 8 ? p.options.map((o) => [o.label, o.id]) : null
    case 'yes_no':
      return [['Sim', 'true'], ['Não', 'false']]
    case 'legal':
      return [[p.acceptLabel || 'Aceito', 'true'], [p.rejectLabel || 'Não aceito', 'false']]
    case 'nps':
      return Array.from({ length: 11 }, (_, i) => [String(i), String(i)])
    case 'opinion_scale': {
      const start = Number(p.start ?? 1)
      return Array.from({ length: Number(p.steps || 5) }, (_, i) => [String(start + i), String(start + i)])
    }
    case 'rating':
      return Array.from({ length: Number(p.steps || 5) }, (_, i) => [String(i + 1), String(i + 1)])
    default:
      return null
  }
}

function emailHtml({ url, title, field, theme, buttonText }) {
  const th = resolveTheme(theme)
  const bg = th.background.color
  const q = th.questionColor
  const a = th.answerColor
  const choices = firstChoices(field)
  const link = (v) => `${url}?pre_${encodeURIComponent(field.id)}=${encodeURIComponent(v)}`
  const font = `'${th.font}', Arial, Helvetica, sans-serif`
  const numeric = ['nps', 'opinion_scale', 'rating'].includes(field?.type)

  let body
  if (choices) {
    const btns = numeric
      ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${choices
          .map(
            ([label, v]) =>
              `<td style="padding:0 4px 8px 0;"><a href="${esc(link(v))}" target="_blank" style="display:inline-block;min-width:36px;padding:10px 0;text-align:center;border:1px solid ${a};border-radius:6px;color:${a};font-family:${font};font-size:16px;text-decoration:none;">${esc(label)}</a></td>`,
          )
          .join('')}</tr></table>`
      : choices
          .map(
            ([label, v]) =>
              `<a href="${esc(link(v))}" target="_blank" style="display:block;margin:0 0 8px;padding:10px 14px;border:1px solid ${a};border-radius:6px;color:${a};font-family:${font};font-size:16px;text-decoration:none;">${esc(label)}</a>`,
          )
          .join('')
    body = `<p style="margin:0 0 16px;color:${q};font-family:${font};font-size:20px;line-height:1.35;">${esc(plainLine(field.title))}</p>${btns}`
  } else {
    body = `<a href="${esc(url)}" target="_blank" style="display:inline-block;padding:12px 22px;border-radius:6px;background:${th.buttonColor};color:${th.buttonTextColor};font-family:${font};font-size:16px;font-weight:bold;text-decoration:none;">${esc(buttonText || 'Responder')}</a>`
  }

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:${bg};border-radius:10px;">
  <tr><td style="padding:28px 28px 20px;">
    <p style="margin:0 0 18px;color:${q};font-family:${font};font-size:14px;opacity:.75;">${esc(title)}</p>
    ${body}
  </td></tr>
</table>`
}

export default function EmbedPanel({ form, schema, url, toast }) {
  const [tab, setTab] = useState('email')
  const [buttonText, setButtonText] = useState('Responder')
  const [height, setHeight] = useState(600)
  const base = `${window.location.origin}${import.meta.env.BASE_URL}`
  const first = (schema?.fields || []).find((f) => !['statement', 'partial_submit', 'group'].includes(f.type))
  const firstIsFirst = schema?.fields?.[0]?.id === first?.id

  const codes = useMemo(
    () => ({
      site: `<iframe src="${url}" title="${esc(form.title)}" style="width:100%;height:${height}px;border:0;border-radius:8px;" allow="clipboard-write"></iframe>`,
      popup: `<button type="button" data-forms-popup="${url}">${esc(buttonText || 'Responder')}</button>\n<script src="${base}embed.js" defer></script>`,
      email: emailHtml({ url, title: form.title, field: firstIsFirst ? first : null, theme: schema?.theme, buttonText }),
    }),
    [url, form.title, height, buttonText, base, schema, first, firstIsFirst],
  )

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      toast('Código copiado.')
    } catch {
      toast('Não foi possível copiar. Selecione o código e copie.', 'err')
    }
  }
  const copyRich = async () => {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'text/html': new Blob([codes.email], { type: 'text/html' }), 'text/plain': new Blob([url], { type: 'text/plain' }) }),
      ])
      toast('Copiado. Cole no corpo do e-mail.')
    } catch {
      toast('Seu navegador não deixou copiar formatado. Use “Copiar HTML”.', 'err')
    }
  }

  return (
    <section className="ad-card ad-embed">
      <h2>Incorporar</h2>
      <div className="ad-tabs-sm ad-tabs-flush" role="tablist">
        {[
          ['email', 'E-mail'],
          ['site', 'Site'],
          ['popup', 'Botão com popup'],
        ].map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'is-on' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'email' && (
        <>
          <p className="ad-muted">
            {firstIsFirst && firstChoices(first)
              ? 'A primeira pergunta aparece no e-mail. Ao clicar numa resposta, o formulário abre com ela já marcada e a pessoa continua de lá.'
              : 'A primeira pergunta deste formulário não pode ser respondida dentro do e-mail, então o e-mail leva um botão para o formulário.'}{' '}
            Programas de e-mail não executam formulários, então tudo no e-mail é link.
          </p>
          {!(firstIsFirst && firstChoices(first)) && (
            <label className="ad-row">
              <span className="ad-row-label">Texto do botão</span>
              <input className="ad-input" value={buttonText} onChange={(e) => setButtonText(e.target.value)} />
            </label>
          )}
          <div className="ad-email-preview">
            <iframe title="Prévia do e-mail" sandbox="" style={{ height: firstIsFirst && firstChoices(first) ? 420 : 190 }} srcDoc={`<!doctype html><meta charset="utf-8"><body style="margin:0;padding:16px;background:#f4f4f6">${codes.email}</body>`} />
          </div>
          <div className="ad-embed-actions">
            <button className="ad-btn ad-btn-primary" onClick={copyRich}>
              <Icon name="copy" size={16} /> Copiar para colar no Gmail ou Outlook
            </button>
            <button className="ad-btn" onClick={() => copyText(codes.email)}>
              Copiar HTML
            </button>
          </div>
          <p className="ad-row-hint">“Copiar HTML” é para ferramentas de e-mail marketing, como Mailchimp ou RD Station. Se mudar a primeira pergunta, gere o código de novo.</p>
        </>
      )}

      {tab === 'site' && (
        <>
          <p className="ad-muted">Cole este código na página onde o formulário deve aparecer.</p>
          <label className="ad-row ad-row-inline">
            <span className="ad-row-label">Altura (px)</span>
            <input className="ad-input" type="number" min="300" step="50" value={height} onChange={(e) => setHeight(Number(e.target.value) || 600)} />
          </label>
          <pre className="ad-code">{codes.site}</pre>
          <div className="ad-embed-actions">
            <button className="ad-btn ad-btn-primary" onClick={() => copyText(codes.site)}>
              <Icon name="copy" size={16} /> Copiar código
            </button>
          </div>
        </>
      )}

      {tab === 'popup' && (
        <>
          <p className="ad-muted">Um botão no seu site que abre o formulário por cima da página.</p>
          <label className="ad-row">
            <span className="ad-row-label">Texto do botão</span>
            <input className="ad-input" value={buttonText} onChange={(e) => setButtonText(e.target.value)} />
          </label>
          <pre className="ad-code">{codes.popup}</pre>
          <div className="ad-embed-actions">
            <button className="ad-btn ad-btn-primary" onClick={() => copyText(codes.popup)}>
              <Icon name="copy" size={16} /> Copiar código
            </button>
          </div>
        </>
      )}
    </section>
  )
}
