import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { supabase, publicFormUrl } from '../lib/supabase'
import Icon from '../Icon'
import { Toggle, Row, TextArea } from './ui'
import EmbedPanel from './EmbedPanel'

// <input type="datetime-local"> works in local time without a zone
const toLocalInput = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function AutoClose({ form, onSave }) {
  const [closeAt, setCloseAt] = useState(toLocalInput(form.close_at))
  const [max, setMax] = useState(form.max_responses ?? '')
  const [msg, setMsg] = useState(form.closed_message ?? '')
  const [count, setCount] = useState(null)
  useEffect(() => {
    supabase.rpc('admin_form_counts').then(({ data }) => setCount(data?.find((r) => r.form_id === form.id)?.completed ?? 0))
  }, [form.id])

  const past = form.close_at && new Date(form.close_at) <= new Date()
  const full = form.max_responses && count != null && count >= form.max_responses

  return (
    <div className="ad-autoclose">
      <h3>Encerrar automaticamente</h3>
      <div className="ad-two">
        <Row label="Data e hora de encerramento" hint="Horário do seu computador.">
          <div className="ad-inline">
            <input
              className="ad-input"
              type="datetime-local"
              value={closeAt}
              onChange={(e) => setCloseAt(e.target.value)}
              onBlur={() => onSave({ close_at: closeAt ? new Date(closeAt).toISOString() : null })}
            />
            {closeAt && (
              <button
                type="button"
                className="ad-icon-btn"
                aria-label="Remover data"
                onClick={() => {
                  setCloseAt('')
                  onSave({ close_at: null })
                }}
              >
                <Icon name="close" size={16} />
              </button>
            )}
          </div>
        </Row>
        <Row label="Limite de respostas" hint={count != null ? `${count} respostas completas até agora.` : ' '}>
          <input
            className="ad-input"
            type="number"
            min="1"
            placeholder="Sem limite"
            value={max}
            onChange={(e) => setMax(e.target.value)}
            onBlur={() => onSave({ max_responses: Number(max) > 0 ? Math.floor(Number(max)) : null })}
          />
        </Row>
      </div>
      <Row label="Mensagem para quem chegar depois do encerramento" hint="Opcional. Sem mensagem, aparece um texto padrão conforme o motivo.">
        <TextArea rows={2} value={msg} onChange={setMsg} onBlur={() => onSave({ closed_message: msg.trim() || null })} placeholder="As inscrições foram encerradas. Dúvidas: …" />
      </Row>
      {(past || full) && !form.closed && (
        <p className="ad-note">{past ? 'A data de encerramento já passou: o formulário está encerrado.' : 'O limite de respostas foi atingido: o formulário está encerrado.'}</p>
      )}
    </div>
  )
}

export default function SharePanel({ form, schema, onForm, onPublish, dirty, toast }) {
  const url = publicFormUrl(form.slug)
  const canvas = useRef(null)
  const [slug, setSlug] = useState(form.slug)
  const [slugErr, setSlugErr] = useState('')

  useEffect(() => setSlug(form.slug), [form.slug])
  useEffect(() => {
    if (canvas.current) QRCode.toCanvas(canvas.current, url, { width: 220, margin: 1, color: { dark: '#171A26', light: '#FFFFFF' } })
  }, [url])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      toast('Link copiado.')
    } catch {
      toast('Não foi possível copiar. Selecione o link e copie.', 'err')
    }
  }

  const downloadPng = async () => {
    const data = await QRCode.toDataURL(url, { width: 1024, margin: 2 })
    const a = document.createElement('a')
    a.href = data
    a.download = `qrcode-${form.slug}.png`
    a.click()
  }
  const downloadSvg = async () => {
    const svg = await QRCode.toString(url, { type: 'svg', margin: 2 })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
    a.download = `qrcode-${form.slug}.svg`
    a.click()
  }

  const saveSlug = async () => {
    const s = slug.trim().toLowerCase()
    if (s === form.slug) return
    if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(s)) {
      setSlugErr('Use de 3 a 40 letras minúsculas, números ou hífen.')
      return
    }
    const { error } = await supabase.from('forms').update({ slug: s }).eq('id', form.id)
    if (error) setSlugErr(String(error.message).includes('duplicate') ? 'Esse endereço já está em uso.' : 'Não foi possível salvar.')
    else {
      setSlugErr('')
      onForm({ slug: s })
      toast('Endereço alterado. O link antigo deixou de funcionar.')
    }
  }

  const setFlag = async (patch) => {
    const { error } = await supabase.from('forms').update(patch).eq('id', form.id)
    if (error) toast('Não foi possível salvar.', 'err')
    else onForm(patch)
  }

  return (
    <div className="ad-share">
      <section className="ad-card">
        <h2>Situação</h2>
        {!form.published ? (
          <div className="ad-share-status">
            <p>O formulário ainda não foi publicado. Quem abrir o link vê “Formulário não encontrado”.</p>
            <button className="ad-btn ad-btn-primary" onClick={onPublish}>
              Publicar
            </button>
          </div>
        ) : (
          <>
            <div className="ad-share-status">
              <p>
                <span className={`ad-status ${form.closed || (form.close_at && new Date(form.close_at) <= new Date()) ? 'is-closed' : 'is-live'}`}>
                  {form.closed || (form.close_at && new Date(form.close_at) <= new Date()) ? 'Encerrado' : 'No ar'}
                </span>{' '}
                {dirty ? 'Há alterações que ainda não foram publicadas.' : 'Tudo publicado.'}
              </p>
              {dirty && (
                <button className="ad-btn ad-btn-primary" onClick={onPublish}>
                  Publicar alterações
                </button>
              )}
            </div>
            <Toggle label="Receber respostas" hint="Desligue para encerrar. O link passa a mostrar uma mensagem de encerrado." checked={!form.closed} onChange={(v) => setFlag({ closed: !v })} />
            <Toggle label="Link ativo" hint="Desligue para tirar o formulário do ar sem apagar nada." checked={form.published} onChange={(v) => setFlag({ published: v })} />
          </>
        )}
        <AutoClose form={form} onSave={setFlag} />
      </section>

      <section className="ad-card">
        <h2>Link</h2>
        <div className="ad-link-row">
          <input className="ad-input ad-link" value={url} readOnly onFocus={(e) => e.target.select()} aria-label="Link do formulário" />
          <button className="ad-btn ad-btn-primary" onClick={copy}>
            <Icon name="copy" size={16} /> Copiar
          </button>
          <a className="ad-btn" href={url} target="_blank" rel="noopener noreferrer">
            <Icon name="globe" size={16} /> Abrir
          </a>
        </div>
        <label className="ad-row">
          <span className="ad-row-label">Final do endereço</span>
          <div className="ad-slug-row">
            <span className="ad-muted">…/#/f/</span>
            <input className="ad-input" value={slug} onChange={(e) => setSlug(e.target.value)} onBlur={saveSlug} onKeyDown={(e) => e.key === 'Enter' && saveSlug()} />
          </div>
          {slugErr ? <small className="ad-error">{slugErr}</small> : <small className="ad-row-hint">Ao mudar, o link e o QR code antigos param de funcionar.</small>}
        </label>
      </section>

      <section className="ad-card ad-qr-card">
        <h2>QR code</h2>
        <canvas ref={canvas} className="ad-qr" aria-label="QR code do link" />
        <div className="ad-qr-actions">
          <button className="ad-btn" onClick={downloadPng}>
            <Icon name="download" size={16} /> PNG
          </button>
          <button className="ad-btn" onClick={downloadSvg}>
            <Icon name="download" size={16} /> SVG
          </button>
        </div>
      </section>

      <EmbedPanel form={form} schema={schema} url={url} toast={toast} />
    </div>
  )
}
