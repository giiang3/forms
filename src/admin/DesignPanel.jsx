import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { FONTS, THEMES, loadFont, resolveTheme, backgroundStyle } from '../lib/themes'
import Icon from '../Icon'
import { Row, Select, Section, TextInput, Toggle } from './ui'

function ThemeCard({ theme, on, onPick, onDelete }) {
  const th = resolveTheme(theme)
  useEffect(() => loadFont(th.font), [th.font])
  return (
    <div className={`ad-theme ${on ? 'is-on' : ''}`}>
      <button type="button" className="ad-theme-btn" onClick={onPick} aria-pressed={on}>
        <span className="ad-theme-swatch" style={{ ...backgroundStyle(th), fontFamily: `'${th.font}', sans-serif` }}>
          {th.background.image && <span className="ad-theme-img" style={{ backgroundImage: `url("${th.background.image}")`, opacity: th.background.imageOpacity ?? 1 }} />}
          <span style={{ color: th.questionColor }}>Pergunta</span>
          <span style={{ color: th.answerColor }}>Resposta</span>
          <span className="ad-theme-pill" style={{ background: th.buttonColor, borderRadius: th.radius === 'pill' ? 99 : th.radius === 'sharp' ? 1 : 4 }} />
        </span>
        <span className="ad-theme-name">{th.name}</span>
      </button>
      {onDelete && (
        <button type="button" className="ad-icon-btn ad-theme-del" aria-label={`Excluir tema ${th.name}`} onClick={onDelete}>
          <Icon name="trash" size={14} />
        </button>
      )}
    </div>
  )
}

function Color({ label, value, onChange }) {
  return (
    <label className="ad-color">
      <input type="color" value={/^#[0-9a-f]{6}$/i.test(value || '') ? value : '#000000'} onChange={(e) => onChange(e.target.value)} />
      <span>{label}</span>
      <input className="ad-input ad-color-hex" value={value || ''} onChange={(e) => onChange(e.target.value)} maxLength={9} aria-label={`${label} (hex)`} />
    </label>
  )
}

export default function DesignPanel({ schema, onTheme, onSettings, toast }) {
  const [tab, setTab] = useState('gallery')
  const [mine, setMine] = useState([])
  const th = resolveTheme(schema.theme)
  const settings = schema.settings || {}

  const loadMine = () => supabase.from('themes').select('*').order('created_at', { ascending: false }).then(({ data }) => setMine(data || []))
  useEffect(() => {
    loadMine()
  }, [])

  const patch = (p) => onTheme({ ...th, ...p, id: th.id?.startsWith('custom') ? th.id : `custom-${th.id || 'tema'}` })
  const patchBg = (p) => patch({ background: { ...th.background, ...p } })

  const saveMine = async () => {
    const name = window.prompt('Nome do tema', th.name.endsWith('(meu)') ? th.name : `${th.name} (meu)`)
    if (!name) return
    const theme = { ...th, name, id: `mine-${Date.now()}` }
    const { error } = await supabase.from('themes').insert({ name, theme })
    if (error) toast('Não foi possível salvar o tema.', 'err')
    else {
      toast('Tema salvo em Meus temas.')
      onTheme(theme)
      loadMine()
      setTab('mine')
    }
  }

  return (
    <div className="ad-right-body ad-design">
      <div className="ad-tabs-sm" role="tablist">
        {[
          ['gallery', 'Galeria'],
          ['mine', 'Meus temas'],
          ['custom', 'Personalizar'],
        ].map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'is-on' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'gallery' && (
        <div className="ad-theme-grid">
          {THEMES.map((t) => (
            <ThemeCard key={t.id} theme={t} on={th.id === t.id} onPick={() => onTheme(t)} />
          ))}
        </div>
      )}

      {tab === 'mine' &&
        (mine.length === 0 ? (
          <p className="ad-note">Você ainda não salvou temas. Em Personalizar, ajuste um tema e salve para usar em outros formulários.</p>
        ) : (
          <div className="ad-theme-grid">
            {mine.map((m) => (
              <ThemeCard
                key={m.id}
                theme={m.theme}
                on={th.id === m.theme.id}
                onPick={() => onTheme(m.theme)}
                onDelete={async () => {
                  await supabase.from('themes').delete().eq('id', m.id)
                  loadMine()
                }}
              />
            ))}
          </div>
        ))}

      {tab === 'custom' && (
        <>
          <Section title="Texto">
            <Row label="Fonte">
              <Select value={th.font} onChange={(v) => patch({ font: v })} options={FONTS.map((f) => ({ value: f, label: f }))} />
            </Row>
            <Row label="Alinhamento">
              <Select value={th.align} onChange={(v) => patch({ align: v })} options={[{ value: 'left', label: 'À esquerda' }, { value: 'center', label: 'Centralizado' }]} />
            </Row>
          </Section>
          <Section title="Cores">
            <Color label="Perguntas" value={th.questionColor} onChange={(v) => patch({ questionColor: v })} />
            <Color label="Respostas" value={th.answerColor} onChange={(v) => patch({ answerColor: v })} />
            <Color label="Botões" value={th.buttonColor} onChange={(v) => patch({ buttonColor: v })} />
            <Color label="Texto dos botões" value={th.buttonTextColor} onChange={(v) => patch({ buttonTextColor: v })} />
            <Color label="Fundo" value={th.background.color} onChange={(v) => patchBg({ color: v })} />
          </Section>
          <Section title="Fundo">
            {th.background.css && <Toggle label="Manter desenho do tema" checked={!!th.background.css} onChange={(v) => !v && patchBg({ css: '' })} />}
            <Row label="Imagem de fundo (URL)">
              <TextInput value={th.background.image} onChange={(v) => patchBg({ image: v })} placeholder="https://…" />
            </Row>
            {th.background.image && (
              <Row label={`Opacidade da imagem: ${Math.round((th.background.imageOpacity ?? 1) * 100)}%`}>
                <input type="range" min="0.1" max="1" step="0.05" value={th.background.imageOpacity ?? 1} onChange={(e) => patchBg({ imageOpacity: Number(e.target.value) })} />
              </Row>
            )}
          </Section>
          <Section title="Botões">
            <Row label="Cantos">
              <Select value={th.radius} onChange={(v) => patch({ radius: v })} options={[{ value: 'sharp', label: 'Retos' }, { value: 'round', label: 'Arredondados' }, { value: 'pill', label: 'Cápsula' }]} />
            </Row>
          </Section>
          <button className="ad-btn ad-btn-block" onClick={saveMine}>
            Salvar em Meus temas
          </button>
        </>
      )}

      <Section title="Opções da tela" defaultOpen={false}>
        <Toggle label="Barra de progresso" checked={settings.showProgress !== false} onChange={(v) => onSettings({ showProgress: v })} />
        <Toggle label="Setas de navegação" checked={settings.showNav !== false} onChange={(v) => onSettings({ showNav: v })} />
        <Toggle label="Letras nas opções (A, B, C)" checked={settings.letters !== false} onChange={(v) => onSettings({ letters: v })} />
      </Section>
    </div>
  )
}
