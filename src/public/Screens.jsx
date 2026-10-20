import { useEffect } from 'react'
import Icon from '../Icon'
import { backgroundStyle, loadFont, resolveTheme, themeVars } from '../lib/themes'
import { recall, recallHtml, estimateMinutes } from '../lib/fields'
import { richHtml, plainLine } from '../lib/rich'
import { googleCalendarUrl } from '../lib/calendar'
import { downloadReceipt, receiptItems } from '../lib/receipt'
import {
  ShortText, LongText, TextLine, PhoneInput, NumberInput, DateInput, SubfieldsInput, ChoiceInput,
  DropdownInput, PictureChoice, BoolInput, ScaleInput, RatingInput, RankingInput, MatrixInput, SignatureInput,
} from './inputs'

export function FormFrame({ theme, children, className = '', style }) {
  const th = resolveTheme(theme)
  useEffect(() => loadFont(th.font), [th.font])
  return (
    <div className={`fr ${th.align === 'center' ? 'fr-center' : ''} ${className}`} style={{ ...themeVars(th), ...backgroundStyle(th), ...style }}>
      {th.background.image && (
        <div className="fr-bgimg" style={{ backgroundImage: `url("${th.background.image}")`, opacity: th.background.imageOpacity ?? 1 }} />
      )}
      {children}
    </div>
  )
}

export function FieldInput({ field, value, onChange, onEnter, onAutoAdvance, autoFocus, letters, active }) {
  const common = { field, value, onChange, onEnter, autoFocus }
  switch (field.type) {
    case 'short_text':
      return <ShortText {...common} />
    case 'long_text':
      return <LongText {...common} />
    case 'email':
      return <TextLine type="email" inputMode="email" value={value} onChange={onChange} onEnter={onEnter} autoFocus={autoFocus} placeholder={field.props?.placeholder} ariaLabel={plainLine(field.title)} />
    case 'website':
      return <TextLine type="url" inputMode="url" value={value} onChange={onChange} onEnter={onEnter} autoFocus={autoFocus} placeholder={field.props?.placeholder} ariaLabel={plainLine(field.title)} />
    case 'phone':
      return <PhoneInput {...common} />
    case 'number':
      return <NumberInput {...common} />
    case 'date':
      return <DateInput {...common} />
    case 'contact_info':
      return <SubfieldsInput {...common} kind="contact" />
    case 'address':
      return <SubfieldsInput {...common} kind="address" />
    case 'multiple_choice':
    case 'checkbox':
      return <ChoiceInput {...common} onAutoAdvance={onAutoAdvance} letters={letters} active={active} />
    case 'dropdown':
      return <DropdownInput {...common} onAutoAdvance={onAutoAdvance} />
    case 'picture_choice':
      return <PictureChoice {...common} onAutoAdvance={onAutoAdvance} letters={letters} />
    case 'yes_no':
    case 'legal':
      return <BoolInput {...common} onAutoAdvance={onAutoAdvance} active={active} />
    case 'nps':
    case 'opinion_scale':
      return <ScaleInput {...common} onAutoAdvance={onAutoAdvance} />
    case 'rating':
      return <RatingInput {...common} onAutoAdvance={onAutoAdvance} />
    case 'ranking':
      return <RankingInput {...common} />
    case 'matrix':
      return <MatrixInput {...common} />
    case 'signature':
      return <SignatureInput {...common} />
    default:
      return null
  }
}

/** Renders stored rich text (already sanitized) as HTML. */
export function Rich({ as: Tag = 'span', html, className, fallback = null }) {
  if (!html) return fallback
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />
}

function Title({ number, html, required, small }) {
  return (
    <div className={`fr-q-head ${small ? 'is-small' : ''}`}>
      {number != null && (
        <span className="fr-q-num">
          {number}
          <span aria-hidden="true">→</span>
        </span>
      )}
      <h2 className="fr-q-title">
        {html ? <span className="fr-rich" dangerouslySetInnerHTML={{ __html: html }} /> : <span className="fr-muted">Sem título</span>}
        {required && <span aria-label="obrigatória"> *</span>}
      </h2>
    </div>
  )
}

/**
 * One screen for a top-level field. For groups, renders children stacked.
 * answers / setAnswer / errors are keyed by field id.
 */
export function FieldScreen({ field, number, answers, setAnswer, errors = {}, onNext, onAutoAdvance, fieldsById, letters = true, active = true, busy, isLast }) {
  const t = (s) => recallHtml(s, answers, fieldsById)
  const isGroup = field.type === 'group'
  const isStatement = field.type === 'statement'
  const err = errors[field.id]
  const btnLabel = isStatement || isGroup ? field.props?.buttonText || 'Continuar' : isLast ? 'Enviar' : 'OK'

  return (
    <div className="fr-q">
      <Title number={isStatement ? null : number} html={t(field.title)} required={field.required && !isGroup} />
      <Rich as="p" className="fr-q-desc" html={t(field.description)} />
      {field.image && <img className="fr-q-img" src={field.image} alt="" />}

      {isGroup ? (
        <div className="fr-group">
          {(field.children || []).map((c, i) => (
            <div key={c.id} className="fr-group-item">
              <Title number={`${number}${String.fromCharCode(97 + i)}`} html={t(c.title)} required={c.required && c.type !== 'statement'} small />
              <Rich as="p" className="fr-q-desc" html={t(c.description)} />
              {c.image && <img className="fr-q-img" src={c.image} alt="" />}
              <FieldInput
                field={c}
                value={answers[c.id]}
                onChange={(v) => setAnswer(c.id, v)}
                onEnter={i === field.children.length - 1 ? onNext : undefined}
                autoFocus={active && i === 0}
                letters={false}
                active={false}
              />
              {errors[c.id] && <ErrorTip text={errors[c.id]} />}
            </div>
          ))}
        </div>
      ) : (
        !isStatement && (
          <div className="fr-q-input">
            <FieldInput
              field={field}
              value={answers[field.id]}
              onChange={(v) => setAnswer(field.id, v)}
              onEnter={onNext}
              onAutoAdvance={onAutoAdvance}
              autoFocus={active}
              letters={letters}
              active={active}
            />
          </div>
        )
      )}

      {err ? (
        <ErrorTip text={err} />
      ) : (
        <div className="fr-actions">
          <button type="button" className="fr-btn" onClick={onNext} disabled={busy}>
            {busy ? 'Enviando…' : btnLabel}
            {!busy && btnLabel === 'OK' && <Icon name="ok" size={16} stroke={2.6} />}
          </button>
          {field.type !== 'long_text' && <span className="fr-press">pressione <b>Enter ↵</b></span>}
        </div>
      )}
    </div>
  )
}

function ErrorTip({ text }) {
  return (
    <div className="fr-error" role="alert">
      <span aria-hidden="true">!</span>
      {text}
    </div>
  )
}

export function WelcomeScreen({ welcome, fields, count, onStart }) {
  const mins = estimateMinutes(fields)
  return (
    <div className="fr-q fr-welcome">
      {welcome.image && <img className="fr-q-img fr-welcome-img" src={welcome.image} alt="" />}
      <Rich as="h1" className="fr-welcome-title" html={richHtml(welcome.title) || 'Olá!'} />
      <Rich as="p" className="fr-q-desc" html={richHtml(welcome.description)} />
      <div className="fr-actions">
        <button type="button" className="fr-btn fr-btn-lg" onClick={onStart} autoFocus>
          {welcome.buttonText || 'Começar'}
        </button>
        <span className="fr-press">pressione <b>Enter ↵</b></span>
      </div>
      {(welcome.showTime || (welcome.showCount && count > 0)) && (
        <p className="fr-meta">
          {welcome.showTime && (
            <span>
              <Icon name="calendar" size={14} /> Leva {mins} {mins === 1 ? 'minuto' : 'minutos'}
            </span>
          )}
          {welcome.showCount && count > 0 && (
            <span>
              <Icon name="contact" size={14} /> {count} {count === 1 ? 'pessoa já respondeu' : 'pessoas já responderam'}
            </span>
          )}
        </p>
      )}
    </div>
  )
}

export function EndingScreen({ ending, answers, fieldsById, receipt, schema, formTitle, preview }) {
  const t = (s) => recall(s, answers || {}, fieldsById)
  const cal = ending?.calendar?.enabled ? googleCalendarUrl(ending.calendar, t) : null
  const showReceipt = ending?.receipt?.enabled !== false && receipt?.protocol && schema
  const getReceipt = () =>
    downloadReceipt({
      title: formTitle || document.title,
      protocol: receipt.protocol,
      submittedAt: receipt.submittedAt,
      items: receiptItems(schema, answers || {}),
      url: preview ? '' : window.location.href.split('?')[0],
    })
  return (
    <div className="fr-q fr-ending">
      <Rich as="h1" className="fr-welcome-title" html={recallHtml(ending?.title, answers || {}, fieldsById) || 'Obrigado!'} />
      <Rich as="p" className="fr-q-desc" html={recallHtml(ending?.description, answers || {}, fieldsById)} />
      {showReceipt && (
        <p className="fr-protocol">
          Protocolo <b>{receipt.protocol}</b>
        </p>
      )}
      {(cal || showReceipt || (ending?.buttonText && ending?.buttonUrl)) && (
        <div className="fr-actions fr-actions-end">
          {showReceipt && (
            <button type="button" className="fr-btn" onClick={getReceipt}>
              <Icon name="download" size={16} /> Baixar comprovante
            </button>
          )}
          {cal && (
            <a className={`fr-btn ${showReceipt ? 'fr-btn-ghost' : ''}`} href={cal} target="_blank" rel="noopener noreferrer">
              <Icon name="calendar" size={16} /> Adicionar ao Google Agenda
            </a>
          )}
          {ending?.buttonText && ending?.buttonUrl && (
            <a className="fr-btn fr-btn-ghost" href={ending.buttonUrl} target="_blank" rel="noopener noreferrer">
              {ending.buttonText}
            </a>
          )}
        </div>
      )}
      {ending?.redirectUrl && <p className="fr-hint">Você vai ser redirecionado em instantes…</p>}
    </div>
  )
}
