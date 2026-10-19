// Theme gallery. Every theme is original to this app.
// background.css is a full CSS `background` value layered over background.color.

const blob = (x, y, color, size = '45%') => `radial-gradient(circle at ${x} ${y}, ${color} 0, transparent ${size})`

export const FONTS = [
  'Schibsted Grotesk', 'Manrope', 'Space Grotesk', 'Fraunces', 'Bricolage Grotesque', 'Lora',
  'Outfit', 'Playfair Display', 'Nunito', 'Libre Baskerville', 'Urbanist', 'Sora', 'Work Sans',
  'Karla', 'IBM Plex Sans', 'Rubik', 'Archivo', 'Lexend', 'Poppins', 'Cormorant Garamond',
  'Inter Tight', 'Montserrat', 'Quicksand', 'Chakra Petch',
]

const loaded = new Set()
export function loadFont(name) {
  if (!name || loaded.has(name)) return
  loaded.add(name)
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name).replace(/%20/g, '+')}:wght@400;700&display=swap`
  document.head.appendChild(link)
}

const t = (id, name, font, bg, q, a, btn, btnText, extra = {}) => ({
  id, name, font,
  background: { color: bg.color, css: bg.css || '', image: '', imageOpacity: 1 },
  questionColor: q, answerColor: a, buttonColor: btn, buttonTextColor: btnText,
  align: 'left', radius: 'round', ...extra,
})

export const THEMES = [
  t('aurora', 'Aurora', 'Manrope',
    { color: '#F2F0F6', css: `${blob('88%', '78%', 'rgba(232,74,152,.55)', '28%')}, ${blob('98%', '96%', 'rgba(64,190,230,.55)', '26%')}, ${blob('76%', '100%', 'rgba(255,170,90,.35)', '22%')}` },
    '#23202E', '#3B3266', '#23202E', '#FFFFFF'),
  t('papel', 'Papel', 'Schibsted Grotesk', { color: '#FFFFFF' }, '#1D1D22', '#2F3BD6', '#2F3BD6', '#FFFFFF'),
  t('grafite', 'Grafite', 'Space Grotesk', { color: '#1E1F24' }, '#F1F1F3', '#C3C7FF', '#F1F1F3', '#1E1F24'),
  t('ipe-rosa', 'Ipê rosa', 'Fraunces',
    { color: '#FFF3F7', css: `${blob('100%', '0%', 'rgba(214,51,132,.30)', '40%')}, ${blob('0%', '100%', 'rgba(214,51,132,.18)', '35%')}` },
    '#4A1036', '#B8195E', '#B8195E', '#FFFFFF'),
  t('ipe-amarelo', 'Ipê amarelo', 'Bricolage Grotesque', { color: '#FFD23F' }, '#2B2100', '#2B2100', '#2B2100', '#FFD23F', { radius: 'pill' }),
  t('cerrado', 'Cerrado', 'Lora',
    { color: '#E9DDC5', css: 'repeating-linear-gradient(135deg, rgba(138,75,18,.06) 0 2px, transparent 2px 14px)' },
    '#3B2A17', '#8A4B12', '#8A4B12', '#FFF6E8'),
  t('mar-de-minas', 'Mar de Minas', 'Outfit',
    { color: '#0E3B53', css: 'linear-gradient(160deg, #0E3B53 0%, #1C6E8C 100%)' },
    '#FFFFFF', '#9FE3F2', '#9FE3F2', '#0E3B53'),
  t('jabuticaba', 'Jabuticaba', 'Playfair Display', { color: '#2A0F2E', css: blob('85%', '15%', 'rgba(229,155,216,.18)', '40%') }, '#F6E8F4', '#E59BD8', '#E59BD8', '#2A0F2E'),
  t('pequi', 'Pequi', 'Nunito',
    { color: '#F6E7A6', css: `${blob('105%', '105%', 'rgba(94,122,18,.45)', '40%')}` },
    '#2E3B12', '#5E7A12', '#5E7A12', '#FFFBEA', { radius: 'pill' }),
  t('cafe', 'Café', 'Libre Baskerville', { color: '#3A2A20' }, '#F3E6D8', '#E1B382', '#E1B382', '#3A2A20'),
  t('lavanda', 'Lavanda', 'Urbanist', { color: '#ECE6FA', css: blob('0%', '0%', 'rgba(106,79,211,.18)', '45%') }, '#2E2350', '#6A4FD3', '#6A4FD3', '#FFFFFF'),
  t('coral', 'Coral', 'Sora', { color: '#FF7A5C' }, '#FFFFFF', '#FFF1EC', '#FFFFFF', '#C73E22'),
  t('musgo', 'Musgo', 'Work Sans', { color: '#1F3A2E' }, '#EAF2E3', '#A8D5A2', '#A8D5A2', '#1F3A2E'),
  t('areia', 'Areia', 'Karla', { color: '#F2E9DC' }, '#2D2A26', '#8C6A43', '#2D2A26', '#F2E9DC'),
  t('tinta', 'Tinta', 'IBM Plex Sans',
    { color: '#FFFFFF', css: 'linear-gradient(90deg, #0F1E5C 0 10px, transparent 10px)' },
    '#0F1E5C', '#0F1E5C', '#0F1E5C', '#FFFFFF', { radius: 'sharp' }),
  t('ceu', 'Céu', 'Rubik', { color: '#FFFFFF', css: 'linear-gradient(180deg, #CDE7FF 0%, #FFFFFF 70%)' }, '#13324F', '#1F6FD1', '#1F6FD1', '#FFFFFF'),
  t('brasa', 'Brasa', 'Archivo', { color: '#2B0A06', css: 'linear-gradient(200deg, #6E1A0E 0%, #2B0A06 70%)' }, '#FFE9DC', '#FF9D6B', '#FF9D6B', '#2B0A06'),
  t('menta', 'Menta', 'Lexend', { color: '#DFF5EC' }, '#0F3D2E', '#11946B', '#11946B', '#FFFFFF'),
  t('ameixa', 'Ameixa', 'Poppins',
    { color: '#5B2A86', css: `${blob('90%', '90%', 'rgba(255,120,200,.35)', '40%')}` },
    '#FFFFFF', '#FFD5F5', '#FFD5F5', '#5B2A86', { radius: 'pill' }),
  t('ouro-preto', 'Ouro Preto', 'Cormorant Garamond',
    { color: '#1A1712', css: blob('50%', '120%', 'rgba(217,180,91,.30)', '60%') },
    '#F5E9C8', '#D9B45B', '#D9B45B', '#1A1712', { align: 'center' }),
  t('concreto', 'Concreto', 'Inter Tight', { color: '#D9DADC' }, '#1B1C1E', '#1B1C1E', '#1B1C1E', '#D9DADC', { radius: 'sharp' }),
  t('por-do-sol', 'Pôr do sol', 'Montserrat',
    { color: '#FF8A7A', css: 'linear-gradient(160deg, #FFB86B 0%, #FF6F91 50%, #7A5CFF 100%)' },
    '#FFFFFF', '#FFFFFF', '#FFFFFF', '#7A2E5C'),
  t('algodao', 'Algodão', 'Quicksand',
    { color: '#FFF7F2', css: `${blob('8%', '12%', 'rgba(255,190,160,.45)', '30%')}, ${blob('95%', '88%', 'rgba(190,170,255,.45)', '32%')}` },
    '#3A2E39', '#B35C8A', '#3A2E39', '#FFF7F2', { radius: 'pill' }),
  t('neon', 'Neon', 'Chakra Petch', { color: '#0A0A23', css: 'linear-gradient(rgba(124,247,255,.06) 1px, transparent 1px) 0 0/100% 32px' }, '#FFFFFF', '#7CF7FF', '#7CF7FF', '#0A0A23', { radius: 'sharp' }),
]

export const DEFAULT_THEME = THEMES[0]

export function resolveTheme(theme) {
  return { ...DEFAULT_THEME, ...(theme || {}), background: { ...DEFAULT_THEME.background, ...(theme?.background || {}) } }
}

const RADIUS = { sharp: '2px', round: '8px', pill: '999px' }

/** CSS custom properties for a form screen. */
export function themeVars(theme) {
  const th = resolveTheme(theme)
  return {
    '--q': th.questionColor,
    '--a': th.answerColor,
    '--btn': th.buttonColor,
    '--btn-text': th.buttonTextColor,
    '--font': `'${th.font}', system-ui, sans-serif`,
    '--radius': RADIUS[th.radius] || RADIUS.round,
    '--bg': th.background.color,
    '--align': th.align === 'center' ? 'center' : 'left',
  }
}

export function backgroundStyle(theme) {
  const th = resolveTheme(theme)
  return {
    background: th.background.css ? `${th.background.css}, ${th.background.color}` : th.background.color,
  }
}
