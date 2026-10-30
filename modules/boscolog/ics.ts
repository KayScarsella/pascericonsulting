export type IcsEvent = {
  dateStr: string // YYYYMMDD
  summary: string
  description: string
  uid?: string
}

function icsEscape(s: string): string {
  return String(s || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

export function buildScadenzarioIcs(events: IcsEvent[]): string {
  let ics =
    'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//BoscoLog//Scadenzario//IT\r\nCALSCALE:GREGORIAN\r\n'
  for (const ev of events) {
    const uid =
      ev.uid ?? `boscolog-${Math.random().toString(16).slice(2)}@pascericonsulting`
    ics += 'BEGIN:VEVENT\r\n'
    ics += `DTSTART;VALUE=DATE:${ev.dateStr}\r\n`
    ics += `DTEND;VALUE=DATE:${ev.dateStr}\r\n`
    ics += `SUMMARY:${icsEscape(ev.summary)}\r\n`
    ics += `DESCRIPTION:${icsEscape(ev.description)}\r\n`
    ics += `UID:${uid}\r\n`
    ics +=
      'BEGIN:VALARM\r\nTRIGGER:-P7D\r\nACTION:DISPLAY\r\nDESCRIPTION:Scadenza tra 7 giorni\r\nEND:VALARM\r\n'
    ics += 'END:VEVENT\r\n'
  }
  ics += 'END:VCALENDAR\r\n'
  return ics
}

export function toIcsDateStr(isoDate: string): string | null {
  const s = isoDate.replace(/-/g, '')
  return s.length === 8 ? s : null
}
