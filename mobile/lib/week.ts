/**
 * Weeks run Sunday 00:00 → next Saturday 23:59:59 (local time).
 * At Sunday midnight the previous week is “archived” logically by `week_start` filtering.
 */

export function getWeekStartSunday(d = new Date()): Date {
  const date = new Date(d);
  const day = date.getDay(); // 0 = Sunday
  const diff = date.getDate() - day;
  const sunday = new Date(date);
  sunday.setDate(diff);
  sunday.setHours(0, 0, 0, 0);
  return sunday;
}

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDateKey(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatWeekLabel(weekStartKey: string): string {
  const start = parseDateKey(weekStartKey);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}`;
}
