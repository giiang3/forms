import { useEffect } from 'react'
import Icon from '../Icon'
import { backgroundStyle, loadFont, resolveTheme, themeVars } from '../lib/themes'
import { recall, estimateMinutes } from '../lib/fields'
import { googleCalendarUrl } from '../lib/calendar'
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
      return <TextLine type="email" inputMode="email" value={value} onChange={onChange} onEnter={onEnter} autoFocus={autoFocus} placeholder={field.props?.placeholder} ariaLabel={field.title} />
    case 'website':
      return <TextLine type="url" inputMode="url" value={value} onChange={onChange} onEnter={onEnter} autoFocus={autoFocus} placeholder={field.props?.placeholder} ariaLabel={field.title} />
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

function Title({ number, text, required, small }) {
  return (
    <div className={`fr-q-head ${small ? 'is-small' : ''}`}>
      {number != null && (
        <span className="fr-q-num">
          {number}
          <span aria-hidden="true">→</span>
        </span>
      )}
      <h2 className="fr-q-title">
        {text || <span className="fr-muted">Sem título</span>}
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
  const t = (s) => recall(s, answers, fieldsById)
  const isGroup = field.type === 'group'
  const isStatement = field.type === 'statement'
  const err = errors[field.id]
  const btnLabel = isStatement || isGroup ? field.props?.buttonText || 'Continuar' : isLast ? 'Enviar' : 'OK'

  return (
    <div className="fr-q">
      <Title number={isStatement ? null : number} text={t(field.title)} required={field.required && !isGroup} />
      {field.description && <p className="fr-q-desc">{t(field.description)}</p>}
      {field.image && <img className="fr-q-img" src={field.image} alt="" />}

      {isGroup ? (
        <div className="fr-group">
          {(field.children || []).map((c, i) => (
            <div key={c.id} className="fr-group-item">
              <Title number={`${number}${String.fromCharCode(97 + i)}`} text={t(c.title)} required={c.required && c.type !== 'statement'} small />
              {c.description && <p className="fr-q-desc">{t(c.description)}</p>}
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
      <h1 className="fr-welcome-title">{welcome.title || 'Olá!'}</h1>
      {welcome.description && <p className="fr-q-desc">{welcome.description}</p>}
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

export function EndingScreen({ ending, answers, fieldsById }) {
  const t = (s) => recall(s, answers || {}, fieldsById)
  const cal = ending?.calendar?.enabled ? googleCalendarUrl(ending.calendar, t) : null
  return (
    <div className="fr-q fr-ending">
      <h1 className="fr-welcome-title">{t(ending?.title) || 'Obrigado!'}</h1>
      {ending?.description && <p className="fr-q-desc">{t(ending.description)}</p>}
      {(cal || (ending?.buttonText && ending?.buttonUrl)) && (
        <div className="fr-actions fr-actions-end">
          {cal && (
            <a className="fr-btn" href={cal} target="_blank" rel="noopener noreferrer">
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
