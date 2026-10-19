// Google Calendar "add event" link (event template URL).
// dates: YYYYMMDDTHHmmSS/YYYYMMDDTHHmmSS in the ctz time zone, or YYYYMMDD/YYYYMMDD for all-day.

const pad = (n) => String(n).padStart(2, '0')

function compactDate(isoDate) {
  return (isoDate || '').replace(/-/g, '')
}

function nextDay(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + 1))
  return `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}`
}

export function googleCalendarUrl(cal, fill = (s) => s) {
  if (!cal?.date) return null
  let dates
  if (cal.allDay) {
    dates = `${compactDate(cal.date)}/${nextDay(cal.date)}`
  } else {
    const start = (cal.start || '09:00').replace(':', '')
    const end = (cal.end || cal.start || '10:00').replace(':', '')
    const endDate = cal.endDate || cal.date
    dates = `${compactDate(cal.date)}T${start}00/${compactDate(endDate)}T${end}00`
  }
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: fill(cal.title || 'Evento'),
    dates,
    ctz: cal.timezone || 'America/Sao_Paulo',
  })
  if (cal.details) params.set('details', fill(cal.details))
  if (cal.location) params.set('location', fill(cal.location))
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}
