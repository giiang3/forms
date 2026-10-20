import { useEffect, useRef, useState } from 'react'
import { richHtml, sanitizeRich, safeHref } from '../lib/rich'

/**
 * Inline editor for titles and descriptions. Select text to get the formatting bar.
 * Shortcuts: Ctrl/Cmd + B, I, U, K. Enter breaks the line. Paste comes in as plain text.
 */
export function RichEditor({ value, onChange, className, placeholder }) {
  const ref = useRef(null)
  const last = useRef(null)

  // Only write to the DOM when the value changed from outside, so the caret stays put
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (value === last.current) return
    el.innerHTML = richHtml(value)
    last.current = value
  }, [value])

  const emit = () => {
    const el = ref.current
    if (!el) return
    const html = sanitizeRich(el.innerHTML)
    if (!html && el.innerHTML !== '') {
      // Leave no stray <br> so the placeholder shows again
      if (!el.textContent.trim()) el.innerHTML = ''
    }
    last.current = html
    onChange(html)
  }

  const onKeyDown = (e) => {
    const mod = e.metaKey || e.ctrlKey
    if (e.key === 'Enter' && !e.shiftKey && !mod) {
      e.preventDefault()
      if (!document.execCommand('insertLineBreak')) document.execCommand('insertHTML', false, '<br>')
      emit()
      return
    }
    if (mod && ['b', 'i', 'u'].includes(e.key.toLowerCase())) {
      e.preventDefault()
      format({ b: 'bold', i: 'italic', u: 'underline' }[e.key.toLowerCase()])
      emit()
      return
    }
    if (mod && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      addLink()
      emit()
    }
  }

  const onPaste = (e) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, text)
    emit()
  }

  return (
    <div
      ref={ref}
      className={`ad-rich ${className || ''}`}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      aria-label={placeholder}
      data-placeholder={placeholder}
      onInput={emit}
      onBlur={emit}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
    />
  )
}

function format(cmd) {
  document.execCommand('styleWithCSS', false, false)
  document.execCommand(cmd, false, null)
}

function addLink(saved) {
  const sel = window.getSelection()
  const range = saved || (sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null)
  const current = sel.anchorNode?.parentElement?.closest?.('a')?.getAttribute('href') || ''
  const input = window.prompt('Endereço do link (deixe vazio para remover)', current || 'https://')
  if (range) {
    sel.removeAllRanges()
    sel.addRange(range)
  }
  if (input === null) return
  if (!input.trim() || input.trim() === 'https://') {
    document.execCommand('unlink')
    return
  }
  const href = safeHref(input)
  if (!href) {
    window.alert('Use um endereço que comece com https://, mailto: ou tel:')
    return
  }
  document.execCommand('createLink', false, href)
}

/** Floating bar shown above a text selection inside any .ad-rich editor. */
export function RichToolbar() {
  const [pos, setPos] = useState(null)
  const [state, setState] = useState({})
  const savedRange = useRef(null)

  useEffect(() => {
    const update = () => {
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return setPos(null)
      const node = sel.anchorNode?.nodeType === 3 ? sel.anchorNode.parentElement : sel.anchorNode
      const editor = node?.closest?.('.ad-rich')
      if (!editor || !editor.contains(sel.focusNode)) return setPos(null)
      const r = sel.getRangeAt(0).getBoundingClientRect()
      if (!r.width && !r.height) return setPos(null)
      savedRange.current = sel.getRangeAt(0).cloneRange()
      setPos({ x: r.left + r.width / 2, y: r.top })
      setState({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        link: !!node.closest('a'),
      })
    }
    document.addEventListener('selectionchange', update)
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      document.removeEventListener('selectionchange', update)
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [])

  if (!pos) return null

  const run = (fn) => (e) => {
    e.preventDefault()
    const editor = savedRange.current?.commonAncestorContainer
    fn()
    // Let the editor save the new HTML
    const el = (editor?.nodeType === 3 ? editor.parentElement : editor)?.closest?.('.ad-rich')
    el?.dispatchEvent(new Event('input', { bubbles: true }))
    const sel = window.getSelection()
    if (sel.rangeCount) {
      setState({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        link: !!(sel.anchorNode?.nodeType === 3 ? sel.anchorNode.parentElement : sel.anchorNode)?.closest?.('a'),
      })
    }
  }

  const top = Math.max(8, pos.y - 46)
  return (
    <div className="ad-rtb" style={{ left: pos.x, top }} role="toolbar" aria-label="Formatação" onMouseDown={(e) => e.preventDefault()}>
      <button type="button" className={state.bold ? 'is-on' : ''} aria-pressed={!!state.bold} title="Negrito (Ctrl+B)" onMouseDown={run(() => format('bold'))}>
        <b>N</b>
      </button>
      <button type="button" className={state.italic ? 'is-on' : ''} aria-pressed={!!state.italic} title="Itálico (Ctrl+I)" onMouseDown={run(() => format('italic'))}>
        <i>I</i>
      </button>
      <button type="button" className={state.underline ? 'is-on' : ''} aria-pressed={!!state.underline} title="Sublinhado (Ctrl+U)" onMouseDown={run(() => format('underline'))}>
        <u>S</u>
      </button>
      <span className="ad-rtb-sep" />
      <button type="button" className={state.link ? 'is-on' : ''} title="Link (Ctrl+K)" onMouseDown={run(() => addLink(savedRange.current))}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
          <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
        </svg>
      </button>
      <button type="button" title="Limpar formatação" onMouseDown={run(() => { format('removeFormat'); document.execCommand('unlink') })}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 5h12M12 5l-3 14M4 19l16-14" />
        </svg>
      </button>
    </div>
  )
}
