// Time formatting helpers — used wherever we render schedule times or
// clock-in/out values so the whole app stays in 12-hour AM/PM format.

/**
 * Converts "HH:mm" (24-hour) to "h:mm AM/PM". Returns the input
 * unchanged if it can't be parsed.
 *
 *   formatTime12("15:30") → "3:30 PM"
 *   formatTime12("08:00") → "8:00 AM"
 *   formatTime12("00:15") → "12:15 AM"
 */
export function formatTime12(hhmm: string): string {
  if (!hhmm) return '';
  const [hStr, mStr] = hhmm.split(':');
  if (!hStr || !mStr) return hhmm;
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const period = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m.toString().padStart(2, '0')} ${period}`;
}

/** ISO timestamp → "h:mm AM/PM" in the browser's local timezone. */
export function formatTimestamp12(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Summarize the LUNCH breaks on a shift. Pulls only `break_type = 'lunch'`
 * entries (regular breaks are excluded) and returns:
 *   - range: one "h:mm AM/PM – h:mm AM/PM" string per lunch, joined by '\n'
 *   - duration: total lunch time formatted as "H:MM"
 * Returns null when there's no lunch on the shift.
 *
 * Used by the on-screen Time Tracking table and the printable Time Card PDF
 * so they show the same thing.
 */
export interface BreakSummaryInput {
  type: 'break' | 'lunch';
  startTime: string;
  endTime?: string;
}

export function summarizeLunch(
  breaks: BreakSummaryInput[],
): { range: string; duration: string } | null {
  const lunches = breaks.filter((b) => b.type === 'lunch');
  if (lunches.length === 0) return null;

  const rangeLines = lunches.map((l) => {
    const start = formatTimestamp12(l.startTime);
    const end = l.endTime ? formatTimestamp12(l.endTime) : 'ongoing';
    return `${start} – ${end}`;
  });

  const totalMs = lunches.reduce((sum, l) => {
    const end = l.endTime ? new Date(l.endTime).getTime() : Date.now();
    return sum + Math.max(0, end - new Date(l.startTime).getTime());
  }, 0);

  const totalMinutes = Math.floor(totalMs / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const durationStr = `${h}:${m.toString().padStart(2, '0')}`;

  return {
    range: rangeLines.join('\n'),
    duration: durationStr,
  };
}
